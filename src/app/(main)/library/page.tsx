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
    <div className="library-grain animate-content-in relative flex flex-col gap-8">
      <header className="relative flex flex-col gap-5 overflow-hidden rounded-[28px] px-1 py-2">
        <div className="pointer-events-none absolute inset-x-8 -top-10 h-28 bg-[radial-gradient(circle_at_top,var(--page-glow-primary),transparent_68%)] opacity-90" />
        <div className="pointer-events-none absolute top-3 right-10 h-16 w-40 bg-[radial-gradient(circle,var(--page-glow-secondary),transparent_72%)] opacity-80" />

        <div className="relative mt-2 flex flex-wrap items-end justify-between gap-6 pt-2 pb-4">
          {/* Left: Titles */}
          <div className="flex shrink-0 flex-col gap-1.5">
            <p className="text-ink-kicker text-[0.65rem] font-bold tracking-[0.3em] uppercase">
              Your Library
            </p>
            <h1 className="text-foreground font-serif text-4xl tracking-tight sm:text-5xl">
              {books.length} {books.length === 1 ? "book" : "books"}
            </h1>
          </div>

          {/* Center: Editorial Quote */}
          <div className="relative ml-6 hidden max-w-2xl flex-1 items-center pl-10 lg:flex">
            <div className="bg-line-strong/80 absolute top-1/2 left-0 h-12 w-px -translate-y-1/2" />
            <p className="text-muted-foreground/90 font-serif text-base leading-relaxed tracking-wide italic">
              &ldquo;I have always imagined that Paradise will be a kind of
              library.&rdquo;
              <span className="text-ink-kicker/80 mt-2.5 block font-sans text-[0.62rem] font-bold tracking-[0.25em] uppercase not-italic">
                &mdash; Jorge Luis Borges
              </span>
            </p>
          </div>

          {/* Right: Actions */}
          <div className="z-10 mb-1 shrink-0">
            <UploadBookDialog />
          </div>
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
