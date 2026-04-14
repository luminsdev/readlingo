import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  assertEpubFile,
  createBookTitle,
  persistBookFile,
  removeBookFile,
  validateEpubArchive,
} from "@/lib/book-storage";
import {
  extractEpubInfo,
  persistBookCover,
  removeBookCover,
} from "@/lib/cover-extraction";
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

  const extractedInfo = await extractEpubInfo(validatedFileBytes);

  const provisionalBook = await prisma.book.create({
    data: {
      title: extractedInfo.metadata.title || createBookTitle(file.name),
      author: extractedInfo.metadata.author,
      coverUrl: null,
      filePath: "pending",
      language: extractedInfo.metadata.language || "und",
      userId: session.user.id,
    },
  });

  let filePath: string | null = null;
  let coverUrl: string | null = null;

  try {
    filePath = await persistBookFile({
      userId: session.user.id,
      bookId: provisionalBook.id,
      file,
      fileBytes: validatedFileBytes,
    });

    try {
      if (extractedInfo.cover) {
        coverUrl = await persistBookCover(
          provisionalBook.id,
          extractedInfo.cover,
        );
      }
    } catch (error) {
      console.error("Cover persistence failed during upload:", error);
    }

    const savedBook = await prisma.book.update({
      where: { id: provisionalBook.id },
      data: { filePath, coverUrl },
    });

    return NextResponse.json({ book: savedBook }, { status: 201 });
  } catch (error) {
    if (filePath) {
      await removeBookFile(filePath).catch(() => undefined);
    }

    if (coverUrl) {
      await removeBookCover(coverUrl);
    }

    await prisma.book.delete({ where: { id: provisionalBook.id } });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 },
    );
  }
}
