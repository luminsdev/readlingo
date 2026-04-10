import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { bookMetadataSchema } from "@/lib/book-validation";
import { getOwnedReaderBook, updateOwnedBookMetadata } from "@/lib/books";
import { removeBookFileBestEffort } from "@/lib/book-storage";
import { removeBookCover } from "@/lib/cover-extraction";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsedPayload = bookMetadataSchema.safeParse(body);

  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        error:
          parsedPayload.error.issues[0]?.message ??
          "A valid metadata payload is required.",
      },
      { status: 400 },
    );
  }

  const { bookId } = await params;
  const book = await updateOwnedBookMetadata(
    session.user.id,
    bookId,
    parsedPayload.data,
  );

  if (!book) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  return NextResponse.json({ book });
}

export async function DELETE(
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

  await prisma.book.delete({ where: { id: book.id } });
  await removeBookFileBestEffort(book.filePath, {
    onError(error) {
      console.error(
        `Failed to delete stored EPUB file for book ${book.id}`,
        error,
      );
    },
  });

  if (book.coverUrl) {
    await removeBookCover(book.coverUrl);
  }

  return new NextResponse(null, { status: 204 });
}
