export function createReaderPagehideFlushHandler({
  getActiveCfi,
  getLastServerAckedCfi,
  saveProgress,
}: {
  getActiveCfi: () => string | null;
  getLastServerAckedCfi: () => string | null;
  saveProgress: (cfi: string, keepalive?: boolean) => void | Promise<void>;
}) {
  return () => {
    const activeCfi = getActiveCfi();

    if (!activeCfi || !shouldSyncProgress(activeCfi, getLastServerAckedCfi())) {
      return;
    }

    void saveProgress(activeCfi, true);
  };
}

export type CachedProgress = {
  cfi: string;
  percentage: number | null;
  timestamp: number;
};

export type ProgressSyncState =
  | "idle"
  | "saved_local"
  | "syncing"
  | "synced"
  | "error"
  | "retrying";

const PROGRESS_SYNC_BACKOFF_BASE_MS = 1_000;
const PROGRESS_SYNC_BACKOFF_MAX_MS = 30_000;

const READER_PROGRESS_STORAGE_PREFIX = "readlingo:progress:";

function getReaderProgressStorageKey(bookId: string) {
  return `${READER_PROGRESS_STORAGE_PREFIX}${bookId}`;
}

export function shouldSyncProgress(
  cfi: string | null,
  serverAckedCfi: string | null,
) {
  return Boolean(cfi) && cfi !== serverAckedCfi;
}

export function getProgressSyncBackoffMs(attempt: number) {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const delay = PROGRESS_SYNC_BACKOFF_BASE_MS * 2 ** safeAttempt;

  return Math.min(delay, PROGRESS_SYNC_BACKOFF_MAX_MS);
}

export function getProgressSyncStateForAttempt({
  didSaveLocally,
  isRetry,
}: {
  didSaveLocally: boolean;
  isRetry: boolean;
}): ProgressSyncState {
  if (isRetry) {
    return "retrying";
  }

  return didSaveLocally ? "saved_local" : "syncing";
}

export function getProgressSyncStatusLabel({
  state,
  syncedAt,
}: {
  state: ProgressSyncState;
  syncedAt: string | null;
}) {
  switch (state) {
    case "saved_local":
      return "Saved on this device";
    case "syncing":
      return "Syncing…";
    case "synced":
      if (!syncedAt) {
        return "Synced";
      }

      return `Synced · ${new Date(syncedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    case "error":
      return "Couldn't sync · will retry";
    case "retrying":
      return "Retrying sync…";
    case "idle":
      return "Progress tracking starts after your first move";
  }
}

export function getLocalStorageProgress(bookId: string): CachedProgress | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cached = localStorage.getItem(getReaderProgressStorageKey(bookId));

    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached) as unknown;

    if (
      parsed &&
      typeof parsed === "object" &&
      "cfi" in parsed &&
      typeof parsed.cfi === "string" &&
      "timestamp" in parsed &&
      typeof parsed.timestamp === "number"
    ) {
      const percentage =
        "percentage" in parsed && typeof parsed.percentage === "number"
          ? parsed.percentage
          : null;

      return {
        cfi: parsed.cfi,
        percentage,
        timestamp: parsed.timestamp,
      };
    }
  } catch (error) {
    console.error("Failed to parse cached progress from localStorage:", error);
  }

  return null;
}

export function setLocalStorageProgress(
  bookId: string,
  cfi: string,
  percentage: number | null,
): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const data: CachedProgress = {
      cfi,
      percentage,
      timestamp: Date.now(),
    };

    localStorage.setItem(
      getReaderProgressStorageKey(bookId),
      JSON.stringify(data),
    );
    return true;
  } catch (error) {
    console.error("Failed to save progress to localStorage:", error);
    return false;
  }
}

export function clearLocalStorageProgress(bookId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(getReaderProgressStorageKey(bookId));
  } catch (error) {
    console.error("Failed to clear progress from localStorage:", error);
  }
}
