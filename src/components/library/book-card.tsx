import Image from "next/image";
import Link from "next/link";

import { DeleteBookButton } from "@/components/library/delete-book-button";
import { ProgressRing } from "@/components/library/progress-ring";

const FALLBACK_COLORS = [
  "var(--ink-soft)",
  "var(--quote)",
  "var(--danger)",
  "var(--accent)",
  "var(--ink-muted)",
  "var(--muted-foreground)",
];

type BookCardProps = {
  author: string | null;
  coverImageUrl: string | null;
  hasStartedReading?: boolean;
  id: string;
  progressPercentage: number | null;
  title: string;
};

function getTitleColor(title: string) {
  const hash = title
    .split("")
    .reduce(
      (accumulator, character) => accumulator + character.charCodeAt(0),
      0,
    );

  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function BookCardCover({
  authorLabel,
  coverImageUrl,
  title,
}: {
  authorLabel: string;
  coverImageUrl: string | null;
  title: string;
}) {
  if (coverImageUrl) {
    return (
      <Image
        alt={title}
        className="h-full w-full object-cover"
        height={800}
        sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
        src={coverImageUrl}
        unoptimized
        width={600}
      />
    );
  }

  const fallbackColor = getTitleColor(title);

  return (
    <div
      className="bg-surface-strong relative h-full w-full"
      style={{
        background: `linear-gradient(155deg, ${fallbackColor} 0%, transparent 100%)`,
        backgroundColor: "var(--surface)",
      }}
    >
      <div className="bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.08%22/%3E%3C/svg%3E')] absolute inset-0 opacity-50 mix-blend-overlay" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_40%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.08)_50%,var(--surface-strong)_100%)] opacity-70" />
      <div className="text-foreground/90 relative flex h-full flex-col justify-between p-[10%]">
        <p className="text-foreground/45 text-[0.62rem] tracking-[0.25em] uppercase mix-blend-multiply dark:mix-blend-screen">
          Personal edition
        </p>
        <div className="flex flex-col gap-2 drop-shadow-sm">
          <p className="text-foreground line-clamp-4 font-serif text-[1.5rem] leading-[1.15]">
            {title}
          </p>
          <p className="text-foreground/60 line-clamp-2 text-xs">
            {authorLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

export function BookCard({
  author,
  coverImageUrl,
  hasStartedReading = false,
  id,
  progressPercentage,
  title,
}: BookCardProps) {
  const authorLabel = author ?? "Unknown author";
  const actionLabel = hasStartedReading
    ? progressPercentage != null
      ? `Continue · ${Math.round(progressPercentage * 100)}%`
      : "Continue"
    : "Read";

  return (
    <div className="group relative flex flex-col">
      <div className="bg-surface-strong border-border/40 relative aspect-[3/4] w-full overflow-hidden rounded-[8px] border shadow-[0_4px_18px_var(--paper-shadow)] transition-all duration-300 ease-[cubic-bezier(0.2,1,0.2,1)] group-hover:scale-[1.015] group-hover:shadow-[0_20px_45px_var(--paper-shadow)]">
        <BookCardCover
          authorLabel={authorLabel}
          coverImageUrl={coverImageUrl}
          title={title}
        />

        {progressPercentage != null ? (
          <div className="absolute right-2.5 bottom-2.5 drop-shadow-md">
            <ProgressRing percentage={progressPercentage * 100} size={24} />
          </div>
        ) : null}

        {/* Delete Box - Subtly visible on hover over cover */}
        <div className="pointer-events-none absolute top-2 right-2 z-20 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100">
          <div className="bg-surface-strong/70 border-line-strong hover:bg-surface-strong/90 overflow-hidden rounded-full border shadow-sm backdrop-blur-md transition-colors">
            <DeleteBookButton bookId={id} iconOnly title={title} />
          </div>
        </div>
      </div>

      {/* Metadata Plaque Area */}
      <div className="relative mt-4 flex flex-col gap-0.5 px-0.5 opacity-90 transition-opacity duration-300 group-hover:opacity-100">
        <p className="text-foreground line-clamp-2 font-serif text-[1.05rem] leading-snug tracking-tight transition-transform duration-300 ease-out group-hover:-translate-y-1">
          {title}
        </p>
        <p className="text-muted-foreground line-clamp-1 text-sm transition-transform duration-300 ease-out group-hover:-translate-y-1">
          {authorLabel}
        </p>

        {/* Action Link slides up from beneath the text */}
        <div className="pointer-events-none absolute -bottom-2.5 left-0.5 w-full overflow-hidden">
          <div className="flex translate-y-4 items-center opacity-0 transition-all duration-300 ease-[cubic-bezier(0.2,1,0.2,1)] group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100">
            <span className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-[0.68rem] font-bold tracking-[0.1em] uppercase transition-colors">
              {actionLabel}{" "}
              <span
                aria-hidden="true"
                className="mb-px ml-0.5 text-sm leading-none"
              >
                →
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Entire Card Click Target */}
      <Link
        href={`/reader/${id}`}
        className="focus-visible:ring-ring absolute inset-0 z-10 rounded-[8px] focus-visible:ring-2 focus-visible:outline-none"
        aria-label={`Read ${title}`}
      />
    </div>
  );
}
