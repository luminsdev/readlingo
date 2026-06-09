import Link from "next/link";

/* eslint-disable @next/next/no-img-element -- Cover images are served through an auth-protected API route. */

const FALLBACK_COLORS = [
  "var(--ink-soft)",
  "var(--quote)",
  "var(--danger)",
  "var(--accent)",
  "var(--ink-muted)",
  "var(--muted-foreground)",
];

const STACK_LAYER_STYLES = [
  { opacity: 0.6, transform: "translate(8px, 8px) scale(0.95)" },
  { opacity: 0.8, transform: "translate(4px, 4px) scale(0.975)" },
  { opacity: 1, transform: "translate(0, 0) scale(1)" },
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

function CoverImage({ book, title }: { book: CoverBook; title: string }) {
  return (
    <div
      className="bg-surface-strong h-full w-full overflow-hidden rounded-[10px] border border-black/10 bg-cover bg-center shadow-[0_16px_38px_var(--paper-shadow)]"
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
    .slice(0, 3)
    .reverse();

  if (!stackedCovers.length) {
    return <FallbackCover title={displayName} />;
  }

  return (
    <div className="relative h-full w-full">
      {stackedCovers.map((book, index) => {
        const style = STACK_LAYER_STYLES[index + (3 - stackedCovers.length)];

        return (
          <div
            className="absolute inset-0"
            key={book.id}
            style={{ opacity: style.opacity, transform: style.transform }}
          >
            <CoverImage book={book} title={displayName} />
          </div>
        );
      })}
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
