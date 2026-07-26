import { NoObjectGeneratedError } from "ai";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  getEligibleDeepActions,
  getDeepActionServerTimeoutMs,
  streamDeepAction,
} from "@/lib/ai-deep-actions";
import { checkAiRateLimit } from "@/lib/ai-rate-limit";
import { deepActionRequestSchema } from "@/lib/ai-validation";
import { generateRequestId, logServerError } from "@/lib/logger";

export const maxDuration = 40;

function getErrorType(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 500);
  }

  return String(error).slice(0, 500);
}

function getErrorDiagnostics(error: unknown) {
  const diagnostics: Record<string, string | boolean> = {
    errorType: getErrorType(error),
    errorMessage: getErrorMessage(error),
  };

  if (!NoObjectGeneratedError.isInstance(error)) {
    return diagnostics;
  }

  if (error.finishReason) {
    diagnostics.finishReason = error.finishReason;
  }

  if (error.text) {
    diagnostics.rawTextContainsForms = /"forms"\s*:/.test(error.text);
  }

  return diagnostics;
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestId = generateRequestId();
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

  const eligibleActions = getEligibleDeepActions({
    selectedText: parsedPayload.data.selectedText,
    sourceLanguage: parsedPayload.data.sourceLanguage,
  });

  if (!eligibleActions.includes(parsedPayload.data.action)) {
    return NextResponse.json(
      {
        error:
          "This AI action is not available for the current selection or language.",
      },
      { status: 400 },
    );
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

  const abortController = new AbortController();
  const timeoutMs = getDeepActionServerTimeoutMs(parsedPayload.data.action);
  let didTimeout = false;
  let hasStreamError = false;
  let hasCleanedUp = false;
  const abortFromRequest = () => abortController.abort(request.signal.reason);
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    logServerError("AI_DEEP_ACTION_TIMEOUT", "AI deep action timed out", {
      requestId,
      userId: session.user.id,
      action: parsedPayload.data.action,
      timeoutMs,
    });
    abortController.abort(
      new DOMException("Deep action timed out", "TimeoutError"),
    );
  }, timeoutMs);
  const cleanup = () => {
    if (hasCleanedUp) {
      return;
    }

    hasCleanedUp = true;
    clearTimeout(timeoutId);
    request.signal.removeEventListener("abort", abortFromRequest);
  };

  if (request.signal.aborted) {
    abortFromRequest();
  } else {
    request.signal.addEventListener("abort", abortFromRequest, { once: true });
  }

  try {
    const result = streamDeepAction(parsedPayload.data, {
      abortSignal: abortController.signal,
      onError({ error }) {
        if (didTimeout) {
          return;
        }

        hasStreamError = true;
        logServerError(
          "AI_DEEP_ACTION_STREAM_FAILED",
          "AI deep-action stream failed",
          {
            requestId,
            userId: session.user.id,
            action: parsedPayload.data.action,
            ...getErrorDiagnostics(error),
          },
        );
      },
      onFinish({ error }) {
        cleanup();

        if (!error || hasStreamError || didTimeout) {
          return;
        }

        logServerError(
          "AI_DEEP_ACTION_OUTPUT_INVALID",
          "AI deep-action output validation failed",
          {
            requestId,
            userId: session.user.id,
            action: parsedPayload.data.action,
            ...getErrorDiagnostics(error),
          },
        );
      },
    });

    const textResponse = result.toTextStreamResponse({
      headers: {
        "Cache-Control": "no-store",
      },
    });

    if (!textResponse.body) {
      throw new Error("AI deep-action stream body is unavailable.");
    }

    const sourceReader = textResponse.body.getReader();
    let isResponseCanceled = false;
    let hasReleasedReader = false;
    const releaseReader = () => {
      if (!hasReleasedReader) {
        hasReleasedReader = true;
        sourceReader.releaseLock();
      }
    };
    const responseStream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await sourceReader.read();

          if (isResponseCanceled) {
            return;
          }

          if (done) {
            cleanup();
            releaseReader();
            controller.close();
            return;
          }

          controller.enqueue(value);
        } catch (error) {
          if (isResponseCanceled) {
            return;
          }

          if (!didTimeout && !hasStreamError) {
            hasStreamError = true;
            logServerError(
              "AI_DEEP_ACTION_STREAM_FAILED",
              "AI deep-action stream failed",
              {
                requestId,
                userId: session.user.id,
                action: parsedPayload.data.action,
                ...getErrorDiagnostics(error),
              },
            );
          }

          cleanup();
          releaseReader();
          controller.close();
        }
      },
      async cancel(reason) {
        isResponseCanceled = true;
        cleanup();
        abortController.abort(reason);
        await sourceReader.cancel(reason).catch(() => undefined);
        releaseReader();
      },
    });

    return new Response(responseStream, {
      headers: textResponse.headers,
      status: textResponse.status,
      statusText: textResponse.statusText,
    });
  } catch (error) {
    cleanup();
    logServerError("AI_DEEP_ACTION_FAILED", "Failed to stream AI deep action", {
      requestId,
      userId: session.user.id,
      ...getErrorDiagnostics(error),
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
