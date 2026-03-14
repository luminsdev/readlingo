import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { readingProgressSchema } from "@/lib/book-validation";
import { getOwnedReaderBook, upsertOwnedReadingProgress } from "@/lib/books";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookId } = await params;
  const book = await getOwnedReaderBook(session.user.id, bookId);

  if (!book) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  return NextResponse.json({ progress: book.readingProgress });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsedPayload = readingProgressSchema.safeParse(body);

  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        error:
          parsedPayload.error.issues[0]?.message ??
          "A valid EPUB CFI location is required.",
      },
      { status: 400 },
    );
  }

  const { bookId } = await params;
  const progress = await upsertOwnedReadingProgress(
    session.user.id,
    bookId,
    parsedPayload.data.cfi,
  );

  if (!progress) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  return NextResponse.json({ progress });
}
