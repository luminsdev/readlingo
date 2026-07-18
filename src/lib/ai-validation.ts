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

export const deepActionSchema = z.enum([
  "grammar",
  "compare",
  "easierExamples",
  "conjugation",
  "collocation",
]);

export const deepActionRequestSchema = explainSelectionSchema.extend({
  action: deepActionSchema,
});

export const GRAMMAR_SUMMARY_MAX_LENGTH = 320;
export const GRAMMAR_POINT_MAX_LENGTH = 140;
export const GRAMMAR_REASON_MAX_LENGTH = 200;

const deepActionReasonSchema = z.string().trim().min(1);
const deepActionStatusSchema = {
  notApplicable: z.boolean().optional(),
  reason: deepActionReasonSchema.optional(),
};

const deepActionGenerationStatusSchema = {
  notApplicable: z.boolean().optional(),
  reason: z.string().optional(),
};

export const grammarDeepActionGenerationSchema = z.object({
  summary: z.string().optional(),
  points: z.array(z.string()).optional(),
  ...deepActionGenerationStatusSchema,
});

export const compareDeepActionGenerationSchema = z.object({
  alternative: z.string().optional(),
  contrast: z.string().optional(),
  tip: z.string().optional(),
  ...deepActionGenerationStatusSchema,
});

export const easierExamplesDeepActionGenerationSchema = z.object({
  examples: z
    .array(
      z.object({
        sentence: z.string().optional(),
        translation: z.string().optional(),
      }),
    )
    .optional(),
  note: z.string().optional(),
  ...deepActionGenerationStatusSchema,
});

export const conjugationDeepActionGenerationSchema = z.object({
  lemma: z.string().optional(),
  forms: z
    .array(
      z.object({
        label: z.string().optional(),
        value: z.string().optional(),
      }),
    )
    .optional(),
  note: z.string().optional(),
  ...deepActionGenerationStatusSchema,
});

export const collocationDeepActionGenerationSchema = z.object({
  items: z
    .array(
      z.object({
        phrase: z.string().optional(),
        translation: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .optional(),
  ...deepActionGenerationStatusSchema,
});

function requireReasonWhenNotApplicable(
  value: { notApplicable?: boolean; reason?: string },
  context: z.RefinementCtx,
  message: string,
) {
  if (value.notApplicable && !value.reason) {
    context.addIssue({
      code: "custom",
      message,
      path: ["reason"],
    });
  }
}

export const grammarDeepActionResponseSchema = z
  .object({
    // Model-friendly: accept summary-only or points-only applicable payloads.
    summary: z
      .string()
      .trim()
      .min(1)
      .max(GRAMMAR_SUMMARY_MAX_LENGTH)
      .optional(),
    points: z
      .array(z.string().trim().min(1).max(GRAMMAR_POINT_MAX_LENGTH))
      .max(5)
      .optional(),
    ...deepActionStatusSchema,
    reason: deepActionReasonSchema.max(GRAMMAR_REASON_MAX_LENGTH).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.notApplicable) {
      requireReasonWhenNotApplicable(
        value,
        context,
        "Reason is required when grammar is not applicable.",
      );
      return;
    }

    const points = value.points ?? [];
    if (!value.summary && points.length === 0) {
      context.addIssue({
        code: "custom",
        message:
          "Provide a non-empty summary and/or 1-5 points when grammar is applicable.",
        path: ["summary"],
      });
    }
  });

const compareContentSchema = {
  alternative: z.string().trim().min(1),
  contrast: z.string().trim().min(1),
  tip: z.string().trim().min(1).optional(),
};

export const compareDeepActionResponseSchema = z
  .object({
    alternative: compareContentSchema.alternative.optional(),
    contrast: compareContentSchema.contrast.optional(),
    tip: compareContentSchema.tip,
    ...deepActionStatusSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.notApplicable) {
      requireReasonWhenNotApplicable(
        value,
        context,
        "Reason is required when comparison is not applicable.",
      );
      return;
    }

    for (const field of ["alternative", "contrast"] as const) {
      if (!value[field]) {
        context.addIssue({
          code: "custom",
          message: `${field} is required when comparison is applicable.`,
          path: [field],
        });
      }
    }
  });

const easierExampleSchema = z
  .object({
    sentence: z.string().trim().min(1),
    translation: z.string().trim().min(1),
  })
  .strict();

const easierExamplesSchema = z.array(easierExampleSchema).min(1).max(2);
const easierExamplesNoteSchema = z.string().trim().min(1).optional();

export const easierExamplesDeepActionResponseSchema = z
  .object({
    examples: easierExamplesSchema.optional(),
    note: easierExamplesNoteSchema,
    ...deepActionStatusSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.notApplicable) {
      requireReasonWhenNotApplicable(
        value,
        context,
        "Reason is required when examples are not applicable.",
      );
      return;
    }

    if (!value.examples) {
      context.addIssue({
        code: "custom",
        message: "Examples are required when this action is applicable.",
        path: ["examples"],
      });
    }
  });

const conjugationFormSchema = z
  .object({
    label: z.string().trim().min(1),
    value: z.string().trim().min(1),
  })
  .strict();

export const conjugationDeepActionResponseSchema = z
  .object({
    lemma: z.string().trim().min(1).optional(),
    forms: z.array(conjugationFormSchema).min(1).max(8).optional(),
    note: z.string().trim().min(1).optional(),
    ...deepActionStatusSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.notApplicable) {
      requireReasonWhenNotApplicable(
        value,
        context,
        "Reason is required when conjugation is not applicable.",
      );
      return;
    }

    if (!value.forms) {
      context.addIssue({
        code: "custom",
        message: "Forms are required when conjugation is applicable.",
        path: ["forms"],
      });
    }
  });

const collocationItemSchema = z
  .object({
    phrase: z.string().trim().min(1),
    translation: z.string().trim().min(1),
    note: z.string().trim().min(1).optional(),
  })
  .strict();

export const collocationDeepActionResponseSchema = z
  .object({
    items: z.array(collocationItemSchema).min(1).max(5).optional(),
    ...deepActionStatusSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.notApplicable) {
      requireReasonWhenNotApplicable(
        value,
        context,
        "Reason is required when collocations are not applicable.",
      );
      return;
    }

    if (!value.items) {
      context.addIssue({
        code: "custom",
        message: "Items are required when collocations are applicable.",
        path: ["items"],
      });
    }
  });

export const aiExplanationSchema = z.object({
  translation: z.string().trim().min(1, "Translation is required.").max(2000),
  pronunciation: optionalTrimmedStringSchema(200),
  partOfSpeech: optionalTrimmedStringSchema(120),
  difficultyHint: difficultyHintSchema,
  explanation: z.string().trim().min(1, "Explanation is required.").max(800),
  grammaticalNote: optionalTrimmedStringSchema(500),
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
export type DeepAction = z.infer<typeof deepActionSchema>;
export type DeepActionRequest = z.infer<typeof deepActionRequestSchema>;
export type GrammarDeepActionResponse = z.infer<
  typeof grammarDeepActionResponseSchema
>;
export type CompareDeepActionResponse = z.infer<
  typeof compareDeepActionResponseSchema
>;
export type EasierExamplesDeepActionResponse = z.infer<
  typeof easierExamplesDeepActionResponseSchema
>;
export type ConjugationDeepActionResponse = z.infer<
  typeof conjugationDeepActionResponseSchema
>;
export type CollocationDeepActionResponse = z.infer<
  typeof collocationDeepActionResponseSchema
>;
