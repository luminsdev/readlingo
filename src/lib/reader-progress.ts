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
