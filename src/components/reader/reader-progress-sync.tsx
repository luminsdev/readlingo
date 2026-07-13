"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clearLocalStorageProgress,
  createReaderPagehideFlushHandler,
  getProgressSyncBackoffMs,
  getProgressSyncStateForAttempt,
  getProgressSyncStatusLabel,
  setLocalStorageProgress,
  shouldSyncProgress,
} from "@/lib/reader-progress";

import type { SaveState } from "@/components/reader/reader-workspace-types";
import { SAVE_DEBOUNCE_MS } from "@/components/reader/reader-workspace-utils";

const FOCUS_RETRY_COOLDOWN_MS = 1500;

type UseReaderProgressSyncProps = {
  activeCfi: string | null;
  bookId: string;
  initialCfi: string | null;
  initialUpdatedAt: string | null;
  isReady: boolean;
  progressPercentage: number | null;
  readerErrorMessage: string | null;
};

type ReaderProgressSyncProps = {
  initialProgressCfi: string | null;
  isReady: boolean;
  locationLabel: string;
  progressPercentage: number | null;
  saveStatusLabel: string;
};

export function useReaderProgressSync({
  activeCfi,
  bookId,
  initialCfi,
  initialUpdatedAt,
  isReady,
  progressPercentage,
  readerErrorMessage,
}: UseReaderProgressSyncProps) {
  const activeCfiRef = useRef(activeCfi);
  const lastServerAckedCfiRef = useRef(initialCfi);
  const lastLocalSavedCfiRef = useRef<string | null>(null);
  const lastLocalSavedSequenceRef = useRef(0);
  const pendingSaveCfiRef = useRef<string | null>(null);
  const progressPercentageRef = useRef(progressPercentage);
  const saveAbortControllerRef = useRef<AbortController | null>(null);
  const backoffRetryTimeoutRef = useRef<number | null>(null);
  const retryAttemptRef = useRef(0);
  const isSavingRef = useRef(false);
  const lastFocusRetryRef = useRef({
    attemptedAt: 0,
    cfi: null as string | null,
  });
  const saveSequenceRef = useRef(0);
  const saveRequestIdRef = useRef(0);

  const [saveState, setSaveState] = useState<SaveState>(
    initialCfi ? "synced" : "idle",
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    initialUpdatedAt,
  );

  useEffect(() => {
    activeCfiRef.current = activeCfi;
  }, [activeCfi]);

  useEffect(() => {
    progressPercentageRef.current = progressPercentage;
  }, [progressPercentage]);

  useEffect(() => {
    lastServerAckedCfiRef.current = initialCfi;
    lastLocalSavedCfiRef.current = null;
    lastLocalSavedSequenceRef.current = 0;
    pendingSaveCfiRef.current = null;
    retryAttemptRef.current = 0;
    saveSequenceRef.current = 0;
    if (backoffRetryTimeoutRef.current !== null) {
      window.clearTimeout(backoffRetryTimeoutRef.current);
      backoffRetryTimeoutRef.current = null;
    }
    setSaveState(initialCfi ? "synced" : "idle");
    setLastSyncedAt(initialUpdatedAt);
  }, [bookId, initialCfi, initialUpdatedAt]);

  useEffect(() => {
    if (readerErrorMessage) {
      setSaveState("idle");
    }
  }, [readerErrorMessage]);

  const saveProgress = useCallback(
    async (cfi: string, keepalive = false, isRetry = false) => {
      if (!shouldSyncProgress(cfi, lastServerAckedCfiRef.current)) {
        return;
      }

      if (!keepalive && backoffRetryTimeoutRef.current !== null) {
        window.clearTimeout(backoffRetryTimeoutRef.current);
        backoffRetryTimeoutRef.current = null;
      }

      const saveSequence = saveSequenceRef.current + 1;
      saveSequenceRef.current = saveSequence;

      const didSaveLocally = setLocalStorageProgress(
        bookId,
        cfi,
        progressPercentageRef.current,
      );
      pendingSaveCfiRef.current = cfi;

      if (didSaveLocally) {
        lastLocalSavedCfiRef.current = cfi;
        lastLocalSavedSequenceRef.current = saveSequence;
      }

      setSaveState(getProgressSyncStateForAttempt({ didSaveLocally, isRetry }));

      if (isSavingRef.current) {
        pendingSaveCfiRef.current = cfi;
        saveAbortControllerRef.current?.abort();

        if (!keepalive) {
          return;
        }
      }

      pendingSaveCfiRef.current = cfi;
      isSavingRef.current = true;
      const saveRequestId = saveRequestIdRef.current + 1;
      saveRequestIdRef.current = saveRequestId;

      const abortController = new AbortController();
      saveAbortControllerRef.current = abortController;
      let didSaveProgress = false;
      let didAbortForNewerProgress = false;

      try {
        const response = await fetch(`/api/books/${bookId}/progress`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cfi,
            ...(progressPercentageRef.current != null
              ? { percentage: progressPercentageRef.current / 100 }
              : {}),
          }),
          keepalive,
          signal: keepalive ? undefined : abortController.signal,
        });

        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          progress?: {
            cfi: string;
            updatedAt: string;
          };
        } | null;

        if (!response.ok || !payload?.progress) {
          throw new Error(
            payload?.error ?? "Unable to save your reading progress.",
          );
        }

        lastServerAckedCfiRef.current = payload.progress.cfi;
        if (backoffRetryTimeoutRef.current !== null) {
          window.clearTimeout(backoffRetryTimeoutRef.current);
          backoffRetryTimeoutRef.current = null;
        }
        if (pendingSaveCfiRef.current === payload.progress.cfi) {
          pendingSaveCfiRef.current = null;
        }
        if (lastLocalSavedCfiRef.current === payload.progress.cfi) {
          clearLocalStorageProgress(bookId);
          lastLocalSavedCfiRef.current = null;
          lastLocalSavedSequenceRef.current = 0;
        } else if (
          lastLocalSavedCfiRef.current !== null &&
          lastLocalSavedSequenceRef.current > saveSequence
        ) {
          setLocalStorageProgress(
            bookId,
            lastLocalSavedCfiRef.current,
            progressPercentageRef.current,
          );
        } else if (lastLocalSavedCfiRef.current !== null) {
          clearLocalStorageProgress(bookId);
          lastLocalSavedCfiRef.current = null;
          lastLocalSavedSequenceRef.current = 0;
        }

        retryAttemptRef.current = 0;
        setLastSyncedAt(payload.progress.updatedAt);
        setSaveState(
          shouldSyncProgress(
            pendingSaveCfiRef.current,
            lastServerAckedCfiRef.current,
          )
            ? "saved_local"
            : "synced",
        );
        didSaveProgress = true;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          didAbortForNewerProgress = true;
        } else {
          setSaveState("error");

          if (backoffRetryTimeoutRef.current === null) {
            const retryCfi = pendingSaveCfiRef.current ?? cfi;
            const retryDelay = getProgressSyncBackoffMs(
              retryAttemptRef.current,
            );
            retryAttemptRef.current += 1;

            backoffRetryTimeoutRef.current = window.setTimeout(() => {
              backoffRetryTimeoutRef.current = null;
              const nextCfi =
                pendingSaveCfiRef.current ??
                lastLocalSavedCfiRef.current ??
                retryCfi;

              if (
                nextCfi &&
                shouldSyncProgress(nextCfi, lastServerAckedCfiRef.current)
              ) {
                void saveProgress(nextCfi, false, true);
              }
            }, retryDelay);
          }
        }
      } finally {
        if (saveAbortControllerRef.current === abortController) {
          saveAbortControllerRef.current = null;
        }
        if (saveRequestIdRef.current === saveRequestId) {
          isSavingRef.current = false;
        }
      }

      // Successful saves and intentional aborts both unlock the latest queued CFI.
      if (
        (didSaveProgress || didAbortForNewerProgress) &&
        saveRequestIdRef.current === saveRequestId
      ) {
        const nextCfi = pendingSaveCfiRef.current;
        if (
          nextCfi &&
          shouldSyncProgress(nextCfi, lastServerAckedCfiRef.current)
        ) {
          void saveProgress(nextCfi, false);
        }
      }
    },
    [bookId],
  );

  const retryPendingProgress = useCallback(
    (source?: "focus") => {
      const pendingCfi = pendingSaveCfiRef.current;

      if (
        !pendingCfi ||
        !shouldSyncProgress(pendingCfi, lastServerAckedCfiRef.current)
      ) {
        return;
      }

      if (source === "focus") {
        const now = Date.now();

        if (
          lastFocusRetryRef.current.cfi === pendingCfi &&
          now - lastFocusRetryRef.current.attemptedAt < FOCUS_RETRY_COOLDOWN_MS
        ) {
          return;
        }

        lastFocusRetryRef.current = { attemptedAt: now, cfi: pendingCfi };
      }

      void saveProgress(pendingCfi, false, true);
    },
    [saveProgress],
  );

  useEffect(() => {
    if (!isReady || !activeCfi) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveProgress(activeCfi);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeCfi, isReady, saveProgress]);

  useEffect(() => {
    const flushProgress = createReaderPagehideFlushHandler({
      getActiveCfi: () => activeCfiRef.current,
      getLastServerAckedCfi: () => lastServerAckedCfiRef.current,
      saveProgress,
    });

    window.addEventListener("pagehide", flushProgress);

    return () => {
      window.removeEventListener("pagehide", flushProgress);
      flushProgress();
    };
  }, [saveProgress]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const handleOnline = () => {
      retryPendingProgress();
    };
    const handleWindowFocus = () => {
      retryPendingProgress("focus");
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        retryPendingProgress();
      } else if (document.visibilityState === "hidden") {
        const activeCfi = activeCfiRef.current;

        if (
          activeCfi &&
          shouldSyncProgress(activeCfi, lastServerAckedCfiRef.current)
        ) {
          void saveProgress(activeCfi, true);
        }
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isReady, retryPendingProgress, saveProgress]);

  const handleRestoreFailure = useCallback(() => {
    lastServerAckedCfiRef.current = null;
    lastLocalSavedCfiRef.current = null;
    lastLocalSavedSequenceRef.current = 0;
    pendingSaveCfiRef.current = null;
  }, []);

  const saveStatusLabel = useMemo(() => {
    return getProgressSyncStatusLabel({
      state: saveState,
      syncedAt: lastSyncedAt,
    });
  }, [lastSyncedAt, saveState]);

  return {
    handleRestoreFailure,
    saveState,
    saveStatusLabel,
  };
}

export function ReaderProgressSync({
  initialProgressCfi,
  isReady,
  locationLabel,
  progressPercentage,
  saveStatusLabel,
}: ReaderProgressSyncProps) {
  const isSyncing =
    saveStatusLabel === "Syncing…" || saveStatusLabel === "Retrying sync…";
  const isSavedLocally = saveStatusLabel === "Saved on this device";
  const isPaused = saveStatusLabel === "Couldn't sync · will retry";

  return (
    <div className="space-y-6 px-1 pt-4">
      <div className="space-y-2">
        <p className="text-ink-kicker flex items-center gap-2 text-[10px] font-medium tracking-[0.2em] uppercase">
          <span className="relative flex size-1.5">
            {isSyncing ? (
              <>
                <span className="bg-ink-kicker absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
                <span className="bg-accent relative inline-flex size-1.5 rounded-full"></span>
              </>
            ) : isPaused ? (
              <span className="relative inline-flex size-1.5 rounded-full bg-red-500/50"></span>
            ) : isSavedLocally ? (
              <span className="bg-accent/70 relative inline-flex size-1.5 rounded-full"></span>
            ) : (
              <span className="border-line-strong relative inline-flex size-1.5 border"></span>
            )}
          </span>
          Sync Status
        </p>
        <p className="text-ink-muted text-xs font-medium">{saveStatusLabel}</p>
      </div>

      <div className="space-y-2">
        <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
          Position Locator
        </p>
        <p className="text-ink-muted font-serif text-[11px] tracking-wide break-all italic">
          {(isReady ? locationLabel : null) ??
            (initialProgressCfi ? "Restoring your last page..." : null) ??
            "Tracking will begin after movement."}
        </p>
        {progressPercentage !== null ? (
          <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em]">
            {progressPercentage}% complete
          </p>
        ) : null}
      </div>
    </div>
  );
}
