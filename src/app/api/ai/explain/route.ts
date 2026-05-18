import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getAiErrorMessage, streamExplanation } from "@/lib/ai";
import { explainSelectionSchema } from "@/lib/ai-validation";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

const AI_RATE_LIMIT = 30;
const AI_RATE_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(
    `ai:${session.user.id}`,
    AI_RATE_LIMIT,
    AI_RATE_WINDOW_MS,
  );

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.retryAfterSeconds),
        },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsedPayload = explainSelectionSchema.safeParse(body);

  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        error:
          parsedPayload.error.issues[0]?.message ??
          "A valid AI explanation request is required.",
      },
      { status: 400 },
    );
  }

  try {
    const result = streamExplanation(parsedPayload.data);

    return result.toTextStreamResponse({
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getAiErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
