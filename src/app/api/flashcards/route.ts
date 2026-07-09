import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDueCardCount, getDueCards } from "@/lib/flashcards";
import { generateRequestId, logServerError } from "@/lib/logger";

export async function GET() {
  const requestId = generateRequestId();
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [cards, dueCount] = await Promise.all([
      getDueCards(session.user.id),
      getDueCardCount(session.user.id),
    ]);

    return NextResponse.json({ cards, dueCount });
  } catch (error) {
    logServerError("FLASHCARDS_FETCH_FAILED", "Failed to fetch flashcards", {
      requestId,
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Unable to load flashcards right now.", requestId },
      { status: 500 },
    );
  }
}
