"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { UploadBookForm } from "@/components/library/upload-book-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function UploadBookDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="text-accent gap-2 hover:text-[var(--accent-hover)]"
        >
          <Plus className="size-4" />
          Add book
        </Button>
      </DialogTrigger>
      <DialogContent className="border-line sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            Add a new EPUB
          </DialogTitle>
          <DialogDescription>
            Upload a book to your shelf. Cover art and metadata are extracted
            automatically.
          </DialogDescription>
        </DialogHeader>
        <UploadBookForm onSuccess={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
