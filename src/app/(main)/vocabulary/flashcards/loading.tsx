import { Skeleton } from "@/components/ui/skeleton";

function FlashcardStatSkeleton() {
  return (
    <div className="border-line bg-surface rounded-[24px] border px-5 py-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-9 w-12" />
    </div>
  );
}

function FlashcardSidebarPanelSkeleton() {
  return (
    <div className="border-line bg-surface rounded-[28px] border p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-4/5" />
      <div className="mt-4 flex flex-col gap-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export default function FlashcardsLoading() {
  return (
    <section className="space-y-8">
      <header className="border-line space-y-6 border-b pb-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <FlashcardStatSkeleton key={index} />
          ))}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <article className="paper-panel border-border overflow-hidden rounded-[32px] border">
          <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-4 w-36" />
          </div>

          <div className="space-y-8 px-6 py-8 sm:px-8 sm:py-10">
            <div className="space-y-4">
              <Skeleton className="h-3 w-16" />
              <div className="space-y-4">
                <Skeleton className="h-16 w-64 max-w-full" />
                <div className="flex flex-wrap items-center gap-3">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-7 w-24 rounded-full" />
                </div>
              </div>
            </div>

            <div className="border-line space-y-5 border-t pt-8">
              <Skeleton className="h-4 w-full max-w-xl" />
              <Skeleton className="h-4 w-5/6 max-w-lg" />
              <div className="flex flex-wrap gap-3 pt-1">
                <Skeleton className="h-11 w-32 rounded-full" />
                <Skeleton className="h-11 w-36 rounded-full" />
              </div>
            </div>
          </div>
        </article>

        <aside className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <FlashcardSidebarPanelSkeleton key={index} />
          ))}
        </aside>
      </div>
    </section>
  );
}
