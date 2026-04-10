"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UploadBookForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        setMessage(null);

        startTransition(async () => {
          const response = await fetch("/api/books", {
            method: "POST",
            body: formData,
          });

          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;

          if (!response.ok) {
            setMessage({
              text: payload?.error ?? "The book could not be uploaded.",
              tone: "error",
            });
            return;
          }

          formRef.current?.reset();
          setMessage({
            text: "Book uploaded successfully.",
            tone: "success",
          });
          router.refresh();
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="file">EPUB file</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept=".epub,application/epub+zip"
          required
        />
      </div>

      {message ? (
        <p
          className={
            message.tone === "error"
              ? "text-danger text-sm"
              : "text-foreground text-sm"
          }
        >
          {message.text}
        </p>
      ) : null}

      <Button disabled={isPending} type="submit">
        <Upload className="size-4" />
        {isPending ? "Uploading..." : "Upload EPUB"}
      </Button>
    </form>
  );
}
