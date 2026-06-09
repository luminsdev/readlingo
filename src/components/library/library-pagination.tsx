import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { getFilteredPageHref } from "@/lib/library-url";
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

export function LibraryPagination({
  basePath,
  currentPage,
  filters,
  totalPages,
}: {
  basePath: string;
  currentPage: number;
  filters: { q: string };
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
            <Link
              href={getFilteredPageHref(basePath, filters, {
                page: Math.max(1, currentPage - 1),
              })}
            >
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
                <Link href={getFilteredPageHref(basePath, filters, { page })}>
                  {page}
                </Link>
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
              href={getFilteredPageHref(basePath, filters, {
                page: Math.min(totalPages, currentPage + 1),
              })}
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
