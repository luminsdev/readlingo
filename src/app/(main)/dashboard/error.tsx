"use client";

import Link from "next/link";

import { LayoutGrid } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="paper-panel border-border mx-auto w-full max-w-md rounded-[32px] border p-8 text-center">
        <div className="bg-danger/10 mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl">
          <LayoutGrid className="text-danger size-8" aria-hidden="true" />
        </div>
        <h1 className="font-serif text-2xl tracking-tight">Dashboard Error</h1>
        <p className="text-muted-foreground mt-2">
          Could not load your dashboard.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            className="bg-accent text-accent-foreground hover:bg-accent-hover rounded-full px-6 py-2.5 text-sm font-medium"
            type="button"
            onClick={reset}
          >
            Try Again
          </button>
          <Link
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            href="/library"
          >
            Go to Library
          </Link>
        </div>
        {error.digest ? (
          <p className="text-muted-foreground mt-4 text-xs">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
