import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStreamingExplanationPayload,
  parseReadyStreamingExplanation,
} from "../src/lib/ai-streaming.ts";
import { getReaderAiStreamingCursorTarget } from "../src/components/reader/reader-ai-panel-utils.ts";

test("buildStreamingExplanationPayload maps partial word fields for progressive rendering", () => {
  assert.deepEqual(
    buildStreamingExplanationPayload(
      {
        translation: "to mo",
        explanation: "dien ta su muon tim hieu",
        pronunciation: "/kjur/",
        partOfSpeech: "adjective",
        difficultyHint: "intermediate",
        examples: [
          {
            sentence: "The curious fox paused.",
          },
        ],
      },
      "curious",
    ),
    {
      selectionType: "word",
      translation: "to mo",
      explanation: "dien ta su muon tim hieu",
      pronunciation: "/kjur/",
      partOfSpeech: "adjective",
      difficultyHint: "intermediate",
      examples: [
        {
          sentence: "The curious fox paused.",
        },
      ],
    },
  );
});

test("buildStreamingExplanationPayload omits word-only fields for phrase selections", () => {
  assert.deepEqual(
    buildStreamingExplanationPayload(
      {
        translation: "toi rat muon hieu",
        explanation: "dien ta mong muon biet ro hon",
        pronunciation: "/ignored/",
        partOfSpeech: "phrase",
        difficultyHint: "advanced",
        grammaticalNote: "thi hien mong muon tim hieu them",
      },
      "I am curious",
    ),
    {
      selectionType: "phrase",
      translation: "toi rat muon hieu",
      explanation: "dien ta mong muon biet ro hon",
      grammaticalNote: "thi hien mong muon tim hieu them",
    },
  );
});

test("buildStreamingExplanationPayload returns null when no stream content exists yet", () => {
  assert.equal(buildStreamingExplanationPayload({}, "curious"), null);
});

test("parseReadyStreamingExplanation blocks vocabulary actions until ready state", () => {
  const explanation = {
    selectionType: "word",
    translation: "to mo",
    explanation: "dien ta su muon tim hieu",
    examples: [
      {
        sentence: "The curious fox paused.",
        translation: "Con cao to mo dung lai.",
      },
    ],
  };

  assert.equal(parseReadyStreamingExplanation(explanation, "loading"), null);
  assert.deepEqual(
    parseReadyStreamingExplanation(explanation, "ready"),
    explanation,
  );
});

test("getReaderAiStreamingCursorTarget points at the latest visible streaming section", () => {
  assert.equal(
    getReaderAiStreamingCursorTarget({
      selectionType: "word",
      translation: "to mo",
    }),
    "translation",
  );

  assert.equal(
    getReaderAiStreamingCursorTarget({
      selectionType: "word",
      translation: "to mo",
      explanation: "dien ta su muon tim hieu",
    }),
    "explanation",
  );

  assert.equal(
    getReaderAiStreamingCursorTarget({
      selectionType: "word",
      translation: "to mo",
      explanation: "dien ta su muon tim hieu",
      examples: [
        {
          sentence: "The curious fox paused.",
        },
      ],
    }),
    "example-sentence-0",
  );

  assert.equal(
    getReaderAiStreamingCursorTarget({
      selectionType: "word",
      translation: "to mo",
      explanation: "dien ta su muon tim hieu",
      examples: [
        {
          sentence: "The curious fox paused.",
          translation: "Con cao to mo dung lai.",
        },
      ],
    }),
    "example-translation-0",
  );
});
