export function createReaderPagehideFlushHandler({
  getActiveCfi,
  getLastPersistedCfi,
  saveProgress,
}: {
  getActiveCfi: () => string | null;
  getLastPersistedCfi: () => string | null;
  saveProgress: (cfi: string, keepalive?: boolean) => void | Promise<void>;
}) {
  return () => {
    const activeCfi = getActiveCfi();

    if (!activeCfi || activeCfi === getLastPersistedCfi()) {
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

const READER_PROGRESS_STORAGE_PREFIX = "readlingo:progress:";

function getReaderProgressStorageKey(bookId: string) {
  return `${READER_PROGRESS_STORAGE_PREFIX}${bookId}`;
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
): void {
  if (typeof window === "undefined") {
    return;
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
  } catch (error) {
    console.error("Failed to save progress to localStorage:", error);
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
