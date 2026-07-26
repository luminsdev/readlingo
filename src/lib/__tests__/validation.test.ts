import { describe, expect, it } from "vitest";

import {
  aiExplanationSchema,
  deepActionRequestSchema,
  explainSelectionSchema,
  explanationPayloadSchema,
  normalizeFormTip,
  structureDeepActionResponseSchema,
} from "@/lib/ai-validation";
import { readingProgressSchema } from "@/lib/book-validation";
import {
  saveVocabularySchema,
  vocabularyIdSchema,
  vocabularyQuerySchema,
} from "@/lib/vocabulary-validation";

describe("AI Validation Schemas", () => {
  it("explainSelectionSchema requires reader context for AI explanations", () => {
    expect(
      explainSelectionSchema.safeParse({
        selectedText: "  curious  ",
        surroundingParagraph: "A curious fox watched the moonlit road.",
        sourceLanguage: "EN",
      }).success,
    ).toBe(true);

    expect(
      explainSelectionSchema.safeParse({
        selectedText: "",
        surroundingParagraph: "context",
        sourceLanguage: "en",
      }).success,
    ).toBe(false);
  });

  it("explanationPayloadSchema requires server-derived selectionType", () => {
    expect(
      explanationPayloadSchema.safeParse({
        selectionType: "word",
        translation: "to mo",
        explanation: "mo ta dieu gi do rat muon tim hieu",
        examples: [
          {
            sentence: "The curious fox paused.",
            translation: "Con cao to mo dung lai.",
          },
        ],
      }).success,
    ).toBe(true);

    expect(
      explanationPayloadSchema.safeParse({
        translation: "to mo",
        explanation: "mo ta dieu gi do rat muon tim hieu",
        examples: [
          {
            sentence: "The curious fox paused.",
            translation: "Con cao to mo dung lai.",
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      explanationPayloadSchema.safeParse({
        selectionType: "word",
        translation: "to mo",
        explanation: "mo ta dieu gi do rat muon tim hieu",
        examples: ["The curious fox paused."],
      }).success,
    ).toBe(false);
  });

  it("aiExplanationSchema tolerates blank optional fields from the model", () => {
    const parsed = aiExplanationSchema.safeParse({
      translation: "to mo",
      pronunciation: "   ",
      partOfSpeech: "",
      explanation: "mo ta dieu gi do rat muon tim hieu",
      grammaticalNote: "   ",
      alternativeMeaning: "",
      examples: [
        {
          sentence: "The curious fox paused.",
          translation: "Con cao to mo dung lai.",
        },
      ],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.pronunciation).toBeUndefined();
    expect(parsed.data.partOfSpeech).toBeUndefined();
    expect(parsed.data.grammaticalNote).toBeUndefined();
    expect(parsed.data.alternativeMeaning).toBeUndefined();
  });

  it("aiExplanationSchema allows missing examples so fallback examples can be synthesized", () => {
    expect(
      aiExplanationSchema.safeParse({
        translation: "to mo",
        explanation: "mo ta dieu gi do rat muon tim hieu",
        examples: [],
      }).success,
    ).toBe(true);
  });

  it("normalizes a valid Form tip and omits invalid optional tips", () => {
    expect(normalizeFormTip("  Uses\n  the past tense.  ")).toBe(
      "Uses the past tense.",
    );
    expect(normalizeFormTip("   ")).toBeUndefined();
    expect(normalizeFormTip("x".repeat(180))).toBe("x".repeat(180));
    expect(normalizeFormTip("x".repeat(181))).toBeUndefined();
    expect(
      normalizeFormTip("First sentence. Second sentence."),
    ).toBeUndefined();
    expect(normalizeFormTip({ text: "not a string" })).toBeUndefined();
  });

  it("aiExplanationSchema caps explanation and omits invalid Form tips", () => {
    const basePayload = {
      translation: "to mo",
      explanation: "x".repeat(800),
      grammaticalNote: "x".repeat(180),
      examples: [],
    };

    expect(aiExplanationSchema.safeParse(basePayload).success).toBe(true);
    expect(
      aiExplanationSchema.safeParse({
        ...basePayload,
        explanation: "x".repeat(801),
      }).success,
    ).toBe(false);
    const overLimit = aiExplanationSchema.safeParse({
      ...basePayload,
      grammaticalNote: "x".repeat(181),
    });
    expect(overLimit.success).toBe(true);
    if (overLimit.success) {
      expect(overLimit.data.grammaticalNote).toBeUndefined();
    }

    const multipleBoundaries = aiExplanationSchema.safeParse({
      ...basePayload,
      grammaticalNote: "First sentence. Second sentence.",
    });
    expect(multipleBoundaries.success).toBe(true);
    if (multipleBoundaries.success) {
      expect(multipleBoundaries.data.grammaticalNote).toBeUndefined();
    }
  });

  it("accepts only the structure deep-action request ID", () => {
    const input = {
      selectedText: "curious",
      surroundingParagraph: "The curious fox paused.",
      sourceLanguage: "en",
    };

    expect(
      deepActionRequestSchema.safeParse({ action: "structure", ...input })
        .success,
    ).toBe(true);
    expect(
      deepActionRequestSchema.safeParse({ action: "grammar", ...input })
        .success,
    ).toBe(false);
  });

  it("enforces exclusive applicable and not-applicable Structure results", () => {
    expect(
      structureDeepActionResponseSchema.safeParse({
        pattern: "adjective + noun",
        role: "Attributive adjective",
        whyHere: "It describes the fox directly.",
        pitfall: "Do not confuse it with interested.",
      }).success,
    ).toBe(true);
    expect(
      structureDeepActionResponseSchema.safeParse({
        pattern: "adjective + noun",
        role: "Attributive adjective",
      }).success,
    ).toBe(false);
    expect(
      structureDeepActionResponseSchema.safeParse({
        notApplicable: true,
        reason: "The selection is a proper name.",
      }).success,
    ).toBe(true);
    expect(
      structureDeepActionResponseSchema.safeParse({
        notApplicable: true,
        reason: "The selection is a proper name.",
        pattern: "proper name",
      }).success,
    ).toBe(false);
    expect(
      structureDeepActionResponseSchema.safeParse({
        notApplicable: true,
      }).success,
    ).toBe(false);
    expect(
      structureDeepActionResponseSchema.safeParse({
        pattern: "adjective + noun",
        role: "Attributive adjective",
        whyHere: "It describes the fox directly.",
        reason: "Not applicable should not appear here.",
      }).success,
    ).toBe(false);
  });

  it("explanationPayloadSchema rejects word-only fields on phrase selections", () => {
    expect(
      explanationPayloadSchema.safeParse({
        selectionType: "phrase",
        translation: "toi rat muon hieu",
        pronunciation: "/ignored/",
        partOfSpeech: "phrase",
        difficultyHint: "advanced",
        explanation: "dien ta mong muon biet ro hon",
        examples: [
          {
            sentence: "I am curious about the ending.",
            translation: "Toi rat muon biet ket thuc ra sao.",
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("Vocabulary Validation Schemas", () => {
  it("saveVocabularySchema validates vocabulary archive payloads", () => {
    expect(
      saveVocabularySchema.safeParse({
        word: "  curious  ",
        definition: "  to mo  ",
        exampleSentence: "The curious fox paused.",
        contextSentence: "The curious fox watched the moonlit road.",
        sourceLanguage: "  EN  ",
        targetLanguage: "  VI  ",
        bookId: "ckvocabularybook0000000000000",
      }).success,
    ).toBe(true);

    expect(
      saveVocabularySchema.safeParse({
        word: "",
        definition: "to mo",
        exampleSentence: "The curious fox paused.",
        contextSentence: "The curious fox watched the moonlit road.",
        sourceLanguage: "en",
        targetLanguage: "vi",
      }).success,
    ).toBe(false);

    expect(
      saveVocabularySchema.parse({
        word: "curious",
        definition: "to mo",
        exampleSentence: "The curious fox paused.",
        contextSentence: "The curious fox watched the moonlit road.",
        sourceLanguage: "EN",
        targetLanguage: "VI",
        pronunciation: "  /'kjur.i.es/  ",
        partOfSpeech: "  adjective  ",
        difficultyHint: "  intermediate  ",
        explanation: "  Learner-friendly note.  ",
        mnemonic: "  Nghi den con cao to mo, gap gi cung muon ngo vao.  ",
        alternativeMeaning: "  inquisitive  ",
        exampleTranslation: "  Con cao to mo dung lai.  ",
      }),
    ).toEqual({
      word: "curious",
      definition: "to mo",
      exampleSentence: "The curious fox paused.",
      contextSentence: "The curious fox watched the moonlit road.",
      sourceLanguage: "en",
      targetLanguage: "vi",
      pronunciation: "/'kjur.i.es/",
      partOfSpeech: "adjective",
      difficultyHint: "intermediate",
      explanation: "Learner-friendly note.",
      mnemonic: "Nghi den con cao to mo, gap gi cung muon ngo vao.",
      alternativeMeaning: "inquisitive",
      exampleTranslation: "Con cao to mo dung lai.",
    });

    expect(
      saveVocabularySchema.safeParse({
        word: "curious",
        definition: "to mo",
        exampleSentence: "The curious fox paused.",
        contextSentence: "The curious fox watched the moonlit road.",
        sourceLanguage: "en",
        targetLanguage: "vi",
        difficultyHint: "expert",
      }).success,
    ).toBe(false);
  });

  it("vocabularyQuerySchema applies pagination defaults and rejects oversized pages", () => {
    expect(vocabularyQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
    });

    expect(
      vocabularyQuerySchema.parse({
        word: "  curious  ",
        bookId: "cm9testbook0000000000000000",
        limit: "1",
      }),
    ).toEqual({
      word: "curious",
      bookId: "cm9testbook0000000000000000",
      page: 1,
      limit: 1,
    });

    expect(
      vocabularyQuerySchema.safeParse({
        page: "2",
        limit: "101",
      }).success,
    ).toBe(false);
  });

  it("vocabularyQuerySchema requires a word and book for normalized lookup mode", () => {
    expect(
      vocabularyQuerySchema.parse({
        match: "normalized",
        word: "  Hello   World  ",
        bookId: "cm9testbook0000000000000000",
      }),
    ).toEqual({
      match: "normalized",
      word: "Hello   World",
      bookId: "cm9testbook0000000000000000",
      page: 1,
      limit: 20,
    });

    expect(
      vocabularyQuerySchema.safeParse({
        match: "normalized",
        word: "hello",
      }).success,
    ).toBe(false);
    expect(
      vocabularyQuerySchema.safeParse({
        match: "contains",
        word: "hello",
        bookId: "cm9testbook0000000000000000",
      }).success,
    ).toBe(false);
  });

  it("vocabularyIdSchema only accepts valid vocabulary ids", () => {
    expect(
      vocabularyIdSchema.safeParse("cm9testbook0000000000000000").success,
    ).toBe(true);

    expect(vocabularyIdSchema.safeParse("not-a-cuid").success).toBe(false);
  });
});

describe("Book Validation Schemas", () => {
  it("readingProgressSchema validates EPUB CFIs and optional percentage bounds", () => {
    expect(
      readingProgressSchema.safeParse({
        cfi: "epubcfi(/6/2!/4/2/8,/1:0,/1:12)",
      }).success,
    ).toBe(true);
    expect(
      readingProgressSchema.safeParse({
        cfi: "epubcfi(/6/2!/4/2/8,/1:0,/1:12)",
        percentage: 0.5,
      }).success,
    ).toBe(true);
    expect(readingProgressSchema.safeParse({ cfi: "chapter-1" }).success).toBe(
      false,
    );
    expect(
      readingProgressSchema.safeParse({
        cfi: "epubcfi(/6/2!/4/2/8,/1:0,/1:12)",
        percentage: 1.1,
      }).success,
    ).toBe(false);
  });
});
