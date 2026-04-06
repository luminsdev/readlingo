"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

import {
  ReaderEpubView,
  type ReaderEpubViewHandle,
} from "@/components/reader/reader-epub-view";
import {
  getReaderActiveTocHref,
  getReaderEscapeAction,
  type ReaderTocItem,
} from "@/components/reader/reader-table-of-contents-utils";
import { ReaderTableOfContents } from "@/components/reader/reader-table-of-contents";
import {
  ReaderProgressSync,
  useReaderProgressSync,
} from "@/components/reader/reader-progress-sync";
import { ReaderSelectionHandler } from "@/components/reader/reader-selection-handler";
import { ReaderToolbar } from "@/components/reader/reader-toolbar";
import type {
  ReaderSelectionHandlerRenderProps,
  ReaderViewState,
} from "@/components/reader/reader-workspace-types";
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
    chapterHref: null,
    errorMessage: null,
    isReady: false,
    locationLabel: getReaderInitialLocationLabel(book.progressCfi),
  };
}

function ReaderWorkspaceContent({
  clearPendingSelection,
  dismissPanels,
  dismissPopover,
  epubViewRef,
  hasPopoverOpen,
  initialBook,
  isAiSidebarOpen,
  isTocOpen,
  metadata,
  moveBack,
  moveForward,
  onRestoreFailure,
  onReaderStateChange,
  onSelection,
  onTocLoaded,
  panel,
  readerState,
  readerSurfaceRef,
  saveState,
  saveStatusLabel,
  setMetadata,
  setIsTocOpen,
  setTocErrorMessage,
  tocErrorMessage,
  tocItems,
}: ReaderSelectionHandlerRenderProps & {
  epubViewRef: RefObject<ReaderEpubViewHandle | null>;
  initialBook: ReaderBookSnapshot;
  isTocOpen: boolean;
  metadata: ReaderMetadata;
  moveBack: () => void;
  moveForward: () => void;
  onRestoreFailure: () => void;
  onReaderStateChange: (nextState: Partial<ReaderViewState>) => void;
  onTocLoaded: (items: ReaderTocItem[]) => void;
  readerState: ReaderViewState;
  readerSurfaceRef: RefObject<HTMLDivElement | null>;
  saveState: ReturnType<typeof useReaderProgressSync>["saveState"];
  saveStatusLabel: string;
  setIsTocOpen: Dispatch<SetStateAction<boolean>>;
  setMetadata: Dispatch<SetStateAction<ReaderMetadata>>;
  setTocErrorMessage: Dispatch<SetStateAction<string | null>>;
  tocErrorMessage: string | null;
  tocItems: ReaderTocItem[];
}) {
  const activeTocHref = useMemo(
    () => getReaderActiveTocHref(tocItems, readerState.chapterHref),
    [readerState.chapterHref, tocItems],
  );

  const focusTocToggleButton = useCallback(() => {
    window.requestAnimationFrame(() => {
      const toggleButton = document.querySelector<HTMLElement>(
        '[data-reader-toc-toggle="true"]',
      );

      if (toggleButton) {
        toggleButton.focus({ preventScroll: true });
        return;
      }

      readerSurfaceRef.current?.focus({ preventScroll: true });
    });
  }, [readerSurfaceRef]);

  const handleCloseToc = useCallback(
    (shouldRestoreFocus = true) => {
      setTocErrorMessage(null);
      setIsTocOpen(false);

      if (shouldRestoreFocus) {
        focusTocToggleButton();
      }
    },
    [focusTocToggleButton, setIsTocOpen, setTocErrorMessage],
  );

  const handleToggleToc = useCallback(() => {
    if (tocItems.length === 0) {
      return;
    }

    setTocErrorMessage(null);

    if (isTocOpen) {
      handleCloseToc();
      return;
    }

    setIsTocOpen(true);
  }, [
    handleCloseToc,
    isTocOpen,
    setIsTocOpen,
    setTocErrorMessage,
    tocItems.length,
  ]);

  const handleTocNavigate = useCallback(
    async (href: string) => {
      setTocErrorMessage(null);

      const navigationResult = await epubViewRef.current?.displayChapter(href);

      if (navigationResult === "success") {
        handleCloseToc(false);
        return;
      }

      if (navigationResult === "busy") {
        setTocErrorMessage(
          "A page turn is still in progress. Please try that chapter again in a moment.",
        );
        return;
      }

      if (navigationResult === "unavailable") {
        setTocErrorMessage(
          "The reader is still preparing this book. Please wait a moment and try again.",
        );
        return;
      }

      setTocErrorMessage(
        "Unable to open that section right now. Please try another chapter.",
      );
    },
    [epubViewRef, handleCloseToc, setTocErrorMessage],
  );

  const handleEscapeAction = useCallback(() => {
    const action = getReaderEscapeAction({
      hasPopoverOpen,
      isAiSidebarOpen,
      isTocOpen,
    });

    if (!action) {
      return false;
    }

    if (action === "dismiss-popover") {
      dismissPopover();
      return true;
    }

    if (action === "dismiss-ai-sidebar") {
      dismissPanels();
      return true;
    }

    handleCloseToc();
    return true;
  }, [
    handleCloseToc,
    dismissPanels,
    dismissPopover,
    hasPopoverOpen,
    isAiSidebarOpen,
    isTocOpen,
  ]);

  const handleRestoreReaderFailure = useCallback(() => {
    onRestoreFailure();
    handleCloseToc();
  }, [handleCloseToc, onRestoreFailure]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (!handleEscapeAction()) {
        return;
      }

      event.preventDefault();
    };

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [handleEscapeAction]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="relative">
        <ReaderToolbar
          canGoNext={readerState.canGoNext}
          canGoPrevious={readerState.canGoPrevious}
          isReady={readerState.isReady}
          isTocOpen={isTocOpen}
          locationLabel={readerState.locationLabel}
          metadata={metadata}
          onNext={moveForward}
          onPrevious={moveBack}
          onToggleToc={handleToggleToc}
          saveState={saveState}
          saveStatusLabel={saveStatusLabel}
          tocItemCount={tocItems.length}
        >
          <ReaderEpubView
            ref={epubViewRef}
            initialBook={initialBook}
            onClearPendingSelection={clearPendingSelection}
            onDismissPanels={dismissPanels}
            onEscapeKey={handleEscapeAction}
            onMetadataChange={setMetadata}
            onRestoreFailure={handleRestoreReaderFailure}
            onSelected={onSelection}
            onStateChange={onReaderStateChange}
            onTocLoaded={onTocLoaded}
            readerSurfaceRef={readerSurfaceRef}
          />
        </ReaderToolbar>

        <ReaderTableOfContents
          activeHref={activeTocHref}
          errorMessage={tocErrorMessage}
          isOpen={isTocOpen}
          items={tocItems}
          onClose={handleCloseToc}
          onNavigate={(href) => {
            void handleTocNavigate(href);
          }}
        />
      </div>

      <aside className="xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]">
        <div className="border-line bg-surface flex flex-col gap-6 border p-6 xl:h-full xl:min-h-0 xl:overflow-y-auto">
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
  );
}

export function ReaderWorkspace({
  initialBook,
}: {
  initialBook: ReaderBookSnapshot;
}) {
  const readerSurfaceRef = useRef<HTMLDivElement | null>(null);
  const epubViewRef = useRef<ReaderEpubViewHandle | null>(null);
  const [tocErrorMessage, setTocErrorMessage] = useState<string | null>(null);

  const [metadata, setMetadata] = useState<ReaderMetadata>(
    getInitialReaderMetadata(initialBook),
  );
  const [readerState, setReaderState] = useState<ReaderViewState>(
    getInitialReaderState(initialBook),
  );
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [tocItems, setTocItems] = useState<ReaderTocItem[]>([]);

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

  const handleTocLoaded = useCallback((items: ReaderTocItem[]) => {
    setTocItems(items);
    setIsTocOpen(false);
    setTocErrorMessage(null);
  }, []);

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
      {(selectionProps) => (
        <ReaderWorkspaceContent
          {...selectionProps}
          epubViewRef={epubViewRef}
          initialBook={initialBook}
          isTocOpen={isTocOpen}
          metadata={metadata}
          moveBack={moveBack}
          moveForward={moveForward}
          onRestoreFailure={handleRestoreFailure}
          onReaderStateChange={handleReaderStateChange}
          onTocLoaded={handleTocLoaded}
          readerState={readerState}
          readerSurfaceRef={readerSurfaceRef}
          saveState={saveState}
          saveStatusLabel={saveStatusLabel}
          setIsTocOpen={setIsTocOpen}
          setMetadata={setMetadata}
          setTocErrorMessage={setTocErrorMessage}
          tocItems={tocItems}
          tocErrorMessage={tocErrorMessage}
        />
      )}
    </ReaderSelectionHandler>
  );
}
