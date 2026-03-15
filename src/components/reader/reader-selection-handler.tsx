"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Contents from "epubjs/types/contents";
import type { ReactNode, RefObject } from "react";

import { ReaderAiPanel } from "@/components/reader/reader-ai-panel";
import type {
  PendingExplainRequest,
  ReaderSelectionHandlerRenderProps,
} from "@/components/reader/reader-workspace-types";
import {
  getPopoverPosition,
  readSelectionStreamText,
} from "@/components/reader/reader-workspace-utils";
import { getAiErrorMessage, normalizeExplanationPayload } from "@/lib/ai";
import {
  aiExplanationSchema,
  type ExplainSelectionInput,
} from "@/lib/ai-validation";
import {
  clearReaderSelection,
  getReaderSelectionPayload,
} from "@/lib/reader-selection";
import type { ExplanationPayload } from "@/types";

type ReaderSelectionHandlerProps = {
  children: (props: ReaderSelectionHandlerRenderProps) => ReactNode;
  language: string;
  readerSurfaceRef: RefObject<HTMLDivElement | null>;
};

export function ReaderSelectionHandler({
  children,
  language,
  readerSurfaceRef,
}: ReaderSelectionHandlerProps) {
  const explainAbortControllerRef = useRef<AbortController | null>(null);
  const pendingExplainRequestRef = useRef<PendingExplainRequest | null>(null);
  const retryExplainRequestRef = useRef<PendingExplainRequest | null>(null);
  const selectionContentsRef = useRef<Contents | null>(null);
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
    retryExplainRequestRef.current = null;
    clearPendingSelection();
    setAiState("idle");
    setAiErrorMessage(null);
    setAiExplanation(null);
    setIsAiSidebarOpen(false);
    setActiveSelectedText(null);
  }, [clearPendingSelection]);

  const requestExplanation = useCallback(
    async (
      requestPayload: PendingExplainRequest,
      modelTier: ExplainSelectionInput["modelTier"] = "primary",
    ) => {
      retryExplainRequestRef.current = requestPayload;
      explainAbortControllerRef.current?.abort();

      const abortController = new AbortController();
      explainAbortControllerRef.current = abortController;

      setActiveSelectedText(requestPayload.selectedText);
      setAiState("loading");
      setAiErrorMessage(null);
      setAiExplanation(null);

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

        const responseText = (await readSelectionStreamText(response)).trim();

        if (!responseText) {
          throw new Error("AI explanation returned an empty response.");
        }

        const parsedOutput = aiExplanationSchema.safeParse(
          JSON.parse(responseText),
        );

        if (!parsedOutput.success) {
          throw new Error(
            parsedOutput.error.issues[0]?.message ??
              "AI explanation returned an unexpected format.",
          );
        }

        if (abortController.signal.aborted || !isMountedRef.current) {
          return;
        }

        setAiExplanation(
          normalizeExplanationPayload(
            parsedOutput.data,
            requestPayload.selectedText,
          ),
        );
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
    [],
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

      selectionContentsRef.current = contents;
      pendingExplainRequestRef.current = requestPayload;
      setTooltipSelectedText(selectionPayload.selectedText);
      setAiPopoverPosition(
        getPopoverPosition(selectionPayload.rect, readerSurfaceRef.current),
      );
    },
    [language, readerSurfaceRef],
  );

  const explainPendingSelection = useCallback(() => {
    const requestPayload = pendingExplainRequestRef.current;

    if (!requestPayload) {
      return;
    }

    clearPendingSelection();
    setIsAiSidebarOpen(true);
    void requestExplanation(requestPayload);
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
      popoverPosition={aiPopoverPosition}
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
