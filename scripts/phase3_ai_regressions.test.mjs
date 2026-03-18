import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExplainPrompt,
  getExplainModelTarget,
  isSingleWordSelection,
  normalizeExplanationPayload,
} from "../src/lib/ai.ts";
import {
  aiExplanationSchema,
  explainSelectionSchema,
  explanationPayloadSchema,
} from "../src/lib/ai-validation.ts";
import {
  saveVocabularySchema,
  vocabularyIdSchema,
  vocabularyQuerySchema,
} from "../src/lib/vocabulary-validation.ts";
import { shouldShowReaderAiContext } from "../src/components/reader/reader-ai-panel-utils.ts";
import { buildVocabularySavePayload } from "../src/lib/vocabulary.ts";

test("shouldShowReaderAiContext only enables In Context for word selections", () => {
  assert.equal(
    shouldShowReaderAiContext("word", "A curious fox watched."),
    true,
  );
  assert.equal(
    shouldShowReaderAiContext("phrase", "A curious fox watched."),
    false,
  );
  assert.equal(shouldShowReaderAiContext("word", "   "), false);
});

test("explainSelectionSchema requires reader context for AI explanations", () => {
  assert.equal(
    explainSelectionSchema.safeParse({
      selectedText: "  curious  ",
      surroundingParagraph: "A curious fox watched the moonlit road.",
      sourceLanguage: "EN",
    }).success,
    true,
  );

  assert.equal(
    explainSelectionSchema.safeParse({
      selectedText: "",
      surroundingParagraph: "context",
      sourceLanguage: "en",
    }).success,
    false,
  );
});

test("getExplainModelTarget returns the configured primary and fallback Gemini models", () => {
  assert.deepEqual(getExplainModelTarget("primary"), {
    provider: "google",
    modelId: "gemini-3.1-flash-lite-preview",
  });

  assert.deepEqual(getExplainModelTarget("fallback"), {
    provider: "google",
    modelId: "gemini-2.5-flash-lite",
  });
});

test("buildExplainPrompt follows the learner-assistant template from planning", () => {
  const prompt = buildExplainPrompt({
    selectedText: "curious",
    surroundingParagraph: "The curious fox watched the moonlit road.",
    sourceLanguage: "en",
  });

  assert.match(prompt, /You are a language learning assistant\./);
  assert.match(prompt, /Respond in Vietnamese\./);
  assert.match(prompt, /Book language: en/);
  assert.match(prompt, /Selected text: "curious"/);
  assert.match(prompt, /Context: "The curious fox watched the moonlit road\."/);
  assert.match(prompt, /Selection type: single word\./);
  assert.match(
    prompt,
    /Include pronunciation using IPA or the standard romanization/,
  );
  assert.match(prompt, /difficultyHint/);
  assert.match(prompt, /alternativeMeaning/);
  assert.match(
    prompt,
    /Each example sentence MUST include a Vietnamese translation on the next line\./,
  );
  assert.match(
    prompt,
    /Use vocabulary at or below the difficulty level of the target word\./,
  );
  assert.match(
    prompt,
    /The example sentences should contain the target word \(or its conjugated\/inflected form\)\./,
  );
  assert.match(
    prompt,
    /"examples": \[{"sentence": string, "translation": string}\]/,
  );
});

test("buildExplainPrompt keeps phrase selections anchored to the full sentence", () => {
  const prompt = buildExplainPrompt({
    selectedText: "Caim was in the lead, followed by Lenka.",
    surroundingParagraph:
      "Caim was in the lead, followed by Lenka, while the rest of the runners spread out behind them.",
    sourceLanguage: "en",
  });

  assert.match(prompt, /Selection type: phrase or sentence\./);
  assert.match(prompt, /Translate the full selection exactly as chosen/);
  assert.match(prompt, /Full translation of the complete selection/);
  assert.match(prompt, /Grammatical breakdown: key structures, tenses, idioms/);
  assert.match(prompt, /Cultural\/contextual note/);
  assert.match(
    prompt,
    /do not narrow the answer to a single word or sub-phrase/,
  );
});

test("explanationPayloadSchema requires server-derived selectionType", () => {
  assert.equal(
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
    true,
  );

  assert.equal(
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
    false,
  );

  assert.equal(
    explanationPayloadSchema.safeParse({
      selectionType: "word",
      translation: "to mo",
      explanation: "mo ta dieu gi do rat muon tim hieu",
      examples: ["The curious fox paused."],
    }).success,
    false,
  );
});

test("aiExplanationSchema tolerates blank optional fields from the model", () => {
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

  assert.equal(parsed.success, true);

  if (!parsed.success) {
    return;
  }

  assert.equal(parsed.data.pronunciation, undefined);
  assert.equal(parsed.data.partOfSpeech, undefined);
  assert.equal(parsed.data.grammaticalNote, undefined);
  assert.equal(parsed.data.alternativeMeaning, undefined);
});

test("aiExplanationSchema allows missing examples so fallback examples can be synthesized", () => {
  assert.equal(
    aiExplanationSchema.safeParse({
      translation: "to mo",
      explanation: "mo ta dieu gi do rat muon tim hieu",
      examples: [],
    }).success,
    true,
  );
});

test("explanationPayloadSchema rejects word-only fields on phrase selections", () => {
  assert.equal(
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
    false,
  );
});

test("normalizeExplanationPayload trims bilingual examples and keeps word-only learning fields", () => {
  assert.deepEqual(
    normalizeExplanationPayload(
      {
        translation: "to mo",
        pronunciation: " /ˈkjʊr.i.əs/ ",
        partOfSpeech: "adjective",
        difficultyHint: "intermediate",
        explanation: "mo ta dieu gi do rat muon tim hieu",
        alternativeMeaning: "hiếu kỳ",
        grammaticalNote: "thuong dung cho nguoi thich tim hieu",
        examples: [
          {
            sentence: "  The curious fox paused.  ",
            translation: "  Con cao to mo dung lai.  ",
          },
          {
            sentence: "The curious fox paused.",
            translation: "Con cao day to mo dung lai.",
          },
          {
            sentence: "Curious minds learn fast.",
            translation: "Nhung bo oc to mo hoc rat nhanh.",
          },
        ],
      },
      "curious",
    ),
    {
      selectionType: "word",
      translation: "to mo",
      pronunciation: "/ˈkjʊr.i.əs/",
      partOfSpeech: "adjective",
      difficultyHint: "intermediate",
      explanation: "mo ta dieu gi do rat muon tim hieu",
      grammaticalNote: "thuong dung cho nguoi thich tim hieu",
      alternativeMeaning: "hiếu kỳ",
      examples: [
        {
          sentence: "The curious fox paused.",
          translation: "Con cao to mo dung lai.",
        },
        {
          sentence: "Curious minds learn fast.",
          translation: "Nhung bo oc to mo hoc rat nhanh.",
        },
      ],
    },
  );
});

test("normalizeExplanationPayload keeps phrase-specific analysis and omits word-only fields", () => {
  assert.deepEqual(
    normalizeExplanationPayload(
      {
        translation: "toi rat muon hieu",
        pronunciation: "phrase should not keep this",
        partOfSpeech: "phrase",
        explanation: "dien ta mong muon biet ro hon",
        grammaticalNote: "thi hien mong muon tim hieu them ve ngu canh",
        difficultyHint: "advanced",
        alternativeMeaning: "có vẻ hứng thú",
        examples: [
          {
            sentence: "I am curious about the ending.",
            translation: "Toi rat muon biet ket thuc ra sao.",
          },
        ],
      },
      "I am curious",
    ),
    {
      selectionType: "phrase",
      translation: "toi rat muon hieu",
      explanation: "dien ta mong muon biet ro hon",
      grammaticalNote: "thi hien mong muon tim hieu them ve ngu canh",
      alternativeMeaning: "có vẻ hứng thú",
      examples: [
        {
          sentence: "I am curious about the ending.",
          translation: "Toi rat muon biet ket thuc ra sao.",
        },
      ],
    },
  );
});

test("normalizeExplanationPayload adds a bilingual fallback example when the model omits examples", () => {
  assert.deepEqual(
    normalizeExplanationPayload(
      {
        translation: "to mo",
        explanation: "mo ta dieu gi do rat muon tim hieu",
        examples: [],
      },
      "curious",
    ).examples,
    [
      {
        sentence: "curious appears in this reading context.",
        translation: "to mo",
      },
    ],
  );
});

test("isSingleWordSelection distinguishes words from phrases", () => {
  assert.equal(isSingleWordSelection("curious"), true);
  assert.equal(isSingleWordSelection("moon-lit"), true);
  assert.equal(isSingleWordSelection("curious fox"), false);
});

test("saveVocabularySchema validates vocabulary archive payloads", () => {
  assert.equal(
    saveVocabularySchema.safeParse({
      word: "  curious  ",
      definition: "  to mo  ",
      exampleSentence: "The curious fox paused.",
      contextSentence: "The curious fox watched the moonlit road.",
      sourceLanguage: "  EN  ",
      targetLanguage: "  VI  ",
      bookId: "ckvocabularybook0000000000000",
    }).success,
    true,
  );

  assert.equal(
    saveVocabularySchema.safeParse({
      word: "",
      definition: "to mo",
      exampleSentence: "The curious fox paused.",
      contextSentence: "The curious fox watched the moonlit road.",
      sourceLanguage: "en",
      targetLanguage: "vi",
    }).success,
    false,
  );

  assert.deepEqual(
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
      alternativeMeaning: "  inquisitive  ",
      exampleTranslation: "  Con cao to mo dung lai.  ",
    }),
    {
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
      alternativeMeaning: "inquisitive",
      exampleTranslation: "Con cao to mo dung lai.",
    },
  );

  assert.equal(
    saveVocabularySchema.safeParse({
      word: "curious",
      definition: "to mo",
      exampleSentence: "The curious fox paused.",
      contextSentence: "The curious fox watched the moonlit road.",
      sourceLanguage: "en",
      targetLanguage: "vi",
      difficultyHint: "expert",
    }).success,
    false,
  );
});

test("vocabularyQuerySchema applies pagination defaults and rejects oversized pages", () => {
  assert.deepEqual(vocabularyQuerySchema.parse({}), {
    page: 1,
    limit: 20,
  });

  assert.deepEqual(
    vocabularyQuerySchema.parse({
      word: "  curious  ",
      bookId: "cm9testbook0000000000000000",
      limit: "1",
    }),
    {
      word: "curious",
      bookId: "cm9testbook0000000000000000",
      page: 1,
      limit: 1,
    },
  );

  assert.equal(
    vocabularyQuerySchema.safeParse({
      page: "2",
      limit: "101",
    }).success,
    false,
  );
});

test("vocabularyIdSchema only accepts valid vocabulary ids", () => {
  assert.equal(
    vocabularyIdSchema.safeParse("cm9testbook0000000000000000").success,
    true,
  );

  assert.equal(vocabularyIdSchema.safeParse("not-a-cuid").success, false);
});

test("buildVocabularySavePayload maps AI explanation data into an archive request", () => {
  assert.deepEqual(
    buildVocabularySavePayload({
      bookId: "cm9testbook0000000000000000",
      explanation: {
        selectionType: "word",
        translation: "to mo",
        pronunciation: "/'kjur.i.es/",
        partOfSpeech: "adjective",
        difficultyHint: "intermediate",
        explanation: "mo ta dieu gi do rat muon tim hieu",
        alternativeMeaning: "ham hoc hoi",
        examples: [
          {
            sentence: "The curious fox paused.",
            translation: "Con cao to mo dung lai.",
          },
          {
            sentence: "Curious minds learn fast.",
            translation: "Nhung bo oc to mo hoc rat nhanh.",
          },
        ],
      },
      selectedText: "curious",
      sourceLanguage: "EN",
      surroundingParagraph: "The curious fox watched the moonlit road.",
    }),
    {
      word: "curious",
      definition: "to mo",
      exampleSentence: "The curious fox paused.",
      contextSentence: "The curious fox watched the moonlit road.",
      sourceLanguage: "en",
      targetLanguage: "vi",
      pronunciation: "/'kjur.i.es/",
      partOfSpeech: "adjective",
      difficultyHint: "intermediate",
      explanation: "mo ta dieu gi do rat muon tim hieu",
      alternativeMeaning: "ham hoc hoi",
      exampleTranslation: "Con cao to mo dung lai.",
      bookId: "cm9testbook0000000000000000",
    },
  );
});
