"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DeleteBookButton({
  bookId,
  title,
}: {
  bookId: string;
  title: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Button
        disabled={isPending}
        size="sm"
        type="button"
        variant="danger"
        onClick={() => {
          if (!window.confirm(`Delete \"${title}\" from your library?`)) {
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
        }}
      >
        <Trash2 className="size-4" />
        {isPending ? "Removing..." : "Delete"}
      </Button>
      {error ? <p className="text-danger text-xs">{error}</p> : null}
    </div>
  );
}
