import { streamObject } from "ai";

import { getAiStreamObjectOptions, isSingleWordSelection } from "./ai.ts";
import { getAiResponseLocaleInstruction } from "./ai-locale.ts";
import {
  collocationDeepActionGenerationSchema,
  compareDeepActionGenerationSchema,
  conjugationDeepActionGenerationSchema,
  easierExamplesDeepActionGenerationSchema,
  GRAMMAR_POINT_MAX_LENGTH,
  GRAMMAR_REASON_MAX_LENGTH,
  GRAMMAR_SUMMARY_MAX_LENGTH,
  grammarDeepActionGenerationSchema,
  type DeepAction,
  type DeepActionRequest,
} from "./ai-validation.ts";

const MVP_DEEP_ACTIONS = [
  "grammar",
  "compare",
  "easierExamples",
] as const satisfies readonly DeepAction[];

const MORPHOLOGY_LANGUAGE_CODES = new Set([
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
]);

export type DeepActionAvailabilityInput = {
  selectedText: string;
  sourceLanguage?: string;
};

type DeepActionPromptInput = Pick<
  DeepActionRequest,
  "selectedText" | "surroundingParagraph" | "sourceLanguage"
>;

type DeepActionStreamCallbacks = {
  onError?: (event: { error: unknown }) => void | Promise<void>;
  onFinish?: (event: { error?: unknown }) => void | Promise<void>;
};

function isMorphologyRelevantLanguage(sourceLanguage?: string) {
  const languageCode = sourceLanguage?.trim().toLowerCase().split("-")[0];

  return languageCode ? MORPHOLOGY_LANGUAGE_CODES.has(languageCode) : false;
}

export function getEligibleDeepActions({
  selectedText,
  sourceLanguage,
}: DeepActionAvailabilityInput): DeepAction[] {
  if (!selectedText.trim()) {
    return [];
  }

  const actions: DeepAction[] = [...MVP_DEEP_ACTIONS];

  if (isSingleWordSelection(selectedText)) {
    if (isMorphologyRelevantLanguage(sourceLanguage)) {
      actions.push("conjugation");
    }

    actions.push("collocation");
  }

  return actions;
}

export function getVisibleDeepActions(
  input: DeepActionAvailabilityInput,
): DeepAction[] {
  const eligibleActions = getEligibleDeepActions(input);

  if (!isSingleWordSelection(input.selectedText)) {
    return eligibleActions;
  }

  return [
    "grammar",
    "easierExamples",
    eligibleActions.includes("conjugation")
      ? "conjugation"
      : eligibleActions.includes("collocation")
        ? "collocation"
        : "compare",
  ];
}

export function getAvailableDeepActions(
  input: DeepActionAvailabilityInput,
): DeepAction[] {
  return getVisibleDeepActions(input);
}

function buildPrompt(
  action: DeepAction,
  input: DeepActionPromptInput,
  schemaDescription: string,
  extraGuidance = "",
) {
  return `System: You are a language learning assistant.
${getAiResponseLocaleInstruction()}
Use learner-facing content in Vietnamese.
Use short structured fields only.
Do not write essays or multi-paragraph answers.
Do not include greetings, sign-offs, thanks, wishes, or encouragement.
Never use phrases such as "hy vọng", "chúc bạn", "cảm ơn", or "cố gắng".
Do not include self-referential assistant chatter.
Do not use chat or multi-turn memory.

User:
Action: ${action}
Source language: ${input.sourceLanguage}
Selected text: "${input.selectedText}"
Context: "${input.surroundingParagraph}"

Return only valid JSON matching this action schema:
${schemaDescription}
${extraGuidance}
Prefer an honest "notApplicable": true with a short Vietnamese "reason" over inventing content.
If the action does not apply, you MUST set "notApplicable": true and provide a non-empty "reason".
When the action applies, set "notApplicable": false or omit it, and include the required content fields.
Do not return an empty object.`;
}

export function buildGrammarPrompt(input: DeepActionPromptInput) {
  return buildPrompt(
    "grammar",
    input,
    `{"summary"?: string (max ${GRAMMAR_SUMMARY_MAX_LENGTH} characters), "points"?: string[1-5] (each max ${GRAMMAR_POINT_MAX_LENGTH} characters), "notApplicable"?: boolean, "reason"?: string (max ${GRAMMAR_REASON_MAX_LENGTH} characters)}`,
    [
      "When applicable, provide either a non-empty summary, or 1-5 non-empty points, or both.",
      "Prefer 1 short summary sentence and up to 3 short points.",
      `Hard limits: summary max ${GRAMMAR_SUMMARY_MAX_LENGTH} characters; each point max ${GRAMMAR_POINT_MAX_LENGTH} characters; reason max ${GRAMMAR_REASON_MAX_LENGTH} characters.`,
      'Never add greetings, sign-offs, wishes, or polite filler loops; forbidden openers include "Chúc bạn", "Cảm ơn", and "Hy vọng".',
    ].join(" "),
  );
}

export function buildComparePrompt(input: DeepActionPromptInput) {
  return buildPrompt(
    "compare",
    input,
    '{"alternative": string, "contrast": string, "tip"?: string, "notApplicable"?: boolean, "reason"?: string}',
  );
}

export function buildEasierExamplesPrompt(input: DeepActionPromptInput) {
  return buildPrompt(
    "easierExamples",
    input,
    '{"examples": [{"sentence": string, "translation": string}][1-2], "note"?: string, "notApplicable"?: boolean, "reason"?: string}',
  );
}

export function buildConjugationPrompt(input: DeepActionPromptInput) {
  return buildPrompt(
    "conjugation",
    input,
    '{"lemma"?: string, "forms": [{"label": string, "value": string}][1-8], "note"?: string, "notApplicable"?: boolean, "reason"?: string}',
    [
      "First decide whether the selected word has useful morphology in this context.",
      'If the selected token does not inflect in the source language or this context (for example, it is a non-inflecting adjective, adverb, proper noun, article, preposition, conjunction, pronoun, or other non-inflecting token), you MUST return "notApplicable": true with a short Vietnamese "reason".',
      "Only return forms for useful morphology of the selected word.",
      "Prefer at most 6 forms even though the schema allows 8.",
      'If useful morphology cannot be completed compactly, return "notApplicable": true with a short Vietnamese "reason".',
      "Never emit incomplete forms; every form must include both a non-empty label and value.",
      "Keep labels, values, and notes short; do not write paragraph notes.",
      "Never invent a full conjugation table for a word that does not conjugate.",
    ].join(" "),
  );
}

export function buildCollocationPrompt(input: DeepActionPromptInput) {
  return buildPrompt(
    "collocation",
    input,
    '{"items": [{"phrase": string, "translation": string, "note"?: string}][1-5], "notApplicable"?: boolean, "reason"?: string}',
  );
}

export function buildDeepActionPrompt(input: DeepActionRequest) {
  switch (input.action) {
    case "grammar":
      return buildGrammarPrompt(input);
    case "compare":
      return buildComparePrompt(input);
    case "easierExamples":
      return buildEasierExamplesPrompt(input);
    case "conjugation":
      return buildConjugationPrompt(input);
    case "collocation":
      return buildCollocationPrompt(input);
  }
}

function getDeepActionDefinition(action: DeepAction) {
  switch (action) {
    case "grammar":
      return {
        schema: grammarDeepActionGenerationSchema,
        schemaName: "readlingo_deep_action_grammar",
        schemaDescription:
          "A concise Vietnamese grammar explanation for selected book text.",
      };
    case "compare":
      return {
        schema: compareDeepActionGenerationSchema,
        schemaName: "readlingo_deep_action_compare",
        schemaDescription:
          "A concise Vietnamese comparison with an alternative expression.",
      };
    case "easierExamples":
      return {
        schema: easierExamplesDeepActionGenerationSchema,
        schemaName: "readlingo_deep_action_easier_examples",
        schemaDescription:
          "One or two easier bilingual examples for selected book text.",
      };
    case "conjugation":
      return {
        schema: conjugationDeepActionGenerationSchema,
        schemaName: "readlingo_deep_action_conjugation",
        schemaDescription:
          "Useful forms or conjugations for a selected single word.",
      };
    case "collocation":
      return {
        schema: collocationDeepActionGenerationSchema,
        schemaName: "readlingo_deep_action_collocation",
        schemaDescription:
          "Common natural collocations for a selected single word.",
      };
  }
}

export function streamDeepAction(
  input: DeepActionRequest,
  callbacks: DeepActionStreamCallbacks = {},
) {
  const definition = getDeepActionDefinition(input.action);

  return streamObject({
    ...getAiStreamObjectOptions(input.modelTier),
    prompt: buildDeepActionPrompt(input),
    schema: definition.schema,
    schemaName: definition.schemaName,
    schemaDescription: definition.schemaDescription,
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(20_000),
    onError: callbacks.onError,
    onFinish: callbacks.onFinish,
  });
}
