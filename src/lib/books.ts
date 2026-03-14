import { readFile } from "node:fs/promises";

import type { Prisma } from "@prisma/client";

import { resolveStoredUploadFilePath } from "@/lib/book-storage";
import type { BookMetadataInput } from "@/lib/book-validation";
import { prisma } from "@/lib/prisma";

const readerBookSelect = {
  id: true,
  title: true,
  author: true,
  coverUrl: true,
  filePath: true,
  language: true,
  createdAt: true,
  userId: true,
  readingProgress: {
    select: {
      cfi: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.BookSelect;

export type ReaderBookRecord = Prisma.BookGetPayload<{
  select: typeof readerBookSelect;
}>;

export async function getOwnedReaderBook(userId: string, bookId: string) {
  return prisma.book.findFirst({
    where: {
      id: bookId,
      userId,
    },
    select: readerBookSelect,
  });
}

export async function updateOwnedBookMetadata(
  userId: string,
  bookId: string,
  metadata: BookMetadataInput,
) {
  const book = await prisma.book.findFirst({
    where: {
      id: bookId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!book) {
    return null;
  }

  return prisma.book.update({
    where: {
      id: book.id,
    },
    data: metadata,
  });
}

export async function upsertOwnedReadingProgress(
  userId: string,
  bookId: string,
  cfi: string,
) {
  const book = await prisma.book.findFirst({
    where: {
      id: bookId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!book) {
    return null;
  }

  return prisma.readingProgress.upsert({
    where: {
      bookId: book.id,
    },
    create: {
      bookId: book.id,
      cfi,
    },
    update: {
      cfi,
    },
  });
}

export async function readStoredBookFile(filePath: string) {
  return readFile(resolveStoredUploadFilePath(filePath));
}

export function createDownloadFileName(title: string) {
  const sanitizedTitle = title
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

  return `${sanitizedTitle || "book"}.epub`;
}
