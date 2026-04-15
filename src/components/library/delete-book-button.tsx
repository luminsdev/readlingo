"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DeleteBookButton({
  bookId,
  iconOnly = false,
  title,
}: {
  bookId: string;
  iconOnly?: boolean;
  title: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!window.confirm(`Delete "${title}" from your library?`)) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/books/${bookId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "The book could not be deleted.");
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className={iconOnly ? "relative" : "space-y-2"}>
      {iconOnly ? (
        <button
          aria-label={isPending ? `Removing ${title}` : `Delete ${title}`}
          className="flex size-7 items-center justify-center rounded-full bg-black/40 text-white/60 transition-colors hover:bg-red-500/80 hover:text-white disabled:pointer-events-none disabled:opacity-50"
          disabled={isPending}
          type="button"
          onClick={handleDelete}
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : (
        <Button
          disabled={isPending}
          size="sm"
          type="button"
          variant="danger"
          onClick={handleDelete}
        >
          <Trash2 className="size-4" />
          {isPending ? "Removing..." : "Delete"}
        </Button>
      )}
      {error ? (
        <p
          className={
            iconOnly
              ? "bg-card/95 text-danger absolute top-full right-0 z-10 mt-2 w-44 rounded-2xl px-3 py-2 text-right text-xs shadow-lg"
              : "text-danger text-xs"
          }
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
