import { Skeleton } from "@/components/ui/skeleton";

function LibraryBookCardSkeleton() {
  return (
    <div className="relative flex flex-col">
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-x-3 -bottom-2 h-5 rounded-full bg-[radial-gradient(ellipse_at_center,var(--paper-shadow),transparent_70%)] opacity-60 blur-md"
        />
        <Skeleton className="border-border/40 relative aspect-[3/4] w-full rounded-[8px] border" />
      </div>
      <div className="mt-4 flex flex-col gap-2 px-0.5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export default function LibraryLoading() {
  return (
    <div className="library-grain relative flex flex-col gap-8">
      <header className="relative flex flex-col gap-5 overflow-hidden rounded-[28px] px-1 py-2">
        <div className="pointer-events-none absolute inset-x-8 -top-10 h-28 bg-[radial-gradient(circle_at_top,var(--page-glow-primary),transparent_68%)] opacity-90" />
        <div className="pointer-events-none absolute top-3 right-10 h-16 w-40 bg-[radial-gradient(circle,var(--page-glow-secondary),transparent_72%)] opacity-80" />

        <div className="relative mt-2 flex flex-wrap items-end justify-between gap-6 pt-2 pb-4">
          <div className="flex shrink-0 flex-col gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-11 w-40 sm:h-14" />
          </div>

          <div
            aria-hidden="true"
            className="relative ml-6 hidden min-h-16 max-w-2xl flex-1 items-center pl-10 lg:flex"
          />

          <div className="z-10 mb-1 shrink-0">
            <Skeleton className="h-11 w-36 rounded-full" />
          </div>
        </div>

        <div className="bg-line-strong h-px" />
      </header>

      <div className="z-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <LibraryBookCardSkeleton key={index} />
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="mt-8 flex items-center justify-center gap-2">
        <Skeleton className="h-9 w-20 rounded-md" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="size-9 rounded-md" />
        ))}
        <Skeleton className="h-9 w-16 rounded-md" />
      </div>
    </div>
  );
}
