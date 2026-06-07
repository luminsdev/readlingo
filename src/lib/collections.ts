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
    },
  });
}

export async function getUserCollections(userId: string) {
  return prisma.collection.findMany({
    where: {
      userId,
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: {
          books: true,
        },
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

export async function renameCollection(
  userId: string,
  collectionId: string,
  displayName: string,
) {
  const collection = await getOwnedCollection(userId, collectionId);

  if (!collection) {
    return null;
  }

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

  if (existingCollection && existingCollection.id !== collection.id) {
    return null;
  }

  try {
    return await prisma.collection.update({
      where: {
        id: collection.id,
      },
      data: {
        displayName,
        normalizedName,
      },
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

  return prisma.bookCollection.delete({
    where: {
      bookId_collectionId: {
        bookId: membership.bookId,
        collectionId: membership.collectionId,
      },
    },
  });
}
