"use client";

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
import { Fragment, useEffect } from "react";

import { shouldShowReaderAiContext } from "@/components/reader/reader-ai-panel-utils";
import { getHighlightedExampleSegments } from "@/components/reader/reader-workspace-utils";
import type { ExplanationPayload, WordExplanationPayload } from "@/types";

type AiPanelState = "idle" | "loading" | "ready" | "error";

type PopoverPosition = {
  top: number;
  left: number;
};

type VocabularySaveState = "idle" | "saving" | "saved" | "alreadySaved";

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

export function ReaderAiPanel({
  contextSentence,
  state,
  errorMessage,
  explanation,
  isSidebarOpen,
  popoverPosition,
  saveState,
  selectedText,
  tooltipSelectedText,
  onCopySelection,
  onExplainSelection,
  onOpenSidebar,
  onRetry,
  onSaveToVocabulary,
  onDismissPopover,
}: {
  contextSentence?: string | null;
  state: AiPanelState;
  errorMessage: string | null;
  explanation: ExplanationPayload | null;
  isSidebarOpen: boolean;
  popoverPosition: PopoverPosition | null;
  saveState: VocabularySaveState;
  selectedText: string | null;
  tooltipSelectedText: string | null;
  onCopySelection: () => void;
  onExplainSelection: () => void;
  onOpenSidebar: () => void;
  onRetry: () => void;
  onSaveToVocabulary: () => void;
  onDismissPopover: () => void;
}) {
  const showPopover = popoverPosition && tooltipSelectedText;
  const briefExplanation = getBriefExplanation(explanation?.explanation);
  const hasMatchingSelection =
    !!selectedText &&
    !!tooltipSelectedText &&
    selectedText === tooltipSelectedText;
  const showPopoverLoading =
    showPopover && state === "loading" && hasMatchingSelection;
  const showPopoverTranslation =
    showPopover && state === "ready" && !!explanation && hasMatchingSelection;
  const isSaving = saveState === "saving";
  const isSaveDisabled = saveState !== "idle";
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
  const showLoadingPanel = !isSidebarOpen && state === "loading";
  const showErrorPanel = !isSidebarOpen && state === "error";
  const showCompactReadyPanel =
    !isSidebarOpen && state === "ready" && !!explanation;
  const showSidebarLoading = isSidebarOpen && state === "loading";
  const showSidebarError = isSidebarOpen && state === "error";
  const showSidebarReady = isSidebarOpen && state === "ready" && !!explanation;

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
                <p className="text-popover-foreground/80 truncate text-xs">
                  {explanation.translation}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onDismissPopover}
              className="text-popover-foreground/65 hover:text-popover-foreground mt-0.5 shrink-0 transition-colors"
              aria-label="Dismiss selection"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="border-popover-foreground/15 mt-4 flex gap-3 border-t pt-3">
            <button
              onClick={onExplainSelection}
              type="button"
              className="text-popover-foreground group flex flex-1 items-center gap-1.5 text-[11px] font-medium tracking-widest uppercase transition-colors hover:opacity-100"
            >
              <Sparkles className="text-popover-foreground/65 group-hover:text-popover-foreground size-3.5" />
              Explain
            </button>
            <div className="bg-popover-foreground/15 w-[1px]" />
            <button
              onClick={onCopySelection}
              type="button"
              className="text-popover-foreground/65 hover:text-popover-foreground group flex flex-1 items-center gap-1.5 text-[11px] font-medium tracking-widest uppercase transition-colors"
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
            <div className="border-line bg-surface-soft flex items-start gap-4 border p-5">
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
            <div className="space-y-4 border border-red-200/50 bg-red-50/50 p-5 dark:border-red-900/30 dark:bg-red-950/20">
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
                className="mt-2 inline-block text-[11px] font-medium tracking-wide text-red-900 underline decoration-red-900/30 underline-offset-4 hover:decoration-red-900 dark:text-red-400 dark:decoration-red-400/30 dark:hover:decoration-red-400"
              >
                RETRY ANALYSIS
              </button>
            </div>
          ) : null}

          {showCompactReadyPanel ? (
            <div className="border-line hover:border-line-strong group relative space-y-4 border p-6 transition-colors">
              <div className="space-y-2">
                <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                  Translation Fragment
                </p>
                <p className="text-foreground font-serif text-2xl">
                  {explanation.translation}
                </p>
              </div>

              <p className="text-ink-muted text-sm leading-relaxed italic">
                {briefExplanation}
              </p>

              <button
                onClick={onOpenSidebar}
                type="button"
                className="text-foreground inline-flex items-center gap-1.5 text-xs font-medium tracking-wide transition-transform group-hover:translate-x-1"
              >
                Expand <ChevronRight className="size-3.5" />
              </button>
            </div>
          ) : null}

          {isSidebarOpen ? (
            <div className="space-y-8 pb-10">
              {showSidebarLoading ? (
                <div className="text-ink-muted flex animate-pulse gap-4">
                  <LoaderCircle className="mt-1 size-4 shrink-0 animate-spin" />
                  <p className="text-sm">
                    Synthesizing comprehensive analysis...
                  </p>
                </div>
              ) : null}

              {showSidebarError ? (
                <div className="space-y-4 border border-red-200/50 bg-red-50/50 p-5 dark:border-red-900/30 dark:bg-red-950/20">
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
                    className="mt-2 inline-block text-[11px] font-medium tracking-wide text-red-900 underline decoration-red-900/30 underline-offset-4 hover:decoration-red-900 dark:text-red-400 dark:decoration-red-400/30 dark:hover:decoration-red-400"
                  >
                    RETRY
                  </button>
                </div>
              ) : null}

              {showSidebarReady ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 space-y-10 duration-500">
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
                      <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                        Source Text
                      </p>
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

                    <div className="space-y-2">
                      <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                        Translation
                      </p>
                      <p className="text-foreground font-serif text-3xl leading-tight font-light tracking-tight">
                        {explanation.translation}
                      </p>
                    </div>
                  </div>

                  <div className="border-line space-y-3 border-t pt-8">
                    <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                      Editorial Note
                    </p>
                    <p className="text-ink-soft text-sm leading-loose">
                      {explanation.explanation}
                    </p>
                    {explanation.alternativeMeaning ? (
                      <p className="text-ink-muted text-xs leading-relaxed">
                        Also commonly means: {explanation.alternativeMeaning}
                      </p>
                    ) : null}
                  </div>

                  {explanation.grammaticalNote ? (
                    <div className="border-line space-y-3 border-t pt-8">
                      <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                        Grammar & Structure
                      </p>
                      <p className="text-ink-soft text-sm leading-loose">
                        {explanation.grammaticalNote}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                      Contextual Usage
                    </p>
                    <div className="space-y-4">
                      {explanation.examples.map((example, idx) => (
                        <div
                          key={idx}
                          className="border-quote/60 hover:border-quote border-l pl-4 transition-colors"
                        >
                          <p className="text-ink-soft font-serif text-sm leading-relaxed italic">
                            {renderHighlightedExampleSentence(
                              example.sentence,
                              selectedText,
                            )}
                          </p>
                          <p className="text-ink-muted mt-1 text-xs leading-relaxed italic">
                            {example.translation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    {explanation.selectionType === "word" ? (
                      <button
                        type="button"
                        onClick={onSaveToVocabulary}
                        disabled={isSaveDisabled}
                        className="border-line hover:bg-surface-soft disabled:border-line group disabled:bg-surface-soft/70 disabled:text-ink-muted flex w-full items-center justify-between border px-4 py-3 transition-colors disabled:cursor-default"
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
                    ) : (
                      <p className="border-line text-ink-muted border px-4 py-3 text-xs">
                        Sentence analysis
                      </p>
                    )}
                    {errorMessage ? (
                      <p className="mt-3 text-[11px] leading-relaxed text-red-700 dark:text-red-300">
                        {errorMessage}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
