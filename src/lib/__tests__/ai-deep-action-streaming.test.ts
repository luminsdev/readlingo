import { parsePartialJson } from "ai";
import { describe, expect, it } from "vitest";

import {
  buildDeepActionErrorState,
  buildStreamingDeepActionResult,
  normalizeDeepActionResult,
  parseCompletedDeepActionResult,
  parseReadyDeepActionResult,
} from "@/lib/ai-deep-action-streaming";
import type { DeepAction } from "@/lib/ai-validation";

const structureAction = "structure" satisfies DeepAction;

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

  it("normalizes partial Structure fields without requiring the final set", () => {
    expect(
      buildStreamingDeepActionResult(structureAction, {
        pattern: "  had   + past participle  ",
        role: "  Verb phrase  ",
      }),
    ).toEqual({
      pattern: "had + past participle",
      role: "Verb phrase",
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
        result: {
          type: "forms",
          lemma: "  be  ",
          forms: [
            { label: "  present  ", value: "  am / is / are  " },
            { label: "  past  " },
            { label: "", value: "" },
          ],
          note: "  Irregular verb.  ",
        },
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
      parseReadyDeepActionResult(structureAction, {
        pattern: "had + past participle",
        role: "Past-perfect verb phrase",
        whyHere: "It places one completed event before another past event.",
        pitfall: "Do not use it when the past order is already unambiguous.",
      }),
    ).toEqual({
      pattern: "had + past participle",
      role: "Past-perfect verb phrase",
      whyHere: "It places one completed event before another past event.",
      pitfall: "Do not use it when the past order is already unambiguous.",
    });
    expect(
      parseReadyDeepActionResult(structureAction, {
        pattern: "had + past participle",
        role: "Past-perfect verb phrase",
      }),
    ).toBeNull();
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
      parseReadyDeepActionResult(structureAction, {
        notApplicable: true,
        reason: "The selection is a proper name.",
      }),
    ).toEqual({
      notApplicable: true,
      reason: "The selection is a proper name.",
    });

    expect(
      parseReadyDeepActionResult(structureAction, {
        notApplicable: true,
      }),
    ).toBeNull();
  });

  it("rejects incomplete over-budget required Structure fields without ellipsis", () => {
    expect(
      normalizeDeepActionResult(structureAction, {
        pattern: "word ".repeat(30),
        role: "Past-perfect verb phrase",
        whyHere: "It places one completed event before another past event.",
      }),
    ).toBeNull();
  });

  it("keeps exclusive applicable and not-applicable Structure results", () => {
    expect(
      normalizeDeepActionResult(structureAction, {
        notApplicable: true,
        reason: "The selection is a proper name.",
      }),
    ).toEqual({
      notApplicable: true,
      reason: "The selection is a proper name.",
    });

    expect(
      normalizeDeepActionResult(structureAction, {
        pattern: "adjective + noun",
        role: "Attributive adjective",
        whyHere: "It describes the fox directly.",
        notApplicable: false,
      }),
    ).toEqual({
      pattern: "adjective + noun",
      role: "Attributive adjective",
      whyHere: "It describes the fox directly.",
    });
  });

  it("rejects mixed final Structure states by own-property presence", () => {
    for (const field of ["pattern", "role", "whyHere", "pitfall"]) {
      expect(
        normalizeDeepActionResult(structureAction, {
          notApplicable: true,
          reason: "The selection is a proper name.",
          [field]: "",
        }),
      ).toBeNull();
    }

    expect(
      normalizeDeepActionResult(structureAction, {
        pattern: "adjective + noun",
        role: "Attributive adjective",
        whyHere: "It describes the fox directly.",
        reason: "This field belongs only to not-applicable results.",
      }),
    ).toBeNull();
  });

  it("rejects malformed applicable Structure discriminators", () => {
    for (const notApplicable of [null, "false", 0]) {
      expect(
        normalizeDeepActionResult(structureAction, {
          pattern: "adjective + noun",
          role: "Attributive adjective",
          whyHere: "It describes the fox directly.",
          notApplicable,
        }),
      ).toBeNull();
    }
  });

  it("normalizes Structure from the original payload and strips unknown fields", () => {
    expect(
      normalizeDeepActionResult(structureAction, {
        pattern: "  had   + past participle  ",
        role: "  Past-perfect   verb phrase  ",
        whyHere: "  It places one completed event before another.  ",
        explanation: "This extra model field is not part of the domain result.",
      }),
    ).toEqual({
      pattern: "had + past participle",
      role: "Past-perfect verb phrase",
      whyHere: "It places one completed event before another.",
    });
  });

  it("rejects punctuation-only required Structure fields", () => {
    expect(
      normalizeDeepActionResult(structureAction, {
        pattern: `. ${"x".repeat(130)}`,
        role: "Past-perfect verb phrase",
        whyHere: "It places one completed event before another past event.",
      }),
    ).toBeNull();
  });

  it("rejects a punctuation-only not-applicable reason", () => {
    expect(
      normalizeDeepActionResult(structureAction, {
        notApplicable: true,
        reason: `. ${"x".repeat(170)}`,
      }),
    ).toBeNull();
  });

  it("omits a punctuation-only optional Structure pitfall", () => {
    expect(
      normalizeDeepActionResult(structureAction, {
        pattern: "had + past participle",
        role: "Past-perfect verb phrase",
        whyHere: "It places one completed event before another past event.",
        pitfall: `. ${"x".repeat(150)}`,
      }),
    ).toEqual({
      pattern: "had + past participle",
      role: "Past-perfect verb phrase",
      whyHere: "It places one completed event before another past event.",
    });
  });

  it("omits an unsafe optional Structure pitfall", () => {
    expect(
      normalizeDeepActionResult(structureAction, {
        pattern: "had + past participle",
        role: "Past-perfect verb phrase",
        whyHere: "It places one completed event before another past event.",
        pitfall: "unfinished ".repeat(20),
      }),
    ).toEqual({
      pattern: "had + past participle",
      role: "Past-perfect verb phrase",
      whyHere: "It places one completed event before another past event.",
    });
  });

  it("retains a complete bounded Structure segment from over-budget output", () => {
    expect(
      normalizeDeepActionResult(structureAction, {
        pattern: `Uses had + past participle. ${"unfinished ".repeat(15)}`,
        role: "Past-perfect verb phrase",
        whyHere: "It places one completed event before another past event.",
      }),
    ).toEqual({
      pattern: "Uses had + past participle.",
      role: "Past-perfect verb phrase",
      whyHere: "It places one completed event before another past event.",
    });
  });

  it("retains meaningful non-ASCII Structure text at a real boundary", () => {
    expect(
      normalizeDeepActionResult(structureAction, {
        pattern: `Mẫu câu tiếng Việt. ${"dở dang ".repeat(20)}`,
        role: "Cụm động từ",
        whyHere: "Diễn tả một hành động đã hoàn tất trước hành động khác.",
      }),
    ).toEqual({
      pattern: "Mẫu câu tiếng Việt.",
      role: "Cụm động từ",
      whyHere: "Diễn tả một hành động đã hoàn tất trước hành động khác.",
    });
  });

  it("normalizes complete conjugation forms into a ready result", () => {
    expect(
      normalizeDeepActionResult("conjugation", {
        result: {
          type: "forms",
          lemma: "lead",
          forms: [
            { label: "base", value: "lead" },
            { label: "past", value: "led" },
          ],
          note: "Irregular verb.",
        },
      }),
    ).toEqual({
      lemma: "lead",
      forms: [
        { label: "base", value: "lead" },
        { label: "past", value: "led" },
      ],
      note: "Irregular verb.",
    });
  });

  it("normalizes explicit conjugation not-applicable output", () => {
    expect(
      normalizeDeepActionResult("conjugation", {
        result: {
          type: "notApplicable",
          notApplicable: true,
          reason: "Từ này không biến đổi hình thái trong ngữ cảnh này.",
        },
      }),
    ).toEqual({
      notApplicable: true,
      reason: "Từ này không biến đổi hình thái trong ngữ cảnh này.",
    });
  });

  it("rejects empty, lemma-only, and unusable conjugation output", () => {
    expect(normalizeDeepActionResult("conjugation", null)).toBeNull();
    expect(normalizeDeepActionResult("conjugation", {})).toBeNull();
    expect(
      normalizeDeepActionResult("conjugation", { lemma: "leading" }),
    ).toBeNull();
    expect(normalizeDeepActionResult("conjugation", { forms: [] })).toBeNull();
    expect(
      normalizeDeepActionResult("conjugation", {
        lemma: "lead",
        forms: [{ label: "past" }, { value: "led" }],
      }),
    ).toBeNull();
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

  it("accepts repaired Structure JSON only with complete required fields", async () => {
    const completeResult = await parsePartialJson(
      '{"pattern":"had + participle","role":"verb phrase","whyHere":"marks earlier action"}\n  ',
    );
    const truncatedResult = await parsePartialJson(
      '{"pattern":"had + participle","role":"verb phrase","whyHere":"marks earlier action"',
    );

    expect(
      parseCompletedDeepActionResult(structureAction, completeResult),
    ).toEqual({
      pattern: "had + participle",
      role: "verb phrase",
      whyHere: "marks earlier action",
    });
    expect(
      parseCompletedDeepActionResult(structureAction, truncatedResult),
    ).toBeNull();
  });

  it("rejects repaired conjugation JSON during finalization", async () => {
    const truncatedResult = await parsePartialJson(
      '{"result":{"type":"forms","lemma":"lead","forms":[{"label":"past","value":"le',
    );

    expect(truncatedResult.state).toBe("repaired-parse");
    expect(
      parseCompletedDeepActionResult("conjugation", truncatedResult),
    ).toBeNull();
  });
});
