"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Plus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { getLibraryHref } from "@/lib/library-url";
import { cn } from "@/lib/utils";

type CollectionPillsProps = {
  activeCollectionId: string | undefined;
  collections: Array<{
    id: string;
    displayName: string;
    _count: { books: number };
  }>;
};

export function CollectionPills({
  activeCollectionId,
  collections,
}: CollectionPillsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const filters = {
    collection: searchParams.get("collection"),
    page: searchParams.get("page"),
    q: searchParams.get("q"),
  };

  const handleCollectionFilter = (collection: string | null) => {
    router.push(getLibraryHref(filters, { collection, page: 1 }));
  };

  const handleCreateCollection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName || isPending) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/collections", {
        body: JSON.stringify({ name: trimmedName }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (response.status === 409) {
        setError("A collection with this name already exists.");
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "The collection could not be created.");
        return;
      }

      setIsCreating(false);
      setName("");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <button
          aria-pressed={!activeCollectionId}
          className={cn(
            "bg-surface border-line text-ink-soft shrink-0 rounded-full border px-3 py-1 text-xs font-medium tracking-wide transition-colors",
            !activeCollectionId && "bg-foreground text-background",
          )}
          onClick={() => handleCollectionFilter(null)}
          type="button"
        >
          All
        </button>

        {collections.map((collection) => (
          <button
            aria-pressed={activeCollectionId === collection.id}
            className={cn(
              "bg-surface border-line text-ink-soft shrink-0 rounded-full border px-3 py-1 text-xs font-medium tracking-wide transition-colors",
              activeCollectionId === collection.id &&
                "bg-foreground text-background",
            )}
            key={collection.id}
            onClick={() => handleCollectionFilter(collection.id)}
            type="button"
          >
            {collection.displayName}{" "}
            <span className="text-ink-kicker">({collection._count.books})</span>
          </button>
        ))}

        {isCreating ? (
          <form
            className="bg-surface border-line flex shrink-0 items-center gap-1 rounded-full border p-1"
            onSubmit={handleCreateCollection}
          >
            <Input
              aria-label="New collection name"
              autoFocus
              className="border-line h-7 w-36 rounded-full bg-transparent px-3 text-xs"
              disabled={isPending}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              placeholder="Collection name"
              value={name}
            />
            <button
              aria-label="Create collection"
              className="bg-foreground text-background flex size-7 items-center justify-center rounded-full transition-opacity disabled:opacity-50"
              disabled={isPending || !name.trim()}
              type="submit"
            >
              <Check aria-hidden="true" className="size-3.5" />
            </button>
          </form>
        ) : (
          <button
            aria-label="Create collection"
            className="border-line text-ink-soft hover:bg-surface shrink-0 rounded-full border border-dashed px-3 py-1 text-xs font-medium tracking-wide transition-colors"
            onClick={() => {
              setError(null);
              setIsCreating(true);
            }}
            type="button"
          >
            <Plus aria-hidden="true" className="mr-1 inline size-3.5" />
            New
          </button>
        )}
      </div>

      {error ? <p className="text-danger px-1 text-xs">{error}</p> : null}
    </div>
  );
}
