import { z } from "zod";

export const collectionNameSchema = z.string().trim().min(1).max(100);

export const createCollectionSchema = z.object({
  name: collectionNameSchema,
});

export const renameCollectionSchema = z.object({
  name: collectionNameSchema,
});

export const updateCollectionSchema = z
  .object({
    name: collectionNameSchema.optional(),
    coverBookId: z.string().min(1).nullable().optional(),
  })
  .refine((data) => data.name !== undefined || data.coverBookId !== undefined, {
    message: "At least one field (name or coverBookId) must be provided.",
  });

export const addBookToCollectionSchema = z.object({
  bookId: z.string().min(1),
});
