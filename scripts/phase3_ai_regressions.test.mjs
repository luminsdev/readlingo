import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { zodSchema } from "ai";

import {
  buildExplainPrompt,
  getExplainModelTarget,
  isSingleWordSelection,
  normalizeExplanationPayload,
} from "../src/lib/ai.ts";
import {
  buildMnemonicPrompt,
  normalizeMnemonicText,
} from "../src/lib/ai-mnemonic.ts";
import {
  buildCollocationPrompt,
  buildComparePrompt,
  buildConjugationPrompt,
  buildEasierExamplesPrompt,
  buildGrammarPrompt,
  getAvailableDeepActions,
  getDeepActionServerTimeoutMs,
  getDeepActionStreamSettings,
  getEligibleDeepActions,
  getVisibleDeepActions,
} from "../src/lib/ai-deep-actions.ts";
import {
  AI_RESPONSE_LOCALE,
  AI_RESPONSE_LOCALE_NAME,
  getAiResponseLocaleInstruction,
} from "../src/lib/ai-locale.ts";
import {
  aiExplanationSchema,
  collocationDeepActionGenerationSchema,
  collocationDeepActionResponseSchema,
  compareDeepActionGenerationSchema,
  compareDeepActionResponseSchema,
  conjugationDeepActionGenerationSchema,
  conjugationDeepActionResponseSchema,
  deepActionRequestSchema,
  easierExamplesDeepActionGenerationSchema,
  easierExamplesDeepActionResponseSchema,
  explainSelectionSchema,
  explanationPayloadSchema,
  grammarDeepActionGenerationSchema,
  grammarDeepActionResponseSchema,
} from "../src/lib/ai-validation.ts";
import {
  saveVocabularySchema,
  vocabularyIdSchema,
  vocabularyQuerySchema,
} from "../src/lib/vocabulary-validation.ts";
import { shouldShowReaderAiContext } from "../src/components/reader/reader-ai-panel-utils.ts";
import { buildVocabularySavePayload } from "../src/lib/vocabulary.ts";

const deepActionRouteSource = await readFile(
  new URL("../src/app/api/ai/deep-action/route.ts", import.meta.url),
  "utf8",
);
const deepActionsSource = await readFile(
  new URL("../src/lib/ai-deep-actions.ts", import.meta.url),
  "utf8",
);

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

test("AI response locale remains locked to Vietnamese", () => {
  assert.equal(AI_RESPONSE_LOCALE, "vi");
  assert.equal(AI_RESPONSE_LOCALE_NAME, "Vietnamese");
  assert.equal(getAiResponseLocaleInstruction(), "Respond in Vietnamese.");
});

test("deep-action availability separates eligible actions from the visible top three", () => {
  const emptyInput = { selectedText: "   ", sourceLanguage: "en" };

  assert.deepEqual(getEligibleDeepActions(emptyInput), []);
  assert.deepEqual(getVisibleDeepActions(emptyInput), []);
  assert.deepEqual(getAvailableDeepActions(emptyInput), []);

  const englishWordInput = {
    selectedText: "curious",
    sourceLanguage: "  EN-US  ",
  };
  assert.deepEqual(getEligibleDeepActions(englishWordInput), [
    "grammar",
    "compare",
    "easierExamples",
    "conjugation",
    "collocation",
  ]);
  assert.deepEqual(getVisibleDeepActions(englishWordInput), [
    "grammar",
    "easierExamples",
    "conjugation",
  ]);
  assert.deepEqual(
    getAvailableDeepActions(englishWordInput),
    getVisibleDeepActions(englishWordInput),
  );

  const vietnameseWordInput = {
    selectedText: "curious",
    sourceLanguage: "vi",
  };
  assert.deepEqual(getEligibleDeepActions(vietnameseWordInput), [
    "grammar",
    "compare",
    "easierExamples",
    "collocation",
  ]);
  assert.deepEqual(getVisibleDeepActions(vietnameseWordInput), [
    "grammar",
    "easierExamples",
    "collocation",
  ]);

  assert.deepEqual(getVisibleDeepActions({ selectedText: "curious" }), [
    "grammar",
    "easierExamples",
    "collocation",
  ]);
  assert.deepEqual(
    getEligibleDeepActions({
      selectedText: "in spite of",
      sourceLanguage: "en",
    }),
    ["grammar", "compare", "easierExamples"],
  );
  assert.deepEqual(
    getVisibleDeepActions({
      selectedText: "in spite of",
      sourceLanguage: "en",
    }),
    ["grammar", "compare", "easierExamples"],
  );

  for (const sourceLanguage of [
    "en",
    "es",
    "fr",
    "de",
    "it",
    "pt",
    "ru",
    "nl",
    "pl",
    "sv",
    "da",
    "nb",
    "no",
    "fi",
    "cs",
    "ro",
    "hu",
    "tr",
    "el",
    "uk",
    "bg",
    "hr",
    "sk",
    "sl",
    "lt",
    "lv",
    "et",
    "ga",
    "cy",
    "is",
    "la",
  ]) {
    assert.equal(
      getEligibleDeepActions({
        selectedText: "curious",
        sourceLanguage,
      }).includes("conjugation"),
      true,
    );
  }

  for (const sourceLanguage of ["", "ja", "zh", "ko", "vi", "th", "ar"]) {
    assert.equal(
      getEligibleDeepActions({
        selectedText: "curious",
        sourceLanguage,
      }).includes("conjugation"),
      false,
    );
  }
});

test("deepActionRequestSchema normalizes valid requests and rejects invalid fields", () => {
  assert.deepEqual(
    deepActionRequestSchema.parse({
      action: "grammar",
      selectedText: "  curious  ",
      surroundingParagraph: "  The curious fox paused.  ",
      sourceLanguage: "  EN  ",
    }),
    {
      action: "grammar",
      selectedText: "curious",
      surroundingParagraph: "The curious fox paused.",
      sourceLanguage: "en",
      modelTier: "primary",
    },
  );

  for (const action of ["conjugation", "collocation"]) {
    assert.equal(
      deepActionRequestSchema.safeParse({
        action,
        selectedText: "curious",
        surroundingParagraph: "The curious fox paused.",
        sourceLanguage: "en",
      }).success,
      true,
    );
  }

  for (const input of [
    {
      action: "syntax",
      selectedText: "curious",
      surroundingParagraph: "The curious fox paused.",
      sourceLanguage: "en",
    },
    {
      action: "compare",
      selectedText: " ",
      surroundingParagraph: "The curious fox paused.",
      sourceLanguage: "en",
    },
    {
      action: "easierExamples",
      selectedText: "curious",
      surroundingParagraph: " ",
      sourceLanguage: "e",
    },
  ]) {
    assert.equal(deepActionRequestSchema.safeParse(input).success, false);
  }
});

test("deep-action response schemas accept applicable and honest not-applicable results", () => {
  assert.equal(
    grammarDeepActionResponseSchema.safeParse({
      summary: "Đây là một tính từ.",
      points: ["Đứng trước danh từ hoặc sau động từ nối."],
    }).success,
    true,
  );
  assert.equal(
    compareDeepActionResponseSchema.safeParse({
      alternative: "inquisitive",
      contrast: "Curious trung tính hơn; inquisitive nhấn mạnh ham tìm hiểu.",
      tip: "Dùng curious trong hội thoại thông thường.",
    }).success,
    true,
  );
  assert.equal(
    easierExamplesDeepActionResponseSchema.safeParse({
      examples: [
        {
          sentence: "The child is curious.",
          translation: "Đứa trẻ rất tò mò.",
        },
      ],
    }).success,
    true,
  );
  assert.deepEqual(
    conjugationDeepActionResponseSchema.parse({
      lemma: "  be  ",
      forms: [{ label: "  past  ", value: "  was / were  " }],
      note: "  Irregular verb.  ",
    }),
    {
      lemma: "be",
      forms: [{ label: "past", value: "was / were" }],
      note: "Irregular verb.",
    },
  );
  assert.deepEqual(
    collocationDeepActionResponseSchema.parse({
      items: [
        {
          phrase: "  deeply curious  ",
          translation: "  vô cùng tò mò  ",
          note: "  Natural intensifier.  ",
        },
      ],
    }),
    {
      items: [
        {
          phrase: "deeply curious",
          translation: "vô cùng tò mò",
          note: "Natural intensifier.",
        },
      ],
    },
  );

  for (const schema of [
    grammarDeepActionResponseSchema,
    compareDeepActionResponseSchema,
    easierExamplesDeepActionResponseSchema,
    conjugationDeepActionResponseSchema,
    collocationDeepActionResponseSchema,
  ]) {
    assert.equal(
      schema.safeParse({
        notApplicable: true,
        reason: "Hành động này không phù hợp với lựa chọn.",
      }).success,
      true,
    );
    assert.equal(
      schema.safeParse({
        notApplicable: true,
      }).success,
      false,
    );
  }
});

test("deep-action response schemas enforce applicable content and collection bounds", () => {
  assert.equal(grammarDeepActionResponseSchema.safeParse({}).success, false);
  assert.equal(
    grammarDeepActionResponseSchema.safeParse({
      summary: "Past perfect marks an earlier completed action.",
    }).success,
    true,
  );
  assert.equal(
    grammarDeepActionResponseSchema.safeParse({
      points: ["Use had + past participle."],
    }).success,
    true,
  );
  assert.equal(
    grammarDeepActionResponseSchema.safeParse({
      summary: " ",
      points: [],
    }).success,
    false,
  );
  assert.equal(compareDeepActionResponseSchema.safeParse({}).success, false);
  assert.equal(
    easierExamplesDeepActionResponseSchema.safeParse({ examples: [] }).success,
    false,
  );
  assert.equal(
    grammarDeepActionResponseSchema.safeParse({
      summary: "Tóm tắt",
      points: ["1", "2", "3", "4", "5", "6"],
    }).success,
    false,
  );
  assert.equal(
    grammarDeepActionResponseSchema.safeParse({
      summary: "s".repeat(220),
      points: ["p".repeat(100)],
    }).success,
    true,
  );
  assert.equal(
    grammarDeepActionResponseSchema.safeParse({
      summary: "s".repeat(221),
    }).success,
    false,
  );
  assert.equal(
    grammarDeepActionResponseSchema.safeParse({
      points: ["p".repeat(101)],
    }).success,
    false,
  );
  assert.equal(
    grammarDeepActionResponseSchema.safeParse({
      notApplicable: true,
      reason: "r".repeat(200),
    }).success,
    true,
  );
  assert.equal(
    grammarDeepActionResponseSchema.safeParse({
      notApplicable: true,
      reason: "r".repeat(201),
    }).success,
    false,
  );
  assert.equal(
    conjugationDeepActionResponseSchema.safeParse({ forms: [] }).success,
    false,
  );
  assert.equal(
    conjugationDeepActionResponseSchema.safeParse({
      forms: Array.from({ length: 7 }, (_, index) => ({
        label: `form ${index}`,
        value: `value ${index}`,
      })),
    }).success,
    false,
  );
  assert.equal(
    conjugationDeepActionResponseSchema.safeParse({
      forms: [{ label: " ", value: "was" }],
    }).success,
    false,
  );
  assert.equal(
    collocationDeepActionResponseSchema.safeParse({ items: [] }).success,
    false,
  );
  assert.equal(
    collocationDeepActionResponseSchema.safeParse({
      items: Array.from({ length: 6 }, (_, index) => ({
        phrase: `phrase ${index}`,
        translation: `translation ${index}`,
      })),
    }).success,
    false,
  );
  assert.equal(
    collocationDeepActionResponseSchema.safeParse({
      items: [{ phrase: "deeply curious", translation: " ", extra: true }],
    }).success,
    false,
  );
});

test("native Google deep-action schemas remain compatible with structured outputs", async () => {
  for (const schema of [
    grammarDeepActionGenerationSchema,
    compareDeepActionGenerationSchema,
    easierExamplesDeepActionGenerationSchema,
    collocationDeepActionGenerationSchema,
  ]) {
    const jsonSchema = await zodSchema(schema).jsonSchema;

    assert.equal(jsonSchema.type, "object");
    assert.equal(jsonSchema.anyOf, undefined);
    assert.ok(jsonSchema.properties?.notApplicable);
    assert.ok(jsonSchema.properties?.reason);
  }

  const conjugationJsonSchema = await zodSchema(
    conjugationDeepActionGenerationSchema,
  ).jsonSchema;

  assert.equal(conjugationJsonSchema.type, "object");
  assert.equal(conjugationJsonSchema.anyOf, undefined);
  assert.ok(conjugationJsonSchema.properties?.result);
  assert.equal(
    /"(?:anyOf|oneOf)"/.test(JSON.stringify(conjugationJsonSchema)),
    true,
  );
});

test("conjugation disables unsupported Google native structured outputs", () => {
  assert.match(
    deepActionsSource,
    /input\.action === "conjugation"[\s\S]*?structuredOutputs: false/,
  );
});

test("deep-action generation schemas tolerate recoverable model output", () => {
  const grammarResult = grammarDeepActionGenerationSchema.safeParse({
    summary: "s".repeat(321),
    points: ["p".repeat(141)],
    extra: "ignored",
  });

  assert.equal(grammarResult.success, true);
  if (grammarResult.success) {
    assert.equal(grammarResult.data.summary, "s".repeat(321));
    assert.equal("extra" in grammarResult.data, false);
  }

  assert.equal(
    conjugationDeepActionGenerationSchema.safeParse({ lemma: "lead" }).success,
    false,
  );
  assert.equal(
    conjugationDeepActionGenerationSchema.safeParse({
      result: {
        type: "forms",
        lemma: "lead",
        forms: [
          { label: "base", value: "lead" },
          { label: "past", value: "led" },
        ],
        note: "Irregular verb.",
      },
    }).success,
    true,
  );
  assert.equal(
    conjugationDeepActionGenerationSchema.safeParse({
      result: {
        type: "notApplicable",
        notApplicable: true,
        reason: "Từ này không biến đổi hình thái.",
      },
    }).success,
    true,
  );
  assert.equal(
    conjugationDeepActionGenerationSchema.safeParse({
      result: { type: "forms", lemma: "lead" },
    }).success,
    false,
  );
  assert.equal(
    conjugationDeepActionGenerationSchema.safeParse({
      result: {
        type: "forms",
        lemma: "lead",
        forms: [{ label: "l".repeat(33), value: "lead" }],
      },
    }).success,
    false,
  );
  assert.equal(
    conjugationDeepActionGenerationSchema.safeParse({
      result: {
        type: "forms",
        lemma: "lead",
        forms: [{ label: "base", value: "v".repeat(33) }],
      },
    }).success,
    false,
  );
  assert.equal(
    conjugationDeepActionGenerationSchema.safeParse({
      result: {
        type: "forms",
        lemma: "lead",
        forms: [{ label: "base", value: "lead" }],
        note: "n".repeat(101),
      },
    }).success,
    false,
  );
  assert.equal(
    conjugationDeepActionGenerationSchema.safeParse({
      result: {
        type: "notApplicable",
        notApplicable: true,
        reason: "r".repeat(101),
      },
    }).success,
    false,
  );
});

test("deep-action streaming uses bounded output and action-aware timeouts", () => {
  assert.deepEqual(getDeepActionStreamSettings("grammar"), {
    temperature: 0.2,
    maxOutputTokens: 350,
  });
  assert.deepEqual(getDeepActionStreamSettings("compare"), {
    temperature: 0.2,
    maxOutputTokens: 300,
  });
  assert.deepEqual(getDeepActionStreamSettings("easierExamples"), {
    temperature: 0.2,
    maxOutputTokens: 350,
  });
  assert.deepEqual(getDeepActionStreamSettings("conjugation"), {
    temperature: 0.2,
    maxOutputTokens: 300,
  });
  assert.deepEqual(getDeepActionStreamSettings("collocation"), {
    temperature: 0.2,
    maxOutputTokens: 350,
  });
  assert.equal(getDeepActionServerTimeoutMs("grammar"), 22_000);
  assert.equal(getDeepActionServerTimeoutMs("conjugation"), 32_000);
});

test("deep-action timeout suppresses duplicate stream failure logging", () => {
  assert.match(
    deepActionRouteSource,
    /onFinish\(\{ error \}\) \{[\s\S]*?if \(!error \|\| hasStreamError \|\| didTimeout\)/,
  );
});

test("deep-action invalid output logs safe parse diagnostics", () => {
  assert.match(deepActionRouteSource, /NoObjectGeneratedError\.isInstance/);
  assert.match(deepActionRouteSource, /finishReason/);
  assert.match(deepActionRouteSource, /rawTextContainsForms/);
});

test("deep-action response wrapper ignores pulls after client cancellation", () => {
  assert.match(deepActionRouteSource, /let isResponseCanceled = false;/);
  assert.match(
    deepActionRouteSource,
    /await sourceReader\.read\(\);\s*if \(isResponseCanceled\) \{\s*return;\s*\}/,
  );
  assert.match(
    deepActionRouteSource,
    /catch \(error\) \{\s*if \(isResponseCanceled\) \{\s*return;\s*\}/,
  );
  assert.match(
    deepActionRouteSource,
    /async cancel\(reason\) \{\s*isResponseCanceled = true;/,
  );
});

test("buildExplainPrompt follows the learner-assistant template from planning", () => {
  const prompt = buildExplainPrompt({
    selectedText: "curious",
    surroundingParagraph: "The curious fox watched the moonlit road.",
    sourceLanguage: "en",
  });

  assert.match(prompt, /You are a language learning assistant\./);
  assert.ok(prompt.includes(getAiResponseLocaleInstruction()));
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
  assert.match(prompt, /2-4 short sentences/);
  assert.match(prompt, /under 500 characters/);
  assert.match(prompt, /at most 1-2 short sentences/);
  assert.match(prompt, /Prefer 1 example; never provide more than 2/);
  assert.match(prompt, /Do not include greetings, closings, thanks, wishes/);
  assert.match(prompt, /self-referential assistant chatter/);

  for (const bannedPhrase of [
    "hy vọng",
    "chúc bạn",
    "cảm ơn",
    "cố gắng",
    "nếu bạn muốn hỏi thêm",
  ]) {
    assert.ok(prompt.toLowerCase().includes(bannedPhrase));
  }
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

test("buildMnemonicPrompt asks for a concise Vietnamese memory hook", () => {
  const prompt = buildMnemonicPrompt({
    word: "ephemeral",
    definition: "ngan ngu, chi ton tai trong thoi gian ngan",
    sourceLanguage: "en",
    exampleSentence: "The beauty of cherry blossoms is ephemeral.",
    contextSentence:
      "The beauty of cherry blossoms is ephemeral, which is why festivals celebrate the brief bloom.",
  });

  assert.ok(prompt.includes(getAiResponseLocaleInstruction()));
  assert.match(prompt, /Word: "ephemeral"/);
  assert.match(
    prompt,
    /Definition: "ngan ngu, chi ton tai trong thoi gian ngan"/,
  );
  assert.match(prompt, /Source language: en/);
  assert.match(
    prompt,
    /Example sentence: "The beauty of cherry blossoms is ephemeral\."/,
  );
  assert.match(prompt, /Context sentence: "/);
  assert.match(prompt, /1-3 sentences max/);
  assert.match(
    prompt,
    /Vietnamese wordplay or cultural references when they genuinely help memory/,
  );
  assert.match(prompt, /Return only the mnemonic text/);
});

test("deep-action prompts include locale, action schema, and selection context", () => {
  const input = {
    selectedText: "curious",
    surroundingParagraph: "The curious fox paused.",
    sourceLanguage: "en",
  };
  const prompts = [
    [buildGrammarPrompt(input), "grammar", "summary", "points"],
    [buildComparePrompt(input), "compare", "alternative", "contrast"],
    [
      buildEasierExamplesPrompt(input),
      "easierExamples",
      "examples",
      "translation",
    ],
    [buildConjugationPrompt(input), "conjugation", "forms", "lemma"],
    [buildCollocationPrompt(input), "collocation", "items", "phrase"],
  ];

  for (const [prompt, action, firstField, secondField] of prompts) {
    assert.ok(prompt.includes(getAiResponseLocaleInstruction()));
    assert.match(prompt, new RegExp(`Action: ${action}`));
    assert.match(prompt, /Selected text: "curious"/);
    assert.match(prompt, /Context: "The curious fox paused\."/);
    assert.match(prompt, /Source language: en/);
    assert.match(prompt, /learner-facing content in Vietnamese/i);
    assert.match(prompt, /JSON/);
    assert.match(prompt, new RegExp(firstField));
    assert.match(prompt, new RegExp(secondField));
    assert.match(prompt, /notApplicable/);
    assert.match(prompt, /reason/);
    assert.match(prompt, /Do not use chat or multi-turn memory\./);
    assert.match(prompt, /Use short structured fields only\./);
    assert.match(prompt, /Do not write essays or multi-paragraph answers\./);
    assert.match(prompt, /Do not include greetings, sign-offs, thanks, wishes/);
    assert.match(prompt, /Prefer an honest "notApplicable": true/);

    for (const bannedPhrase of ["hy vọng", "chúc bạn", "cảm ơn", "cố gắng"]) {
      assert.ok(prompt.toLowerCase().includes(bannedPhrase));
    }
  }
});

test("grammar prompt states hard payload limits and repeats the filler ban", () => {
  const prompt = buildGrammarPrompt({
    selectedText: "curious",
    surroundingParagraph: "The curious fox paused.",
    sourceLanguage: "en",
  });

  assert.match(prompt, /summary[^\n]*220 characters/i);
  assert.match(prompt, /point[^\n]*100 characters/i);
  assert.match(prompt, /reason[^\n]*200 characters/i);
  assert.match(prompt, /exactly 1 short summary sentence/i);
  assert.match(prompt, /0.?3 short points/i);
  assert.match(prompt, /no multi-clause essays/i);
  assert.match(prompt, /dictionary definition dump/i);
  assert.match(prompt, /polite filler loops/i);

  for (const forbiddenOpener of [
    "Ch\u00fac b\u1ea1n",
    "C\u1ea3m \u01a1n",
    "Hy v\u1ecdng",
  ]) {
    assert.ok(prompt.includes(forbiddenOpener));
  }
});

test("conjugation prompt requires a compact discriminated morphology result", () => {
  const prompt = buildConjugationPrompt({
    selectedText: "central",
    surroundingParagraph: "The station is in central London.",
    sourceLanguage: "en",
  });

  for (const category of [
    "adjective",
    "adverb",
    "proper noun",
    "article",
    "preposition",
    "conjunction",
    "pronoun",
    "non-inflecting token",
  ]) {
    assert.match(prompt, new RegExp(category, "i"));
  }

  assert.match(
    prompt,
    /does not inflect in the source language or this context/,
  );
  assert.match(prompt, /MUST return "notApplicable": true/);
  assert.match(prompt, /"type": "forms"/);
  assert.match(prompt, /"type": "notApplicable"/);
  assert.match(prompt, /lemma.*required/i);
  assert.match(prompt, /forms.*required/i);
  assert.match(prompt, /Only return forms for useful morphology/);
  assert.match(prompt, /4.?6 complete forms/i);
  assert.match(prompt, /maximum of 6 forms/i);
  assert.match(prompt, /Every form requires both a short label and value/i);
  assert.match(prompt, /label.*maximum 32 characters/i);
  assert.match(prompt, /value.*maximum 32 characters/i);
  assert.match(prompt, /lemma.*dictionary headword only/i);
  assert.match(prompt, /note.*maximum 100 characters/i);
  assert.match(prompt, /reason.*maximum 100 characters/i);
  assert.match(prompt, /Prefer forms over prose/i);
  assert.match(prompt, /multi-paragraph explanation/i);
  assert.doesNotMatch(prompt, /cannot be completed compactly/i);
  assert.match(prompt, /Never invent a full textbook paradigm/);
});

test("normalizeMnemonicText trims wrapper quotes and rejects invalid model output", () => {
  assert.equal(
    normalizeMnemonicText('  "Nghĩ đến WiFi ở khắp nơi, giống ubiquitous."  '),
    "Nghĩ đến WiFi ở khắp nơi, giống ubiquitous.",
  );

  assert.equal(normalizeMnemonicText("   \n   "), null);
  assert.equal(normalizeMnemonicText("x".repeat(1001)), null);
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
      mnemonic: "  Nghi den con cao to mo, gap gi cung muon ngo vao.  ",
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
      mnemonic: "Nghi den con cao to mo, gap gi cung muon ngo vao.",
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
