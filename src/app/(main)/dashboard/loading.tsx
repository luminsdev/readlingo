import { Skeleton } from "@/components/ui/skeleton";

function DashboardStatSkeleton() {
  return (
    <div className="border-line bg-surface-strong rounded-[24px] border px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="size-9 rounded-full" />
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="library-grain relative flex flex-col gap-8">
      <header className="relative flex flex-col gap-4 overflow-hidden rounded-[28px] px-1 py-2">
        <div className="pointer-events-none absolute inset-x-8 -top-10 h-28 bg-[radial-gradient(circle_at_top,var(--page-glow-primary),transparent_68%)] opacity-90" />
        <div className="relative mt-2 space-y-3 pt-2 pb-4">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-11 w-56 sm:h-14" />
        </div>
        <div className="bg-line-strong h-px" />
      </header>

      <section className="paper-panel border-border rounded-[32px] border p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-5 w-full max-w-xl" />
            <Skeleton className="h-11 w-36 rounded-full" />
          </div>
          <Skeleton className="h-44 rounded-[24px]" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <DashboardStatSkeleton key={index} />
        ))}
      </div>

      <section className="paper-panel border-border rounded-[32px] border p-6">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="mt-5 h-32 rounded-[24px]" />
      </section>

      <section className="border-line bg-surface rounded-[28px] border p-5">
        <Skeleton className="h-3 w-32" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-5 w-full" key={index} />
          ))}
        </div>
      </section>
    </div>
  );
}
