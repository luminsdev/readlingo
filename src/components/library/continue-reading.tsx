import Image from "next/image";
import Link from "next/link";

import { getTitleColor } from "@/components/library/book-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ContinueReadingProps = {
  author: string | null;
  bookId: string;
  coverImageUrl: string | null;
  percentage: number | null;
  title: string;
};

function formatProgressLabel(percentage: number | null) {
  if (percentage == null) {
    return "In progress";
  }

  return `${Math.round(percentage * 100)}% complete`;
}

export function ContinueReading({
  author,
  bookId,
  coverImageUrl,
  percentage,
  title,
}: ContinueReadingProps) {
  const authorLabel = author ?? "Unknown author";
  const progressLabel = formatProgressLabel(percentage);

  return (
    <Card className="border-border/90 bg-card/95 overflow-hidden shadow-[0_24px_60px_var(--paper-shadow)]">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center sm:p-5">
        <div className="border-border/70 w-16 overflow-hidden rounded-[22px] border sm:w-[72px]">
          {coverImageUrl ? (
            <Image
              alt={title}
              className="aspect-[3/4] h-full w-full object-cover"
              height={192}
              sizes="72px"
              src={coverImageUrl}
              width={144}
            />
          ) : (
            <div
              className="bg-surface-soft aspect-[3/4]"
              style={{
                background: `linear-gradient(155deg, ${getTitleColor(title)} 0%, #20140f 100%)`,
              }}
            />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-ink-kicker text-xs font-semibold tracking-[0.26em] uppercase">
            Continue reading
          </p>
          <h2 className="line-clamp-2 font-serif text-2xl leading-tight sm:text-[1.9rem]">
            {title}
          </h2>
          <p className="text-muted-foreground line-clamp-1 text-sm">
            {authorLabel}
          </p>
          <p className="text-foreground text-sm font-medium">{progressLabel}</p>
        </div>

        <Button
          asChild
          className="justify-self-start sm:justify-self-end"
          size="sm"
        >
          <Link href={`/reader/${bookId}`}>Continue</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
