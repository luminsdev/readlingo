import { Skeleton } from "@/components/ui/skeleton";

function VocabularyCardSkeleton() {
  return (
    <article className="paper-panel border-border space-y-8 rounded-[32px] border p-6">
      <div className="border-line space-y-4 border-b pb-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <div className="flex flex-wrap items-end gap-3">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="mb-1 h-4 w-24" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-3 w-full" />
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
          </div>
          <div className="border-line bg-surface space-y-3 rounded-[24px] border p-5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </div>

      <div className="border-line flex flex-wrap items-end justify-between gap-4 border-t pt-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
    </article>
  );
}

export default function VocabularyLoading() {
  return (
    <div className="space-y-10">
      <header className="border-line space-y-3 border-b pb-6">
        <Skeleton className="h-3 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
      </header>

      <div className="grid gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <VocabularyCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
