import { z } from "zod";

const difficultyHintSchema = z
  .enum(["beginner", "intermediate", "advanced"])
  .optional();

const selectionTypeSchema = z.enum(["word", "phrase"]);

export const PRONUNCIATION_MAX_LENGTH = 64;
export const FORM_TIP_MAX_LENGTH = 180;

export function normalizeFormTip(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim().replace(/\s+/g, " ");
  const sentenceBoundaryCount = normalizedValue.match(/[.!?…]/g)?.length ?? 0;

  if (
    !normalizedValue ||
    normalizedValue.length > FORM_TIP_MAX_LENGTH ||
    sentenceBoundaryCount > 1
  ) {
    return undefined;
  }

  return normalizedValue;
}

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
  "structure",
  "compare",
  "easierExamples",
  "conjugation",
  "collocation",
]);

export const deepActionRequestSchema = explainSelectionSchema.extend({
  action: deepActionSchema,
});

export const STRUCTURE_PATTERN_MAX_LENGTH = 120;
export const STRUCTURE_ROLE_MAX_LENGTH = 120;
export const STRUCTURE_WHY_HERE_MAX_LENGTH = 160;
export const STRUCTURE_PITFALL_MAX_LENGTH = 140;
export const STRUCTURE_REASON_MAX_LENGTH = 160;
export const CONJUGATION_FORMS_MAX_COUNT = 6;
export const CONJUGATION_FORM_FIELD_MAX_LENGTH = 32;
export const CONJUGATION_LEMMA_MAX_LENGTH = 64;
export const CONJUGATION_NOTE_MAX_LENGTH = 100;
export const CONJUGATION_REASON_MAX_LENGTH = 100;

const deepActionReasonSchema = z.string().trim().min(1);
const deepActionStatusSchema = {
  notApplicable: z.boolean().optional(),
  reason: deepActionReasonSchema.optional(),
};

const deepActionGenerationStatusSchema = {
  notApplicable: z.boolean().optional(),
  reason: z.string().optional(),
};

export const structureDeepActionGenerationSchema = z.object({
  pattern: z.string().optional(),
  role: z.string().optional(),
  whyHere: z.string().optional(),
  pitfall: z.string().optional(),
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

const conjugationGenerationFormSchema = z
  .object({
    label: z.string().trim().min(1).max(CONJUGATION_FORM_FIELD_MAX_LENGTH),
    value: z.string().trim().min(1).max(CONJUGATION_FORM_FIELD_MAX_LENGTH),
  })
  .strict();

const conjugationGenerationResultSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("forms"),
      lemma: z.string().trim().min(1).max(CONJUGATION_LEMMA_MAX_LENGTH),
      forms: z
        .array(conjugationGenerationFormSchema)
        .min(1)
        .max(CONJUGATION_FORMS_MAX_COUNT),
      note: z
        .string()
        .trim()
        .min(1)
        .max(CONJUGATION_NOTE_MAX_LENGTH)
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("notApplicable"),
      notApplicable: z.literal(true),
      reason: z.string().trim().min(1).max(CONJUGATION_REASON_MAX_LENGTH),
    })
    .strict(),
]);
export const conjugationDeepActionGenerationSchema = z
  .object({
    result: conjugationGenerationResultSchema,
  })
  .strict();

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

const applicableStructureDeepActionResponseSchema = z
  .object({
    pattern: z.string().trim().min(1).max(STRUCTURE_PATTERN_MAX_LENGTH),
    role: z.string().trim().min(1).max(STRUCTURE_ROLE_MAX_LENGTH),
    whyHere: z.string().trim().min(1).max(STRUCTURE_WHY_HERE_MAX_LENGTH),
    pitfall: z
      .string()
      .trim()
      .min(1)
      .max(STRUCTURE_PITFALL_MAX_LENGTH)
      .optional(),
    notApplicable: z.literal(false).optional(),
  })
  .strict();

const notApplicableStructureDeepActionResponseSchema = z
  .object({
    notApplicable: z.literal(true),
    reason: z.string().trim().min(1).max(STRUCTURE_REASON_MAX_LENGTH),
  })
  .strict();

export const structureDeepActionResponseSchema = z.union([
  applicableStructureDeepActionResponseSchema,
  notApplicableStructureDeepActionResponseSchema,
]);

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
    label: z.string().trim().min(1).max(CONJUGATION_FORM_FIELD_MAX_LENGTH),
    value: z.string().trim().min(1).max(CONJUGATION_FORM_FIELD_MAX_LENGTH),
  })
  .strict();

export const conjugationDeepActionResponseSchema = z
  .object({
    lemma: z
      .string()
      .trim()
      .min(1)
      .max(CONJUGATION_LEMMA_MAX_LENGTH)
      .optional(),
    forms: z
      .array(conjugationFormSchema)
      .min(1)
      .max(CONJUGATION_FORMS_MAX_COUNT)
      .optional(),
    note: z.string().trim().min(1).max(CONJUGATION_NOTE_MAX_LENGTH).optional(),
    ...deepActionStatusSchema,
    reason: deepActionReasonSchema
      .max(CONJUGATION_REASON_MAX_LENGTH)
      .optional(),
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
  pronunciation: optionalTrimmedStringSchema(PRONUNCIATION_MAX_LENGTH),
  partOfSpeech: optionalTrimmedStringSchema(120),
  difficultyHint: difficultyHintSchema,
  explanation: z.string().trim().min(1, "Explanation is required.").max(800),
  grammaticalNote: z.preprocess(
    normalizeFormTip,
    z.string().max(FORM_TIP_MAX_LENGTH).optional(),
  ),
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
export type StructureDeepActionResponse = z.infer<
  typeof structureDeepActionResponseSchema
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
