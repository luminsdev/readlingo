import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { submitReview } from "@/lib/flashcards";
import { reviewSubmitSchema } from "@/lib/srs-validation";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsedPayload = reviewSubmitSchema.safeParse(body);

  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        error:
          parsedPayload.error.issues[0]?.message ??
          "A valid flashcard review payload is required.",
      },
      { status: 400 },
    );
  }

  try {
    const srsData = await submitReview(
      session.user.id,
      parsedPayload.data.vocabularyId,
      parsedPayload.data.rating,
    );

    if (!srsData) {
      return NextResponse.json(
        { error: "Flashcard not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ srsData });
  } catch {
    return NextResponse.json(
      { error: "Unable to submit this flashcard review." },
      { status: 500 },
    );
  }
}
