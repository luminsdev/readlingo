import Link from "next/link";

import { BookOpenText } from "lucide-react";

export default function ReaderNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="paper-panel border-border mx-auto w-full max-w-md rounded-[32px] border p-8 text-center">
        <div className="bg-danger/10 mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl">
          <BookOpenText className="text-danger size-8" aria-hidden="true" />
        </div>
        <h1 className="font-serif text-2xl tracking-tight">Book Not Found</h1>
        <p className="text-muted-foreground mt-2">
          This book doesn&apos;t exist in your library.
        </p>
        <div className="mt-6">
          <Link
            className="bg-accent text-accent-foreground hover:bg-accent-hover inline-flex rounded-full px-6 py-2.5 text-sm font-medium"
            href="/library"
          >
            Back to Library
          </Link>
        </div>
      </div>
    </div>
  );
}
