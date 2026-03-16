import { z } from "zod";

const difficultyHintSchema = z
  .enum(["beginner", "intermediate", "advanced"])
  .optional();

const selectionTypeSchema = z.enum(["word", "phrase"]);

function optionalTrimmedStringSchema(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalizedValue = value.trim();

    return normalizedValue ? normalizedValue : undefined;
  }, z.string().max(maxLength).optional());
}

const exampleSchema = z.object({
  sentence: z.string().trim().min(1).max(1000),
  translation: z.string().trim().min(1).max(1000),
});

export const explainSelectionSchema = z.object({
  selectedText: z
    .string()
    .trim()
    .min(1, "Selected text is required.")
    .max(300, "Selected text must be 300 characters or less."),
  surroundingParagraph: z
    .string()
    .trim()
    .min(1, "Surrounding context is required.")
    .max(6000, "Surrounding context must be 6000 characters or less."),
  sourceLanguage: z
    .string()
    .trim()
    .min(2, "Source language is required.")
    .max(32)
    .transform((value) => value.toLowerCase()),
  modelTier: z.enum(["primary", "fallback"]).optional().default("primary"),
});

export const aiExplanationSchema = z.object({
  translation: z.string().trim().min(1, "Translation is required.").max(2000),
  pronunciation: optionalTrimmedStringSchema(200),
  partOfSpeech: optionalTrimmedStringSchema(120),
  difficultyHint: difficultyHintSchema,
  explanation: z.string().trim().min(1, "Explanation is required.").max(4000),
  grammaticalNote: optionalTrimmedStringSchema(2000),
  alternativeMeaning: optionalTrimmedStringSchema(500),
  examples: z
    .array(exampleSchema)
    .max(2, "At most two example sentences are supported.")
    .default([]),
});

const wordExplanationPayloadSchema = aiExplanationSchema
  .extend({
    selectionType: z.literal(selectionTypeSchema.enum.word),
  })
  .strict();

const phraseExplanationPayloadSchema = aiExplanationSchema
  .omit({
    pronunciation: true,
    partOfSpeech: true,
    difficultyHint: true,
  })
  .extend({
    selectionType: z.literal(selectionTypeSchema.enum.phrase),
  })
  .strict();

export const explanationPayloadSchema = z.discriminatedUnion("selectionType", [
  wordExplanationPayloadSchema,
  phraseExplanationPayloadSchema,
]);

export type ExplainSelectionInput = z.infer<typeof explainSelectionSchema>;
export type AiExplanationInput = z.infer<typeof aiExplanationSchema>;
export type ExplanationPayloadInput = z.infer<typeof explanationPayloadSchema>;
