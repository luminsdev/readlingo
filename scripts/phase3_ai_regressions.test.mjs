import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { zodSchema } from "ai";

import {
  buildExplainPrompt,
  getAiStreamObjectOptions,
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
  buildStructurePrompt,
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
  structureDeepActionGenerationSchema,
  structureDeepActionResponseSchema,
} from "../src/lib/ai-validation.ts";
import {
  saveVocabularySchema,
  vocabularyIdSchema,
  vocabularyQuerySchema,
} from "../src/lib/vocabulary-validation.ts";
import { shouldShowReaderAiContext } from "../src/components/reader/reader-ai-panel-utils.ts";
import { buildVocabularySavePayload } from "../src/lib/vocabulary.ts";

const aiModule = await import("../src/lib/ai.ts");
const aiSource = await readFile(
  new URL("../src/lib/ai.ts", import.meta.url),
  "utf8",
);
const deepActionRouteSource = await readFile(
  new URL("../src/app/api/ai/deep-action/route.ts", import.meta.url),
  "utf8",
);
const deepActionsSource = await readFile(
  new URL("../src/lib/ai-deep-actions.ts", import.meta.url),
  "utf8",
);
const mnemonicSource = await readFile(
  new URL("../src/lib/ai-mnemonic.ts", import.meta.url),
  "utf8",
);
const readerAiPanelSource = await readFile(
  new URL("../src/components/reader/reader-ai-panel.tsx", import.meta.url),
  "utf8",
);
const readerSelectionHandlerSource = await readFile(
  new URL(
    "../src/components/reader/reader-selection-handler.tsx",
    import.meta.url,
  ),
  "utf8",
);
const envExampleSource = await readFile(
  new URL("../.env.example", import.meta.url),
  "utf8",
);

function restoreEnvironment(previousValues) {
  for (const [name, value] of Object.entries(previousValues)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

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

test("Google model resolution uses independent dynamic overrides and catalog defaults", () => {
  const previousValues = {
    GOOGLE_PRIMARY_MODEL_ID: process.env.GOOGLE_PRIMARY_MODEL_ID,
    GOOGLE_FALLBACK_MODEL_ID: process.env.GOOGLE_FALLBACK_MODEL_ID,
  };

  try {
    delete process.env.GOOGLE_PRIMARY_MODEL_ID;
    delete process.env.GOOGLE_FALLBACK_MODEL_ID;
    assert.deepEqual(getExplainModelTarget("primary", "google"), {
      provider: "google",
      modelId: "gemma-4-31b-it",
    });
    assert.deepEqual(getExplainModelTarget("fallback", "google"), {
      provider: "google",
      modelId: "gemini-3.5-flash-lite",
    });

    process.env.GOOGLE_PRIMARY_MODEL_ID = "  gemini-3.1-flash-lite-preview  ";
    assert.equal(
      getExplainModelTarget("primary", "google").modelId,
      "gemini-3.1-flash-lite-preview",
    );
    assert.equal(
      getExplainModelTarget("fallback", "google").modelId,
      "gemini-3.5-flash-lite",
    );

    delete process.env.GOOGLE_PRIMARY_MODEL_ID;
    process.env.GOOGLE_FALLBACK_MODEL_ID = "  gemini-3-flash-preview  ";
    assert.equal(
      getExplainModelTarget("primary", "google").modelId,
      "gemma-4-31b-it",
    );
    assert.equal(
      getExplainModelTarget("fallback", "google").modelId,
      "gemini-3-flash-preview",
    );

    process.env.GOOGLE_PRIMARY_MODEL_ID = "  custom-primary  ";
    process.env.GOOGLE_FALLBACK_MODEL_ID = "  custom-fallback  ";
    assert.equal(
      getExplainModelTarget("primary", "google").modelId,
      "custom-primary",
    );
    assert.equal(
      getExplainModelTarget("fallback", "google").modelId,
      "custom-fallback",
    );

    process.env.GOOGLE_PRIMARY_MODEL_ID = "";
    process.env.GOOGLE_FALLBACK_MODEL_ID = "   ";
    assert.equal(
      getExplainModelTarget("primary", "google").modelId,
      "gemma-4-31b-it",
    );
    assert.equal(
      getExplainModelTarget("fallback", "google").modelId,
      "gemini-3.5-flash-lite",
    );
  } finally {
    restoreEnvironment(previousValues);
  }
});

test("GitHub and Qwen model resolution remains unchanged", () => {
  assert.deepEqual(getExplainModelTarget("primary", "github"), {
    provider: "github",
    modelId: process.env.GITHUB_MODEL_ID ?? "gpt-4.1-mini",
  });
  assert.deepEqual(getExplainModelTarget("fallback", "github"), {
    provider: "github",
    modelId:
      process.env.GITHUB_FALLBACK_MODEL_ID ??
      process.env.GITHUB_MODEL_ID ??
      "gpt-4.1-mini",
  });
  assert.deepEqual(getExplainModelTarget("primary", "qwen"), {
    provider: "qwen",
    modelId: process.env.QWEN_MODEL_ID ?? "qwen3",
  });
  assert.deepEqual(getExplainModelTarget("fallback", "qwen"), {
    provider: "qwen",
    modelId:
      process.env.QWEN_FALLBACK_MODEL_ID ??
      process.env.QWEN_MODEL_ID ??
      "qwen3",
  });
});

test("Google thinking controls follow the supported interactive model policy", () => {
  assert.equal(typeof aiModule.getGoogleThinkingConfig, "function");
  const getGoogleThinkingConfig = aiModule.getGoogleThinkingConfig;

  assert.equal(getGoogleThinkingConfig("gemma-3-27b-it"), undefined);
  assert.deepEqual(getGoogleThinkingConfig("gemini-2.5-flash"), {
    thinkingBudget: 0,
  });
  assert.deepEqual(getGoogleThinkingConfig("gemini-2.5-flash-preview"), {
    thinkingBudget: 0,
  });
  assert.deepEqual(getGoogleThinkingConfig("gemini-2.5-flash-preview-05-20"), {
    thinkingBudget: 0,
  });
  assert.deepEqual(getGoogleThinkingConfig("gemini-2.5-flash-lite"), {
    thinkingBudget: 0,
  });
  assert.deepEqual(getGoogleThinkingConfig("gemini-2.5-flash-lite-preview"), {
    thinkingBudget: 0,
  });
  assert.deepEqual(
    getGoogleThinkingConfig("gemini-2.5-flash-lite-preview-09-2025"),
    { thinkingBudget: 0 },
  );
  assert.equal(getGoogleThinkingConfig("gemini-2.5-pro"), undefined);
  assert.equal(
    getGoogleThinkingConfig("gemini-2.5-pro-preview-06-05"),
    undefined,
  );
  assert.equal(getGoogleThinkingConfig("gemini-2.5-experimental"), undefined);
  assert.deepEqual(getGoogleThinkingConfig("gemini-3-flash-preview"), {
    thinkingLevel: "minimal",
  });
  assert.deepEqual(getGoogleThinkingConfig("gemini-3.1-flash-lite-preview"), {
    thinkingLevel: "minimal",
  });
  assert.deepEqual(getGoogleThinkingConfig("gemini-3.5-flash-lite"), {
    thinkingLevel: "minimal",
  });
  assert.equal(getGoogleThinkingConfig("gemini-3-pro-preview"), undefined);
  assert.equal(getGoogleThinkingConfig("gemini-3.1-pro-preview"), undefined);
  assert.equal(getGoogleThinkingConfig("custom-model"), undefined);
});

test("Gemma 4 thinking override accepts only normalized minimal and high", () => {
  const previousValue = process.env.GOOGLE_GEMMA_THINKING_LEVEL;
  const getGoogleThinkingConfig = aiModule.getGoogleThinkingConfig;

  try {
    delete process.env.GOOGLE_GEMMA_THINKING_LEVEL;
    assert.deepEqual(getGoogleThinkingConfig("gemma-4-31b-it"), {
      thinkingLevel: "minimal",
    });
    assert.deepEqual(getGoogleThinkingConfig("gemma-4-26b-a4b-it"), {
      thinkingLevel: "minimal",
    });

    process.env.GOOGLE_GEMMA_THINKING_LEVEL = "  MiNiMaL  ";
    assert.deepEqual(getGoogleThinkingConfig("gemma-4-31b-it"), {
      thinkingLevel: "minimal",
    });

    process.env.GOOGLE_GEMMA_THINKING_LEVEL = "  HiGh  ";
    assert.deepEqual(getGoogleThinkingConfig("gemma-4-31b-it"), {
      thinkingLevel: "high",
    });
    assert.deepEqual(getGoogleThinkingConfig("gemini-2.5-flash-lite"), {
      thinkingBudget: 0,
    });
    assert.deepEqual(getGoogleThinkingConfig("gemini-3-flash-preview"), {
      thinkingLevel: "minimal",
    });
    assert.equal(getGoogleThinkingConfig("gemma-3-27b-it"), undefined);

    process.env.GOOGLE_GEMMA_THINKING_LEVEL = "medium";
    assert.deepEqual(getGoogleThinkingConfig("gemma-4-31b-it"), {
      thinkingLevel: "minimal",
    });

    process.env.GOOGLE_GEMMA_THINKING_LEVEL = "   ";
    assert.deepEqual(getGoogleThinkingConfig("gemma-4-31b-it"), {
      thinkingLevel: "minimal",
    });
  } finally {
    if (previousValue === undefined) {
      delete process.env.GOOGLE_GEMMA_THINKING_LEVEL;
    } else {
      process.env.GOOGLE_GEMMA_THINKING_LEVEL = previousValue;
    }
  }
});

test("stream options keep Google structured outputs and omit Google options elsewhere", () => {
  const previousValues = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    GOOGLE_PRIMARY_MODEL_ID: process.env.GOOGLE_PRIMARY_MODEL_ID,
    GOOGLE_FALLBACK_MODEL_ID: process.env.GOOGLE_FALLBACK_MODEL_ID,
    GOOGLE_GEMMA_THINKING_LEVEL: process.env.GOOGLE_GEMMA_THINKING_LEVEL,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_BASE_URL: process.env.GITHUB_BASE_URL,
    QWEN_API_KEY: process.env.QWEN_API_KEY,
    QWEN_BASE_URL: process.env.QWEN_BASE_URL,
  };

  try {
    process.env.AI_PROVIDER = "google";
    delete process.env.GOOGLE_PRIMARY_MODEL_ID;
    delete process.env.GOOGLE_FALLBACK_MODEL_ID;
    delete process.env.GOOGLE_GEMMA_THINKING_LEVEL;
    assert.deepEqual(getAiStreamObjectOptions("primary").providerOptions, {
      google: {
        structuredOutputs: true,
        thinkingConfig: { thinkingLevel: "minimal" },
      },
    });
    assert.deepEqual(getAiStreamObjectOptions("fallback").providerOptions, {
      google: {
        structuredOutputs: true,
        thinkingConfig: { thinkingLevel: "minimal" },
      },
    });

    process.env.GOOGLE_GEMMA_THINKING_LEVEL = "high";
    assert.deepEqual(getAiStreamObjectOptions("primary").providerOptions, {
      google: {
        structuredOutputs: true,
        thinkingConfig: { thinkingLevel: "high" },
      },
    });
    assert.deepEqual(getAiStreamObjectOptions("fallback").providerOptions, {
      google: {
        structuredOutputs: true,
        thinkingConfig: { thinkingLevel: "minimal" },
      },
    });

    process.env.AI_PROVIDER = "github";
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_BASE_URL = "https://example.com/v1";
    assert.equal(
      getAiStreamObjectOptions("primary").providerOptions,
      undefined,
    );

    process.env.AI_PROVIDER = "qwen";
    process.env.QWEN_API_KEY = "test-key";
    process.env.QWEN_BASE_URL = "https://example.com/v1";
    assert.equal(
      getAiStreamObjectOptions("primary").providerOptions,
      undefined,
    );
  } finally {
    restoreEnvironment(previousValues);
  }
});

test("sampling policy omits temperature only for exact stable Gemini 3.5 Flash-Lite", () => {
  const previousValues = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    GOOGLE_PRIMARY_MODEL_ID: process.env.GOOGLE_PRIMARY_MODEL_ID,
    GOOGLE_FALLBACK_MODEL_ID: process.env.GOOGLE_FALLBACK_MODEL_ID,
  };
  const getAiSamplingOptions = aiModule.getAiSamplingOptions;

  try {
    assert.equal(typeof getAiSamplingOptions, "function");

    process.env.AI_PROVIDER = "google";
    delete process.env.GOOGLE_PRIMARY_MODEL_ID;
    delete process.env.GOOGLE_FALLBACK_MODEL_ID;
    const exactGeminiFallback = getAiSamplingOptions("fallback", 0.2);
    assert.deepEqual(exactGeminiFallback, {});
    assert.equal("temperature" in exactGeminiFallback, false);
    assert.equal("topP" in exactGeminiFallback, false);
    assert.equal("topK" in exactGeminiFallback, false);

    const gemmaPrimary = getAiSamplingOptions("primary", 0.2);
    assert.deepEqual(gemmaPrimary, { temperature: 0.2 });
    assert.equal("topP" in gemmaPrimary, false);
    assert.equal("topK" in gemmaPrimary, false);

    process.env.GOOGLE_FALLBACK_MODEL_ID = "gemini-3-flash-preview";
    assert.deepEqual(getAiSamplingOptions("fallback", 0.2), {
      temperature: 0.2,
    });

    process.env.GOOGLE_FALLBACK_MODEL_ID = "gemini-3.5-flash-lite-preview";
    assert.deepEqual(getAiSamplingOptions("fallback", 0.2), {
      temperature: 0.2,
    });

    process.env.AI_PROVIDER = "github";
    assert.deepEqual(getAiSamplingOptions("fallback", 0.2), {
      temperature: 0.2,
    });

    process.env.AI_PROVIDER = "qwen";
    assert.deepEqual(getAiSamplingOptions("fallback", 0.4), {
      temperature: 0.4,
    });
  } finally {
    restoreEnvironment(previousValues);
  }
});

test("AI callers use model-aware sampling options", () => {
  const previousValues = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    GOOGLE_PRIMARY_MODEL_ID: process.env.GOOGLE_PRIMARY_MODEL_ID,
    GOOGLE_FALLBACK_MODEL_ID: process.env.GOOGLE_FALLBACK_MODEL_ID,
  };

  try {
    process.env.AI_PROVIDER = "google";
    delete process.env.GOOGLE_PRIMARY_MODEL_ID;
    delete process.env.GOOGLE_FALLBACK_MODEL_ID;

    assert.deepEqual(getDeepActionStreamSettings("structure", "primary"), {
      temperature: 0.2,
      maxOutputTokens: 300,
    });
    assert.deepEqual(getDeepActionStreamSettings("structure", "fallback"), {
      maxOutputTokens: 300,
    });

    process.env.GOOGLE_FALLBACK_MODEL_ID = "gemini-3-flash-preview";
    assert.deepEqual(getDeepActionStreamSettings("structure", "fallback"), {
      temperature: 0.2,
      maxOutputTokens: 300,
    });
  } finally {
    restoreEnvironment(previousValues);
  }

  assert.match(
    aiSource,
    /streamExplanation[\s\S]*\.\.\.getAiSamplingOptions\(input\.modelTier,\s*0\.2\)/,
  );
  assert.doesNotMatch(aiSource, /streamExplanation[\s\S]*temperature:\s*0\.2/);
  assert.match(
    deepActionsSource,
    /getDeepActionStreamSettings\(input\.action,\s*input\.modelTier\)/,
  );
  assert.match(
    mnemonicSource,
    /\.\.\.getAiSamplingOptions\("fallback",\s*0\.4\)/,
  );
  assert.doesNotMatch(
    mnemonicSource,
    /generateMnemonic[\s\S]*temperature:\s*0\.4/,
  );
});

test("primary explanation has an explicit 800-token output budget", () => {
  assert.equal(aiModule.PRIMARY_EXPLAIN_MAX_OUTPUT_TOKENS, 800);
  assert.match(
    aiSource,
    /maxOutputTokens:\s*PRIMARY_EXPLAIN_MAX_OUTPUT_TOKENS/,
  );
});

test("Google model overrides are documented for local dogfood", () => {
  assert.match(envExampleSource, /local dogfood/i);
  assert.match(envExampleSource, /^GOOGLE_PRIMARY_MODEL_ID=""$/m);
  assert.match(envExampleSource, /^GOOGLE_FALLBACK_MODEL_ID=""$/m);
  assert.match(envExampleSource, /^GOOGLE_GEMMA_THINKING_LEVEL=""$/m);
});

test("AI response locale remains locked to Vietnamese", () => {
  assert.equal(AI_RESPONSE_LOCALE, "vi");
  assert.equal(AI_RESPONSE_LOCALE_NAME, "Vietnamese");
  assert.equal(getAiResponseLocaleInstruction(), "Respond in Vietnamese.");
});

test("reader source uses the Structure action and Form tip copy", () => {
  assert.match(readerAiPanelSource, /structure:\s*"Structure"/);
  assert.ok(readerAiPanelSource.includes("Form tip"));
  assert.doesNotMatch(readerAiPanelSource, /Grammar & Structure/);
  assert.doesNotMatch(readerAiPanelSource, /\bgrammar:/);

  assert.ok(
    (readerSelectionHandlerSource.match(/\bstructure:/g) ?? []).length >= 4,
  );
  assert.doesNotMatch(readerSelectionHandlerSource, /\bgrammar:/);
});

test("reader deep actions retain the active explanation model tier without automatic fallback", () => {
  assert.match(
    readerSelectionHandlerSource,
    /activeExplainModelTierRef\.current = modelTier;/,
  );
  assert.match(
    readerSelectionHandlerSource,
    /body: JSON\.stringify\(\{[\s\S]*?\.\.\.requestPayload,[\s\S]*?action,[\s\S]*?modelTier: activeExplainModelTierRef\.current,[\s\S]*?\}\)/,
  );
  assert.doesNotMatch(
    readerSelectionHandlerSource,
    /requestExplanation\(requestPayload,\s*"fallback"\)/,
  );
  assert.doesNotMatch(
    readerSelectionHandlerSource,
    /retryAiExplanation\(\s*"fallback"\s*\)/,
  );
  assert.doesNotMatch(aiSource, /getAiStreamObjectOptions\(\s*"fallback"\s*\)/);
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
    "structure",
    "compare",
    "easierExamples",
    "conjugation",
    "collocation",
  ]);
  assert.deepEqual(getVisibleDeepActions(englishWordInput), [
    "structure",
    "compare",
    "conjugation",
  ]);

  const vietnameseWordInput = {
    selectedText: "curious",
    sourceLanguage: "vi",
  };
  assert.deepEqual(getEligibleDeepActions(vietnameseWordInput), [
    "structure",
    "compare",
    "easierExamples",
    "collocation",
  ]);
  assert.deepEqual(getVisibleDeepActions(vietnameseWordInput), [
    "structure",
    "compare",
    "easierExamples",
  ]);

  const unknownLanguageWordInputs = [
    { selectedText: "curious" },
    { selectedText: "curious", sourceLanguage: "und" },
  ];
  for (const input of unknownLanguageWordInputs) {
    assert.deepEqual(getVisibleDeepActions(input), [
      "structure",
      "compare",
      "easierExamples",
    ]);
  }

  const phraseInput = {
    selectedText: "in spite of",
    sourceLanguage: "en",
  };
  assert.deepEqual(getEligibleDeepActions(phraseInput), [
    "structure",
    "compare",
    "easierExamples",
  ]);
  assert.deepEqual(getVisibleDeepActions(phraseInput), [
    "structure",
    "compare",
    "easierExamples",
  ]);
  assert.equal(
    getEligibleDeepActions(phraseInput).includes("conjugation"),
    false,
  );
  assert.equal(
    getEligibleDeepActions(phraseInput).includes("collocation"),
    false,
  );

  for (const input of [
    englishWordInput,
    vietnameseWordInput,
    ...unknownLanguageWordInputs,
  ]) {
    assert.equal(getEligibleDeepActions(input).includes("collocation"), true);
    assert.equal(getVisibleDeepActions(input).includes("collocation"), false);
  }

  for (const input of [
    englishWordInput,
    vietnameseWordInput,
    ...unknownLanguageWordInputs,
    phraseInput,
  ]) {
    assert.equal(getVisibleDeepActions(input).includes("compare"), true);
    assert.deepEqual(
      getAvailableDeepActions(input),
      getVisibleDeepActions(input),
    );
  }

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
      action: "structure",
      selectedText: "  curious  ",
      surroundingParagraph: "  The curious fox paused.  ",
      sourceLanguage: "  EN  ",
    }),
    {
      action: "structure",
      selectedText: "curious",
      surroundingParagraph: "The curious fox paused.",
      sourceLanguage: "en",
      modelTier: "primary",
    },
  );

  assert.equal(
    deepActionRequestSchema.safeParse({
      action: "grammar",
      selectedText: "curious",
      surroundingParagraph: "The curious fox paused.",
      sourceLanguage: "en",
    }).success,
    false,
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
    structureDeepActionResponseSchema.safeParse({
      pattern: "Tính từ curious.",
      role: "Bổ ngữ cho chủ ngữ.",
      whyHere: "Mô tả trạng thái tò mò của chủ ngữ trong câu.",
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
    structureDeepActionResponseSchema,
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
  assert.equal(structureDeepActionResponseSchema.safeParse({}).success, false);
  assert.equal(
    structureDeepActionResponseSchema.safeParse({
      pattern: "had + past participle",
      role: "Past-perfect verb phrase",
      whyHere: "Marks an action completed before another past event.",
    }).success,
    true,
  );
  assert.equal(
    structureDeepActionResponseSchema.safeParse({
      pattern: "had + past participle",
      role: "Past-perfect verb phrase",
    }).success,
    false,
  );
  assert.equal(
    structureDeepActionResponseSchema.safeParse({
      pattern: "had + past participle",
      role: "Past-perfect verb phrase",
      whyHere: "Marks an earlier action.",
      pitfall: "Do not use it for unrelated past events.",
    }).success,
    true,
  );
  assert.equal(compareDeepActionResponseSchema.safeParse({}).success, false);
  assert.equal(
    easierExamplesDeepActionResponseSchema.safeParse({ examples: [] }).success,
    false,
  );
  assert.equal(
    structureDeepActionResponseSchema.safeParse({
      pattern: "p".repeat(120),
      role: "r".repeat(120),
      whyHere: "w".repeat(160),
      pitfall: "p".repeat(140),
    }).success,
    true,
  );
  assert.equal(
    structureDeepActionResponseSchema.safeParse({
      pattern: "p".repeat(121),
      role: "r",
      whyHere: "w",
    }).success,
    false,
  );
  assert.equal(
    structureDeepActionResponseSchema.safeParse({
      pattern: "p",
      role: "r".repeat(121),
      whyHere: "w",
    }).success,
    false,
  );
  assert.equal(
    structureDeepActionResponseSchema.safeParse({
      pattern: "p",
      role: "r",
      whyHere: "w".repeat(161),
    }).success,
    false,
  );
  assert.equal(
    structureDeepActionResponseSchema.safeParse({
      notApplicable: true,
      reason: "r".repeat(160),
    }).success,
    true,
  );
  assert.equal(
    structureDeepActionResponseSchema.safeParse({
      notApplicable: true,
      reason: "r".repeat(161),
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
    structureDeepActionGenerationSchema,
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
  const structureResult = structureDeepActionGenerationSchema.safeParse({
    pattern: "p".repeat(321),
    whyHere: "w".repeat(341),
    extra: "ignored",
  });

  assert.equal(structureResult.success, true);
  if (structureResult.success) {
    assert.equal(structureResult.data.pattern, "p".repeat(321));
    assert.equal("extra" in structureResult.data, false);
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
  const previousValues = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    GOOGLE_PRIMARY_MODEL_ID: process.env.GOOGLE_PRIMARY_MODEL_ID,
  };

  try {
    process.env.AI_PROVIDER = "google";
    delete process.env.GOOGLE_PRIMARY_MODEL_ID;

    assert.deepEqual(getDeepActionStreamSettings("structure"), {
      temperature: 0.2,
      maxOutputTokens: 300,
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
  } finally {
    restoreEnvironment(previousValues);
  }

  assert.equal(getDeepActionServerTimeoutMs("structure"), 22_000);
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
  assert.match(prompt, /grammaticalNote.*optional/i);
  assert.match(prompt, /at most one short sentence/i);
  assert.match(prompt, /180 characters/);
  assert.match(prompt, /translation and contextual meaning/i);
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

test("buildExplainPrompt bounds single-word pronunciation generation", () => {
  const prompt = buildExplainPrompt({
    selectedText: "curious",
    surroundingParagraph: "The curious fox watched the moonlit road.",
    sourceLanguage: "en",
  });

  assert.match(
    prompt,
    /Return exactly one short IPA or standard romanization transcription\./,
  );
  assert.match(prompt, /Keep pronunciation to a maximum of 64 characters\./);
  assert.match(prompt, /Never repeat characters or transcriptions\./);
  assert.match(prompt, /Omit pronunciation when uncertain\./);
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
  assert.doesNotMatch(prompt, /Grammatical breakdown/i);
  assert.doesNotMatch(prompt, /key structures, tenses, idioms/i);
  assert.match(prompt, /grammaticalNote.*optional/i);
  assert.match(prompt, /Cultural\/contextual note/);
  assert.match(
    prompt,
    /do not narrow the answer to a single word or sub-phrase/,
  );
  assert.doesNotMatch(
    prompt,
    /Return exactly one short IPA or standard romanization transcription\./,
  );
  assert.match(
    prompt,
    /Omit pronunciation, partOfSpeech, and difficultyHint unless the selected text is a single word\./,
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
    [buildStructurePrompt(input), "structure", "pattern", "whyHere"],
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
    if (action !== "structure") {
      assert.match(prompt, /Prefer an honest "notApplicable": true/);
    }

    for (const bannedPhrase of ["hy vọng", "chúc bạn", "cảm ơn", "cố gắng"]) {
      assert.ok(prompt.toLowerCase().includes(bannedPhrase));
    }
  }
});

test("Compare prompt requests a source-language confusable alternative", () => {
  const prompt = buildComparePrompt({
    selectedText: "foolhardy",
    surroundingParagraph:
      "Only a foolhardy rider would cross the flooded bridge at night.",
    sourceLanguage: "en",
  });

  assert.match(prompt, /Selected text: "foolhardy"/);
  assert.match(
    prompt,
    /alternative is exactly one source-language near-synonym or confusable word\/short phrase that a learner might mix up with the selected text/i,
  );
  assert.match(prompt, /alternative must stay in the source language/i);
  assert.match(prompt, /Never use alternative for a Vietnamese translation/i);
  assert.match(prompt, /Never use alternative for a simple antonym/i);
  assert.match(
    prompt,
    /contrast is a short Vietnamese explanation comparing the selected text and the alternative in this context/i,
  );
  assert.match(
    prompt,
    /tip is an optional short Vietnamese usage or choice tip/i,
  );
  assert.match(prompt, /When applicable, do not include reason/i);
  assert.match(
    prompt,
    /Use "notApplicable": true only when no plausible source-language confusable alternative exists/i,
  );
  assert.match(
    prompt,
    /Not applicable returns only "notApplicable": true and a short Vietnamese "reason"/i,
  );
  assert.match(
    prompt,
    /Do not include alternative, contrast, or tip in the not-applicable branch/i,
  );
});

test("Structure prompt requests only the fixed field map and hard limits", () => {
  const prompt = buildStructurePrompt({
    selectedText: "curious",
    surroundingParagraph: "The curious fox paused.",
    sourceLanguage: "en",
  });

  for (const [field, limit] of [
    ["pattern", 120],
    ["role", 120],
    ["whyHere", 160],
    ["pitfall", 140],
    ["reason", 160],
  ]) {
    assert.match(prompt, new RegExp(`${field}[^\\n]*${limit} characters`, "i"));
  }

  assert.match(prompt, /construction or form/i);
  assert.match(prompt, /grammatical role in this sentence/i);
  assert.match(prompt, /why.*used here/i);
  assert.match(prompt, /Do not paraphrase the primary meaning/i);
  assert.match(prompt, /dictionary-definition prose/i);
  assert.match(prompt, /filler/i);
  assert.match(prompt, /greetings/i);
  assert.match(prompt, /essays/i);
  assert.ok(prompt.includes("Trong ngữ cảnh này, X là danh từ chỉ…"));
});

test("Structure prompt treats simple forms and fixed phrases as applicable", () => {
  const prompt = buildStructurePrompt({
    selectedText: "etched into history",
    surroundingParagraph:
      "The rescue was etched into history as an act of rare courage.",
    sourceLanguage: "en",
  });

  assert.match(
    prompt,
    /Structure applies whenever the supplied context reveals a reliable construction, inflection\/form, modifier role, syntactic role, or fixed\/idiomatic construction/i,
  );
  assert.match(prompt, /A single word can still be applicable/i);
  assert.match(prompt, /An ordinary inflected form can still be applicable/i);
  assert.match(
    prompt,
    /A short or fixed\/idiomatic phrase can still be applicable/i,
  );
  assert.match(
    prompt,
    /MUST NOT return "notApplicable": true merely because the analysis is simple, ordinary, or not a complex grammar pattern/i,
  );
  assert.match(
    prompt,
    /Use "notApplicable": true only when no reliable construction, form, or grammatical role can be identified from the supplied context/i,
  );
  assert.match(
    prompt,
    /Applicable results require pattern, role, and whyHere/i,
  );
  assert.match(
    prompt,
    /Do not invent analysis when the context is genuinely insufficient/i,
  );
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

test("normalizeExplanationPayload omits invalid optional Form tips without clipping", () => {
  const normalized = normalizeExplanationPayload(
    {
      translation: "to mo",
      explanation: "mo ta dieu gi do rat muon tim hieu",
      grammaticalNote: "x".repeat(181),
      examples: [],
    },
    "curious",
  );

  assert.equal(normalized.grammaticalNote, undefined);
  assert.equal(normalized.translation, "to mo");
  assert.equal(normalized.explanation, "mo ta dieu gi do rat muon tim hieu");
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
