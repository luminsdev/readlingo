"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import type Book from "epubjs/types/book";
import type Contents from "epubjs/types/contents";
import type { PackagingMetadataObject } from "epubjs/types/packaging";
import type Rendition from "epubjs/types/rendition";
import type { Location as EpubLocation } from "epubjs/types/rendition";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Languages,
  LoaderCircle,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getReaderImagePageTarget,
  getReaderCfi,
  getReaderLocationLabel,
  getReaderNavigationDirection,
  hasReaderMetadataChanged,
  normalizeReaderMetadata,
  restoreReaderFocus,
  type ReaderMetadata,
  type ReaderNavigationDirection,
} from "@/lib/reader";
import type { ReaderBookSnapshot } from "@/types";

const SAVE_DEBOUNCE_MS = 1200;

type SaveState = "idle" | "saving" | "saved" | "error";

function getReaderErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "This EPUB could not be rendered. The file may be corrupted or unsupported.";
}

function formatSavedTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return "Not synced yet";
  }

  const savedAt = new Date(timestamp);

  return `Saved ${savedAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function setImportantStyle(
  element: Element | null | undefined,
  property: string,
  value: string,
) {
  if (!element) {
    return;
  }

  (element as HTMLElement | SVGElement).style.setProperty(
    property,
    value,
    "important",
  );
}

function styleImageOnlyContent(contents: Contents) {
  const body = contents.document?.body;

  if (!body) {
    return;
  }

  body.tabIndex = -1;

  const imagePageTarget = getReaderImagePageTarget(body);

  if (!imagePageTarget) {
    body.removeAttribute("data-readlingo-image-page");
    return;
  }

  body.setAttribute("data-readlingo-image-page", "true");

  const root = contents.document.documentElement;

  setImportantStyle(root, "width", "100%");
  setImportantStyle(root, "height", "100%");
  setImportantStyle(root, "margin", "0");
  setImportantStyle(root, "padding", "0");

  setImportantStyle(body, "width", "100%");
  setImportantStyle(body, "height", "100%");
  setImportantStyle(body, "margin", "0");
  setImportantStyle(body, "padding", "0");
  setImportantStyle(body, "display", "flex");
  setImportantStyle(body, "align-items", "center");
  setImportantStyle(body, "justify-content", "center");
  setImportantStyle(body, "overflow", "hidden");

  const containerElements = imagePageTarget.containerChain.slice(1, -1);

  for (const element of containerElements) {
    setImportantStyle(element as Element, "width", "100%");
    setImportantStyle(element as Element, "height", "100%");
    setImportantStyle(element as Element, "margin", "0");
    setImportantStyle(element as Element, "padding", "0");
    setImportantStyle(element as Element, "display", "flex");
    setImportantStyle(element as Element, "align-items", "center");
    setImportantStyle(element as Element, "justify-content", "center");
    setImportantStyle(element as Element, "overflow", "hidden");
  }

  const mediaElement = imagePageTarget.containerChain.at(-1) as
    | Element
    | undefined;

  setImportantStyle(mediaElement, "display", "block");
  setImportantStyle(mediaElement, "width", "100%");
  setImportantStyle(mediaElement, "height", "100%");
  setImportantStyle(mediaElement, "max-width", "100%");
  setImportantStyle(mediaElement, "max-height", "100%");
  setImportantStyle(mediaElement, "margin", "0 auto");
  setImportantStyle(mediaElement, "object-fit", "contain");
  setImportantStyle(mediaElement, "object-position", "center center");
}

export function ReaderWorkspace({
  initialBook,
}: {
  initialBook: ReaderBookSnapshot;
}) {
  const readerSurfaceRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const isMountedRef = useRef(true);
  const isNavigatingRef = useRef(false);
  const lastPersistedCfiRef = useRef(initialBook.progressCfi);
  const metadataSyncStartedRef = useRef(false);
  const pendingSaveCfiRef = useRef<string | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeCfi, setActiveCfi] = useState<string | null>(
    initialBook.progressCfi,
  );
  const [locationLabel, setLocationLabel] = useState(
    initialBook.progressCfi ? "Restoring your last page..." : "Opening book...",
  );
  const [canGoPrevious, setCanGoPrevious] = useState(false);
  const [canGoNext, setCanGoNext] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(
    initialBook.progressCfi ? "saved" : "idle",
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialBook.progressUpdatedAt,
  );
  const [metadata, setMetadata] = useState<ReaderMetadata>({
    title: initialBook.title,
    author: initialBook.author,
    language: initialBook.language,
  });

  const styleReaderContents = useCallback((contents: Contents) => {
    styleImageOnlyContent(contents);
  }, []);

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
  }, []);

  const navigateReader = useCallback(
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

  const handleNavigationKey = useCallback(
    (key: string) => {
      const direction = getReaderNavigationDirection(key);

      if (!direction) {
        return false;
      }

      void navigateReader(direction);
      return true;
    },
    [navigateReader],
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

  const saveProgress = useCallback(
    async (cfi: string, keepalive = false) => {
      if (!cfi || lastPersistedCfiRef.current === cfi) {
        return;
      }

      pendingSaveCfiRef.current = cfi;

      if (isMountedRef.current) {
        setSaveState("saving");
      }

      try {
        const response = await fetch(`/api/books/${initialBook.id}/progress`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cfi }),
          keepalive,
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

        if (isMountedRef.current) {
          setLastSavedAt(payload.progress.updatedAt);
          setSaveState("saved");
        }
      } catch {
        if (isMountedRef.current) {
          setSaveState("error");
        }
      }
    },
    [initialBook.id],
  );

  const retryPendingProgress = useCallback(() => {
    const pendingCfi = pendingSaveCfiRef.current;

    if (!pendingCfi || pendingCfi === lastPersistedCfiRef.current) {
      return;
    }

    void saveProgress(pendingCfi);
  }, [saveProgress]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
    const flushProgress = () => {
      if (activeCfi && activeCfi !== lastPersistedCfiRef.current) {
        void saveProgress(activeCfi, true);
      }
    };

    window.addEventListener("pagehide", flushProgress);

    return () => {
      window.removeEventListener("pagehide", flushProgress);
      flushProgress();
    };
  }, [activeCfi, saveProgress]);

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

    refocusReader();
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isReady, refocusReader, retryPendingProgress]);

  useEffect(() => {
    let cancelled = false;
    const viewerElement = viewerRef.current;

    async function openBook() {
      let book: Book | null = null;
      let rendition: Rendition | null = null;

      if (!viewerElement) {
        return;
      }

      metadataSyncStartedRef.current = false;
      setErrorMessage(null);
      setIsReady(false);
      setCanGoPrevious(false);
      setCanGoNext(false);
      setLocationLabel(
        initialBook.progressCfi
          ? "Restoring your last page..."
          : "Opening book...",
      );

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

        const handleRelocated = (location: EpubLocation) => {
          if (cancelled) {
            return;
          }

          const nextCfi = getReaderCfi(location);

          setActiveCfi(nextCfi);
          setLocationLabel(getReaderLocationLabel(location));
          setCanGoPrevious(!location.atStart);
          setCanGoNext(!location.atEnd);
        };
        const handleRenditionKeyDown = (event: KeyboardEvent) => {
          if (handleNavigationKey(event.key)) {
            event.preventDefault();
          }
        };

        bookRef.current = book;
        renditionRef.current = rendition;
        rendition.hooks.content.register(styleReaderContents);
        rendition.on("relocated", handleRelocated);
        rendition.on("keydown", handleRenditionKeyDown);

        if (initialBook.progressCfi) {
          try {
            await rendition.display(initialBook.progressCfi);
          } catch {
            lastPersistedCfiRef.current = null;
            pendingSaveCfiRef.current = null;
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

          setMetadata(nextMetadata);

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
      } catch (error) {
        rendition?.hooks.content.deregister(styleReaderContents);
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
          setErrorMessage(getReaderErrorMessage(error));
          setSaveState("idle");
        }
      }
    }

    void openBook();

    return () => {
      cancelled = true;
      renditionRef.current?.hooks.content.deregister(styleReaderContents);
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
    styleReaderContents,
    syncMetadata,
  ]);

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

  const moveBack = useCallback(() => {
    void navigateReader("previous");
  }, [navigateReader]);

  const moveForward = useCallback(() => {
    void navigateReader("next");
  }, [navigateReader]);

  const handleReaderAction = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (handleNavigationKey(event.key)) {
        event.preventDefault();
      }
    },
    [handleNavigationKey],
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader className="border-border/70 gap-5 border-b pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Badge>Phase 2 reader</Badge>
              <div className="space-y-2">
                <CardTitle className="font-serif text-3xl sm:text-4xl">
                  {metadata.title}
                </CardTitle>
                <CardDescription className="max-w-2xl text-sm sm:text-base">
                  {metadata.author ??
                    "Author metadata is unavailable for this EPUB."}
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-right">
              <Badge>
                {metadata.language === "und"
                  ? "Language pending"
                  : metadata.language}
              </Badge>
              <Badge>{locationLabel}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <BookOpen className="size-4" />
              Paginated EPUB rendering is live, with resume-by-CFI enabled.
            </div>

            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              {saveState === "saving" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RefreshCcw className="size-4" />
              )}
              {saveStatusLabel}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              disabled={!canGoPrevious || !isReady}
              onClick={moveBack}
              type="button"
              variant="secondary"
            >
              <ArrowLeft className="size-4" />
              Previous
            </Button>

            <div className="text-muted-foreground text-sm">
              Use the arrow keys or navigation controls to turn pages.
            </div>

            <Button
              disabled={!canGoNext || !isReady}
              onClick={moveForward}
              type="button"
            >
              Next
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div
            className="border-border relative min-h-[520px] overflow-hidden rounded-[28px] border bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
            onKeyDown={handleReaderAction}
            ref={readerSurfaceRef}
            tabIndex={0}
          >
            <div className="absolute inset-0" ref={viewerRef} />

            {!isReady && !errorMessage ? (
              <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,rgba(255,252,247,0.95),rgba(248,240,229,0.95))] text-center text-sm">
                <LoaderCircle className="size-5 animate-spin" />
                <div className="space-y-1">
                  <p className="text-foreground font-medium">
                    Preparing your EPUB
                  </p>
                  <p>
                    Loading chapters, restoring location, and extracting
                    metadata.
                  </p>
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgba(255,252,247,0.98),rgba(248,240,229,0.98))] p-6">
                <div className="max-w-lg space-y-4 text-center">
                  <Badge>Reader error</Badge>
                  <div className="space-y-2">
                    <p className="text-foreground font-serif text-2xl">
                      This EPUB could not be opened.
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {errorMessage}
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3">
                    <Button asChild type="button" variant="secondary">
                      <Link href="/library">Back to library</Link>
                    </Button>
                    <Button
                      onClick={() => window.location.reload()}
                      type="button"
                    >
                      Try again
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <Badge>Workspace</Badge>
            <CardTitle className="font-serif text-2xl">
              Reader context
            </CardTitle>
            <CardDescription>
              This side rail is reserved for the inline AI explanation panel in
              the next vertical slice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="text-muted-foreground border-border/80 flex items-start gap-3 rounded-[24px] border border-dashed bg-white/60 p-4">
              <Sparkles className="mt-0.5 size-4 shrink-0" />
              Highlight-to-explain hooks will slot into this panel without
              changing the reader layout again.
            </div>

            <div className="text-muted-foreground border-border/80 flex items-start gap-3 rounded-[24px] border border-dashed bg-white/60 p-4">
              <Languages className="mt-0.5 size-4 shrink-0" />
              Parsed metadata is persisted back to the library, so later visits
              show the enriched title, author, and language.
            </div>
          </CardContent>
        </Card>

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
                  (initialBook.progressCfi
                    ? "Restoring your last page..."
                    : null) ??
                  "This book will save its first reading location after you move."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
