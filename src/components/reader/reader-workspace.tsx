"use client";

import { useCallback, useRef, useState } from "react";

import {
  ReaderEpubView,
  type ReaderEpubViewHandle,
} from "@/components/reader/reader-epub-view";
import {
  ReaderProgressSync,
  useReaderProgressSync,
} from "@/components/reader/reader-progress-sync";
import { ReaderSelectionHandler } from "@/components/reader/reader-selection-handler";
import { ReaderToolbar } from "@/components/reader/reader-toolbar";
import type { ReaderViewState } from "@/components/reader/reader-workspace-types";
import { getReaderInitialLocationLabel } from "@/components/reader/reader-workspace-utils";
import type { ReaderMetadata } from "@/lib/reader";
import type { ReaderBookSnapshot } from "@/types";

function getInitialReaderMetadata(book: ReaderBookSnapshot): ReaderMetadata {
  return {
    title: book.title,
    author: book.author,
    language: book.language,
  };
}

function getInitialReaderState(book: ReaderBookSnapshot): ReaderViewState {
  return {
    activeCfi: book.progressCfi,
    canGoNext: false,
    canGoPrevious: false,
    errorMessage: null,
    isReady: false,
    locationLabel: getReaderInitialLocationLabel(book.progressCfi),
  };
}

export function ReaderWorkspace({
  initialBook,
}: {
  initialBook: ReaderBookSnapshot;
}) {
  const readerSurfaceRef = useRef<HTMLDivElement | null>(null);
  const epubViewRef = useRef<ReaderEpubViewHandle | null>(null);

  const [metadata, setMetadata] = useState<ReaderMetadata>(
    getInitialReaderMetadata(initialBook),
  );
  const [readerState, setReaderState] = useState<ReaderViewState>(
    getInitialReaderState(initialBook),
  );

  const { handleRestoreFailure, saveState, saveStatusLabel } =
    useReaderProgressSync({
      activeCfi: readerState.activeCfi,
      bookId: initialBook.id,
      initialCfi: initialBook.progressCfi,
      initialUpdatedAt: initialBook.progressUpdatedAt,
      isReady: readerState.isReady,
      readerErrorMessage: readerState.errorMessage,
    });

  const handleReaderStateChange = useCallback(
    (nextState: Partial<ReaderViewState>) => {
      setReaderState((currentState) => ({
        ...currentState,
        ...nextState,
      }));
    },
    [],
  );

  const moveBack = useCallback(() => {
    void epubViewRef.current?.navigate("previous");
  }, []);

  const moveForward = useCallback(() => {
    void epubViewRef.current?.navigate("next");
  }, []);

  return (
    <ReaderSelectionHandler
      bookId={initialBook.id}
      language={metadata.language}
      readerSurfaceRef={readerSurfaceRef}
    >
      {({ clearPendingSelection, dismissPanels, onSelection, panel }) => (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <ReaderToolbar
            canGoNext={readerState.canGoNext}
            canGoPrevious={readerState.canGoPrevious}
            isReady={readerState.isReady}
            locationLabel={readerState.locationLabel}
            metadata={metadata}
            onNext={moveForward}
            onPrevious={moveBack}
            saveState={saveState}
            saveStatusLabel={saveStatusLabel}
          >
            <ReaderEpubView
              ref={epubViewRef}
              initialBook={initialBook}
              onClearPendingSelection={clearPendingSelection}
              onDismissPanels={dismissPanels}
              onMetadataChange={setMetadata}
              onRestoreFailure={handleRestoreFailure}
              onSelected={onSelection}
              onStateChange={handleReaderStateChange}
              readerSurfaceRef={readerSurfaceRef}
            />
          </ReaderToolbar>

          <aside className="xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]">
            <div className="flex flex-col gap-6 border border-zinc-200/40 bg-zinc-50/60 p-6 xl:h-full xl:min-h-0 xl:overflow-y-auto dark:border-zinc-800/40 dark:bg-zinc-900/20">
              {panel}
              <ReaderProgressSync
                initialProgressCfi={initialBook.progressCfi}
                isReady={readerState.isReady}
                locationLabel={readerState.locationLabel}
                saveStatusLabel={saveStatusLabel}
              />
            </div>
          </aside>
        </div>
      )}
    </ReaderSelectionHandler>
  );
}
