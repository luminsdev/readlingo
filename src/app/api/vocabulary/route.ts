import { Prisma } from "@prisma/client";
import { after, NextResponse } from "next/server";

import { auth } from "@/auth";
import { generateMnemonic } from "@/lib/ai-mnemonic";
import { prisma } from "@/lib/prisma";
import {
  saveVocabularySchema,
  vocabularyQuerySchema,
} from "@/lib/vocabulary-validation";

const DUPLICATE_VOCABULARY_CONFLICT = "DUPLICATE_VOCABULARY_CONFLICT";
const DUPLICATE_VOCABULARY_MESSAGE = "This word is already in your vocabulary.";

type VocabularyListRecord = Awaited<
  ReturnType<typeof prisma.vocabulary.findMany>
>[number];

type QueueVocabularyMnemonicInput = {
  vocabularyId: string;
  userId: string;
  word: string;
  definition: string;
  sourceLanguage: string;
  exampleSentence: string;
  contextSentence: string;
};

async function attachOwnedBookTitles(
  userId: string,
  items: VocabularyListRecord[],
) {
  const bookIds = Array.from(
    new Set(
      items
        .map((item) => item.bookId)
        .filter((bookId): bookId is string => typeof bookId === "string"),
    ),
  );

  if (!bookIds.length) {
    return items.map((item) => ({
      ...item,
      book: null,
    }));
  }

  const books = await prisma.book.findMany({
    where: {
      id: {
        in: bookIds,
      },
      userId,
    },
    select: {
      id: true,
      title: true,
    },
  });

  const booksById = new Map(
    books.map((book) => [book.id, { title: book.title }]),
  );

  return items.map((item) => ({
    ...item,
    book: item.bookId ? (booksById.get(item.bookId) ?? null) : null,
  }));
}

function queueVocabularyMnemonicGeneration({
  vocabularyId,
  userId,
  word,
  definition,
  sourceLanguage,
  exampleSentence,
  contextSentence,
}: QueueVocabularyMnemonicInput) {
  after(async () => {
    try {
      const mnemonic = await generateMnemonic({
        word,
        definition,
        sourceLanguage,
        exampleSentence,
        contextSentence,
      });

      if (!mnemonic) {
        return;
      }

      await prisma.vocabulary.updateMany({
        where: {
          id: vocabularyId,
          userId,
          mnemonic: null,
        },
        data: {
          mnemonic,
        },
      });
    } catch (error) {
      console.error(
        `Failed to generate mnemonic for vocabulary ${vocabularyId}`,
        error,
      );
    }
  });
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const parsedQuery = vocabularyQuerySchema.safeParse({
    bookId: searchParams.get("bookId") ?? undefined,
    word: searchParams.get("word") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error:
          parsedQuery.error.issues[0]?.message ??
          "A valid vocabulary query is required.",
      },
      { status: 400 },
    );
  }

  const { bookId, word, page, limit } = parsedQuery.data;
  const where = {
    userId: session.user.id,
    ...(bookId ? { bookId } : {}),
    ...(word ? { word } : {}),
  };

  try {
    const [rawItems, total] = await prisma.$transaction([
      prisma.vocabulary.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.vocabulary.count({ where }),
    ]);
    const items = await attachOwnedBookTitles(session.user.id, rawItems);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load vocabulary items." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsedPayload = saveVocabularySchema.safeParse(body);

  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        error:
          parsedPayload.error.issues[0]?.message ??
          "A valid vocabulary payload is required.",
      },
      { status: 400 },
    );
  }

  if (parsedPayload.data.bookId) {
    const ownedBook = await prisma.book.findFirst({
      where: {
        id: parsedPayload.data.bookId,
        userId: session.user.id,
      },
      select: {
        id: true,
      },
    });

    if (!ownedBook) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }
  }

  try {
    const vocabulary = await prisma.$transaction(
      async (tx) => {
        const existingVocabulary = await tx.vocabulary.findFirst({
          where: {
            userId: session.user.id,
            word: parsedPayload.data.word,
            bookId: parsedPayload.data.bookId ?? null,
          },
          select: {
            id: true,
          },
        });

        if (existingVocabulary) {
          throw new Error(DUPLICATE_VOCABULARY_CONFLICT);
        }

        return tx.vocabulary.create({
          data: {
            word: parsedPayload.data.word,
            definition: parsedPayload.data.definition,
            exampleSentence: parsedPayload.data.exampleSentence,
            contextSentence: parsedPayload.data.contextSentence,
            pronunciation: parsedPayload.data.pronunciation,
            partOfSpeech: parsedPayload.data.partOfSpeech,
            difficultyHint: parsedPayload.data.difficultyHint,
            explanation: parsedPayload.data.explanation,
            mnemonic: parsedPayload.data.mnemonic,
            alternativeMeaning: parsedPayload.data.alternativeMeaning,
            exampleTranslation: parsedPayload.data.exampleTranslation,
            sourceLanguage: parsedPayload.data.sourceLanguage,
            targetLanguage: parsedPayload.data.targetLanguage,
            bookId: parsedPayload.data.bookId,
            userId: session.user.id,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
    const [vocabularyWithBook] = await attachOwnedBookTitles(session.user.id, [
      vocabulary,
    ]);

    if (!parsedPayload.data.mnemonic) {
      queueVocabularyMnemonicGeneration({
        vocabularyId: vocabulary.id,
        userId: session.user.id,
        word: parsedPayload.data.word,
        definition: parsedPayload.data.definition,
        sourceLanguage: parsedPayload.data.sourceLanguage,
        exampleSentence: parsedPayload.data.exampleSentence,
        contextSentence: parsedPayload.data.contextSentence,
      });
    }

    return NextResponse.json(
      { vocabulary: vocabularyWithBook },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === DUPLICATE_VOCABULARY_CONFLICT
    ) {
      return NextResponse.json(
        { error: DUPLICATE_VOCABULARY_MESSAGE },
        { status: 409 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: DUPLICATE_VOCABULARY_MESSAGE },
        { status: 409 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      const existingVocabulary = await prisma.vocabulary.findFirst({
        where: {
          userId: session.user.id,
          word: parsedPayload.data.word,
          bookId: parsedPayload.data.bookId ?? null,
        },
        select: {
          id: true,
        },
      });

      if (existingVocabulary) {
        return NextResponse.json(
          { error: DUPLICATE_VOCABULARY_MESSAGE },
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      { error: "Unable to save this vocabulary item." },
      { status: 500 },
    );
  }
}
