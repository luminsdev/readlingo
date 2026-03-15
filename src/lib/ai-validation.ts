import { z } from "zod";

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
  partOfSpeech: z.string().trim().min(1).max(120).optional(),
  explanation: z.string().trim().min(1, "Explanation is required.").max(4000),
  examples: z
    .array(z.string().trim().min(1).max(1000))
    .min(1, "At least one example sentence is required.")
    .max(2, "At most two example sentences are supported."),
});

export type ExplainSelectionInput = z.infer<typeof explainSelectionSchema>;
export type AiExplanationInput = z.infer<typeof aiExplanationSchema>;
