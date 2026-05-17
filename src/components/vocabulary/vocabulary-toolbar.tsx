"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "learning", label: "Learning" },
  { value: "mastered", label: "Mastered" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "az", label: "A -> Z" },
  { value: "za", label: "Z -> A" },
] as const;

export function VocabularyToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentQuery = searchParams.get("q") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  const currentSort = searchParams.get("sort") ?? "newest";

  const [searchValue, setSearchValue] = useState(currentQuery);

  useEffect(() => {
    setSearchValue(currentQuery);
  }, [currentQuery]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }

      params.delete("page");

      startTransition(() => {
        const queryString = params.toString();
        router.push(queryString ? `/vocabulary?${queryString}` : "/vocabulary");
      });
    },
    [router, searchParams],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        updateParams({ q: value.trim() });
      }, 400);
    },
    [updateParams],
  );

  return (
    <div className="paper-panel border-border flex flex-col gap-4 rounded-[32px] border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative max-w-sm flex-1">
        <Search className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          type="search"
          placeholder="Search words..."
          value={searchValue}
          onChange={(event) => handleSearchChange(event.target.value)}
          className={cn(
            "border-line bg-surface placeholder:text-ink-muted text-foreground w-full rounded-full border py-2 pr-4 pl-9 text-sm outline-none",
            "focus:border-accent focus:ring-1 focus:ring-[var(--accent)]",
            isPending && "opacity-70",
          )}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateParams({ status: option.value })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                currentStatus === option.value
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line text-ink-muted hover:border-line-strong hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <select
          value={currentSort}
          onChange={(event) => updateParams({ sort: event.target.value })}
          className="border-line bg-surface text-ink-soft rounded-full border px-3 py-1.5 text-xs outline-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
