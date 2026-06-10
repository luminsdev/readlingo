"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function CreateCollectionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const trimmedName = name.trim();

  const reset = () => {
    setError(null);
    setName("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!trimmedName || isPending) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/collections", {
          body: JSON.stringify({ name: trimmedName }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        if (response.status === 409) {
          setError("A shelf with this name already exists.");
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(payload?.error ?? "The shelf could not be created.");
          return;
        }

        reset();
        setOpen(false);
        router.refresh();
      } catch {
        setError("The shelf could not be created.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          aria-label="Create shelf"
          className="group focus-visible:ring-ring block w-36 shrink-0 rounded-[14px] text-left focus-visible:ring-2 focus-visible:outline-none sm:w-40"
          type="button"
        >
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute inset-x-3 -bottom-2 h-5 rounded-full bg-[radial-gradient(ellipse_at_center,var(--paper-shadow),transparent_70%)] opacity-80 blur-md transition-all duration-300 group-hover:-bottom-3 group-hover:opacity-100"
            />
            <div className="border-line text-ink-soft hover:bg-surface relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed bg-transparent transition-all duration-300 ease-[cubic-bezier(0.2,1,0.2,1)] group-hover:scale-[1.015] group-hover:shadow-[0_20px_45px_var(--paper-shadow)]">
              <span className="border-line bg-surface flex size-10 items-center justify-center rounded-full border">
                <Plus aria-hidden="true" className="size-4" />
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-0.5 px-0.5">
            <p className="text-foreground truncate font-serif text-[1.02rem] leading-snug tracking-tight transition-transform duration-300 ease-out group-hover:-translate-y-1">
              Create Shelf
            </p>
            <p className="text-muted-foreground text-xs transition-transform duration-300 ease-out group-hover:-translate-y-1">
              New collection
            </p>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            Create a shelf
          </DialogTitle>
          <DialogDescription>
            Give this reading room a short, memorable name.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Shelf name
            <Input
              aria-invalid={!!error}
              autoFocus
              disabled={isPending}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              placeholder="Victorian ghosts"
              value={name}
            />
          </label>
          {error ? <p className="text-danger text-sm">{error}</p> : null}
          <DialogFooter>
            <Button
              disabled={isPending || !trimmedName}
              size="sm"
              type="submit"
            >
              {isPending ? "Creating..." : "Create Shelf"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
