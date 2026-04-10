import Image from "next/image";
import Link from "next/link";

import { DeleteBookButton } from "@/components/library/delete-book-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  id: string;
  title: string;
};

export function getTitleColor(title: string) {
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
      <div className="border-border/80 bg-surface-soft aspect-[3/4] overflow-hidden border-b">
        <Image
          alt={title}
          className="h-full w-full object-cover"
          height={800}
          sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
          src={coverImageUrl}
          width={600}
        />
      </div>
    );
  }

  const fallbackColor = getTitleColor(title);

  return (
    <div
      className="border-border/80 relative aspect-[3/4] overflow-hidden border-b"
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

export function BookCard({ author, coverImageUrl, id, title }: BookCardProps) {
  const authorLabel = author ?? "Unknown author";

  return (
    <Card className="border-border/90 bg-card/95 hover:border-line-strong overflow-hidden shadow-[0_24px_60px_var(--paper-shadow)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_30px_80px_var(--paper-shadow)]">
      <BookCardCover
        authorLabel={authorLabel}
        coverImageUrl={coverImageUrl}
        title={title}
      />
      <CardHeader className="gap-1 pb-4">
        <CardTitle className="line-clamp-2 text-lg leading-snug">
          {title}
        </CardTitle>
        <CardDescription className="line-clamp-1 text-sm">
          {authorLabel}
        </CardDescription>
      </CardHeader>
      <CardFooter className="border-border/70 justify-between gap-3 border-t pt-4">
        <Button asChild size="sm">
          <Link href={`/reader/${id}`}>Read</Link>
        </Button>
        <DeleteBookButton bookId={id} title={title} />
      </CardFooter>
    </Card>
  );
}
