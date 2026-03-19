import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDueCardCount, getDueCards } from "@/lib/flashcards";

export async function GET() {
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
  } catch {
    return NextResponse.json(
      { error: "Unable to load flashcards right now." },
      { status: 500 },
    );
  }
}
