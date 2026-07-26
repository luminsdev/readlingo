"use client";

import Link from "next/link";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Copy,
  LoaderCircle,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { Fragment, useEffect, type ReactNode } from "react";

import {
  getReaderAiStreamingCursorTarget,
  shouldShowReaderAiContext,
} from "@/components/reader/reader-ai-panel-utils";
import { getHighlightedExampleSegments } from "@/components/reader/reader-workspace-utils";
import { PronounceTextButton } from "@/components/speech/pronounce-text-button";
import type {
  DeepActionUiState,
  DeepActionUiStates,
  StreamingDeepActionResultByAction,
} from "@/lib/ai-deep-action-streaming";
import type { StreamingExplanationPayload } from "@/lib/ai-streaming";
import type { DeepAction } from "@/lib/ai-validation";
import { isSpeechTextEligible } from "@/lib/speech";
import { getVocabularyReencounterCue } from "@/lib/vocabulary-match";
import type { WordExplanationPayload } from "@/types";

type AiPanelState = "idle" | "loading" | "ready" | "error";

type PopoverPosition = {
  top: number;
  left: number;
};

type VocabularySaveState = "idle" | "saving" | "saved" | "alreadySaved";

export type ExistingVocabulary = {
  id: string;
  word: string;
  definition: string;
  explanation: string | null;
  exampleSentence: string | null;
  srsData: {
    interval: number;
    nextReviewAt: string;
  } | null;
};

const DEEP_ACTION_LABELS = {
  structure: "Structure",
  compare: "Compare",
  easierExamples: "Easier examples",
  conjugation: "Conjugation",
  collocation: "Collocations",
} satisfies Record<DeepAction, string>;

const REENCOUNTER_CUE_LABELS = {
  due: "Due",
  learning: "Learning",
  mastered: "Mastered",
} as const;

function getBriefExplanation(explanation: string | undefined) {
  if (!explanation) {
    return "";
  }

  if (explanation.length <= 140) {
    return explanation;
  }

  return `${explanation.slice(0, 137).trimEnd()}...`;
}

function getDifficultyBadgeClass(
  difficultyHint: WordExplanationPayload["difficultyHint"],
) {
  if (difficultyHint === "beginner") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (difficultyHint === "intermediate") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300";
  }

  return "border-line-strong bg-surface-strong text-ink-soft";
}

function renderHighlightedExampleSentence(
  sentence: string,
  selectedText: string | null,
) {
  const segments = getHighlightedExampleSegments(sentence, selectedText);

  if (!segments.some((segment) => segment.isHighlighted)) {
    return sentence;
  }

  return segments.map((segment, index) => {
    if (segment.isHighlighted) {
      return (
        <strong
          key={`${segment.text}-${index}`}
          className="text-foreground font-semibold"
        >
          {segment.text}
        </strong>
      );
    }

    return <Fragment key={`${segment.text}-${index}`}>{segment.text}</Fragment>;
  });
}

function StreamingCursor() {
  return (
    <span
      aria-hidden="true"
      className="bg-foreground/70 ml-1 inline-block h-[1em] w-2 animate-pulse rounded-full align-[-0.12em]"
    />
  );
}

function DeepActionResult({
  action,
  state,
  onRetry,
}: {
  action: DeepAction;
  state: DeepActionUiState;
  onRetry: () => void;
}) {
  const errorContent =
    state.status === "error" ? (
      <div
        className="space-y-2 border border-red-200/50 bg-red-50/50 p-4 dark:border-red-900/30 dark:bg-red-950/20"
        role="alert"
      >
        <p className="text-xs leading-relaxed text-red-800 dark:text-red-300">
          {state.errorMessage}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="focus-visible:ring-ring rounded-sm text-[10px] font-medium tracking-widest text-red-900 uppercase underline decoration-red-900/30 underline-offset-4 focus-visible:ring-2 focus-visible:outline-none dark:text-red-400 dark:decoration-red-400/30"
        >
          Retry {DEEP_ACTION_LABELS[action]}
        </button>
      </div>
    ) : null;

  const result = state.result;

  if (!result) {
    return (
      errorContent ??
      (state.status === "loading" ? (
        <p
          className="text-ink-muted flex items-center gap-2 text-xs"
          role="status"
        >
          <LoaderCircle className="size-3.5 animate-spin" />
          Preparing {DEEP_ACTION_LABELS[action].toLowerCase()}...
        </p>
      ) : null)
    );
  }

  if (result.notApplicable) {
    return (
      <div className="space-y-3">
        <p className="text-ink-muted border-line border-l pl-4 text-xs leading-relaxed italic">
          {result.reason}
        </p>
        {errorContent}
      </div>
    );
  }

  let content: ReactNode = null;

  if (action === "structure") {
    const structure = result as StreamingDeepActionResultByAction["structure"];

    content = (
      <dl className="space-y-3">
        {structure.pattern ? (
          <div className="space-y-1">
            <dt className="text-ink-kicker text-[9px] font-medium tracking-[0.18em] uppercase">
              Pattern
            </dt>
            <dd className="text-ink-soft text-xs leading-relaxed">
              {structure.pattern}
            </dd>
          </div>
        ) : null}
        {structure.role ? (
          <div className="space-y-1">
            <dt className="text-ink-kicker text-[9px] font-medium tracking-[0.18em] uppercase">
              Role
            </dt>
            <dd className="text-ink-soft text-xs leading-relaxed">
              {structure.role}
            </dd>
          </div>
        ) : null}
        {structure.whyHere ? (
          <div className="space-y-1">
            <dt className="text-ink-kicker text-[9px] font-medium tracking-[0.18em] uppercase">
              Why here
            </dt>
            <dd className="text-ink-soft text-xs leading-relaxed">
              {structure.whyHere}
            </dd>
          </div>
        ) : null}
        {structure.pitfall ? (
          <div className="space-y-1">
            <dt className="text-ink-kicker text-[9px] font-medium tracking-[0.18em] uppercase">
              Pitfall
            </dt>
            <dd className="text-ink-muted text-xs leading-relaxed italic">
              {structure.pitfall}
            </dd>
          </div>
        ) : null}
      </dl>
    );
  } else if (action === "compare") {
    const comparison = result as StreamingDeepActionResultByAction["compare"];

    content = (
      <div className="space-y-4">
        {comparison.alternative ? (
          <div className="space-y-1">
            <p className="text-ink-kicker text-[9px] font-medium tracking-[0.18em] uppercase">
              Alternative
            </p>
            <p className="text-foreground font-serif text-sm leading-relaxed">
              {comparison.alternative}
            </p>
          </div>
        ) : null}
        {comparison.contrast ? (
          <div className="space-y-1">
            <p className="text-ink-kicker text-[9px] font-medium tracking-[0.18em] uppercase">
              Contrast
            </p>
            <p className="text-ink-soft text-xs leading-relaxed">
              {comparison.contrast}
            </p>
          </div>
        ) : null}
        {comparison.tip ? (
          <p className="text-ink-muted border-quote/60 border-l pl-3 text-xs leading-relaxed italic">
            {comparison.tip}
          </p>
        ) : null}
      </div>
    );
  } else if (action === "easierExamples") {
    const easierExamples =
      result as StreamingDeepActionResultByAction["easierExamples"];

    content = (
      <div className="space-y-4">
        {easierExamples.examples?.map((example, index) => (
          <div
            key={`${example.sentence}-${example.translation}-${index}`}
            className="border-quote/60 border-l pl-4"
          >
            {example.sentence ? (
              <p className="text-ink-soft font-serif text-sm leading-relaxed italic">
                {example.sentence}
              </p>
            ) : null}
            {example.translation ? (
              <p className="text-ink-muted mt-1 text-xs leading-relaxed">
                {example.translation}
              </p>
            ) : null}
          </div>
        ))}
        {easierExamples.note ? (
          <p className="text-ink-muted text-xs leading-relaxed italic">
            {easierExamples.note}
          </p>
        ) : null}
      </div>
    );
  } else if (action === "conjugation") {
    const conjugation =
      result as StreamingDeepActionResultByAction["conjugation"];

    content = (
      <div className="space-y-4">
        {conjugation.lemma ? (
          <div className="space-y-1">
            <p className="text-ink-kicker text-[9px] font-medium tracking-[0.18em] uppercase">
              Lemma
            </p>
            <p className="text-foreground font-serif text-sm leading-relaxed">
              {conjugation.lemma}
            </p>
          </div>
        ) : null}
        {(conjugation.forms?.length ?? 0) > 0 ? (
          <div className="border-line divide-line divide-y border-y">
            {conjugation.forms?.map((form, index) => (
              <div
                key={`${form.label}-${form.value}-${index}`}
                className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 py-2.5 text-xs leading-relaxed"
              >
                <p className="text-ink-muted">{form.label}</p>
                <p className="text-ink-soft font-medium">{form.value}</p>
              </div>
            ))}
          </div>
        ) : null}
        {conjugation.note ? (
          <p className="text-ink-muted border-quote/60 border-l pl-3 text-xs leading-relaxed italic">
            {conjugation.note}
          </p>
        ) : null}
      </div>
    );
  } else if (action === "collocation") {
    const collocation =
      result as StreamingDeepActionResultByAction["collocation"];

    content = (
      <div className="space-y-4">
        {collocation.items?.map((item, index) => (
          <div
            key={`${item.phrase}-${item.translation}-${index}`}
            className="border-quote/60 border-l pl-4"
          >
            {item.phrase ? (
              <p className="text-ink-soft font-serif text-sm leading-relaxed">
                {item.phrase}
              </p>
            ) : null}
            {item.translation ? (
              <p className="text-ink-muted mt-1 text-xs leading-relaxed">
                {item.translation}
              </p>
            ) : null}
            {item.note ? (
              <p className="text-ink-muted mt-1 text-[11px] leading-relaxed italic">
                {item.note}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {content}
      {state.status === "loading" ? (
        <p
          className="text-ink-muted flex items-center gap-2 text-[11px]"
          role="status"
        >
          <LoaderCircle className="size-3 animate-spin" />
          Refining...
        </p>
      ) : null}
      {errorContent}
    </div>
  );
}

function DeepActionsSection({
  actions,
  states,
  onRun,
}: {
  actions: DeepAction[];
  states: DeepActionUiStates;
  onRun: (action: DeepAction) => void;
}) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="border-line space-y-5 border-t pt-8">
      <div className="space-y-1.5">
        <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
          Go deeper
        </p>
        <p className="text-ink-muted text-xs leading-relaxed">
          Explore one angle at a time. These notes stay separate from your saved
          explanation.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {actions.map((action) => {
          const actionState = states[action];

          return (
            <button
              key={action}
              type="button"
              onClick={() => onRun(action)}
              className="border-line hover:border-line-strong hover:bg-surface-soft focus-visible:ring-ring flex min-h-10 items-center justify-center gap-2 border px-3 py-2 text-[11px] font-medium tracking-wide transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {actionState.status === "loading" ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : null}
              {DEEP_ACTION_LABELS[action]}
            </button>
          );
        })}
      </div>

      <div className="space-y-5">
        {actions.map((action) => {
          const actionState = states[action];

          return actionState.status !== "idle" ? (
            <article
              key={action}
              className="border-line bg-surface-soft border p-4"
            >
              <p className="text-foreground mb-3 font-serif text-base">
                {DEEP_ACTION_LABELS[action]}
              </p>
              <DeepActionResult
                action={action}
                state={actionState}
                onRetry={() => onRun(action)}
              />
            </article>
          ) : null;
        })}
      </div>
    </section>
  );
}

export function ReaderAiPanel({
  availableDeepActions,
  contextSentence,
  deepActionStates,
  dueCardCount,
  existingVocabulary,
  state,
  errorMessage,
  explanation,
  isSidebarOpen,
  isVocabularyLookupPending,
  popoverPosition,
  saveState,
  selectedText,
  sourceLanguage,
  tooltipSelectedText,
  onCopySelection,
  onExplainSelection,
  onRunDeepAction,
  onOpenSidebar,
  onRetry,
  onSaveToVocabulary,
  onDismissPopover,
}: {
  availableDeepActions: DeepAction[];
  contextSentence?: string | null;
  deepActionStates: DeepActionUiStates;
  dueCardCount: number | null;
  existingVocabulary: ExistingVocabulary | null;
  state: AiPanelState;
  errorMessage: string | null;
  explanation: StreamingExplanationPayload | null;
  isSidebarOpen: boolean;
  isVocabularyLookupPending: boolean;
  popoverPosition: PopoverPosition | null;
  saveState: VocabularySaveState;
  selectedText: string | null;
  sourceLanguage: string;
  tooltipSelectedText: string | null;
  onCopySelection: () => void;
  onExplainSelection: () => void;
  onRunDeepAction: (action: DeepAction) => void;
  onOpenSidebar: () => void;
  onRetry: () => void;
  onSaveToVocabulary: () => void;
  onDismissPopover: () => void;
}) {
  const showPopover = popoverPosition && tooltipSelectedText;
  const briefExplanation = getBriefExplanation(explanation?.explanation);
  const existingVocabularyDefinition = getBriefExplanation(
    existingVocabulary?.definition.trim() ||
      existingVocabulary?.explanation?.trim() ||
      existingVocabulary?.exampleSentence?.trim(),
  );
  const reencounterCue = getVocabularyReencounterCue({
    srsData: existingVocabulary?.srsData,
  });
  const hasMatchingSelection =
    !!selectedText &&
    !!tooltipSelectedText &&
    selectedText === tooltipSelectedText;
  const isStreamingExplanation = state === "loading";
  const showPopoverLoading =
    showPopover && isStreamingExplanation && hasMatchingSelection;
  const showPopoverTranslation =
    showPopover && !!explanation?.translation && hasMatchingSelection;
  const streamingCursorTarget = isStreamingExplanation
    ? getReaderAiStreamingCursorTarget(explanation)
    : null;
  const isSaving = saveState === "saving";
  const isSaveDisabled =
    isVocabularyLookupPending || saveState !== "idle" || state !== "ready";
  const saveLabel =
    saveState === "saving"
      ? "Saving to Archive"
      : saveState === "saved"
        ? "Saved to Archive"
        : saveState === "alreadySaved"
          ? "Already Saved"
          : "Save to Archive";
  const saveButtonTextClass = isSaveDisabled
    ? "text-ink-muted"
    : "text-foreground";
  const canSpeakSelection = isSpeechTextEligible(selectedText);

  useEffect(() => {
    if (!showPopover) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismissPopover();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPopover, onDismissPopover]);

  const showIdlePanel = !isSidebarOpen && state === "idle";
  const showLoadingPanel =
    !isSidebarOpen && state === "loading" && !explanation;
  const showErrorPanel = !isSidebarOpen && state === "error";
  const showCompactExplanationPanel = !isSidebarOpen && !!explanation;
  const showSidebarLoading =
    isSidebarOpen && state === "loading" && !explanation;
  const showSidebarError = isSidebarOpen && state === "error";
  const showSidebarExplanation = isSidebarOpen && !!explanation;

  return (
    <>
      {showPopover ? (
        <div
          className="bg-popover text-popover-foreground border-line-strong animate-in fade-in slide-in-from-bottom-2 fixed z-50 flex w-[min(300px,calc(100vw-2rem))] flex-col border p-3 shadow-2xl"
          style={{
            top: popoverPosition.top,
            left: popoverPosition.left,
            transform:
              popoverPosition.top > window.innerHeight - 200
                ? "translateY(-100%) translateY(-24px)"
                : "none", // Handle bottom collision directly via inline transform shift
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-1.5 focus:ring-0 focus:outline-none">
              <p className="font-serif text-[15px] leading-snug font-normal">
                {tooltipSelectedText}
              </p>
              {showPopoverLoading ? (
                <div className="text-popover-foreground/70 flex items-center gap-2 text-[11px]">
                  <LoaderCircle className="size-3 animate-spin" />
                  <span>Translating...</span>
                </div>
              ) : null}
              {showPopoverTranslation ? (
                <p className="text-popover-foreground/80 animate-in fade-in-0 truncate text-xs duration-300">
                  {explanation.translation}
                  {streamingCursorTarget === "translation" ? (
                    <StreamingCursor />
                  ) : null}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onDismissPopover}
              className="text-popover-foreground/65 hover:text-popover-foreground focus-visible:ring-ring mt-0.5 shrink-0 rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Dismiss selection"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="border-popover-foreground/15 mt-4 flex gap-3 border-t pt-3">
            <button
              onClick={onExplainSelection}
              type="button"
              className="text-popover-foreground focus-visible:ring-ring group flex flex-1 items-center gap-1.5 rounded-sm text-[11px] font-medium tracking-widest uppercase transition-colors hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
            >
              <Sparkles className="text-popover-foreground/65 group-hover:text-popover-foreground size-3.5" />
              Explain
            </button>
            <div className="bg-popover-foreground/15 w-[1px]" />
            <button
              onClick={onCopySelection}
              type="button"
              className="text-popover-foreground/65 hover:text-popover-foreground focus-visible:ring-ring group flex flex-1 items-center gap-1.5 rounded-sm text-[11px] font-medium tracking-widest uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Copy className="text-popover-foreground/55 group-hover:text-popover-foreground/80 size-3.5" />
              Copy
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex shrink-0 flex-col gap-6">
        <header className="border-line space-y-2 border-b pb-4">
          <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
            ReadLingo
          </p>
          <h2 className="text-foreground font-serif text-2xl font-light tracking-wide">
            AI Assistant
          </h2>
          <p className="text-ink-muted text-xs">
            Highlight a word or sentence inside the book to open the reading
            tools. Choose Explain when you need the AI to analyze your
            selection.
          </p>
        </header>

        <div className="space-y-6">
          {showIdlePanel ? (
            <div className="border-line bg-surface-soft flex items-start gap-4 border p-5">
              <Sparkles className="text-ink-kicker mt-0.5 size-4 shrink-0" />
              <p className="text-ink-muted text-xs leading-relaxed">
                Highlight text inside the book to open the reading tools. Choose
                Explain when you need the AI to analyze your selection.
              </p>
            </div>
          ) : null}

          {showLoadingPanel ? (
            <div
              className="border-line bg-surface-soft flex items-start gap-4 border p-5"
              role="status"
            >
              <LoaderCircle className="text-foreground mt-0.5 size-4 shrink-0 animate-spin" />
              <div className="space-y-1.5">
                <p className="text-foreground text-sm font-medium">
                  Analyzing context
                </p>
                <p className="text-ink-muted text-xs">
                  Preparing a literary explanation for
                  {selectedText ? ` "${selectedText}"` : " your selection"}...
                </p>
              </div>
            </div>
          ) : null}

          {showErrorPanel ? (
            <div
              className="space-y-4 border border-red-200/50 bg-red-50/50 p-5 dark:border-red-900/30 dark:bg-red-950/20"
              role="alert"
            >
              <p className="flex items-center gap-2 text-sm font-medium text-red-900 dark:text-red-400">
                <AlertCircle className="size-4" />
                Analysis interrupted
              </p>
              <p className="text-xs text-red-800 dark:text-red-300">
                {errorMessage}
              </p>
              <button
                onClick={onRetry}
                type="button"
                className="focus-visible:ring-ring mt-2 inline-block rounded-sm text-[11px] font-medium tracking-wide text-red-900 underline decoration-red-900/30 underline-offset-4 hover:decoration-red-900 focus-visible:ring-2 focus-visible:outline-none dark:text-red-400 dark:decoration-red-400/30 dark:hover:decoration-red-400"
              >
                RETRY ANALYSIS
              </button>
            </div>
          ) : null}

          {showCompactExplanationPanel ? (
            <div className="border-line hover:border-line-strong group relative space-y-4 border p-6 transition-colors">
              <div className="animate-in fade-in-0 space-y-2 duration-300">
                <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                  Translation Fragment
                </p>
                {explanation.translation ? (
                  <p className="text-foreground font-serif text-2xl">
                    {explanation.translation}
                    {streamingCursorTarget === "translation" ? (
                      <StreamingCursor />
                    ) : null}
                  </p>
                ) : null}
              </div>

              {briefExplanation ? (
                <p className="text-ink-muted animate-in fade-in-0 text-sm leading-relaxed italic duration-300">
                  {briefExplanation}
                  {streamingCursorTarget === "explanation" ? (
                    <StreamingCursor />
                  ) : null}
                </p>
              ) : null}

              <button
                onClick={onOpenSidebar}
                type="button"
                className="text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-sm text-xs font-medium tracking-wide transition-transform group-hover:translate-x-1 focus-visible:ring-2 focus-visible:outline-none"
              >
                Expand <ChevronRight className="size-3.5" />
              </button>
            </div>
          ) : null}

          {isSidebarOpen ? (
            <div className="space-y-8 pb-10">
              {showSidebarLoading ? (
                <div
                  className="text-ink-muted flex animate-pulse gap-4"
                  role="status"
                >
                  <LoaderCircle className="mt-1 size-4 shrink-0 animate-spin" />
                  <p className="text-sm">
                    Synthesizing comprehensive analysis...
                  </p>
                </div>
              ) : null}

              {showSidebarError ? (
                <div
                  className="space-y-4 border border-red-200/50 bg-red-50/50 p-5 dark:border-red-900/30 dark:bg-red-950/20"
                  role="alert"
                >
                  <p className="flex items-center gap-2 text-sm font-medium text-red-900 dark:text-red-400">
                    <AlertCircle className="size-4" />
                    Analysis unavailable
                  </p>
                  <p className="text-xs text-red-800 dark:text-red-300">
                    {errorMessage}
                  </p>
                  <button
                    onClick={onRetry}
                    type="button"
                    className="focus-visible:ring-ring mt-2 inline-block rounded-sm text-[11px] font-medium tracking-wide text-red-900 underline decoration-red-900/30 underline-offset-4 hover:decoration-red-900 focus-visible:ring-2 focus-visible:outline-none dark:text-red-400 dark:decoration-red-400/30 dark:hover:decoration-red-400"
                  >
                    RETRY
                  </button>
                </div>
              ) : null}

              {showSidebarExplanation ? (
                <div
                  aria-atomic="false"
                  aria-live="polite"
                  className="animate-in fade-in slide-in-from-bottom-2 space-y-10 duration-500"
                >
                  <div className="space-y-6">
                    {shouldShowReaderAiContext(
                      explanation.selectionType,
                      contextSentence,
                    ) ? (
                      <div className="space-y-4">
                        <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                          In Context
                        </p>
                        <blockquote className="border-quote border-l-2 pl-5">
                          <p className="text-ink-soft font-serif text-lg leading-relaxed">
                            {renderHighlightedExampleSentence(
                              contextSentence ?? "",
                              selectedText,
                            )}
                          </p>
                        </blockquote>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                          Source Text
                        </p>
                        {canSpeakSelection && selectedText ? (
                          <PronounceTextButton
                            text={selectedText}
                            sourceLanguage={sourceLanguage}
                            allowEnglishAccentControls
                            className="shrink-0"
                          />
                        ) : null}
                      </div>
                      <p className="text-foreground font-serif text-lg leading-snug">
                        {selectedText}
                      </p>
                      {explanation.selectionType === "word" &&
                      explanation.pronunciation ? (
                        <p className="text-ink-muted text-sm italic">
                          {explanation.pronunciation}
                        </p>
                      ) : null}
                      {explanation.selectionType === "word" &&
                      (explanation.partOfSpeech ||
                        explanation.difficultyHint) ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {explanation.partOfSpeech ? (
                            <span className="border-line text-ink-muted inline-block border px-2 py-0.5 text-[10px] tracking-widest uppercase">
                              {explanation.partOfSpeech}
                            </span>
                          ) : null}
                          {explanation.difficultyHint ? (
                            <span
                              className={`inline-block border px-2 py-0.5 text-[10px] tracking-widest uppercase ${getDifficultyBadgeClass(explanation.difficultyHint)}`}
                            >
                              {explanation.difficultyHint}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {explanation.translation ? (
                      <div className="animate-in fade-in-0 space-y-2 duration-300">
                        <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                          Translation
                        </p>
                        <p className="text-foreground font-serif text-3xl leading-tight font-light tracking-tight">
                          {explanation.translation}
                          {streamingCursorTarget === "translation" ? (
                            <StreamingCursor />
                          ) : null}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {explanation.explanation ? (
                    <div className="border-line animate-in fade-in-0 space-y-3 border-t pt-8 duration-300">
                      <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                        Editorial Note
                      </p>
                      <p className="text-ink-soft text-sm leading-loose">
                        {explanation.explanation}
                        {streamingCursorTarget === "explanation" ? (
                          <StreamingCursor />
                        ) : null}
                      </p>
                      {explanation.alternativeMeaning ? (
                        <p className="text-ink-muted animate-in fade-in-0 text-xs leading-relaxed duration-300">
                          Also commonly means: {explanation.alternativeMeaning}
                          {streamingCursorTarget === "alternative-meaning" ? (
                            <StreamingCursor />
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {explanation.grammaticalNote ? (
                    <div className="border-line animate-in fade-in-0 space-y-3 border-t pt-8 duration-300">
                      <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                        Form tip
                      </p>
                      <p className="text-ink-soft text-sm leading-loose">
                        {explanation.grammaticalNote}
                        {streamingCursorTarget === "grammatical-note" ? (
                          <StreamingCursor />
                        ) : null}
                      </p>
                    </div>
                  ) : null}

                  {(explanation.examples?.length ?? 0) > 0 ? (
                    <div className="animate-in fade-in-0 space-y-4 duration-300">
                      <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                        Contextual Usage
                      </p>
                      <div className="space-y-4">
                        {explanation.examples?.map((example, idx) => (
                          <div
                            key={idx}
                            className="border-quote/60 hover:border-quote animate-in fade-in-0 border-l pl-4 transition-colors duration-300"
                          >
                            {example.sentence ? (
                              <p className="text-ink-soft font-serif text-sm leading-relaxed italic">
                                {renderHighlightedExampleSentence(
                                  example.sentence,
                                  selectedText,
                                )}
                                {streamingCursorTarget ===
                                `example-sentence-${idx}` ? (
                                  <StreamingCursor />
                                ) : null}
                              </p>
                            ) : null}
                            {example.translation ? (
                              <p className="text-ink-muted mt-1 text-xs leading-relaxed italic">
                                {example.translation}
                                {streamingCursorTarget ===
                                `example-translation-${idx}` ? (
                                  <StreamingCursor />
                                ) : null}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="pt-4">
                    {state === "ready" &&
                    explanation.selectionType === "word" ? (
                      <button
                        type="button"
                        onClick={onSaveToVocabulary}
                        disabled={isSaveDisabled}
                        className="border-line hover:bg-surface-soft disabled:border-line group disabled:bg-surface-soft/70 disabled:text-ink-muted focus-visible:ring-ring flex w-full items-center justify-between border px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default"
                      >
                        <span
                          className={`flex items-center gap-2 text-xs font-medium ${saveButtonTextClass}`}
                        >
                          {isSaving ? (
                            <LoaderCircle className="size-3.5 animate-spin" />
                          ) : saveState === "saved" ||
                            saveState === "alreadySaved" ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Save className="size-3.5" />
                          )}
                          {saveLabel}
                        </span>
                        <ChevronRight className="text-ink-muted size-3.5 transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0" />
                      </button>
                    ) : state === "ready" ? (
                      <p className="border-line text-ink-muted border px-4 py-3 text-xs">
                        Sentence analysis
                      </p>
                    ) : (
                      <p className="border-line text-ink-muted border px-4 py-3 text-xs">
                        Streaming analysis...
                      </p>
                    )}
                    {saveState === "saved" ? (
                      <Link
                        href="/vocabulary/flashcards"
                        className="text-ink-muted hover:text-foreground focus-visible:ring-ring mt-3 inline-flex items-center gap-1.5 rounded-sm text-[11px] tracking-wide transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {dueCardCount !== null && dueCardCount > 0
                          ? `${dueCardCount} due now`
                          : "Open flashcards"}
                        <ChevronRight className="size-3" />
                      </Link>
                    ) : null}
                    {saveState === "alreadySaved" &&
                    existingVocabularyDefinition ? (
                      <div className="border-quote/60 mt-4 border-l pl-4">
                        <p className="text-ink-kicker text-[9px] font-medium tracking-[0.18em] uppercase">
                          Saved meaning
                        </p>
                        <p className="text-ink-soft mt-1 font-serif text-sm leading-relaxed">
                          {existingVocabularyDefinition}
                        </p>
                        {reencounterCue ? (
                          <span className="border-line text-ink-muted mt-2 inline-block border px-2 py-0.5 text-[9px] tracking-[0.16em] uppercase">
                            {REENCOUNTER_CUE_LABELS[reencounterCue]}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {errorMessage ? (
                      <p className="mt-3 text-[11px] leading-relaxed text-red-700 dark:text-red-300">
                        {errorMessage}
                      </p>
                    ) : null}
                  </div>

                  {state === "ready" ? (
                    <DeepActionsSection
                      actions={availableDeepActions}
                      states={deepActionStates}
                      onRun={onRunDeepAction}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
