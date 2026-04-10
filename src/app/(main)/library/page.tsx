import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BookCard } from "@/components/library/book-card";
import { ContinueReading } from "@/components/library/continue-reading";
import { UploadBookForm } from "@/components/library/upload-book-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getContinueReadingBook, resolveBookCoverUrl } from "@/lib/books";
import { prisma } from "@/lib/prisma";

export default async function LibraryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [books, continueBook] = await Promise.all([
    prisma.book.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        author: true,
        coverUrl: true,
      },
    }),
    getContinueReadingBook(session.user.id),
  ]);

  const [booksWithCovers, continueBookCoverUrl] = await Promise.all([
    Promise.all(
      books.map(async (book) => ({
        ...book,
        coverImageUrl: await resolveBookCoverUrl(book.coverUrl),
      })),
    ),
    continueBook ? resolveBookCoverUrl(continueBook.book.coverUrl) : null,
  ]);

  const bookCountLabel = `${books.length} ${books.length === 1 ? "book" : "books"} in your library`;

  return (
    <div className="flex flex-col gap-6">
      {continueBook ? (
        <ContinueReading
          author={continueBook.book.author}
          bookId={continueBook.book.id}
          coverImageUrl={continueBookCoverUrl}
          percentage={continueBook.percentage}
          title={continueBook.book.title}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <Card className="border-border/90 bg-card/95 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(200,106,60,0.15),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(92,130,95,0.12),transparent_28%)]" />
          <CardHeader className="relative gap-3 sm:p-8">
            <p className="text-ink-kicker text-xs font-semibold tracking-[0.3em] uppercase">
              Curated reading desk
            </p>
            <div className="flex max-w-3xl flex-col gap-2">
              <CardTitle className="font-serif text-4xl tracking-tight sm:text-5xl">
                Your Library
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6 sm:text-base">
                Every upload keeps its own jacket art when available, remembers
                your place, and keeps the path back into the reader close at
                hand.
              </CardDescription>
            </div>
            <p className="text-ink-soft text-sm font-medium">
              {bookCountLabel}
            </p>
          </CardHeader>
        </Card>

        <Card className="border-border/90 bg-card/95">
          <CardHeader className="gap-2">
            <CardTitle className="font-serif text-2xl">
              Add a new EPUB
            </CardTitle>
            <CardDescription>
              Drop another title onto your shelf. The library will keep the
              cover, progress, and reading route together.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadBookForm />
          </CardContent>
        </Card>
      </div>

      {booksWithCovers.length ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-serif text-2xl tracking-tight">Your shelf</h2>
              <p className="text-muted-foreground text-sm">
                Covers stay visible, and every title opens straight into the
                reader.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {booksWithCovers.map((book) => (
              <BookCard
                author={book.author}
                coverImageUrl={book.coverImageUrl}
                id={book.id}
                key={book.id}
                title={book.title}
              />
            ))}
          </div>
        </section>
      ) : (
        <Card className="border-border/90 bg-card/95">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center sm:py-20">
            <p className="text-ink-kicker text-xs font-semibold tracking-[0.3em] uppercase">
              Shelf waiting
            </p>
            <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">
              Start your library with a first EPUB.
            </h2>
            <p className="text-muted-foreground max-w-xl text-sm leading-6 sm:text-base">
              Upload a book to see extracted cover art, continue-reading
              shortcuts, and your saved place appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
