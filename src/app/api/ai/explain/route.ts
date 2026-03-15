import { NextResponse } from "next/server";

import { generateExplanation, getAiErrorMessage } from "@/lib/ai";
import { explainSelectionSchema } from "@/lib/ai-validation";

export const maxDuration = 30;

export async function POST(request: Request) {
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
    const result = await generateExplanation(parsedPayload.data);

    return NextResponse.json(result, {
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
