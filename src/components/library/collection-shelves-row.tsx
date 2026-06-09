import { CollectionCard } from "@/components/library/collection-card";
import { CreateCollectionDialog } from "@/components/library/create-collection-dialog";

type CollectionShelvesRowProps = {
  collections: Array<{
    _count: { books: number };
    books: Array<{
      book: {
        coverBlurDataUrl: string | null;
        coverUrl: string | null;
        id: string;
      };
    }>;
    coverBook: {
      coverBlurDataUrl: string | null;
      coverUrl: string | null;
      id: string;
    } | null;
    coverBookId: string | null;
    displayName: string;
    id: string;
  }>;
};

export function CollectionShelvesRow({
  collections,
}: CollectionShelvesRowProps) {
  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="your-shelves-heading"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p
            className="text-ink-kicker text-[0.65rem] font-bold tracking-[0.3em] uppercase"
            id="your-shelves-heading"
          >
            Your Shelves
          </p>
          <h2 className="font-serif text-2xl tracking-tight sm:text-3xl">
            Curated reading rooms
          </h2>
        </div>
      </div>

      <div
        className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {collections.map((collection) => (
          <CollectionCard collection={collection} key={collection.id} />
        ))}
        <CreateCollectionDialog />
      </div>
    </section>
  );
}
