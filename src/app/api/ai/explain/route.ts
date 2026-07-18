import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getAiErrorMessage, streamExplanation } from "@/lib/ai";
import { checkAiRateLimit } from "@/lib/ai-rate-limit";
import { explainSelectionSchema } from "@/lib/ai-validation";
import { generateRequestId, logServerError } from "@/lib/logger";

export const maxDuration = 30;

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = checkAiRateLimit(session.user.id);

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
    logServerError("AI_EXPLAIN_FAILED", "Failed to stream AI explanation", {
      requestId,
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: getAiErrorMessage(error),
        requestId,
      },
      { status: 500 },
    );
  }
}
