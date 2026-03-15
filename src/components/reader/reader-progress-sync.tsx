"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  return (
    <Card>
      <CardHeader>
        <Badge>Resume state</Badge>
        <CardTitle className="font-serif text-2xl">Progress sync</CardTitle>
        <CardDescription>
          EPUB CFI locations are saved in the background and restored on the
          next open.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="text-muted-foreground border-border/70 rounded-[24px] border bg-white/70 p-4">
          <p className="text-foreground font-medium">Current save state</p>
          <p className="mt-1">{saveStatusLabel}</p>
        </div>

        <div className="text-muted-foreground border-border/70 rounded-[24px] border bg-white/70 p-4">
          <p className="text-foreground font-medium">
            Current reading position
          </p>
          <p className="mt-1 text-xs break-all">
            {(isReady ? locationLabel : null) ??
              (initialProgressCfi ? "Restoring your last page..." : null) ??
              "This book will save its first reading location after you move."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
