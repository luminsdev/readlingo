import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExplainPrompt,
  getExplainModelTarget,
  isSingleWordSelection,
  normalizeExplanationPayload,
} from "../src/lib/ai.ts";
import { explainSelectionSchema } from "../src/lib/ai-validation.ts";

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
  assert.match(
    prompt,
    /do not narrow the answer to a single word or sub-phrase/,
  );
});

test("normalizeExplanationPayload trims examples and only keeps part of speech for single words", () => {
  assert.deepEqual(
    normalizeExplanationPayload(
      {
        translation: "to mo",
        partOfSpeech: "adjective",
        explanation: "mo ta dieu gi do rat muon tim hieu",
        examples: [
          "  The curious fox paused.  ",
          "",
          "Curious minds learn fast.",
        ],
      },
      "curious",
    ),
    {
      translation: "to mo",
      partOfSpeech: "adjective",
      explanation: "mo ta dieu gi do rat muon tim hieu",
      examples: ["The curious fox paused.", "Curious minds learn fast."],
    },
  );

  assert.deepEqual(
    normalizeExplanationPayload(
      {
        translation: "toi rat muon hieu",
        partOfSpeech: "phrase",
        explanation: "dien ta mong muon biet ro hon",
        examples: ["I am curious about the ending."],
      },
      "I am curious",
    ),
    {
      translation: "toi rat muon hieu",
      explanation: "dien ta mong muon biet ro hon",
      examples: ["I am curious about the ending."],
    },
  );
});

test("isSingleWordSelection distinguishes words from phrases", () => {
  assert.equal(isSingleWordSelection("curious"), true);
  assert.equal(isSingleWordSelection("moon-lit"), true);
  assert.equal(isSingleWordSelection("curious fox"), false);
});
