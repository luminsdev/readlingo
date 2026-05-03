import { getDueCardCount } from "@/lib/flashcards";
import { resolveBookCoverUrl } from "@/lib/books";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserPreferences } from "@/lib/user-preferences";

const COMPLETED_BOOK_THRESHOLD = 0.95;

export type DashboardData = {
  preferences: Awaited<ReturnType<typeof getOrCreateUserPreferences>>;
  dueCardCount: number;
  totalVocabularyCount: number;
  reviewedTodayCount: number;
  booksInProgress: number;
  booksCompleted: number;
  recentWords: Array<{
    id: string;
    word: string;
    definition: string;
    createdAt: Date;
  }>;
  continueReading: {
    bookId: string;
    title: string;
    author: string | null;
    percentage: number | null;
    coverImageUrl: string | null;
  } | null;
  activityHeatmap: Array<{ date: Date; count: number }>;
};

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const today = new Date();
  const dateOnly = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  const heatmapStart = new Date(dateOnly);
  heatmapStart.setUTCDate(heatmapStart.getUTCDate() - 83);

  const [
    preferences,
    dueCardCount,
    totalVocabularyCount,
    reviewedToday,
    booksInProgress,
    booksCompleted,
    recentWords,
    lastReadBook,
    activityRaw,
  ] = await Promise.all([
    getOrCreateUserPreferences(userId),
    getDueCardCount(userId),
    prisma.vocabulary.count({ where: { userId } }),
    prisma.learningActivity.findUnique({
      where: { userId_date_type: { userId, date: dateOnly, type: "review" } },
      select: { count: true },
    }),
    prisma.book.count({
      where: {
        userId,
        readingProgress: {
          is: {
            OR: [
              { percentage: null },
              { percentage: { lt: COMPLETED_BOOK_THRESHOLD } },
            ],
          },
        },
      },
    }),
    prisma.book.count({
      where: {
        userId,
        readingProgress: {
          is: { percentage: { gte: COMPLETED_BOOK_THRESHOLD } },
        },
      },
    }),
    prisma.vocabulary.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, word: true, definition: true, createdAt: true },
    }),
    prisma.book.findFirst({
      where: {
        userId,
        readingProgress: {
          is: {
            OR: [
              { percentage: null },
              { percentage: { lt: COMPLETED_BOOK_THRESHOLD } },
            ],
          },
        },
      },
      orderBy: { readingProgress: { updatedAt: "desc" } },
      select: {
        id: true,
        title: true,
        author: true,
        coverUrl: true,
        readingProgress: { select: { percentage: true } },
      },
    }),
    prisma.learningActivity.groupBy({
      by: ["date"],
      where: { userId, date: { gte: heatmapStart } },
      _sum: { count: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const continueReadingCover = lastReadBook
    ? await resolveBookCoverUrl(lastReadBook.coverUrl)
    : null;

  return {
    preferences,
    dueCardCount,
    totalVocabularyCount,
    reviewedTodayCount: reviewedToday?.count ?? 0,
    booksInProgress,
    booksCompleted,
    recentWords,
    continueReading: lastReadBook
      ? {
          bookId: lastReadBook.id,
          title: lastReadBook.title,
          author: lastReadBook.author,
          percentage: lastReadBook.readingProgress?.percentage ?? null,
          coverImageUrl: continueReadingCover,
        }
      : null,
    activityHeatmap: activityRaw.map((row) => ({
      date: row.date,
      count: row._sum.count ?? 0,
    })),
  };
}
