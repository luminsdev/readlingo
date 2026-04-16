import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BookCard } from "@/components/library/book-card";
import { UploadBookDialog } from "@/components/library/upload-book-dialog";
import { resolveBookCoverUrl } from "@/lib/books";
import { prisma } from "@/lib/prisma";

export default async function LibraryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const books = await prisma.book.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      author: true,
      coverUrl: true,
      readingProgress: {
        select: {
          percentage: true,
          updatedAt: true,
        },
      },
    },
  });

  const booksWithCovers = await Promise.all(
    books.map(async (book) => ({
      ...book,
      coverImageUrl: await resolveBookCoverUrl(book.coverUrl),
    })),
  );

  return (
    <div className="library-grain relative flex flex-col gap-8">
      <header className="relative flex flex-col gap-5 overflow-hidden rounded-[28px] px-1 py-2">
        <div className="pointer-events-none absolute inset-x-8 -top-10 h-28 bg-[radial-gradient(circle_at_top,var(--page-glow-primary),transparent_68%)] opacity-90" />
        <div className="pointer-events-none absolute top-3 right-10 h-16 w-40 bg-[radial-gradient(circle,var(--page-glow-secondary),transparent_72%)] opacity-80" />

        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-ink-kicker text-xs font-semibold tracking-[0.3em] uppercase">
              Your Library
            </p>
            <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
              {books.length} {books.length === 1 ? "book" : "books"}
            </h1>
          </div>

          <UploadBookDialog />
        </div>

        <div className="bg-line-strong h-px" />
      </header>

      {booksWithCovers.length ? (
        <div className="z-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {booksWithCovers.map((book) => (
            <BookCard
              author={book.author}
              coverImageUrl={book.coverImageUrl}
              hasStartedReading={book.readingProgress != null}
              id={book.id}
              key={book.id}
              progressPercentage={book.readingProgress?.percentage ?? null}
              title={book.title}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <p className="text-ink-kicker text-xs font-semibold tracking-[0.3em] uppercase">
            Your shelf is waiting
          </p>
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
            Add your first book
          </h2>
          <p className="text-muted-foreground max-w-md text-sm leading-6">
            Upload an EPUB to see its cover art, track your reading progress,
            and pick up right where you left off.
          </p>
        </div>
      )}
    </div>
  );
}
