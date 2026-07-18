"use client";

import { parsePartialJson } from "ai";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type Contents from "epubjs/types/contents";

import {
  ReaderAiPanel,
  type ExistingVocabulary,
} from "@/components/reader/reader-ai-panel";
import type {
  PendingExplainRequest,
  ReaderSelectionHandlerRenderProps,
} from "@/components/reader/reader-workspace-types";
import { getPopoverPosition } from "@/components/reader/reader-workspace-utils";
import {
  getAiErrorMessage,
  isSingleWordSelection,
  normalizeExplanationPayload,
} from "@/lib/ai";
import { getAvailableDeepActions } from "@/lib/ai-deep-actions";
import {
  buildDeepActionErrorState,
  buildStreamingDeepActionResult,
  parseCompletedDeepActionResult,
  type DeepActionUiStates,
} from "@/lib/ai-deep-action-streaming";
import {
  buildStreamingExplanationPayload,
  parseReadyStreamingExplanation,
  type StreamingExplanationPayload,
} from "@/lib/ai-streaming";
import {
  aiExplanationSchema,
  explanationPayloadSchema,
  type DeepAction,
  type ExplainSelectionInput,
} from "@/lib/ai-validation";
import {
  clearReaderSelection,
  getReaderSelectionPayload,
} from "@/lib/reader-selection";
import { buildVocabularySavePayload } from "@/lib/vocabulary";

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

function isStreamObjectPayload(
  value: unknown,
): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const STREAM_INTERRUPTED_MESSAGE =
  "AI explanation stream was interrupted. Please try again.";
const INVALID_STREAM_FORMAT_MESSAGE =
  "AI explanation returned an unexpected format. Please try again.";
const DEEP_ACTION_STREAM_INTERRUPTED_MESSAGE =
  "AI follow-up stream was interrupted. Please try again.";
const INVALID_DEEP_ACTION_STREAM_FORMAT_MESSAGE =
  "AI follow-up returned an unexpected format. Please try again.";
const DEEP_ACTION_TIMEOUT_MESSAGE = "AI follow-up timed out. Please try again.";
const DEEP_ACTION_TIMEOUT_MS = 25_000;
const IDLE_DEEP_ACTION_STATES = {
  grammar: { status: "idle", result: null, errorMessage: null },
  compare: { status: "idle", result: null, errorMessage: null },
  easierExamples: { status: "idle", result: null, errorMessage: null },
  conjugation: { status: "idle", result: null, errorMessage: null },
  collocation: { status: "idle", result: null, errorMessage: null },
} satisfies DeepActionUiStates;

export function ReaderSelectionHandler({
  bookId,
  children,
  language,
  readerSurfaceRef,
}: ReaderSelectionHandlerProps) {
  const explainAbortControllerRef = useRef<AbortController | null>(null);
  const pendingExplainRequestRef = useRef<PendingExplainRequest | null>(null);
  const retryExplainRequestRef = useRef<PendingExplainRequest | null>(null);
  const explainRequestIdRef = useRef(0);
  const deepActionAbortControllersRef = useRef<
    Record<DeepAction, AbortController | null>
  >({
    grammar: null,
    compare: null,
    easierExamples: null,
    conjugation: null,
    collocation: null,
  });
  const deepActionRequestIdsRef = useRef<Record<DeepAction, number>>({
    grammar: 0,
    compare: 0,
    easierExamples: 0,
    conjugation: 0,
    collocation: 0,
  });
  const deepActionWatchdogsRef = useRef<Record<DeepAction, number | null>>({
    grammar: null,
    compare: null,
    easierExamples: null,
    conjugation: null,
    collocation: null,
  });
  const selectionContentsRef = useRef<Contents | null>(null);
  const vocabularyLookupAbortControllerRef = useRef<AbortController | null>(
    null,
  );
  const vocabularySaveAbortControllerRef = useRef<AbortController | null>(null);
  const dueCardCountAbortControllerRef = useRef<AbortController | null>(null);
  const vocabularySaveStateRef = useRef<
    "idle" | "saving" | "saved" | "alreadySaved"
  >("idle");
  const isMountedRef = useRef(true);

  const [aiState, setAiState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] =
    useState<StreamingExplanationPayload | null>(null);
  const [deepActionStates, setDeepActionStates] = useState<DeepActionUiStates>(
    IDLE_DEEP_ACTION_STATES,
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
  const [isVocabularyLookupPending, setIsVocabularyLookupPending] =
    useState(false);
  const [existingVocabulary, setExistingVocabulary] =
    useState<ExistingVocabulary | null>(null);
  const [dueCardCount, setDueCardCount] = useState<number | null>(null);

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

  const abortAndResetDeepActions = useCallback(() => {
    for (const action of Object.keys(
      deepActionAbortControllersRef.current,
    ) as DeepAction[]) {
      deepActionAbortControllersRef.current[action]?.abort();
      deepActionAbortControllersRef.current[action] = null;
      const watchdogId = deepActionWatchdogsRef.current[action];
      if (watchdogId !== null) {
        window.clearTimeout(watchdogId);
        deepActionWatchdogsRef.current[action] = null;
      }
      deepActionRequestIdsRef.current[action] += 1;
    }

    setDeepActionStates(IDLE_DEEP_ACTION_STATES);
  }, []);

  const dismissPanels = useCallback(() => {
    explainAbortControllerRef.current?.abort();
    explainAbortControllerRef.current = null;
    abortAndResetDeepActions();
    vocabularyLookupAbortControllerRef.current?.abort();
    vocabularyLookupAbortControllerRef.current = null;
    vocabularySaveAbortControllerRef.current?.abort();
    vocabularySaveAbortControllerRef.current = null;
    dueCardCountAbortControllerRef.current?.abort();
    dueCardCountAbortControllerRef.current = null;
    retryExplainRequestRef.current = null;
    clearPendingSelection();
    setAiState("idle");
    setAiErrorMessage(null);
    setAiExplanation(null);
    setIsAiSidebarOpen(false);
    setActiveSelectedText(null);
    setIsVocabularyLookupPending(false);
    setExistingVocabulary(null);
    setDueCardCount(null);
    setVocabularySaveStatus("idle");
  }, [
    abortAndResetDeepActions,
    clearPendingSelection,
    setVocabularySaveStatus,
  ]);

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
      dueCardCountAbortControllerRef.current?.abort();
      dueCardCountAbortControllerRef.current = null;

      const abortController = new AbortController();
      const requestId = explainRequestIdRef.current + 1;

      explainRequestIdRef.current = requestId;
      explainAbortControllerRef.current = abortController;

      setActiveSelectedText(requestPayload.selectedText);
      setAiState("loading");
      setAiErrorMessage(null);
      setAiExplanation(null);
      setIsVocabularyLookupPending(
        isSingleWordSelection(requestPayload.selectedText),
      );
      setExistingVocabulary(null);
      setDueCardCount(null);
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

        if (!response.body) {
          throw new Error("AI explanation stream is unavailable right now.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedText = "";

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            streamedText += decoder.decode(value, { stream: true });

            const parsedPartialResponse = await parsePartialJson(streamedText);

            if (
              abortController.signal.aborted ||
              !isMountedRef.current ||
              explainRequestIdRef.current !== requestId
            ) {
              return;
            }

            if (!isStreamObjectPayload(parsedPartialResponse.value)) {
              continue;
            }

            const partialExplanation = buildStreamingExplanationPayload(
              parsedPartialResponse.value,
              requestPayload.selectedText,
            );

            if (partialExplanation) {
              setAiExplanation(partialExplanation);
            }
          }
        } catch {
          if (abortController.signal.aborted) {
            return;
          }

          throw new Error(STREAM_INTERRUPTED_MESSAGE);
        } finally {
          reader.releaseLock();
        }

        streamedText += decoder.decode();

        const parsedFinalResponse = await parsePartialJson(streamedText);

        if (!isStreamObjectPayload(parsedFinalResponse.value)) {
          throw new Error(INVALID_STREAM_FORMAT_MESSAGE);
        }

        const parsedAiExplanation = aiExplanationSchema.safeParse(
          parsedFinalResponse.value,
        );

        if (!parsedAiExplanation.success) {
          throw new Error(INVALID_STREAM_FORMAT_MESSAGE);
        }

        const normalizedExplanation = normalizeExplanationPayload(
          parsedAiExplanation.data,
          requestPayload.selectedText,
        );
        const parsedOutput = explanationPayloadSchema.safeParse(
          normalizedExplanation,
        );

        if (!parsedOutput.success) {
          throw new Error(INVALID_STREAM_FORMAT_MESSAGE);
        }

        if (
          abortController.signal.aborted ||
          !isMountedRef.current ||
          explainRequestIdRef.current !== requestId
        ) {
          return;
        }

        setAiExplanation(parsedOutput.data);
        setAiState("ready");
      } catch (error) {
        if (
          abortController.signal.aborted ||
          !isMountedRef.current ||
          explainRequestIdRef.current !== requestId
        ) {
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

  const requestDeepAction = useCallback(
    async (action: DeepAction) => {
      const requestPayload = retryExplainRequestRef.current;

      if (!requestPayload || aiState !== "ready") {
        return;
      }

      deepActionAbortControllersRef.current[action]?.abort();
      const previousWatchdogId = deepActionWatchdogsRef.current[action];
      if (previousWatchdogId !== null) {
        window.clearTimeout(previousWatchdogId);
        deepActionWatchdogsRef.current[action] = null;
      }

      const abortController = new AbortController();
      const requestId = deepActionRequestIdsRef.current[action] + 1;

      deepActionAbortControllersRef.current[action] = abortController;
      deepActionRequestIdsRef.current[action] = requestId;
      setDeepActionStates((currentStates) => ({
        ...currentStates,
        [action]: {
          status: "loading",
          result: null,
          errorMessage: null,
        },
      }));

      const isRequestActive = () =>
        isMountedRef.current &&
        deepActionRequestIdsRef.current[action] === requestId &&
        isSameExplainRequest(retryExplainRequestRef.current, requestPayload);
      const isRequestCurrent = () =>
        !abortController.signal.aborted && isRequestActive();
      const watchdogId = window.setTimeout(() => {
        if (deepActionWatchdogsRef.current[action] === watchdogId) {
          deepActionWatchdogsRef.current[action] = null;
        }

        if (!isRequestActive()) {
          return;
        }

        setDeepActionStates((currentStates) => ({
          ...currentStates,
          [action]: buildDeepActionErrorState(
            currentStates[action],
            DEEP_ACTION_TIMEOUT_MESSAGE,
          ),
        }));
        abortController.abort();
      }, DEEP_ACTION_TIMEOUT_MS);
      deepActionWatchdogsRef.current[action] = watchdogId;

      try {
        const response = await fetch("/api/ai/deep-action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...requestPayload,
            action,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;

          throw new Error(
            payload?.error ?? "AI follow-up is unavailable right now.",
          );
        }

        if (!response.body) {
          throw new Error("AI follow-up stream is unavailable right now.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedText = "";

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            streamedText += decoder.decode(value, { stream: true });

            const parsedPartialResponse = await parsePartialJson(streamedText);

            if (!isRequestCurrent()) {
              return;
            }

            const partialResult = buildStreamingDeepActionResult(
              action,
              parsedPartialResponse.value,
            );

            if (partialResult) {
              setDeepActionStates((currentStates) => ({
                ...currentStates,
                [action]: {
                  status: "loading",
                  result: partialResult,
                  errorMessage: null,
                },
              }));
            }
          }
        } catch {
          if (abortController.signal.aborted) {
            return;
          }

          throw new Error(DEEP_ACTION_STREAM_INTERRUPTED_MESSAGE);
        } finally {
          reader.releaseLock();
        }

        streamedText += decoder.decode();

        const parsedFinalResponse = await parsePartialJson(streamedText);
        const finalResult = parseCompletedDeepActionResult(
          action,
          parsedFinalResponse,
        );

        if (!finalResult) {
          throw new Error(INVALID_DEEP_ACTION_STREAM_FORMAT_MESSAGE);
        }

        if (!isRequestCurrent()) {
          return;
        }

        setDeepActionStates((currentStates) => ({
          ...currentStates,
          [action]: {
            status: "ready",
            result: finalResult,
            errorMessage: null,
          },
        }));
      } catch (error) {
        if (!isRequestCurrent()) {
          return;
        }

        setDeepActionStates((currentStates) => ({
          ...currentStates,
          [action]: buildDeepActionErrorState(
            currentStates[action],
            getAiErrorMessage(error),
          ),
        }));
      } finally {
        if (deepActionWatchdogsRef.current[action] === watchdogId) {
          window.clearTimeout(watchdogId);
          deepActionWatchdogsRef.current[action] = null;
        }
        if (deepActionAbortControllersRef.current[action] === abortController) {
          deepActionAbortControllersRef.current[action] = null;
        }
      }
    },
    [aiState],
  );

  const requestDueCardCount = useCallback(() => {
    dueCardCountAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    dueCardCountAbortControllerRef.current = abortController;
    setDueCardCount(null);

    void (async () => {
      try {
        const response = await fetch("/api/flashcards", {
          signal: abortController.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json().catch(() => null)) as {
          dueCount?: unknown;
        } | null;
        const nextDueCardCount = payload?.dueCount;

        if (
          abortController.signal.aborted ||
          !isMountedRef.current ||
          typeof nextDueCardCount !== "number" ||
          !Number.isInteger(nextDueCardCount) ||
          nextDueCardCount < 0
        ) {
          return;
        }

        setDueCardCount(nextDueCardCount);
      } catch {
        return;
      } finally {
        if (dueCardCountAbortControllerRef.current === abortController) {
          dueCardCountAbortControllerRef.current = null;
        }
      }
    })();
  }, []);

  const saveToVocabulary = useCallback(async () => {
    const requestPayload = retryExplainRequestRef.current;
    const currentSaveState = vocabularySaveStateRef.current;
    const readyExplanation = parseReadyStreamingExplanation(
      aiExplanation,
      aiState,
    );

    if (
      !requestPayload ||
      !readyExplanation ||
      readyExplanation.selectionType !== "word" ||
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
            explanation: readyExplanation,
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
      requestDueCardCount();
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
  }, [
    aiExplanation,
    aiState,
    bookId,
    requestDueCardCount,
    setVocabularySaveStatus,
  ]);

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
      abortAndResetDeepActions();
      vocabularyLookupAbortControllerRef.current?.abort();
      vocabularyLookupAbortControllerRef.current = null;
      vocabularySaveAbortControllerRef.current?.abort();
      vocabularySaveAbortControllerRef.current = null;
      dueCardCountAbortControllerRef.current?.abort();
      dueCardCountAbortControllerRef.current = null;
      retryExplainRequestRef.current = null;
      setAiState("idle");
      setAiErrorMessage(null);
      setAiExplanation(null);
      setActiveSelectedText(null);
      setIsVocabularyLookupPending(false);
      setExistingVocabulary(null);
      setDueCardCount(null);
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
    [
      abortAndResetDeepActions,
      language,
      readerSurfaceRef,
      requestExplanation,
      setVocabularySaveStatus,
    ],
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
    const deepActionAbortControllers = deepActionAbortControllersRef.current;
    const deepActionWatchdogs = deepActionWatchdogsRef.current;

    return () => {
      explainAbortControllerRef.current?.abort();
      explainAbortControllerRef.current = null;
      for (const abortController of Object.values(deepActionAbortControllers)) {
        abortController?.abort();
      }
      for (const watchdogId of Object.values(deepActionWatchdogs)) {
        if (watchdogId !== null) {
          window.clearTimeout(watchdogId);
        }
      }
      vocabularyLookupAbortControllerRef.current?.abort();
      vocabularyLookupAbortControllerRef.current = null;
      vocabularySaveAbortControllerRef.current?.abort();
      vocabularySaveAbortControllerRef.current = null;
      dueCardCountAbortControllerRef.current?.abort();
      dueCardCountAbortControllerRef.current = null;
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

      if (aiState !== "loading") {
        setIsVocabularyLookupPending(false);
      }

      setExistingVocabulary(null);
      return;
    }

    const requestPayload = retryExplainRequestRef.current;
    const readyExplanation = parseReadyStreamingExplanation(
      aiExplanation,
      aiState,
    );
    const word = requestPayload?.selectedText.trim();

    if (!requestPayload || !readyExplanation || !word) {
      return;
    }

    if (readyExplanation.selectionType !== "word") {
      vocabularyLookupAbortControllerRef.current?.abort();
      vocabularyLookupAbortControllerRef.current = null;
      setIsVocabularyLookupPending(false);
      return;
    }

    vocabularyLookupAbortControllerRef.current?.abort();
    setIsVocabularyLookupPending(true);
    setExistingVocabulary(null);

    const abortController = new AbortController();
    vocabularyLookupAbortControllerRef.current = abortController;
    let isActive = true;

    const searchParams = new URLSearchParams({
      word,
      bookId,
      page: "1",
      limit: "1",
    });
    searchParams.set("match", "normalized");

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
          items?: ExistingVocabulary[];
        } | null;

        if (
          !isActive ||
          abortController.signal.aborted ||
          retryExplainRequestRef.current?.selectedText.trim() !== word
        ) {
          return;
        }

        const matchedVocabulary = payload?.items?.[0];

        if (matchedVocabulary) {
          setExistingVocabulary(matchedVocabulary);

          if (vocabularySaveStateRef.current === "idle") {
            setVocabularySaveStatus("alreadySaved");
          }
        }
      } catch {
        if (abortController.signal.aborted) {
          return;
        }

        return;
      } finally {
        if (vocabularyLookupAbortControllerRef.current === abortController) {
          vocabularyLookupAbortControllerRef.current = null;
          setIsVocabularyLookupPending(false);
        }
      }
    })();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [aiExplanation, aiState, bookId, setVocabularySaveStatus]);

  const availableDeepActions = getAvailableDeepActions({
    selectedText: activeSelectedText ?? "",
    sourceLanguage: language,
  });

  const panel = (
    <ReaderAiPanel
      availableDeepActions={availableDeepActions}
      contextSentence={retryExplainRequestRef.current?.surroundingParagraph}
      deepActionStates={deepActionStates}
      dueCardCount={dueCardCount}
      errorMessage={aiErrorMessage}
      existingVocabulary={existingVocabulary}
      explanation={aiExplanation}
      isSidebarOpen={isAiSidebarOpen}
      isVocabularyLookupPending={isVocabularyLookupPending}
      onCopySelection={() => {
        void copyPendingSelection();
      }}
      onExplainSelection={explainPendingSelection}
      onRunDeepAction={(action) => {
        void requestDeepAction(action);
      }}
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
    dismissPopover: clearPendingSelection,
    hasPopoverOpen: Boolean(aiPopoverPosition && tooltipSelectedText),
    isAiSidebarOpen,
    onSelection: handleSelection,
    panel,
  });
}
