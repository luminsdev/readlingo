"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

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

export function DeleteVocabularyButton({
  action,
  vocabularyId,
  word,
}: {
  action: (formData: FormData) => void | Promise<void>;
  vocabularyId: string;
  word: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const formData = new FormData();
    formData.set("vocabularyId", vocabularyId);

    startTransition(async () => {
      await action(formData);
      setOpen(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button disabled={isPending} size="sm" type="button" variant="danger">
          <Trash2 className="size-4" />
          {isPending ? "Removing..." : "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-surface border-line rounded-[24px] sm:rounded-[24px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif">
            Delete &quot;{word}&quot;?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-ink-soft text-sm leading-relaxed">
            This will remove this word from your vocabulary archive. Any
            associated flashcard data will also be deleted.
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
  );
}
