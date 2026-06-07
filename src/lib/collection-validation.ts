import { z } from "zod";

export const collectionNameSchema = z.string().trim().min(1).max(100);

export const createCollectionSchema = z.object({
  name: collectionNameSchema,
});

export const renameCollectionSchema = z.object({
  name: collectionNameSchema,
});

export const addBookToCollectionSchema = z.object({
  bookId: z.string().min(1),
});
