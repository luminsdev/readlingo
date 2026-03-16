"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type Contents from "epubjs/types/contents";

import { ReaderAiPanel } from "@/components/reader/reader-ai-panel";
import type {
  PendingExplainRequest,
  ReaderSelectionHandlerRenderProps,
} from "@/components/reader/reader-workspace-types";
import { getPopoverPosition } from "@/components/reader/reader-workspace-utils";
import { getAiErrorMessage, isSingleWordSelection } from "@/lib/ai";
import {
  explanationPayloadSchema,
  type ExplainSelectionInput,
} from "@/lib/ai-validation";
import {
  clearReaderSelection,
  getReaderSelectionPayload,
} from "@/lib/reader-selection";
import { buildVocabularySavePayload } from "@/lib/vocabulary";
import type { ExplanationPayload } from "@/types";

type ReaderSelectionHandlerProps = {
  bookId: string;
  children: (props: ReaderSelectionHandlerRenderProps) => ReactNode;
  language: string;
  readerSurfaceRef: RefObject<HTMLDivElement | null>;
};

function isSameExplainRequest(
  left: PendingExplainRequest | null,
  right: PendingExplainRequest | null,
) {
  if (!left || !right) {
    return false;
  }

  return (
    left.selectedText === right.selectedText &&
    left.surroundingParagraph === right.surroundingParagraph &&
    left.sourceLanguage === right.sourceLanguage
  );
}

export function ReaderSelectionHandler({
  bookId,
  children,
  language,
  readerSurfaceRef,
}: ReaderSelectionHandlerProps) {
  const explainAbortControllerRef = useRef<AbortController | null>(null);
  const pendingExplainRequestRef = useRef<PendingExplainRequest | null>(null);
  const retryExplainRequestRef = useRef<PendingExplainRequest | null>(null);
  const selectionContentsRef = useRef<Contents | null>(null);
  const vocabularyLookupAbortControllerRef = useRef<AbortController | null>(
    null,
  );
  const vocabularySaveAbortControllerRef = useRef<AbortController | null>(null);
  const vocabularySaveStateRef = useRef<
    "idle" | "saving" | "saved" | "alreadySaved"
  >("idle");
  const isMountedRef = useRef(true);

  const [aiState, setAiState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<ExplanationPayload | null>(
    null,
  );
  const [aiPopoverPosition, setAiPopoverPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [activeSelectedText, setActiveSelectedText] = useState<string | null>(
    null,
  );
  const [tooltipSelectedText, setTooltipSelectedText] = useState<string | null>(
    null,
  );
  const [vocabularySaveState, setVocabularySaveState] = useState<
    "idle" | "saving" | "saved" | "alreadySaved"
  >("idle");

  const setVocabularySaveStatus = useCallback(
    (nextState: "idle" | "saving" | "saved" | "alreadySaved") => {
      vocabularySaveStateRef.current = nextState;
      setVocabularySaveState(nextState);
    },
    [],
  );

  const clearPendingSelection = useCallback(() => {
    clearReaderSelection(selectionContentsRef.current);
    selectionContentsRef.current = null;
    pendingExplainRequestRef.current = null;
    setAiPopoverPosition(null);
    setTooltipSelectedText(null);
  }, []);

  const dismissPanels = useCallback(() => {
    explainAbortControllerRef.current?.abort();
    explainAbortControllerRef.current = null;
    vocabularyLookupAbortControllerRef.current?.abort();
    vocabularyLookupAbortControllerRef.current = null;
    vocabularySaveAbortControllerRef.current?.abort();
    vocabularySaveAbortControllerRef.current = null;
    retryExplainRequestRef.current = null;
    clearPendingSelection();
    setAiState("idle");
    setAiErrorMessage(null);
    setAiExplanation(null);
    setIsAiSidebarOpen(false);
    setActiveSelectedText(null);
    setVocabularySaveStatus("idle");
  }, [clearPendingSelection, setVocabularySaveStatus]);

  const requestExplanation = useCallback(
    async (
      requestPayload: PendingExplainRequest,
      modelTier: ExplainSelectionInput["modelTier"] = "primary",
    ) => {
      retryExplainRequestRef.current = requestPayload;
      explainAbortControllerRef.current?.abort();
      vocabularyLookupAbortControllerRef.current?.abort();
      vocabularyLookupAbortControllerRef.current = null;
      vocabularySaveAbortControllerRef.current?.abort();
      vocabularySaveAbortControllerRef.current = null;

      const abortController = new AbortController();
      explainAbortControllerRef.current = abortController;

      setActiveSelectedText(requestPayload.selectedText);
      setAiState("loading");
      setAiErrorMessage(null);
      setAiExplanation(null);
      setVocabularySaveStatus("idle");

      try {
        const response = await fetch("/api/ai/explain", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...requestPayload,
            modelTier,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;

          throw new Error(
            payload?.error ?? "AI explanation is unavailable right now.",
          );
        }

        const responseBody = await response.json().catch(() => null);
        const parsedOutput = explanationPayloadSchema.safeParse(responseBody);

        if (!parsedOutput.success) {
          throw new Error(
            parsedOutput.error.issues[0]?.message ??
              "AI explanation returned an unexpected format.",
          );
        }

        if (abortController.signal.aborted || !isMountedRef.current) {
          return;
        }

        setAiExplanation(parsedOutput.data);
        setAiState("ready");
      } catch (error) {
        if (abortController.signal.aborted || !isMountedRef.current) {
          return;
        }

        setAiExplanation(null);
        setAiState("error");
        setAiErrorMessage(getAiErrorMessage(error));
      } finally {
        if (explainAbortControllerRef.current === abortController) {
          explainAbortControllerRef.current = null;
        }
      }
    },
    [setVocabularySaveStatus],
  );

  const retryAiExplanation = useCallback(
    (modelTier: ExplainSelectionInput["modelTier"] = "primary") => {
      const requestPayload = retryExplainRequestRef.current;

      if (!requestPayload) {
        return;
      }

      void requestExplanation(requestPayload, modelTier);
    },
    [requestExplanation],
  );

  const saveToVocabulary = useCallback(async () => {
    const requestPayload = retryExplainRequestRef.current;
    const currentSaveState = vocabularySaveStateRef.current;

    if (
      !requestPayload ||
      !aiExplanation ||
      aiExplanation.selectionType !== "word" ||
      currentSaveState === "saving" ||
      currentSaveState === "saved" ||
      currentSaveState === "alreadySaved"
    ) {
      return;
    }

    const selectedWord = requestPayload.selectedText.trim();

    vocabularySaveAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    vocabularySaveAbortControllerRef.current = abortController;

    setVocabularySaveStatus("saving");
    setAiErrorMessage(null);

    try {
      const response = await fetch("/api/vocabulary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildVocabularySavePayload({
            bookId,
            explanation: aiExplanation,
            selectedText: requestPayload.selectedText,
            sourceLanguage: requestPayload.sourceLanguage,
            surroundingParagraph: requestPayload.surroundingParagraph,
          }),
        ),
        signal: abortController.signal,
      });

      if (
        abortController.signal.aborted ||
        !isMountedRef.current ||
        retryExplainRequestRef.current?.selectedText.trim() !== selectedWord
      ) {
        return;
      }

      if (response.status === 409) {
        setVocabularySaveStatus("alreadySaved");
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(
          payload?.error ?? "Unable to save this vocabulary item.",
        );
      }

      setVocabularySaveStatus("saved");
    } catch (error) {
      if (
        abortController.signal.aborted ||
        !isMountedRef.current ||
        retryExplainRequestRef.current?.selectedText.trim() !== selectedWord
      ) {
        return;
      }

      setVocabularySaveStatus("idle");
      setAiErrorMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to save this vocabulary item.",
      );
    } finally {
      if (vocabularySaveAbortControllerRef.current === abortController) {
        vocabularySaveAbortControllerRef.current = null;
      }
    }
  }, [aiExplanation, bookId, setVocabularySaveStatus]);

  const handleSelection = useCallback(
    (_cfiRange: string, contents: Contents) => {
      const selectionPayload = getReaderSelectionPayload(contents);

      if (!selectionPayload) {
        return;
      }

      const requestPayload: PendingExplainRequest = {
        selectedText: selectionPayload.selectedText,
        surroundingParagraph: selectionPayload.surroundingParagraph,
        sourceLanguage: language,
      };
      const shouldAutoRequest = isSingleWordSelection(
        selectionPayload.selectedText,
      );

      explainAbortControllerRef.current?.abort();
      explainAbortControllerRef.current = null;
      vocabularyLookupAbortControllerRef.current?.abort();
      vocabularyLookupAbortControllerRef.current = null;
      vocabularySaveAbortControllerRef.current?.abort();
      vocabularySaveAbortControllerRef.current = null;
      retryExplainRequestRef.current = null;
      setAiState("idle");
      setAiErrorMessage(null);
      setAiExplanation(null);
      setActiveSelectedText(null);
      setVocabularySaveStatus("idle");

      selectionContentsRef.current = contents;
      pendingExplainRequestRef.current = requestPayload;
      setTooltipSelectedText(selectionPayload.selectedText);
      setAiPopoverPosition(
        getPopoverPosition(selectionPayload.rect, readerSurfaceRef.current),
      );
      setIsAiSidebarOpen(false);

      if (shouldAutoRequest) {
        void requestExplanation(requestPayload);
      }
    },
    [language, readerSurfaceRef, requestExplanation, setVocabularySaveStatus],
  );

  const explainPendingSelection = useCallback(() => {
    const pendingRequest = pendingExplainRequestRef.current;
    const retryRequest = retryExplainRequestRef.current;

    if (!pendingRequest && !retryRequest) {
      return;
    }

    const requestPayload = pendingRequest ?? retryRequest;
    const shouldStartRequest =
      !!pendingRequest && !isSameExplainRequest(pendingRequest, retryRequest);

    clearPendingSelection();
    setIsAiSidebarOpen(true);

    if (requestPayload && shouldStartRequest) {
      void requestExplanation(requestPayload);
    }
  }, [clearPendingSelection, requestExplanation]);

  const copyPendingSelection = useCallback(async () => {
    const textToCopy =
      tooltipSelectedText ?? pendingExplainRequestRef.current?.selectedText;

    if (!textToCopy) {
      return;
    }

    await navigator.clipboard.writeText(textToCopy).catch(() => null);
    clearPendingSelection();
  }, [clearPendingSelection, tooltipSelectedText]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      explainAbortControllerRef.current?.abort();
      explainAbortControllerRef.current = null;
      vocabularyLookupAbortControllerRef.current?.abort();
      vocabularyLookupAbortControllerRef.current = null;
      vocabularySaveAbortControllerRef.current?.abort();
      vocabularySaveAbortControllerRef.current = null;
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!aiPopoverPosition) {
      return;
    }

    const handleViewportChange = () => {
      clearPendingSelection();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [aiPopoverPosition, clearPendingSelection]);

  useEffect(() => {
    if (aiState !== "ready" || !aiExplanation) {
      vocabularyLookupAbortControllerRef.current?.abort();
      vocabularyLookupAbortControllerRef.current = null;
      return;
    }

    const requestPayload = retryExplainRequestRef.current;
    const word = requestPayload?.selectedText.trim();

    if (!requestPayload || !word) {
      return;
    }

    if (aiExplanation.selectionType !== "word") {
      vocabularyLookupAbortControllerRef.current?.abort();
      vocabularyLookupAbortControllerRef.current = null;
      return;
    }

    vocabularyLookupAbortControllerRef.current?.abort();

    const abortController = new AbortController();
    vocabularyLookupAbortControllerRef.current = abortController;
    let isActive = true;

    const searchParams = new URLSearchParams({
      word,
      bookId,
      page: "1",
      limit: "1",
    });

    void (async () => {
      try {
        const response = await fetch(
          `/api/vocabulary?${searchParams.toString()}`,
          {
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          return;
        }

        const payload = (await response.json().catch(() => null)) as {
          items?: Array<{ id: string }>;
        } | null;

        if (
          !isActive ||
          abortController.signal.aborted ||
          retryExplainRequestRef.current?.selectedText.trim() !== word
        ) {
          return;
        }

        if (
          (payload?.items?.length ?? 0) > 0 &&
          vocabularySaveStateRef.current === "idle"
        ) {
          setVocabularySaveStatus("alreadySaved");
        }
      } catch {
        if (abortController.signal.aborted) {
          return;
        }

        return;
      } finally {
        if (vocabularyLookupAbortControllerRef.current === abortController) {
          vocabularyLookupAbortControllerRef.current = null;
        }
      }
    })();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [aiExplanation, aiState, bookId, setVocabularySaveStatus]);

  const panel = (
    <ReaderAiPanel
      errorMessage={aiErrorMessage}
      explanation={aiExplanation}
      isSidebarOpen={isAiSidebarOpen}
      onCopySelection={() => {
        void copyPendingSelection();
      }}
      onExplainSelection={explainPendingSelection}
      onOpenSidebar={() => setIsAiSidebarOpen(true)}
      onRetry={() => retryAiExplanation()}
      onSaveToVocabulary={() => {
        void saveToVocabulary();
      }}
      onDismissPopover={clearPendingSelection}
      popoverPosition={aiPopoverPosition}
      saveState={vocabularySaveState}
      selectedText={activeSelectedText}
      state={aiState}
      tooltipSelectedText={tooltipSelectedText}
    />
  );

  return children({
    clearPendingSelection,
    dismissPanels,
    onSelection: handleSelection,
    panel,
  });
}
