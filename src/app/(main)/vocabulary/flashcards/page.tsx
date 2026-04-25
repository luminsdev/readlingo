import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FlashcardSession } from "@/components/flashcards/flashcard-session";
import { getDueCardCount, getDueCards } from "@/lib/flashcards";
import { prisma } from "@/lib/prisma";

export default async function FlashcardsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [cards, dueCount, totalVocabularyCount] = await Promise.all([
    getDueCards(session.user.id),
    getDueCardCount(session.user.id),
    prisma.vocabulary.count({
      where: {
        userId: session.user.id,
      },
    }),
  ]);

  return (
    <div className="animate-content-in">
      <FlashcardSession
        initialCards={cards}
        initialDueCount={dueCount}
        totalVocabularyCount={totalVocabularyCount}
      />
    </div>
  );
}
