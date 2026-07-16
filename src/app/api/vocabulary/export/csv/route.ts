import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { generateRequestId, logServerError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildVocabularyExportQuery,
  createVocabularyExportFilename,
  formatVocabularyCsv,
  VOCABULARY_EXPORT_MAX_ROWS,
  VOCABULARY_EXPORT_RATE_LIMIT,
  VOCABULARY_EXPORT_RATE_WINDOW_MS,
} from "@/lib/vocabulary-export";

export async function GET(request: Request) {
  const requestId = generateRequestId();
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const rateLimit = checkRateLimit(
    `vocab-export:${userId}`,
    VOCABULARY_EXPORT_RATE_LIMIT,
    VOCABULARY_EXPORT_RATE_WINDOW_MS,
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many export requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  try {
    const query = buildVocabularyExportQuery(
      userId,
      new URL(request.url).searchParams,
    );
    const count = await prisma.vocabulary.count({ where: query.where });

    if (count > VOCABULARY_EXPORT_MAX_ROWS) {
      return NextResponse.json(
        {
          error: `${count.toLocaleString("en-US")} vocabulary items match these filters. Refine your filters to export ${VOCABULARY_EXPORT_MAX_ROWS.toLocaleString("en-US")} items or fewer.`,
        },
        { status: 400 },
      );
    }

    const records = count === 0 ? [] : await prisma.vocabulary.findMany(query);
    const body = formatVocabularyCsv(records);

    return new NextResponse(body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${createVocabularyExportFilename("csv")}"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    logServerError(
      "VOCABULARY_EXPORT_FAILED",
      "Failed to export vocabulary as CSV",
      {
        requestId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      },
    );

    return NextResponse.json(
      { error: "Unable to export vocabulary.", requestId },
      { status: 500 },
    );
  }
}
