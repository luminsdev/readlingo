import Link from "next/link";
import { cn } from "@/lib/utils";

/* eslint-disable @next/next/no-img-element -- Cover images are served through an auth-protected API route. */

const FALLBACK_COLORS = [
  "var(--ink-soft)",
  "var(--quote)",
  "var(--danger)",
  "var(--accent)",
  "var(--ink-muted)",
  "var(--muted-foreground)",
];

type CoverBook = {
  coverBlurDataUrl: string | null;
  coverUrl: string | null;
  id: string;
};

type CollectionCardProps = {
  collection: {
    _count: { books: number };
    books: Array<{ book: CoverBook }>;
    coverBook: CoverBook | null;
    coverBookId: string | null;
    displayName: string;
    id: string;
  };
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

function FallbackCover({ title }: { title: string }) {
  const fallbackColor = getTitleColor(title);

  return (
    <div
      className="bg-surface-strong relative h-full w-full overflow-hidden rounded-[10px] border border-black/10"
      style={{
        background: `linear-gradient(155deg, ${fallbackColor} 0%, transparent 100%)`,
        backgroundColor: "var(--surface)",
      }}
    >
      <div className="bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.08%22/%3E%3C/svg%3E')] absolute inset-0 opacity-50 mix-blend-overlay" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_40%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.08)_50%,var(--surface-strong)_100%)] opacity-70" />
      <div className="text-foreground/90 relative flex h-full flex-col justify-between p-[10%]">
        <p className="text-foreground/45 text-[0.52rem] tracking-[0.24em] uppercase mix-blend-multiply dark:mix-blend-screen">
          Shelf edition
        </p>
        <p className="text-foreground line-clamp-4 font-serif text-lg leading-[1.08] drop-shadow-sm">
          {title}
        </p>
      </div>
    </div>
  );
}

function CoverImage({
  book,
  title,
  className,
}: {
  book: CoverBook;
  title: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface-strong h-full w-full overflow-hidden rounded-[10px] border border-black/10 bg-cover bg-center shadow-[0_16px_38px_var(--paper-shadow)]",
        className,
      )}
      style={
        book.coverBlurDataUrl
          ? { backgroundImage: `url(${book.coverBlurDataUrl})` }
          : undefined
      }
    >
      <img
        alt={title}
        className="h-full w-full object-cover"
        decoding="async"
        loading="lazy"
        src={`/api/covers/${book.id}?size=thumb`}
      />
    </div>
  );
}

function CollectionCover({ collection }: CollectionCardProps) {
  const { coverBook, coverBookId, displayName } = collection;

  if (coverBookId && coverBook?.coverUrl) {
    return <CoverImage book={coverBook} title={displayName} />;
  }

  const stackedCovers = collection.books
    .map(({ book }) => book)
    .filter((book) => book.coverUrl)
    .slice(0, 4);

  if (!stackedCovers.length) {
    return <FallbackCover title={displayName} />;
  }

  if (stackedCovers.length === 1) {
    return <CoverImage book={stackedCovers[0]} title={displayName} />;
  }

  if (stackedCovers.length === 2) {
    return (
      <div className="bg-surface-strong grid h-full w-full grid-cols-2 gap-[2px] overflow-hidden rounded-[10px] border border-black/10 shadow-[0_16px_38px_var(--paper-shadow)]">
        <div className="relative h-full w-full">
          <CoverImage
            book={stackedCovers[0]}
            title={displayName}
            className="rounded-none border-none shadow-none"
          />
        </div>
        <div className="relative h-full w-full">
          <CoverImage
            book={stackedCovers[1]}
            title={displayName}
            className="rounded-none border-none shadow-none"
          />
        </div>
      </div>
    );
  }

  if (stackedCovers.length === 3) {
    return (
      <div className="bg-surface-strong grid h-full w-full grid-cols-2 gap-[2px] overflow-hidden rounded-[10px] border border-black/10 shadow-[0_16px_38px_var(--paper-shadow)]">
        <div className="relative h-full w-full">
          <CoverImage
            book={stackedCovers[0]}
            title={displayName}
            className="rounded-none border-none shadow-none"
          />
        </div>
        <div className="grid grid-rows-2 gap-[2px]">
          <div className="relative h-full w-full">
            <CoverImage
              book={stackedCovers[1]}
              title={displayName}
              className="rounded-none border-none shadow-none"
            />
          </div>
          <div className="relative h-full w-full">
            <CoverImage
              book={stackedCovers[2]}
              title={displayName}
              className="rounded-none border-none shadow-none"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-strong grid h-full w-full grid-cols-2 grid-rows-2 gap-[2px] overflow-hidden rounded-[10px] border border-black/10 shadow-[0_16px_38px_var(--paper-shadow)]">
      {stackedCovers.map((book) => (
        <div key={book.id} className="relative h-full w-full">
          <CoverImage
            book={book}
            title={displayName}
            className="rounded-none border-none shadow-none"
          />
        </div>
      ))}
    </div>
  );
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const bookCount = collection._count.books;

  return (
    <Link
      aria-label={`Open ${collection.displayName} shelf`}
      className="group focus-visible:ring-ring block w-36 shrink-0 rounded-[14px] focus-visible:ring-2 focus-visible:outline-none sm:w-40"
      href={`/library/collections/${collection.id}`}
    >
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-x-3 -bottom-2 h-5 rounded-full bg-[radial-gradient(ellipse_at_center,var(--paper-shadow),transparent_70%)] opacity-80 blur-md transition-all duration-300 group-hover:-bottom-3 group-hover:opacity-100"
        />
        <div className="relative aspect-[3/4] w-full transition-all duration-300 ease-[cubic-bezier(0.2,1,0.2,1)] group-hover:scale-[1.015] group-hover:drop-shadow-[0_20px_45px_var(--paper-shadow)]">
          <CollectionCover collection={collection} />
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-0.5 px-0.5">
        <p className="text-foreground truncate font-serif text-[1.02rem] leading-snug tracking-tight transition-transform duration-300 ease-out group-hover:-translate-y-1">
          {collection.displayName}
        </p>
        <p className="text-muted-foreground text-xs transition-transform duration-300 ease-out group-hover:-translate-y-1">
          {bookCount} {bookCount === 1 ? "book" : "books"}
        </p>
      </div>
    </Link>
  );
}
