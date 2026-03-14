import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  assertEpubFile,
  createBookTitle,
  persistBookFile,
  removeBookFile,
  validateEpubArchive,
} from "@/lib/book-storage";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const books = await prisma.book.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ books });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "An EPUB file is required." },
      { status: 400 },
    );
  }

  try {
    assertEpubFile(file);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid EPUB upload.",
      },
      { status: 400 },
    );
  }

  let validatedFileBytes: Uint8Array;

  try {
    validatedFileBytes = await validateEpubArchive(file);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid EPUB upload.",
      },
      { status: 400 },
    );
  }

  const provisionalBook = await prisma.book.create({
    data: {
      title: createBookTitle(file.name),
      author: null,
      coverUrl: null,
      filePath: "pending",
      language: "und",
      userId: session.user.id,
    },
  });

  let filePath: string | null = null;

  try {
    filePath = await persistBookFile({
      userId: session.user.id,
      bookId: provisionalBook.id,
      file,
      fileBytes: validatedFileBytes,
    });

    const savedBook = await prisma.book.update({
      where: { id: provisionalBook.id },
      data: { filePath },
    });

    return NextResponse.json({ book: savedBook }, { status: 201 });
  } catch (error) {
    if (filePath) {
      await removeBookFile(filePath).catch(() => undefined);
    }

    await prisma.book.delete({ where: { id: provisionalBook.id } });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 },
    );
  }
}
