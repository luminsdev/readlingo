"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { getFilteredPageHref } from "@/lib/library-url";
import { cn } from "@/lib/utils";

type LibrarySearchProps = {
  className?: string;
};

export function LibrarySearch({ className }: LibrarySearchProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const nextQuery = query.trim();
      const currentQuery = searchParams.get("q")?.trim() ?? "";

      if (nextQuery === currentQuery) {
        return;
      }

      router.push(
        getFilteredPageHref(
          pathname,
          {
            page: searchParams.get("page"),
            q: currentQuery,
          },
          { page: 1, q: nextQuery || null },
        ),
      );
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [pathname, query, router, searchParams]);

  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden="true"
        className="text-ink-soft pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <Input
        aria-label="Search library by title or author"
        className="bg-surface border-line text-foreground placeholder:text-ink-soft/70 h-10 rounded-full pr-4 pl-9 shadow-sm"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search title or author"
        type="search"
        value={query}
      />
    </div>
  );
}
