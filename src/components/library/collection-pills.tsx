import Link from "next/link";

type CollectionPillsProps = {
  collections: Array<{
    _count: { books: number };
    displayName: string;
    id: string;
  }>;
};

export function CollectionPills({ collections }: CollectionPillsProps) {
  return (
    <nav
      aria-label="Library shelves"
      className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: "none" }}
    >
      <Link
        aria-current="page"
        className="border-line bg-foreground text-background shrink-0 rounded-full border px-3 py-1 text-xs font-medium tracking-wide transition-colors"
        href="/library"
      >
        All
      </Link>

      {collections.map((collection) => (
        <Link
          className="bg-surface border-line text-ink-soft hover:bg-surface-strong shrink-0 rounded-full border px-3 py-1 text-xs font-medium tracking-wide transition-colors"
          href={`/library/collections/${collection.id}`}
          key={collection.id}
        >
          {collection.displayName}{" "}
          <span className="text-ink-kicker">({collection._count.books})</span>
        </Link>
      ))}
    </nav>
  );
}
