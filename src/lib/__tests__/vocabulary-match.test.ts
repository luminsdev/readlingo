import { describe, expect, it } from "vitest";

import {
  getVocabularyReencounterCue,
  normalizeVocabularyWord,
  wordsMatchNormalized,
} from "@/lib/vocabulary-match";

describe("Vocabulary Matching", () => {
  it("normalizes casing and whitespace without changing word content", () => {
    expect(normalizeVocabularyWord("  Hello   World ")).toBe("hello world");
    expect(normalizeVocabularyWord("École")).toBe("école");
  });

  it("treats whitespace-only values as empty", () => {
    expect(normalizeVocabularyWord(" \t\n ")).toBe("");
  });

  it("matches only non-empty normalized exact words", () => {
    expect(wordsMatchNormalized("  Hello   World ", "hello world")).toBe(true);
    expect(wordsMatchNormalized("HELLO", "hello")).toBe(true);
    expect(wordsMatchNormalized("", "   ")).toBe(false);
    expect(wordsMatchNormalized("reader", "reading")).toBe(false);
    expect(wordsMatchNormalized("resume", "résumé")).toBe(false);
  });

  it("omits re-encounter cues without SRS data", () => {
    expect(getVocabularyReencounterCue({ srsData: null })).toBeNull();
  });

  it("prioritizes due over the interval-derived status", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");

    expect(
      getVocabularyReencounterCue({
        srsData: {
          interval: 30,
          nextReviewAt: "2026-07-17T12:00:00.000Z",
        },
        now,
      }),
    ).toBe("due");
  });

  it("maps future SRS data to learning or mastered", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const nextReviewAt = new Date("2026-07-18T12:00:00.000Z");

    expect(
      getVocabularyReencounterCue({
        srsData: { interval: 7, nextReviewAt },
        now,
      }),
    ).toBe("learning");
    expect(
      getVocabularyReencounterCue({
        srsData: { interval: 21, nextReviewAt },
        now,
      }),
    ).toBe("mastered");
  });
});
