import { Skeleton } from "@/components/ui/skeleton";

const lineWidths = [
  "w-full",
  "w-[95%]",
  "w-[85%]",
  "w-full",
  "w-[90%]",
  "w-[78%]",
  "w-[96%]",
  "w-[88%]",
  "w-[70%]",
];

export default function ReaderLoading() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div className="border-line bg-surface flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-[24px] border px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex min-w-0 flex-col gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-48 max-w-full" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-16 rounded-full" />
          </div>
        </div>

        <div className="paper-panel border-border flex min-h-[520px] items-center justify-center rounded-[32px] border p-6 sm:p-10">
          <div className="flex w-full max-w-3xl flex-col gap-5">
            {lineWidths.map((width, index) => (
              <Skeleton key={`${width}-${index}`} className={`h-4 ${width}`} />
            ))}
          </div>
        </div>
      </div>

      <aside className="xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]">
        <div className="border-line bg-surface flex flex-col gap-6 border p-6 xl:h-full xl:min-h-0 xl:overflow-y-auto">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-24 w-full rounded-[24px]" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>

          <div className="border-line flex flex-col gap-4 border-t pt-6">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
