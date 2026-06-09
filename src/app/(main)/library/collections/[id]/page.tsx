import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { BookCard } from "@/components/library/book-card";
import { CollectionHeader } from "@/components/library/collection-header";
import { LibraryPagination } from "@/components/library/library-pagination";
import { LibrarySearch } from "@/components/library/library-search";
import {
  getCollectionBooks,
  getCollectionDetail,
  getUserCollections,
} from "@/lib/collections";
import { getFilteredPageHref } from "@/lib/library-url";
import { prisma } from "@/lib/prisma";

type CollectionPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await auth();

  if (!session?.user) {
    return { title: "Shelf | ReadLingo" };
  }

  const { id } = await params;
  const collection = await getCollectionDetail(session.user.id, id);

  if (!collection) {
    notFound();
  }

  return {
    title: `${collection.displayName} | Library | ReadLingo`,
  };
}

export default async function CollectionDetailPage({
  params,
  searchParams,
}: CollectionPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const collection = await getCollectionDetail(session.user.id, id);

  if (!collection) {
    notFound();
  }

  const { page: pageParam, q: searchQuery } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const trimmedQuery = searchQuery?.trim() || "";
  const [booksResult, allCollections] = await Promise.all([
    getCollectionBooks(session.user.id, id, {
      page: currentPage,
      query: trimmedQuery,
    }),
    getUserCollections(session.user.id),
  ]);
  const bookCollectionRows = booksResult.books.length
    ? await prisma.bookCollection.findMany({
        where: {
          bookId: { in: booksResult.books.map((book) => book.id) },
          collectionId: {
            in: allCollections.map((collection) => collection.id),
          },
        },
        select: {
          bookId: true,
          collectionId: true,
        },
      })
    : [];
  const booksWithCollections = booksResult.books.map((book) => ({
    ...book,
    collections: bookCollectionRows.filter((row) => row.bookId === book.id),
  }));
  const totalPages = Math.ceil(booksResult.totalCount / booksResult.pageSize);
  const basePath = `/library/collections/${id}`;

  if (currentPage > totalPages && totalPages > 0) {
    redirect(
      getFilteredPageHref(basePath, { q: trimmedQuery }, { page: totalPages }),
    );
  }

  return (
    <div className="library-grain animate-content-in relative flex flex-col gap-8">
      <Link
        className="text-ink-soft hover:text-foreground w-fit text-xs font-bold tracking-[0.22em] uppercase transition-colors"
        href="/library"
      >
        &larr; Back to Library
      </Link>

      <CollectionHeader
        bookCount={collection._count.books}
        coverBook={collection.coverBook}
        coverBookId={collection.coverBookId}
        createdAt={collection.createdAt.toISOString()}
        displayName={collection.displayName}
        id={collection.id}
        stackedCovers={collection.books.map(({ book }) => book)}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-ink-kicker text-[0.65rem] font-bold tracking-[0.3em] uppercase">
            Shelf Books
          </p>
          <h2 className="font-serif text-2xl tracking-tight sm:text-3xl">
            {booksResult.totalCount}{" "}
            {booksResult.totalCount === 1 ? "book" : "books"}
          </h2>
        </div>
        <LibrarySearch className="w-full sm:w-80" />
      </div>

      {booksResult.books.length ? (
        <>
          <div className="z-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {booksWithCollections.map((book) => (
              <BookCard
                author={book.author}
                collectionContext={{ collectionId: id }}
                coverBlurDataUrl={book.coverBlurDataUrl}
                hasCover={!!book.coverUrl}
                hasStartedReading={book.readingProgress != null}
                id={book.id}
                key={book.id}
                progressPercentage={book.readingProgress?.percentage ?? null}
                title={book.title}
                collections={allCollections.map((collection) => ({
                  id: collection.id,
                  displayName: collection.displayName,
                  hasBook: book.collections.some(
                    (bookCollection) =>
                      bookCollection.collectionId === collection.id,
                  ),
                }))}
              />
            ))}
          </div>
          {totalPages > 1 ? (
            <LibraryPagination
              basePath={basePath}
              currentPage={currentPage}
              filters={{ q: trimmedQuery }}
              totalPages={totalPages}
            />
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <p className="text-ink-kicker text-xs font-semibold tracking-[0.3em] uppercase">
            {trimmedQuery ? "No matches" : "Empty shelf"}
          </p>
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            {trimmedQuery ? "No books found" : "This shelf is empty"}
          </h2>
          {!trimmedQuery ? (
            <p className="text-muted-foreground max-w-md text-sm leading-6">
              This shelf is empty &mdash; add books from your library.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
