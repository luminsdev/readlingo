"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

function DeleteVocabularySubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} size="sm" type="submit" variant="danger">
      <Trash2 className="size-4" />
      {pending ? "Removing..." : "Delete"}
    </Button>
  );
}

export function DeleteVocabularyButton({
  action,
  vocabularyId,
  word,
}: {
  action: (formData: FormData) => void | Promise<void>;
  vocabularyId: string;
  word: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Delete "${word}" from your vocabulary?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="vocabularyId" value={vocabularyId} />
      <DeleteVocabularySubmitButton />
    </form>
  );
}
