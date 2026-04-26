import { readFile } from "node:fs/promises";

import type { Prisma } from "@prisma/client";

import {
  getStoredBookR2Key,
  R2_FILE_PATH_PREFIX,
  resolveStoredUploadFilePath,
} from "@/lib/book-storage";
import { getCoverR2Key } from "@/lib/cover-extraction";
import type { BookMetadataInput } from "@/lib/book-validation";
import { prisma } from "@/lib/prisma";
import { downloadFromR2, getR2SignedUrl } from "@/lib/r2";

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
      percentage: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.BookSelect;

export type ReaderBookRecord = Prisma.BookGetPayload<{
  select: typeof readerBookSelect;
}>;

async function verifyBookOwnership(userId: string, bookId: string) {
  return prisma.book.findFirst({
    where: {
      id: bookId,
      userId,
    },
    select: {
      id: true,
    },
  });
}

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
  percentage?: number | null,
) {
  const book = await verifyBookOwnership(userId, bookId);

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
      ...(percentage != null ? { percentage } : {}),
    },
    update: {
      cfi,
      ...(percentage != null ? { percentage } : {}),
    },
  });
}

export async function resolveBookCoverUrl(coverUrl: string | null) {
  if (!coverUrl) {
    return null;
  }

  try {
    return await getR2SignedUrl(getCoverR2Key(coverUrl), 60 * 60 * 24);
  } catch (error) {
    console.error("Cover URL signing failed:", error);
    return null;
  }
}

export async function readStoredBookFile(filePath: string) {
  if (filePath.startsWith(R2_FILE_PATH_PREFIX)) {
    return downloadFromR2(getStoredBookR2Key(filePath));
  }

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
