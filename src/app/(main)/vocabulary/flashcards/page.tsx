import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FlashcardSession } from "@/components/flashcards/flashcard-session";
import { getDueCardCount, getDueCards } from "@/lib/flashcards";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserPreferences } from "@/lib/user-preferences";

export default async function FlashcardsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const today = new Date();
  const dateOnly = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  const [cards, dueCount, totalVocabularyCount, preferences, reviewedToday] =
    await Promise.all([
      getDueCards(session.user.id),
      getDueCardCount(session.user.id),
      prisma.vocabulary.count({
        where: {
          userId: session.user.id,
        },
      }),
      getOrCreateUserPreferences(session.user.id),
      prisma.learningActivity.findUnique({
        where: {
          userId_date_type: {
            userId: session.user.id,
            date: dateOnly,
            type: "review",
          },
        },
        select: { count: true },
      }),
    ]);

  return (
    <div className="animate-content-in">
      <FlashcardSession
        initialCards={cards}
        initialDueCount={dueCount}
        initialReviewedToday={reviewedToday?.count ?? 0}
        dailyGoal={preferences.dailyGoal}
        totalVocabularyCount={totalVocabularyCount}
      />
    </div>
  );
}
