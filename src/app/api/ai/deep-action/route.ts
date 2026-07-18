import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { streamDeepAction } from "@/lib/ai-deep-actions";
import { checkAiRateLimit } from "@/lib/ai-rate-limit";
import { deepActionRequestSchema } from "@/lib/ai-validation";
import { generateRequestId, logServerError } from "@/lib/logger";

export const maxDuration = 30;

function getErrorType(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 500);
  }

  return String(error).slice(0, 500);
}

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
  const parsedPayload = deepActionRequestSchema.safeParse(body);

  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        error:
          parsedPayload.error.issues[0]?.message ??
          "A valid AI deep-action request is required.",
      },
      { status: 400 },
    );
  }

  try {
    let hasStreamError = false;
    const result = streamDeepAction(parsedPayload.data, {
      onError({ error }) {
        hasStreamError = true;
        logServerError(
          "AI_DEEP_ACTION_STREAM_FAILED",
          "AI deep-action stream failed",
          {
            requestId,
            userId: session.user.id,
            action: parsedPayload.data.action,
            errorType: getErrorType(error),
            errorMessage: getErrorMessage(error),
          },
        );
      },
      onFinish({ error }) {
        if (!error || hasStreamError) {
          return;
        }

        logServerError(
          "AI_DEEP_ACTION_OUTPUT_INVALID",
          "AI deep-action output validation failed",
          {
            requestId,
            userId: session.user.id,
            action: parsedPayload.data.action,
            errorType: getErrorType(error),
            errorMessage: getErrorMessage(error),
          },
        );
      },
    });

    return result.toTextStreamResponse({
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logServerError("AI_DEEP_ACTION_FAILED", "Failed to stream AI deep action", {
      requestId,
      userId: session.user.id,
      errorType: getErrorType(error),
    });

    return NextResponse.json(
      {
        error: "AI follow-up is unavailable right now. Please try again.",
        requestId,
      },
      { status: 500 },
    );
  }
}
