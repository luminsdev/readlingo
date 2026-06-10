"use client";

/* eslint-disable @next/next/no-img-element -- Cover images are served through an auth-protected API route. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FALLBACK_COLORS = [
  "var(--ink-soft)",
  "var(--quote)",
  "var(--danger)",
  "var(--accent)",
  "var(--ink-muted)",
  "var(--muted-foreground)",
];

type CoverBook = {
  coverBlurDataUrl: string | null;
  coverUrl: string | null;
  id: string;
};

type CollectionHeaderProps = {
  bookCount: number;
  coverBook: CoverBook | null;
  coverBookId: string | null;
  createdAt: string;
  displayName: string;
  id: string;
  stackedCovers: CoverBook[];
};

type PendingAction = "delete" | "rename" | "reset";

function getTitleColor(title: string) {
  const hash = title
    .split("")
    .reduce(
      (accumulator, character) => accumulator + character.charCodeAt(0),
      0,
    );

  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

async function getResponseError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? fallback;
}

function FallbackCover({ title }: { title: string }) {
  const fallbackColor = getTitleColor(title);

  return (
    <div
      className="bg-surface-strong relative h-full w-full overflow-hidden rounded-[10px] border border-black/10"
      style={{
        background: `linear-gradient(155deg, ${fallbackColor} 0%, transparent 100%)`,
        backgroundColor: "var(--surface)",
      }}
    >
      <div className="bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.08%22/%3E%3C/svg%3E')] absolute inset-0 opacity-50 mix-blend-overlay" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%)]" />
      <div className="text-foreground/90 relative flex h-full flex-col justify-between p-4">
        <p className="text-foreground/45 text-[0.56rem] tracking-[0.24em] uppercase mix-blend-multiply dark:mix-blend-screen">
          Shelf edition
        </p>
        <p className="text-foreground line-clamp-4 font-serif text-xl leading-tight">
          {title}
        </p>
      </div>
    </div>
  );
}

function CoverImage({
  blurDataUrl,
  className,
  id,
  title,
}: {
  blurDataUrl: string | null;
  className?: string;
  id: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface-strong h-full w-full overflow-hidden rounded-[10px] border border-black/10 bg-cover bg-center shadow-[0_16px_38px_var(--paper-shadow)]",
        className,
      )}
      style={
        blurDataUrl ? { backgroundImage: `url(${blurDataUrl})` } : undefined
      }
    >
      <img
        alt={title}
        className="h-full w-full object-cover"
        decoding="async"
        loading="lazy"
        src={`/api/covers/${id}?size=thumb`}
      />
    </div>
  );
}

function CollectionCover({
  coverBook,
  coverBookId,
  displayName,
  stackedCovers,
}: Pick<
  CollectionHeaderProps,
  "coverBook" | "coverBookId" | "displayName" | "stackedCovers"
>) {
  if (coverBook && coverBook.coverUrl && coverBookId) {
    return (
      <div className="relative aspect-[3/4] w-32 sm:w-36">
        <div
          aria-hidden="true"
          className="absolute inset-x-4 -bottom-3 h-8 rounded-full bg-[radial-gradient(ellipse_at_center,var(--paper-shadow),transparent_70%)] opacity-90 blur-md"
        />
        <CoverImage
          blurDataUrl={coverBook.coverBlurDataUrl}
          id={coverBookId}
          title={`${displayName} shelf cover`}
        />
      </div>
    );
  }

  const visibleCovers = stackedCovers
    .filter((cover) => cover.coverUrl)
    .slice(0, 4);

  if (!visibleCovers.length) {
    return (
      <div className="relative aspect-[3/4] w-32 sm:w-36">
        <div
          aria-hidden="true"
          className="absolute inset-x-4 -bottom-3 h-8 rounded-full bg-[radial-gradient(ellipse_at_center,var(--paper-shadow),transparent_70%)] opacity-90 blur-md"
        />
        <FallbackCover title={displayName} />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-32 sm:w-36">
      <div
        aria-hidden="true"
        className="absolute inset-x-4 -bottom-3 h-8 rounded-full bg-[radial-gradient(ellipse_at_center,var(--paper-shadow),transparent_70%)] opacity-90 blur-md"
      />
      {visibleCovers.length === 1 ? (
        <CoverImage
          blurDataUrl={visibleCovers[0].coverBlurDataUrl}
          id={visibleCovers[0].id}
          title={`${displayName} shelf cover preview`}
        />
      ) : visibleCovers.length === 2 ? (
        <div className="bg-surface-strong grid h-full w-full grid-cols-2 gap-[2px] overflow-hidden rounded-[10px] border border-black/10 shadow-[0_16px_38px_var(--paper-shadow)]">
          <div className="relative h-full w-full">
            <CoverImage
              blurDataUrl={visibleCovers[0].coverBlurDataUrl}
              id={visibleCovers[0].id}
              title={`${displayName} shelf cover preview`}
              className="rounded-none border-none shadow-none"
            />
          </div>
          <div className="relative h-full w-full">
            <CoverImage
              blurDataUrl={visibleCovers[1].coverBlurDataUrl}
              id={visibleCovers[1].id}
              title={`${displayName} shelf cover preview`}
              className="rounded-none border-none shadow-none"
            />
          </div>
        </div>
      ) : visibleCovers.length === 3 ? (
        <div className="bg-surface-strong grid h-full w-full grid-cols-2 gap-[2px] overflow-hidden rounded-[10px] border border-black/10 shadow-[0_16px_38px_var(--paper-shadow)]">
          <div className="relative h-full w-full">
            <CoverImage
              blurDataUrl={visibleCovers[0].coverBlurDataUrl}
              id={visibleCovers[0].id}
              title={`${displayName} shelf cover preview`}
              className="rounded-none border-none shadow-none"
            />
          </div>
          <div className="grid grid-rows-2 gap-[2px]">
            <div className="relative h-full w-full">
              <CoverImage
                blurDataUrl={visibleCovers[1].coverBlurDataUrl}
                id={visibleCovers[1].id}
                title={`${displayName} shelf cover preview`}
                className="rounded-none border-none shadow-none"
              />
            </div>
            <div className="relative h-full w-full">
              <CoverImage
                blurDataUrl={visibleCovers[2].coverBlurDataUrl}
                id={visibleCovers[2].id}
                title={`${displayName} shelf cover preview`}
                className="rounded-none border-none shadow-none"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface-strong grid h-full w-full grid-cols-2 grid-rows-2 gap-[2px] overflow-hidden rounded-[10px] border border-black/10 shadow-[0_16px_38px_var(--paper-shadow)]">
          {visibleCovers.map((cover) => (
            <div key={cover.id} className="relative h-full w-full">
              <CoverImage
                blurDataUrl={cover.coverBlurDataUrl}
                id={cover.id}
                title={`${displayName} shelf cover preview`}
                className="rounded-none border-none shadow-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatCreatedDate(createdAt: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(createdAt));
}

export function CollectionHeader({
  bookCount,
  coverBook,
  coverBookId,
  createdAt,
  displayName,
  id,
  stackedCovers,
}: CollectionHeaderProps) {
  const router = useRouter();
  const [draftName, setDraftName] = useState(displayName);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const createdDate = formatCreatedDate(createdAt);

  useEffect(() => {
    setDraftName(displayName);
  }, [displayName]);

  const saveName = async () => {
    const trimmedName = draftName.trim();

    if (!trimmedName || pendingAction) {
      if (!trimmedName) {
        setError("Shelf name is required.");
      }
      return;
    }

    if (trimmedName === displayName) {
      setIsEditing(false);
      setError(null);
      return;
    }

    setPendingAction("rename");
    setError(null);

    try {
      const response = await fetch(`/api/collections/${id}`, {
        body: JSON.stringify({ name: trimmedName }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (response.status === 409) {
        setError("A collection with this name already exists.");
        return;
      }

      if (!response.ok) {
        setError(
          await getResponseError(response, "The shelf could not be renamed."),
        );
        return;
      }

      setDraftName(trimmedName);
      setIsEditing(false);
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  };

  const resetCover = async () => {
    if (pendingAction) {
      return;
    }

    setPendingAction("reset");
    setError(null);

    try {
      const response = await fetch(`/api/collections/${id}`, {
        body: JSON.stringify({ coverBookId: null }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        setError(
          await getResponseError(
            response,
            "The shelf cover could not be reset.",
          ),
        );
        return;
      }

      router.refresh();
    } finally {
      setPendingAction(null);
    }
  };

  const deleteShelf = async () => {
    if (pendingAction) {
      return;
    }

    setPendingAction("delete");
    setDeleteError(null);
    setError(null);

    try {
      const response = await fetch(`/api/collections/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const message = await getResponseError(
          response,
          "The shelf could not be deleted.",
        );

        setDeleteError(message);
        setError(message);
        return;
      }

      router.push("/library");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section className="bg-surface border-line relative overflow-hidden rounded-[32px] border p-6 shadow-[0_20px_70px_var(--paper-shadow)] sm:p-8">
      <div className="pointer-events-none absolute inset-x-10 -top-16 h-36 bg-[radial-gradient(circle_at_top,var(--page-glow-primary),transparent_68%)] opacity-90" />
      <div className="pointer-events-none absolute right-10 bottom-8 h-20 w-44 bg-[radial-gradient(circle,var(--page-glow-secondary),transparent_72%)] opacity-70" />

      <div className="relative flex flex-col gap-8 md:flex-row md:items-end">
        <CollectionCover
          coverBook={coverBook}
          coverBookId={coverBookId}
          displayName={displayName}
          stackedCovers={stackedCovers}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-ink-kicker text-[0.65rem] font-bold tracking-[0.3em] uppercase">
              Reading Shelf
            </p>

            {isEditing ? (
              <Input
                aria-label="Shelf name"
                aria-invalid={!!error}
                autoFocus
                className="border-line bg-surface-strong h-auto max-w-2xl rounded-2xl px-4 py-3 font-serif text-3xl tracking-tight sm:text-5xl"
                disabled={pendingAction === "rename"}
                maxLength={100}
                onBlur={() => {
                  if (!draftName.trim()) {
                    setDraftName(displayName);
                    setError(null);
                    setIsEditing(false);
                  } else {
                    void saveName();
                  }
                }}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveName();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    setDraftName(displayName);
                    setError(null);
                    setIsEditing(false);
                  }
                }}
                value={draftName}
              />
            ) : (
              <h1 className="text-foreground font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
                <button
                  className="group hover:bg-surface-strong focus-visible:ring-ring -ml-2 flex items-center gap-3 rounded-2xl px-2 py-1 text-left transition-colors focus-visible:ring-4 focus-visible:outline-none"
                  onClick={() => {
                    setDraftName(displayName);
                    setError(null);
                    setIsEditing(true);
                  }}
                  type="button"
                >
                  <span>{displayName}</span>
                  <Edit2
                    aria-hidden="true"
                    className="text-ink-soft size-6 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </button>
              </h1>
            )}

            <p className="text-ink-soft text-sm leading-6">
              {bookCount} books &middot; Created {createdDate}
            </p>
            {error ? <p className="text-danger text-sm">{error}</p> : null}
          </div>

          <div className="flex flex-wrap gap-3">
            {coverBookId ? (
              <Button
                disabled={!!pendingAction}
                onClick={() => void resetCover()}
                size="sm"
                type="button"
                variant="secondary"
              >
                {pendingAction === "reset"
                  ? "Resetting..."
                  : "Reset to default"}
              </Button>
            ) : null}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={!!pendingAction}
                  onClick={() => {
                    setDeleteError(null);
                    setError(null);
                  }}
                  size="sm"
                  type="button"
                  variant="danger"
                >
                  Delete Shelf
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-surface border-line rounded-[24px]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-serif text-2xl tracking-tight">
                    Delete this shelf?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-ink-soft leading-6">
                    This removes the shelf and its organization only. Your books
                    are NOT deleted and will remain in your library.
                  </AlertDialogDescription>
                  {deleteError ? (
                    <p className="text-danger text-sm leading-6">
                      {deleteError}
                    </p>
                  ) : null}
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pendingAction === "delete"}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-danger text-danger-foreground shadow-[0_12px_30px_var(--danger-shadow)] hover:bg-[var(--danger-hover)]"
                    disabled={pendingAction === "delete"}
                    onClick={(event) => {
                      event.preventDefault();
                      void deleteShelf();
                    }}
                  >
                    {pendingAction === "delete"
                      ? "Deleting..."
                      : "Delete Shelf"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </section>
  );
}
