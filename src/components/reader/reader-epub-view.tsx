"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import Link from "next/link";
import type Book from "epubjs/types/book";
import type Contents from "epubjs/types/contents";
import type { PackagingMetadataObject } from "epubjs/types/packaging";
import type Rendition from "epubjs/types/rendition";
import type { Location as EpubLocation } from "epubjs/types/rendition";
import { LoaderCircle } from "lucide-react";
import { useTheme } from "next-themes";

import type { ReaderViewState } from "@/components/reader/reader-workspace-types";
import {
  getReaderErrorMessage,
  getReaderInitialLocationLabel,
  styleImageOnlyContent,
} from "@/components/reader/reader-workspace-utils";
import {
  applyReaderThemeToContents,
  getReaderCfi,
  getReaderLocationLabel,
  getReaderNavigationDirection,
  hasReaderMetadataChanged,
  normalizeReaderMetadata,
  READER_VIEWPORT_BACKGROUND,
  restoreReaderFocus,
  type ReaderMetadata,
  type ReaderNavigationDirection,
} from "@/lib/reader";
import type { ReaderBookSnapshot } from "@/types";

export type ReaderEpubViewHandle = {
  navigate: (direction: ReaderNavigationDirection) => Promise<void>;
  refocus: () => void;
};

type ReaderEpubViewProps = {
  initialBook: ReaderBookSnapshot;
  onClearPendingSelection: () => void;
  onDismissPanels: () => void;
  onMetadataChange: (metadata: ReaderMetadata) => void;
  onRestoreFailure: () => void;
  onSelected: (_cfiRange: string, contents: Contents) => void;
  onStateChange: (state: Partial<ReaderViewState>) => void;
  readerSurfaceRef: RefObject<HTMLDivElement | null>;
};

export const ReaderEpubView = forwardRef<
  ReaderEpubViewHandle,
  ReaderEpubViewProps
>(function ReaderEpubView(
  {
    initialBook,
    onClearPendingSelection,
    onDismissPanels,
    onMetadataChange,
    onRestoreFailure,
    onSelected,
    onStateChange,
    readerSurfaceRef,
  },
  ref,
) {
  const { resolvedTheme } = useTheme();
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const isNavigatingRef = useRef(false);
  const metadataSyncStartedRef = useRef(false);
  const relocatedListenerRef = useRef<
    ((location: EpubLocation) => void) | null
  >(null);
  const renditionKeydownListenerRef = useRef<
    ((event: KeyboardEvent) => void) | null
  >(null);

  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const styleReaderContents = useCallback((contents: Contents) => {
    applyReaderThemeToContents([{ document: contents.document }]);
    styleImageOnlyContent(contents);
  }, []);

  useEffect(() => {
    const renditionContents = renditionRef.current?.getContents();
    const contents = Array.isArray(renditionContents)
      ? renditionContents
      : renditionContents
        ? [renditionContents]
        : [];

    applyReaderThemeToContents(contents);
  }, [isReady, resolvedTheme]);

  const refocusReader = useCallback(() => {
    window.requestAnimationFrame(() => {
      const renditionContents = renditionRef.current?.getContents();
      const focusTargets = Array.isArray(renditionContents)
        ? renditionContents
        : renditionContents
          ? [renditionContents]
          : [];

      restoreReaderFocus(readerSurfaceRef.current, focusTargets);
    });
  }, [readerSurfaceRef]);

  const navigate = useCallback(
    async (direction: ReaderNavigationDirection) => {
      const rendition = renditionRef.current;

      if (!rendition || isNavigatingRef.current) {
        return;
      }

      isNavigatingRef.current = true;

      try {
        if (direction === "previous") {
          await rendition.prev();
          return;
        }

        await rendition.next();
      } finally {
        isNavigatingRef.current = false;
        refocusReader();
      }
    },
    [refocusReader],
  );

  useImperativeHandle(
    ref,
    () => ({
      navigate,
      refocus: refocusReader,
    }),
    [navigate, refocusReader],
  );

  const handleNavigationKey = useCallback(
    (key: string) => {
      const direction = getReaderNavigationDirection(key);

      if (!direction) {
        return false;
      }

      void navigate(direction);
      return true;
    },
    [navigate],
  );

  const syncMetadata = useCallback(
    async (nextMetadata: ReaderMetadata) => {
      if (metadataSyncStartedRef.current) {
        return;
      }

      metadataSyncStartedRef.current = true;

      try {
        const response = await fetch(`/api/books/${initialBook.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(nextMetadata),
        });

        if (!response.ok) {
          metadataSyncStartedRef.current = false;
        }
      } catch {
        metadataSyncStartedRef.current = false;
      }
    },
    [initialBook.id],
  );

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const handleOnline = () => {
      refocusReader();
    };
    const handleWindowFocus = () => {
      refocusReader();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refocusReader();
      }
    };

    refocusReader();
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isReady, refocusReader]);

  useEffect(() => {
    let cancelled = false;
    const viewerElement = viewerRef.current;

    async function openBook() {
      let book: Book | null = null;
      let rendition: Rendition | null = null;
      let handleRelocated: ((location: EpubLocation) => void) | null = null;
      let handleRenditionKeyDown: ((event: KeyboardEvent) => void) | null =
        null;

      if (!viewerElement) {
        return;
      }

      metadataSyncStartedRef.current = false;
      onDismissPanels();
      setErrorMessage(null);
      setIsReady(false);
      onStateChange({
        activeCfi: initialBook.progressCfi,
        canGoNext: false,
        canGoPrevious: false,
        errorMessage: null,
        isReady: false,
        locationLabel: getReaderInitialLocationLabel(initialBook.progressCfi),
      });

      try {
        const response = await fetch(`/api/books/${initialBook.id}/file`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;

          throw new Error(payload?.error ?? "Unable to load this EPUB.");
        }

        const { default: ePub } = await import("epubjs");
        const fileBuffer = await response.arrayBuffer();
        book = ePub(fileBuffer);
        const loadedMetadataPromise = book.loaded.metadata.catch(() => null);

        await book.opened;
        await book.ready;

        if (cancelled) {
          book.destroy();
          return;
        }

        rendition = book.renderTo(viewerElement, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "auto",
          allowScriptedContent: false,
        });

        handleRelocated = (location: EpubLocation) => {
          if (cancelled) {
            return;
          }

          onClearPendingSelection();
          onStateChange({
            activeCfi: getReaderCfi(location),
            canGoNext: !location.atEnd,
            canGoPrevious: !location.atStart,
            locationLabel: getReaderLocationLabel(location),
          });
        };
        handleRenditionKeyDown = (event: KeyboardEvent) => {
          if (handleNavigationKey(event.key)) {
            event.preventDefault();
          }
        };

        bookRef.current = book;
        renditionRef.current = rendition;
        relocatedListenerRef.current = handleRelocated;
        renditionKeydownListenerRef.current = handleRenditionKeyDown;
        rendition.hooks.content.register(styleReaderContents);
        rendition.on("relocated", handleRelocated);
        rendition.on("selected", onSelected);
        rendition.on("keydown", handleRenditionKeyDown);

        if (initialBook.progressCfi) {
          try {
            await rendition.display(initialBook.progressCfi);
          } catch {
            onRestoreFailure();
            await rendition.display();
          }
        } else {
          await rendition.display();
        }

        const parsedMetadata = await loadedMetadataPromise;

        if (parsedMetadata && !cancelled) {
          const nextMetadata = normalizeReaderMetadata(
            parsedMetadata as PackagingMetadataObject,
            {
              title: initialBook.title,
              author: initialBook.author,
              language: initialBook.language,
            },
          );

          onMetadataChange(nextMetadata);

          if (
            hasReaderMetadataChanged(
              {
                title: initialBook.title,
                author: initialBook.author,
                language: initialBook.language,
              },
              nextMetadata,
            )
          ) {
            void syncMetadata(nextMetadata);
          }
        }

        if (cancelled) {
          return;
        }

        setIsReady(true);
        onStateChange({ isReady: true });
      } catch (error) {
        onDismissPanels();
        rendition?.hooks.content.deregister(styleReaderContents);
        if (handleRelocated) {
          rendition?.off("relocated", handleRelocated);
        }
        rendition?.off("selected", onSelected);
        if (handleRenditionKeyDown) {
          rendition?.off("keydown", handleRenditionKeyDown);
        }
        relocatedListenerRef.current = null;
        renditionKeydownListenerRef.current = null;
        rendition?.destroy();
        if (renditionRef.current === rendition) {
          renditionRef.current = null;
        }

        book?.destroy();
        if (bookRef.current === book) {
          bookRef.current = null;
        }

        if (viewerElement) {
          viewerElement.innerHTML = "";
        }

        if (!cancelled) {
          const nextErrorMessage = getReaderErrorMessage(error);

          setErrorMessage(nextErrorMessage);
          setIsReady(false);
          onStateChange({
            errorMessage: nextErrorMessage,
            isReady: false,
          });
        }
      }
    }

    void openBook();

    return () => {
      cancelled = true;
      onDismissPanels();
      renditionRef.current?.hooks.content.deregister(styleReaderContents);
      if (relocatedListenerRef.current) {
        renditionRef.current?.off("relocated", relocatedListenerRef.current);
      }
      renditionRef.current?.off("selected", onSelected);
      if (renditionKeydownListenerRef.current) {
        renditionRef.current?.off(
          "keydown",
          renditionKeydownListenerRef.current,
        );
      }
      relocatedListenerRef.current = null;
      renditionKeydownListenerRef.current = null;
      renditionRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current?.destroy();
      bookRef.current = null;

      if (viewerElement) {
        viewerElement.innerHTML = "";
      }
    };
  }, [
    initialBook.author,
    initialBook.id,
    initialBook.language,
    initialBook.progressCfi,
    initialBook.title,
    handleNavigationKey,
    onClearPendingSelection,
    onDismissPanels,
    onMetadataChange,
    onRestoreFailure,
    onSelected,
    onStateChange,
    styleReaderContents,
    syncMetadata,
  ]);

  const handleReaderAction = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (handleNavigationKey(event.key)) {
        event.preventDefault();
      }
    },
    [handleNavigationKey],
  );

  return (
    <div
      className="relative min-h-[520px] overflow-hidden rounded-[24px] border border-[#eadfce]"
      onKeyDown={handleReaderAction}
      ref={readerSurfaceRef}
      style={{ backgroundColor: READER_VIEWPORT_BACKGROUND }}
      tabIndex={0}
    >
      <div
        className="absolute inset-0"
        ref={viewerRef}
        style={{ backgroundColor: READER_VIEWPORT_BACKGROUND }}
      />

      {!isReady && !errorMessage ? (
        <div className="bg-reader-overlay absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 text-center backdrop-blur-sm">
          <LoaderCircle className="text-foreground size-5 animate-spin" />
          <div className="space-y-1.5 focus:ring-0 focus:outline-none">
            <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
              Preparing EPUB
            </p>
            <p className="text-ink-muted font-serif text-[13px] italic">
              Loading chapters and extracting structural metadata.
            </p>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="bg-background absolute inset-0 z-20 flex items-center justify-center p-6">
          <div className="max-w-lg space-y-6 text-center">
            <div className="space-y-2">
              <p className="text-[10px] font-medium tracking-[0.2em] text-red-500 uppercase dark:text-red-400">
                Reader Error
              </p>
              <h2 className="text-foreground font-serif text-2xl font-light">
                Unable to open publication
              </h2>
            </div>

            <p className="text-ink-muted text-sm leading-relaxed">
              {errorMessage}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                href="/library"
                className="text-ink-muted hover:text-foreground text-[11px] font-medium tracking-wide uppercase transition-colors"
              >
                Back to library
              </Link>
              <button
                onClick={() => window.location.reload()}
                type="button"
                className="border-foreground bg-foreground text-background hover:bg-ink-soft border px-6 py-2.5 text-[11px] font-medium tracking-widest uppercase transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});

ReaderEpubView.displayName = "ReaderEpubView";
