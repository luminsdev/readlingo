import { z } from "zod";

const optionalBookIdSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalizedValue = value.trim();

  return normalizedValue ? normalizedValue : undefined;
}, z.string().cuid().optional());

const optionalWordSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalizedValue = value.trim();

  return normalizedValue ? normalizedValue : undefined;
}, z.string().max(300).optional());

export const vocabularyIdSchema = z.string().cuid("Vocabulary not found.");

const languageSchema = z
  .string()
  .trim()
  .min(2, "Language is required.")
  .max(32)
  .transform((value) => value.toLowerCase());

export const saveVocabularySchema = z.object({
  word: z.string().trim().min(1, "Word is required.").max(300),
  definition: z.string().trim().min(1, "Definition is required.").max(4000),
  exampleSentence: z
    .string()
    .trim()
    .min(1, "Example sentence is required.")
    .max(1000),
  contextSentence: z
    .string()
    .trim()
    .min(1, "Context sentence is required.")
    .max(4000),
  sourceLanguage: languageSchema,
  targetLanguage: languageSchema,
  bookId: optionalBookIdSchema,
});

export const vocabularyQuerySchema = z.object({
  bookId: optionalBookIdSchema,
  word: optionalWordSchema,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SaveVocabularyInput = z.infer<typeof saveVocabularySchema>;
export type VocabularyQueryInput = z.infer<typeof vocabularyQuerySchema>;
