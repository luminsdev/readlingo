"use client";

const DAY_LABELS = ["", "M", "", "W", "", "F", ""];
const MONTH_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "short",
  timeZone: "UTC",
});

type ActivityHeatmapProps = {
  data: Array<{ date: Date; count: number }>;
};

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getUtcDateOnly(date: Date) {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

function getCellColor(count: number) {
  if (count >= 6) {
    return "bg-[var(--accent)]/75";
  }

  if (count >= 3) {
    return "bg-[var(--accent)]/45";
  }

  if (count >= 1) {
    return "bg-[var(--accent)]/20";
  }

  return "bg-surface-strong";
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const countsByDate = new Map(
    data.map((item) => [toDateKey(new Date(item.date)), item.count]),
  );
  const today = getUtcDateOnly(new Date());
  const startDate = new Date(today);
  startDate.setUTCDate(startDate.getUTCDate() - 83);

  const cells = Array.from({ length: 84 }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);
    const dateKey = toDateKey(date);

    return {
      count: countsByDate.get(dateKey) ?? 0,
      date,
      dateKey,
    };
  });

  const monthLabels = Array.from({ length: 12 }, (_, columnIndex) => {
    const columnCells = cells.slice(columnIndex * 7, columnIndex * 7 + 7);
    const monthStart = columnCells.find(
      (cell, cellIndex) =>
        cell.date.getUTCDate() === 1 || (columnIndex === 0 && cellIndex === 0),
    );

    return monthStart ? MONTH_FORMATTER.format(monthStart.date) : "";
  });

  return (
    <section className="paper-panel border-border rounded-[32px] border p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
            Activity · last 12 weeks
          </p>
          <h2 className="text-foreground mt-2 font-serif text-2xl font-light tracking-tight">
            Reading rhythm
          </h2>
        </div>
        <p className="text-ink-muted text-xs">
          Darker marks mean more activity
        </p>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[236px] grid-cols-[1.25rem_repeat(12,0.75rem)] gap-1.5">
          <div aria-hidden="true" />
          {monthLabels.map((label, index) => (
            <div
              className="text-ink-muted h-4 text-[10px] leading-4"
              key={`${label}-${index}`}
            >
              {label}
            </div>
          ))}

          <div className="grid grid-rows-7 gap-1.5">
            {DAY_LABELS.map((label, index) => (
              <div
                className="text-ink-muted h-3 text-[10px] leading-3"
                key={`${label}-${index}`}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="col-span-12 grid grid-flow-col grid-rows-7 gap-1.5">
            {cells.map((cell) => (
              <span
                aria-label={`${cell.dateKey}: ${cell.count} activit${cell.count === 1 ? "y" : "ies"}`}
                className={`size-3 rounded-sm ${getCellColor(cell.count)}`}
                key={cell.dateKey}
                title={`${cell.dateKey}: ${cell.count}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
