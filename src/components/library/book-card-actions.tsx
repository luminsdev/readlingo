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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type BookCardActionsProps = {
  bookId: string;
  collections?: Array<{ id: string; displayName: string; hasBook: boolean }>;
  title: string;
};

export function BookCardActions({
  bookId,
  collections = [],
  title,
}: BookCardActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingCollectionId, setPendingCollectionId] = useState<string | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const updateCollectionMembership = (
    collection: { id: string; displayName: string; hasBook: boolean },
    isChecked: boolean,
  ) => {
    setError(null);
    setPendingCollectionId(collection.id);

    startTransition(async () => {
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

      setPendingCollectionId(null);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "The collection could not be updated.");
        return;
      }

      router.refresh();
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
          className="bg-surface border-line min-w-48 rounded-xl"
        >
          {collections.length ? (
            collections.map((collection) => (
              <DropdownMenuCheckboxItem
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
            <DropdownMenuLabel className="text-ink-soft text-xs font-medium">
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
