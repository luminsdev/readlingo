import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function getOwnedCollection(userId: string, collectionId: string) {
  return prisma.collection.findFirst({
    where: {
      id: collectionId,
      userId,
    },
    select: {
      id: true,
      coverBookId: true,
    },
  });
}

export async function getUserCollections(userId: string) {
  return prisma.collection.findMany({
    where: {
      userId,
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      displayName: true,
      normalizedName: true,
      order: true,
      createdAt: true,
      coverBookId: true,
      coverBook: {
        select: { id: true, coverUrl: true, coverBlurDataUrl: true },
      },
      _count: { select: { books: true } },
      books: {
        where: { book: { coverUrl: { not: null } } },
        select: {
          book: {
            select: { id: true, coverUrl: true, coverBlurDataUrl: true },
          },
        },
        take: 3,
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function createCollection(userId: string, displayName: string) {
  const normalizedName = displayName.toLowerCase();
  const existingCollection = await prisma.collection.findFirst({
    where: {
      userId,
      normalizedName,
    },
    select: {
      id: true,
    },
  });

  if (existingCollection) {
    return null;
  }

  try {
    return await prisma.collection.create({
      data: {
        displayName,
        normalizedName,
        userId,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return null;
    }

    throw error;
  }
}

export async function updateCollection(
  userId: string,
  collectionId: string,
  data: { name?: string; coverBookId?: string | null },
) {
  const collection = await getOwnedCollection(userId, collectionId);

  if (!collection) {
    return null;
  }

  const updateData: Prisma.CollectionUncheckedUpdateInput = {};

  if (data.name !== undefined) {
    const normalizedName = data.name.toLowerCase();
    const existingCollection = await prisma.collection.findFirst({
      where: { userId, normalizedName },
      select: { id: true },
    });

    if (existingCollection && existingCollection.id !== collection.id) {
      return null;
    }

    updateData.displayName = data.name;
    updateData.normalizedName = normalizedName;
  }

  if (data.coverBookId === null) {
    updateData.coverBookId = null;
  } else if (data.coverBookId !== undefined) {
    const bookId = data.coverBookId;

    updateData.coverBookId = bookId;
  }

  try {
    if (data.coverBookId !== undefined && data.coverBookId !== null) {
      const bookId = data.coverBookId;
      const updatedCollection = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.collection.updateMany({
          where: {
            id: collection.id,
            books: { some: { bookId } },
          },
          data: updateData,
        });

        if (updateResult.count === 0) {
          return null;
        }

        return tx.collection.findUnique({
          where: { id: collection.id },
        });
      });

      return updatedCollection ?? ("invalid-cover" as const);
    }

    return await prisma.collection.update({
      where: {
        id: collection.id,
      },
      data: updateData,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return null;
    }

    throw error;
  }
}

export async function deleteCollection(userId: string, collectionId: string) {
  const collection = await getOwnedCollection(userId, collectionId);

  if (!collection) {
    return null;
  }

  return prisma.collection.delete({
    where: {
      id: collection.id,
    },
  });
}

export async function addBookToCollection(
  userId: string,
  collectionId: string,
  bookId: string,
) {
  const collection = await getOwnedCollection(userId, collectionId);
  const book = await prisma.book.findFirst({
    where: {
      id: bookId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!collection || !book) {
    return null;
  }

  const existingMembership = await prisma.bookCollection.findUnique({
    where: {
      bookId_collectionId: {
        bookId: book.id,
        collectionId: collection.id,
      },
    },
    select: {
      bookId: true,
    },
  });

  if (existingMembership) {
    return "exists";
  }

  try {
    return await prisma.bookCollection.create({
      data: {
        bookId: book.id,
        collectionId: collection.id,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return "exists";
    }

    throw error;
  }
}

export async function removeBookFromCollection(
  userId: string,
  collectionId: string,
  bookId: string,
) {
  const collection = await getOwnedCollection(userId, collectionId);

  if (!collection) {
    return null;
  }

  const membership = await prisma.bookCollection.findUnique({
    where: {
      bookId_collectionId: {
        bookId,
        collectionId: collection.id,
      },
    },
    select: {
      bookId: true,
      collectionId: true,
    },
  });

  if (!membership) {
    return null;
  }

  const deleteWhere = {
    bookId_collectionId: {
      bookId: membership.bookId,
      collectionId: membership.collectionId,
    },
  };

  const [deleted] = await prisma.$transaction([
    prisma.bookCollection.delete({ where: deleteWhere }),
    prisma.collection.updateMany({
      where: { id: collection.id, coverBookId: bookId },
      data: { coverBookId: null },
    }),
  ]);

  return deleted;
}

export async function getCollectionDetail(
  userId: string,
  collectionId: string,
) {
  return prisma.collection.findFirst({
    where: { id: collectionId, userId },
    select: {
      id: true,
      displayName: true,
      createdAt: true,
      coverBookId: true,
      coverBook: {
        select: { id: true, coverUrl: true, coverBlurDataUrl: true },
      },
      _count: { select: { books: true } },
      books: {
        where: { book: { coverUrl: { not: null } } },
        select: {
          book: {
            select: { id: true, coverUrl: true, coverBlurDataUrl: true },
          },
        },
        take: 3,
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getCollectionBooks(
  userId: string,
  collectionId: string,
  options: { page?: number; query?: string; pageSize?: number },
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = options.pageSize ?? 20;
  const trimmedQuery = options.query?.trim() || "";

  const bookWhere: Prisma.BookWhereInput = {
    userId,
    collections: { some: { collectionId } },
    ...(trimmedQuery && {
      OR: [
        { title: { contains: trimmedQuery, mode: "insensitive" } },
        { author: { contains: trimmedQuery, mode: "insensitive" } },
      ],
    }),
  };

  const [books, totalCount] = await Promise.all([
    prisma.book.findMany({
      where: bookWhere,
      select: {
        id: true,
        title: true,
        author: true,
        coverUrl: true,
        coverBlurDataUrl: true,
        createdAt: true,
        readingProgress: { select: { percentage: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.book.count({ where: bookWhere }),
  ]);

  return { books, totalCount, page, pageSize };
}
