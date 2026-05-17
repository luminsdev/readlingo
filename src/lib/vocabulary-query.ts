import type { Prisma } from "@prisma/client";

export const MASTERY_INTERVAL_THRESHOLD = 21;

export type VocabularyStatus = "new" | "learning" | "mastered";
export type VocabularyStatusFilter = VocabularyStatus | "";
export type VocabularySort = "newest" | "oldest" | "az" | "za";

const VOCABULARY_STATUSES = new Set<string>(["new", "learning", "mastered"]);

const VOCABULARY_SORTS = new Set<string>(["newest", "oldest", "az", "za"]);

export function deriveVocabularyStatus(
  srsData: { interval: number } | null,
): VocabularyStatus {
  if (!srsData) {
    return "new";
  }

  if (srsData.interval >= MASTERY_INTERVAL_THRESHOLD) {
    return "mastered";
  }

  return "learning";
}

export function getVocabularyStatusBadge(status: VocabularyStatus) {
  switch (status) {
    case "new":
      return {
        label: "New",
        className:
          "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300",
      };
    case "learning":
      return {
        label: "Learning",
        className:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
      };
    case "mastered":
      return {
        label: "Mastered",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
      };
  }
}

export function parseVocabularySearchParams(searchParams: {
  page?: string;
  q?: string;
  status?: string;
  sort?: string;
}): {
  currentPage: number;
  searchQuery: string;
  statusFilter: VocabularyStatusFilter;
  sortBy: VocabularySort;
} {
  const currentPage = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const searchQuery = searchParams.q?.trim() ?? "";
  const statusFilter = VOCABULARY_STATUSES.has(searchParams.status ?? "")
    ? (searchParams.status as VocabularyStatus)
    : "";
  const sortBy = VOCABULARY_SORTS.has(searchParams.sort ?? "")
    ? (searchParams.sort as VocabularySort)
    : "newest";

  return {
    currentPage,
    searchQuery,
    statusFilter,
    sortBy,
  };
}

export function buildVocabularyWhere({
  userId,
  searchQuery,
  statusFilter,
}: {
  userId: string;
  searchQuery: string;
  statusFilter: VocabularyStatusFilter;
}): Prisma.VocabularyWhereInput {
  const where: Prisma.VocabularyWhereInput = {
    userId,
    ...(searchQuery && {
      OR: [
        { word: { contains: searchQuery, mode: "insensitive" } },
        { definition: { contains: searchQuery, mode: "insensitive" } },
      ],
    }),
  };

  if (statusFilter === "new") {
    where.srsData = null;
  }

  if (statusFilter === "learning") {
    where.srsData = {
      is: {
        interval: {
          lt: MASTERY_INTERVAL_THRESHOLD,
        },
      },
    };
  }

  if (statusFilter === "mastered") {
    where.srsData = {
      is: {
        interval: {
          gte: MASTERY_INTERVAL_THRESHOLD,
        },
      },
    };
  }

  return where;
}

export function getVocabularyOrderBy(
  sortBy: VocabularySort,
): Prisma.VocabularyOrderByWithRelationInput {
  switch (sortBy) {
    case "oldest":
      return { createdAt: "asc" };
    case "az":
      return { word: "asc" };
    case "za":
      return { word: "desc" };
    default:
      return { createdAt: "desc" };
  }
}
