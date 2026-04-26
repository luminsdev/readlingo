"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

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
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
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

      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className={iconOnly ? "relative" : "flex flex-col gap-2"}>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          {iconOnly ? (
            <button
              aria-label={isPending ? `Removing ${title}` : `Delete ${title}`}
              className="flex size-7 items-center justify-center rounded-full bg-black/40 text-white/60 transition-colors hover:bg-red-500/80 hover:text-white disabled:pointer-events-none disabled:opacity-50"
              disabled={isPending}
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(true);
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : (
            <Button
              disabled={isPending}
              size="sm"
              type="button"
              variant="danger"
            >
              <Trash2 className="size-4" />
              {isPending ? "Removing..." : "Delete"}
            </Button>
          )}
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-surface border-line rounded-[24px] sm:rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">
              Delete &quot;{title}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-ink-soft text-sm leading-relaxed">
              This will permanently remove this book from your library,
              including its reading progress and cover image. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                disabled={isPending}
                type="button"
                variant="danger"
                onClick={(event) => {
                  event.preventDefault();
                  handleDelete();
                }}
              >
                {isPending ? "Removing..." : "Delete"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
