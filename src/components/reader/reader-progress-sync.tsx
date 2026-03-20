"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createReaderPagehideFlushHandler } from "@/lib/reader-progress";

import type { SaveState } from "@/components/reader/reader-workspace-types";
import {
  formatSavedTimestamp,
  SAVE_DEBOUNCE_MS,
} from "@/components/reader/reader-workspace-utils";

type UseReaderProgressSyncProps = {
  activeCfi: string | null;
  bookId: string;
  initialCfi: string | null;
  initialUpdatedAt: string | null;
  isReady: boolean;
  readerErrorMessage: string | null;
};

type ReaderProgressSyncProps = {
  initialProgressCfi: string | null;
  isReady: boolean;
  locationLabel: string;
  saveStatusLabel: string;
};

export function useReaderProgressSync({
  activeCfi,
  bookId,
  initialCfi,
  initialUpdatedAt,
  isReady,
  readerErrorMessage,
}: UseReaderProgressSyncProps) {
  const activeCfiRef = useRef(activeCfi);
  const lastPersistedCfiRef = useRef(initialCfi);
  const pendingSaveCfiRef = useRef<string | null>(null);
  const saveAbortControllerRef = useRef<AbortController | null>(null);
  const isSavingRef = useRef(false);

  const [saveState, setSaveState] = useState<SaveState>(
    initialCfi ? "saved" : "idle",
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialUpdatedAt,
  );

  useEffect(() => {
    activeCfiRef.current = activeCfi;
  }, [activeCfi]);

  useEffect(() => {
    lastPersistedCfiRef.current = initialCfi;
    pendingSaveCfiRef.current = null;
    setSaveState(initialCfi ? "saved" : "idle");
    setLastSavedAt(initialUpdatedAt);
  }, [bookId, initialCfi, initialUpdatedAt]);

  useEffect(() => {
    if (readerErrorMessage) {
      setSaveState("idle");
    }
  }, [readerErrorMessage]);

  const saveProgress = useCallback(
    async (cfi: string, keepalive = false) => {
      if (!cfi || lastPersistedCfiRef.current === cfi) {
        return;
      }

      if (isSavingRef.current) {
        pendingSaveCfiRef.current = cfi;
        saveAbortControllerRef.current?.abort();
        return;
      }

      pendingSaveCfiRef.current = cfi;
      isSavingRef.current = true;
      setSaveState("saving");

      const abortController = new AbortController();
      saveAbortControllerRef.current = abortController;

      try {
        const response = await fetch(`/api/books/${bookId}/progress`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cfi }),
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

        lastPersistedCfiRef.current = payload.progress.cfi;
        if (pendingSaveCfiRef.current === payload.progress.cfi) {
          pendingSaveCfiRef.current = null;
        }

        setLastSavedAt(payload.progress.updatedAt);
        setSaveState("saved");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setSaveState("error");
      } finally {
        if (saveAbortControllerRef.current === abortController) {
          saveAbortControllerRef.current = null;
        }
        isSavingRef.current = false;
      }

      const nextCfi = pendingSaveCfiRef.current;
      if (nextCfi && nextCfi !== lastPersistedCfiRef.current) {
        void saveProgress(nextCfi, false);
      }
    },
    [bookId],
  );

  const retryPendingProgress = useCallback(() => {
    const pendingCfi = pendingSaveCfiRef.current;

    if (!pendingCfi || pendingCfi === lastPersistedCfiRef.current) {
      return;
    }

    void saveProgress(pendingCfi);
  }, [saveProgress]);

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
      getLastPersistedCfi: () => lastPersistedCfiRef.current,
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
      retryPendingProgress();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        retryPendingProgress();
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
  }, [isReady, retryPendingProgress]);

  const handleRestoreFailure = useCallback(() => {
    lastPersistedCfiRef.current = null;
    pendingSaveCfiRef.current = null;
  }, []);

  const saveStatusLabel = useMemo(() => {
    if (saveState === "saving") {
      return "Saving location...";
    }

    if (saveState === "error") {
      return "Progress sync paused";
    }

    if (saveState === "saved") {
      return formatSavedTimestamp(lastSavedAt);
    }

    return "Progress tracking starts after your first move";
  }, [lastSavedAt, saveState]);

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
  saveStatusLabel,
}: ReaderProgressSyncProps) {
  const isSaving = saveStatusLabel === "Saving location...";
  const isPaused = saveStatusLabel === "Progress sync paused";

  return (
    <div className="space-y-6 px-1 pt-4">
      <div className="space-y-2">
        <p className="text-ink-kicker flex items-center gap-2 text-[10px] font-medium tracking-[0.2em] uppercase">
          <span className="relative flex size-1.5">
            {isSaving ? (
              <>
                <span className="bg-ink-kicker absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
                <span className="bg-accent relative inline-flex size-1.5 rounded-full"></span>
              </>
            ) : isPaused ? (
              <span className="relative inline-flex size-1.5 rounded-full bg-red-500/50"></span>
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
      </div>
    </div>
  );
}
