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

  return "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";
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
          className="font-semibold text-zinc-950 dark:text-zinc-50"
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
    ? "text-zinc-500 dark:text-zinc-400"
    : "text-zinc-900 dark:text-zinc-100";

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
          className="animate-in fade-in slide-in-from-bottom-2 fixed z-50 flex w-[min(300px,calc(100vw-2rem))] flex-col bg-zinc-900 p-3 shadow-2xl dark:bg-zinc-100"
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
              <p className="font-serif text-[15px] leading-snug font-normal text-zinc-100 dark:text-zinc-900">
                {tooltipSelectedText}
              </p>
              {showPopoverLoading ? (
                <div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-600">
                  <LoaderCircle className="size-3 animate-spin" />
                  <span>Translating...</span>
                </div>
              ) : null}
              {showPopoverTranslation ? (
                <p className="truncate text-xs text-zinc-300 dark:text-zinc-700">
                  {explanation.translation}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onDismissPopover}
              className="mt-0.5 shrink-0 text-zinc-400 transition-colors hover:text-white dark:text-zinc-500 dark:hover:text-zinc-900"
              aria-label="Dismiss selection"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 flex gap-3 border-t border-zinc-800 pt-3 dark:border-zinc-200">
            <button
              onClick={onExplainSelection}
              type="button"
              className="group flex flex-1 items-center gap-1.5 text-[11px] font-medium tracking-widest text-zinc-100 uppercase transition-colors hover:text-white dark:text-zinc-900 dark:hover:text-black"
            >
              <Sparkles className="size-3.5 text-zinc-400 group-hover:text-zinc-100 dark:text-zinc-500 dark:group-hover:text-zinc-900" />
              Explain
            </button>
            <div className="w-[1px] bg-zinc-800 dark:bg-zinc-200" />
            <button
              onClick={onCopySelection}
              type="button"
              className="group flex flex-1 items-center gap-1.5 text-[11px] font-medium tracking-widest text-zinc-400 uppercase transition-colors hover:text-zinc-100 dark:text-zinc-600 dark:hover:text-zinc-900"
            >
              <Copy className="size-3.5 text-zinc-500 group-hover:text-zinc-400 dark:text-zinc-400 dark:group-hover:text-zinc-600" />
              Copy
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex shrink-0 flex-col gap-6">
        <header className="space-y-2 border-b border-zinc-200/60 pb-4 dark:border-zinc-800/60">
          <p className="text-[10px] font-medium tracking-[0.2em] text-zinc-400 uppercase">
            ReadLingo
          </p>
          <h2 className="font-serif text-2xl font-light tracking-wide text-zinc-900 dark:text-zinc-100">
            AI Assistant
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Highlight a word or sentence inside the book to open the reading
            tools. Choose Explain when you need the AI to analyze your
            selection.
          </p>
        </header>

        <div className="space-y-6">
          {showIdlePanel ? (
            <div className="flex items-start gap-4 border border-zinc-200/50 bg-zinc-50/50 p-5 dark:border-zinc-800/50 dark:bg-zinc-900/40">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-zinc-400" />
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                Highlight text inside the book to open the reading tools. Choose
                Explain when you need the AI to analyze your selection.
              </p>
            </div>
          ) : null}

          {showLoadingPanel ? (
            <div className="flex items-start gap-4 border border-zinc-200/50 bg-zinc-50/50 p-5 dark:border-zinc-800/50 dark:bg-zinc-900/40">
              <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-zinc-900 dark:text-zinc-100" />
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Analyzing context
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
            <div className="group relative space-y-4 border border-zinc-200 p-6 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700">
              <div className="space-y-2">
                <p className="text-[10px] font-medium tracking-[0.2em] text-zinc-400 uppercase">
                  Translation Fragment
                </p>
                <p className="font-serif text-2xl text-zinc-900 dark:text-zinc-100">
                  {explanation.translation}
                </p>
              </div>

              <p className="text-sm leading-relaxed text-zinc-600 italic dark:text-zinc-400">
                {briefExplanation}
              </p>

              <button
                onClick={onOpenSidebar}
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-zinc-900 transition-transform group-hover:translate-x-1 dark:text-zinc-100"
              >
                Expand <ChevronRight className="size-3.5" />
              </button>
            </div>
          ) : null}

          {isSidebarOpen ? (
            <div className="space-y-8 pb-10">
              {showSidebarLoading ? (
                <div className="flex animate-pulse gap-4 text-zinc-500">
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
                        <p className="text-[10px] font-medium tracking-[0.2em] text-zinc-400 uppercase">
                          In Context
                        </p>
                        <blockquote className="border-l-2 border-zinc-900 pl-5 dark:border-zinc-100">
                          <p className="font-serif text-lg leading-relaxed text-zinc-800 dark:text-zinc-200">
                            {renderHighlightedExampleSentence(
                              contextSentence ?? "",
                              selectedText,
                            )}
                          </p>
                        </blockquote>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <p className="text-[10px] font-medium tracking-[0.2em] text-zinc-400 uppercase">
                        Source Text
                      </p>
                      <p className="font-serif text-lg leading-snug text-zinc-900 dark:text-zinc-100">
                        {selectedText}
                      </p>
                      {explanation.selectionType === "word" &&
                      explanation.pronunciation ? (
                        <p className="text-sm text-zinc-500 italic dark:text-zinc-400">
                          {explanation.pronunciation}
                        </p>
                      ) : null}
                      {explanation.selectionType === "word" &&
                      (explanation.partOfSpeech ||
                        explanation.difficultyHint) ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {explanation.partOfSpeech ? (
                            <span className="inline-block border border-zinc-200 px-2 py-0.5 text-[10px] tracking-widest text-zinc-500 uppercase dark:border-zinc-800">
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
                      <p className="text-[10px] font-medium tracking-[0.2em] text-zinc-400 uppercase">
                        Translation
                      </p>
                      <p className="font-serif text-3xl leading-tight font-light tracking-tight text-zinc-900 dark:text-zinc-100">
                        {explanation.translation}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-zinc-100 pt-8 dark:border-zinc-900">
                    <p className="text-[10px] font-medium tracking-[0.2em] text-zinc-400 uppercase">
                      Editorial Note
                    </p>
                    <p className="text-sm leading-loose text-zinc-700 dark:text-zinc-300">
                      {explanation.explanation}
                    </p>
                    {explanation.alternativeMeaning ? (
                      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        Also commonly means: {explanation.alternativeMeaning}
                      </p>
                    ) : null}
                  </div>

                  {explanation.grammaticalNote ? (
                    <div className="space-y-3 border-t border-zinc-100 pt-8 dark:border-zinc-900">
                      <p className="text-[10px] font-medium tracking-[0.2em] text-zinc-400 uppercase">
                        Grammar & Structure
                      </p>
                      <p className="text-sm leading-loose text-zinc-700 dark:text-zinc-300">
                        {explanation.grammaticalNote}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    <p className="text-[10px] font-medium tracking-[0.2em] text-zinc-400 uppercase">
                      Contextual Usage
                    </p>
                    <div className="space-y-4">
                      {explanation.examples.map((example, idx) => (
                        <div
                          key={idx}
                          className="border-l border-zinc-300 pl-4 transition-colors hover:border-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-400"
                        >
                          <p className="font-serif text-sm leading-relaxed text-zinc-800 italic dark:text-zinc-200">
                            {renderHighlightedExampleSentence(
                              example.sentence,
                              selectedText,
                            )}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-500 italic dark:text-zinc-400">
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
                        className="group flex w-full items-center justify-between border border-zinc-200 px-4 py-3 transition-colors hover:bg-zinc-50 disabled:cursor-default disabled:border-zinc-200/70 disabled:bg-zinc-50/80 disabled:text-zinc-500 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:disabled:border-zinc-800/70 dark:disabled:bg-zinc-900/60 dark:disabled:text-zinc-400"
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
                        <ChevronRight className="size-3.5 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0 dark:text-zinc-400" />
                      </button>
                    ) : (
                      <p className="border border-zinc-200 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
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
