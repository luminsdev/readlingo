import { parsePartialJson } from "ai";
import { describe, expect, it } from "vitest";

import {
  buildDeepActionErrorState,
  buildStreamingDeepActionResult,
  normalizeDeepActionResult,
  parseCompletedDeepActionResult,
  parseReadyDeepActionResult,
} from "@/lib/ai-deep-action-streaming";

describe("deep-action streaming helpers", () => {
  it("preserves the last partial result when a request terminally errors", () => {
    const partialResult = {
      lemma: "lead",
      forms: [{ label: "past" }],
    };

    expect(
      buildDeepActionErrorState(
        {
          status: "loading",
          result: partialResult,
          errorMessage: null,
        },
        "AI follow-up timed out.",
      ),
    ).toEqual({
      status: "error",
      result: partialResult,
      errorMessage: "AI follow-up timed out.",
    });
  });

  it("normalizes a partial grammar result without requiring final fields", () => {
    expect(
      buildStreamingDeepActionResult("grammar", {
        summary: "  Past perfect in context  ",
        points: ["  had + participle  ", "", null],
      }),
    ).toEqual({
      summary: "Past perfect in context",
      points: ["had + participle"],
    });
  });

  it("clamps partial grammar text to the final schema limits", () => {
    expect(
      buildStreamingDeepActionResult("grammar", {
        summary: `  ${"s".repeat(321)}  `,
        points: [`  ${"p".repeat(141)}  `],
        notApplicable: true,
        reason: `  ${"r".repeat(201)}  `,
      }),
    ).toEqual({
      summary: "s".repeat(320),
      points: ["p".repeat(140)],
      notApplicable: true,
      reason: "r".repeat(200),
    });
  });

  it("keeps a partially streamed easier example renderable", () => {
    expect(
      buildStreamingDeepActionResult("easierExamples", {
        examples: [
          { sentence: "  I had already left.  " },
          { sentence: "", translation: "  Tôi đã rời đi.  " },
        ],
      }),
    ).toEqual({
      examples: [
        { sentence: "I had already left." },
        { translation: "Tôi đã rời đi." },
      ],
    });
  });

  it("normalizes partially streamed conjugation forms", () => {
    expect(
      buildStreamingDeepActionResult("conjugation", {
        lemma: "  be  ",
        forms: [
          { label: "  present  ", value: "  am / is / are  " },
          { label: "  past  " },
          { label: "", value: "" },
        ],
        note: "  Irregular verb.  ",
      }),
    ).toEqual({
      lemma: "be",
      forms: [{ label: "present", value: "am / is / are" }, { label: "past" }],
      note: "Irregular verb.",
    });
  });

  it("normalizes partially streamed collocations", () => {
    expect(
      buildStreamingDeepActionResult("collocation", {
        items: [
          {
            phrase: "  deeply curious  ",
            translation: "  vô cùng tò mò  ",
          },
          { phrase: "  curious about  " },
          { phrase: "", translation: "" },
        ],
      }),
    ).toEqual({
      items: [
        {
          phrase: "deeply curious",
          translation: "vô cùng tò mò",
        },
        { phrase: "curious about" },
      ],
    });
  });

  it("validates final results with the schema for the requested action", () => {
    expect(
      parseReadyDeepActionResult("grammar", {
        summary: "Past perfect marks earlier action.",
      }),
    ).toEqual({
      summary: "Past perfect marks earlier action.",
    });
    expect(
      parseReadyDeepActionResult("grammar", {
        points: ["Use had + past participle."],
      }),
    ).toEqual({
      points: ["Use had + past participle."],
    });
    expect(
      parseReadyDeepActionResult("compare", {
        alternative: "I left before she arrived.",
        contrast: "This states the order directly.",
        tip: "Use this when the sequence matters more than the tense.",
      }),
    ).toEqual({
      alternative: "I left before she arrived.",
      contrast: "This states the order directly.",
      tip: "Use this when the sequence matters more than the tense.",
    });

    expect(
      parseReadyDeepActionResult("compare", {
        alternative: "I left before she arrived.",
      }),
    ).toBeNull();

    expect(
      parseReadyDeepActionResult("conjugation", {
        lemma: "be",
        forms: [{ label: "past", value: "was / were" }],
      }),
    ).toEqual({
      lemma: "be",
      forms: [{ label: "past", value: "was / were" }],
    });
    expect(
      parseReadyDeepActionResult("conjugation", { lemma: "be" }),
    ).toBeNull();

    expect(
      parseReadyDeepActionResult("collocation", {
        items: [
          {
            phrase: "deeply curious",
            translation: "vô cùng tò mò",
          },
        ],
      }),
    ).toEqual({
      items: [
        {
          phrase: "deeply curious",
          translation: "vô cùng tò mò",
        },
      ],
    });
    expect(parseReadyDeepActionResult("collocation", { items: [] })).toBeNull();
  });

  it("accepts an honest not-applicable result and rejects one without a reason", () => {
    expect(
      buildStreamingDeepActionResult("collocation", {
        notApplicable: true,
      }),
    ).toBeNull();

    expect(
      buildStreamingDeepActionResult("collocation", {
        notApplicable: true,
        reason: "  The selection has no natural collocations.  ",
      }),
    ).toEqual({
      notApplicable: true,
      reason: "The selection has no natural collocations.",
    });

    expect(
      parseReadyDeepActionResult("grammar", {
        notApplicable: true,
        reason: "The selection is a proper name.",
      }),
    ).toEqual({
      notApplicable: true,
      reason: "The selection is a proper name.",
    });

    expect(
      parseReadyDeepActionResult("grammar", {
        notApplicable: true,
      }),
    ).toBeNull();
  });

  it("clamps over-long grammar content during finalization", () => {
    expect(
      normalizeDeepActionResult("grammar", {
        summary: `  ${"s".repeat(321)}  `,
        points: [`  ${"p".repeat(141)}  `],
      }),
    ).toEqual({
      summary: "s".repeat(320),
      points: ["p".repeat(140)],
    });
  });

  it("strips unknown grammar fields during finalization", () => {
    expect(
      normalizeDeepActionResult("grammar", {
        summary: "Past perfect marks an earlier completed action.",
        explanation: "This extra model field is not part of the domain result.",
      }),
    ).toEqual({
      summary: "Past perfect marks an earlier completed action.",
    });
  });

  it("converts lemma-only conjugation into an honest not-applicable result", () => {
    expect(
      normalizeDeepActionResult("conjugation", { lemma: "leading" }),
    ).toEqual({
      notApplicable: true,
      reason:
        "Kh\u00f4ng c\u00f3 d\u1ea1ng chia h\u1eefu \u00edch cho l\u1ef1a ch\u1ecdn n\u00e0y.",
    });
  });

  it("converts empty conjugation output into an honest not-applicable result", () => {
    expect(normalizeDeepActionResult("conjugation", {})).toEqual({
      notApplicable: true,
      reason:
        "Kh\u00f4ng c\u00f3 d\u1ea1ng chia h\u1eefu \u00edch cho l\u1ef1a ch\u1ecdn n\u00e0y.",
    });
    expect(normalizeDeepActionResult("conjugation", { forms: [] })).toEqual({
      notApplicable: true,
      reason:
        "Kh\u00f4ng c\u00f3 d\u1ea1ng chia h\u1eefu \u00edch cho l\u1ef1a ch\u1ecdn n\u00e0y.",
    });
  });

  it("drops incomplete conjugation forms during finalization", () => {
    expect(
      normalizeDeepActionResult("conjugation", {
        lemma: "lead",
        forms: [
          { label: "present participle" },
          { value: "led" },
          { label: "past", value: "led" },
        ],
      }),
    ).toEqual({
      lemma: "lead",
      forms: [{ label: "past", value: "led" }],
    });
  });

  it("drops incomplete rows before applying final collection limits", () => {
    expect(
      normalizeDeepActionResult("easierExamples", {
        examples: [
          { sentence: "Incomplete" },
          { sentence: "Still incomplete" },
          { sentence: "Complete", translation: "Ho\u00e0n ch\u1ec9nh" },
        ],
      }),
    ).toEqual({
      examples: [{ sentence: "Complete", translation: "Ho\u00e0n ch\u1ec9nh" }],
    });
    expect(
      normalizeDeepActionResult("conjugation", {
        forms: [
          ...Array.from({ length: 8 }, (_, index) => ({
            label: `incomplete ${index}`,
          })),
          { label: "past", value: "led" },
        ],
      }),
    ).toEqual({
      forms: [{ label: "past", value: "led" }],
    });
    expect(
      normalizeDeepActionResult("collocation", {
        items: [
          ...Array.from({ length: 5 }, (_, index) => ({
            phrase: `incomplete ${index}`,
          })),
          { phrase: "take the lead", translation: "d\u1eabn \u0111\u1ea7u" },
        ],
      }),
    ).toEqual({
      items: [
        { phrase: "take the lead", translation: "d\u1eabn \u0111\u1ea7u" },
      ],
    });
  });

  it("rejects repaired JSON when completing a deep-action stream", async () => {
    const completeResult = await parsePartialJson(
      '{"summary":"Past perfect","points":["had + participle"]}\n  ',
    );
    const truncatedResult = await parsePartialJson(
      '{"summary":"Past perfect","points":["had + participle"]',
    );

    expect(parseCompletedDeepActionResult("grammar", completeResult)).toEqual({
      summary: "Past perfect",
      points: ["had + participle"],
    });
    expect(
      parseCompletedDeepActionResult("grammar", truncatedResult),
    ).toBeNull();
  });
});
