import Image from "next/image";
import Link from "next/link";

import { DeleteBookButton } from "@/components/library/delete-book-button";
import { ProgressRing } from "@/components/library/progress-ring";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const FALLBACK_COLORS = [
  "#4f46e5",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
];

type BookCardProps = {
  author: string | null;
  coverImageUrl: string | null;
  featured?: boolean;
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
        width={600}
      />
    );
  }

  const fallbackColor = getTitleColor(title);

  return (
    <div
      className="relative h-full w-full"
      style={{
        background: `linear-gradient(155deg, ${fallbackColor} 0%, #20140f 100%)`,
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_36%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(18,12,9,0.2)_48%,rgba(18,12,9,0.58)_100%)]" />
      <div className="relative flex h-full flex-col justify-between p-5 text-white">
        <p className="text-[0.68rem] tracking-[0.28em] text-white/68 uppercase">
          Personal edition
        </p>
        <div className="flex flex-col gap-2">
          <p className="line-clamp-4 font-serif text-[1.65rem] leading-tight">
            {title}
          </p>
          <p className="line-clamp-2 text-sm text-white/70">{authorLabel}</p>
        </div>
      </div>
    </div>
  );
}

export function BookCard({
  author,
  coverImageUrl,
  featured = false,
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
    <Card
      className={cn(
        "group border-border/90 bg-card/95 hover:border-line-strong overflow-hidden shadow-[0_24px_60px_var(--paper-shadow)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_30px_80px_var(--paper-shadow)]",
        featured && "col-span-2 row-span-2",
      )}
    >
      <div className="border-border/80 relative aspect-[3/4] overflow-hidden border-b">
        <BookCardCover
          authorLabel={authorLabel}
          coverImageUrl={coverImageUrl}
          title={title}
        />

        {progressPercentage != null ? (
          <div
            className={cn(
              "absolute right-2 bottom-2",
              featured && "right-3 bottom-3",
            )}
          >
            <ProgressRing
              percentage={progressPercentage * 100}
              size={featured ? 36 : 28}
            />
          </div>
        ) : null}

        <div className="pointer-events-none invisible absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 backdrop-blur-[2px] transition-[opacity,visibility] duration-200 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:visible [@media(hover:none)]:opacity-100">
          <div className="absolute top-2 right-2 z-10">
            <DeleteBookButton bookId={id} iconOnly title={title} />
          </div>

          <Link
            className={cn(
              "rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus-visible:ring-4 focus-visible:ring-white/30 focus-visible:outline-none",
              featured && "px-5 py-2 text-sm",
            )}
            href={`/reader/${id}`}
          >
            {actionLabel}
          </Link>
        </div>
      </div>

      <Link
        className="focus-visible:ring-ring block p-4 focus-visible:ring-4 focus-visible:outline-none"
        href={`/reader/${id}`}
      >
        <div className="flex flex-col gap-1">
          <CardTitle className="line-clamp-2 text-base leading-snug">
            {title}
          </CardTitle>
          <CardDescription className="line-clamp-1 text-sm">
            {authorLabel}
          </CardDescription>
        </div>
      </Link>
    </Card>
  );
}
