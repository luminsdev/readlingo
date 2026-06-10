"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";

import { DeleteBookButton } from "@/components/library/delete-book-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type BookCardActionsProps = {
  bookId: string;
  collectionContext?: { collectionId: string };
  collections?: Array<{ id: string; displayName: string; hasBook: boolean }>;
  title: string;
};

export function BookCardActions({
  bookId,
  collectionContext,
  collections = [],
  title,
}: BookCardActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingCollectionId, setPendingCollectionId] = useState<string | null>(
    null,
  );
  const [pendingContextAction, setPendingContextAction] = useState<
    "cover" | "remove" | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const updateCollectionMembership = (
    collection: { id: string; displayName: string; hasBook: boolean },
    isChecked: boolean,
  ) => {
    setError(null);
    setPendingCollectionId(collection.id);

    startTransition(async () => {
      try {
        const response = await fetch(
          isChecked
            ? `/api/collections/${collection.id}/books/${bookId}`
            : `/api/collections/${collection.id}/books`,
          {
            method: isChecked ? "DELETE" : "POST",
            ...(isChecked
              ? {}
              : {
                  body: JSON.stringify({ bookId }),
                  headers: { "Content-Type": "application/json" },
                }),
          },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(payload?.error ?? "The collection could not be updated.");
          return;
        }

        router.refresh();
      } catch {
        setError("The collection could not be updated.");
      } finally {
        setPendingCollectionId(null);
      }
    });
  };

  const setAsShelfCover = () => {
    if (!collectionContext) {
      return;
    }

    setError(null);
    setPendingContextAction("cover");

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/collections/${collectionContext.collectionId}`,
          {
            body: JSON.stringify({ coverBookId: bookId }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(payload?.error ?? "The shelf cover could not be updated.");
          return;
        }

        router.refresh();
      } catch {
        setError("The shelf cover could not be updated.");
      } finally {
        setPendingContextAction(null);
      }
    });
  };

  const removeFromShelf = () => {
    if (!collectionContext) {
      return;
    }

    setError(null);
    setPendingContextAction("remove");

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/collections/${collectionContext.collectionId}/books/${bookId}`,
          { method: "DELETE" },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(payload?.error ?? "The book could not be removed.");
          return;
        }

        router.refresh();
      } catch {
        setError("The book could not be removed.");
      } finally {
        setPendingContextAction(null);
      }
    });
  };

  return (
    <div className="bg-surface-strong/70 border-line-strong hover:bg-surface-strong/90 flex items-center gap-1 overflow-hidden rounded-full border p-1 shadow-sm backdrop-blur-md transition-colors">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Manage collections for ${title}`}
            className="size-7 bg-black/40 p-0 text-white/70 hover:bg-black/55 hover:text-white"
            disabled={isPending}
            size="icon"
            type="button"
            variant="ghost"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <FolderPlus aria-hidden="true" className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="bg-surface-strong text-foreground border-line-strong min-w-52 rounded-2xl p-1.5 shadow-[0_24px_50px_var(--paper-shadow)] backdrop-blur-2xl"
        >
          {collectionContext ? (
            <>
              <DropdownMenuItem
                className="focus:text-foreground cursor-pointer rounded-xl px-3 py-2.5 transition-all focus:bg-black/5 dark:focus:bg-white/10"
                disabled={pendingContextAction === "cover"}
                onSelect={(event) => {
                  event.preventDefault();
                  setAsShelfCover();
                }}
              >
                Set as Shelf Cover
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-danger focus:bg-danger/10 focus:text-danger cursor-pointer rounded-xl px-3 py-2.5 transition-all"
                disabled={pendingContextAction === "remove"}
                onSelect={(event) => {
                  event.preventDefault();
                  removeFromShelf();
                }}
              >
                Remove from Shelf
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1.5 opacity-50" />
            </>
          ) : null}
          {collections.length ? (
            collections.map((collection) => (
              <DropdownMenuCheckboxItem
                className="focus:text-foreground cursor-pointer rounded-xl py-2.5 pr-3 pl-10 transition-all focus:bg-black/5 dark:focus:bg-white/10 [&>span]:top-1/2 [&>span]:left-3 [&>span]:-translate-y-1/2"
                checked={collection.hasBook}
                disabled={pendingCollectionId === collection.id}
                key={collection.id}
                onCheckedChange={() =>
                  updateCollectionMembership(collection, collection.hasBook)
                }
              >
                {collection.displayName}
              </DropdownMenuCheckboxItem>
            ))
          ) : (
            <DropdownMenuLabel className="text-ink-soft px-3 py-2.5 text-xs font-medium">
              No collections yet
            </DropdownMenuLabel>
          )}
          {error ? (
            <DropdownMenuLabel className="text-danger max-w-44 text-xs font-medium whitespace-normal">
              {error}
            </DropdownMenuLabel>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteBookButton bookId={bookId} iconOnly title={title} />
    </div>
  );
}
