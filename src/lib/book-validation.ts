import { z } from "zod";

export function isValidReaderProgressCfi(value: string) {
  const normalizedValue = value.trim();

  return (
    normalizedValue.length > 10 &&
    normalizedValue.startsWith("epubcfi(") &&
    normalizedValue.endsWith(")")
  );
}

const optionalTrimmedString = z
  .string()
  .trim()
  .max(255)
  .optional()
  .or(z.literal(""))
  .transform((value) => {
    const normalized = value?.trim();

    return normalized ? normalized : null;
  });

export const bookMetadataSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(255),
  author: optionalTrimmedString,
  language: z
    .string()
    .trim()
    .min(2, "Language must be at least 2 characters.")
    .max(32)
    .transform((value) => value.toLowerCase()),
});

export const readingProgressSchema = z.object({
  cfi: z
    .string()
    .trim()
    .min(1, "A valid EPUB CFI location is required.")
    .max(2048)
    .refine(isValidReaderProgressCfi, {
      message: "A valid EPUB CFI location is required.",
    }),
  percentage: z
    .number()
    .min(0, "Percentage must be at least 0.")
    .max(1, "Percentage must be at most 1.")
    .optional()
    .nullable(),
});

export type BookMetadataInput = z.infer<typeof bookMetadataSchema>;
export type ReadingProgressInput = z.infer<typeof readingProgressSchema>;
