import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { auth } from "@/auth";
import { BookCard } from "@/components/library/book-card";
import { UploadBookDialog } from "@/components/library/upload-book-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { resolveBookCoverUrl } from "@/lib/books";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

type PaginationPage = number | "ellipsis-start" | "ellipsis-end";

function getPaginationPages(currentPage: number, totalPages: number) {
  const pages = new Set<number>([1, totalPages]);
  const firstSibling = Math.max(2, currentPage - 1);
  const lastSibling = Math.min(totalPages - 1, currentPage + 1);

  for (let page = firstSibling; page <= lastSibling; page += 1) {
    pages.add(page);
  }

  return Array.from(pages)
    .sort((a, b) => a - b)
    .reduce<PaginationPage[]>((items, page, index, sortedPages) => {
      const previousPage = sortedPages[index - 1];

      if (previousPage && page - previousPage > 1) {
        items.push(index === 1 ? "ellipsis-start" : "ellipsis-end");
      }

      items.push(page);
      return items;
    }, []);
}

function LibraryPagination({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  const paginationPages = getPaginationPages(currentPage, totalPages);

  return (
    <Pagination className="mt-8">
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            asChild
            size="default"
            className={cn(
              "text-ink-soft gap-1 pl-2.5",
              currentPage === 1 && "pointer-events-none opacity-40",
            )}
            aria-disabled={currentPage === 1}
          >
            <Link href={`/library?page=${Math.max(1, currentPage - 1)}`}>
              <ChevronLeft className="size-4" />
              <span>Previous</span>
            </Link>
          </PaginationLink>
        </PaginationItem>

        {paginationPages.map((page) => (
          <PaginationItem key={page}>
            {typeof page === "number" ? (
              <PaginationLink
                asChild
                isActive={page === currentPage}
                className={cn(
                  page === currentPage
                    ? "border-line bg-surface-strong text-foreground"
                    : "text-ink-soft",
                )}
              >
                <Link href={`/library?page=${page}`}>{page}</Link>
              </PaginationLink>
            ) : (
              <PaginationEllipsis className="text-ink-soft" />
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationLink
            asChild
            size="default"
            className={cn(
              "text-ink-soft gap-1 pr-2.5",
              currentPage === totalPages && "pointer-events-none opacity-40",
            )}
            aria-disabled={currentPage === totalPages}
          >
            <Link
              href={`/library?page=${Math.min(totalPages, currentPage + 1)}`}
            >
              <span>Next</span>
              <ChevronRight className="size-4" />
            </Link>
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const PAGE_SIZE = 20;

  const [books, totalCount] = await Promise.all([
    prisma.book.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
    }),
    prisma.book.count({
      where: { userId: session.user.id },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (currentPage > totalPages && totalPages > 0) {
    redirect(`/library?page=${totalPages}`);
  }

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
              {totalCount} {totalCount === 1 ? "book" : "books"}
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
        <>
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
          {totalPages > 1 ? (
            <LibraryPagination
              currentPage={currentPage}
              totalPages={totalPages}
            />
          ) : null}
        </>
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
