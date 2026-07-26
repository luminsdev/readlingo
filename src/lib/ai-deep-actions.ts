import { streamObject } from "ai";

import { getAiStreamObjectOptions, isSingleWordSelection } from "./ai.ts";
import { getAiResponseLocaleInstruction } from "./ai-locale.ts";
import {
  collocationDeepActionGenerationSchema,
  compareDeepActionGenerationSchema,
  conjugationDeepActionGenerationSchema,
  CONJUGATION_FORM_FIELD_MAX_LENGTH,
  CONJUGATION_FORMS_MAX_COUNT,
  CONJUGATION_NOTE_MAX_LENGTH,
  CONJUGATION_REASON_MAX_LENGTH,
  easierExamplesDeepActionGenerationSchema,
  STRUCTURE_PATTERN_MAX_LENGTH,
  STRUCTURE_PITFALL_MAX_LENGTH,
  STRUCTURE_REASON_MAX_LENGTH,
  STRUCTURE_ROLE_MAX_LENGTH,
  STRUCTURE_WHY_HERE_MAX_LENGTH,
  structureDeepActionGenerationSchema,
  type DeepAction,
  type DeepActionRequest,
} from "./ai-validation.ts";

const MVP_DEEP_ACTIONS = [
  "structure",
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
  abortSignal?: AbortSignal;
  onError?: (event: { error: unknown }) => void | Promise<void>;
  onFinish?: (event: { error?: unknown }) => void | Promise<void>;
};

const DEFAULT_APPLICABILITY_GUIDANCE = `Prefer an honest "notApplicable": true with a short Vietnamese "reason" over inventing content.
If the action does not apply, you MUST set "notApplicable": true and provide a non-empty "reason".
When the action applies, set "notApplicable": false or omit it, and include the required content fields.`;

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
  const visibleActions: readonly DeepAction[] =
    isSingleWordSelection(input.selectedText) &&
    eligibleActions.includes("conjugation")
      ? ["structure", "compare", "conjugation"]
      : MVP_DEEP_ACTIONS;

  return visibleActions.filter((action) => eligibleActions.includes(action));
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
  applicabilityGuidance = DEFAULT_APPLICABILITY_GUIDANCE,
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
${applicabilityGuidance}
Do not return an empty object.`;
}

export function buildStructurePrompt(input: DeepActionPromptInput) {
  return buildPrompt(
    "structure",
    input,
    `Applicable: {"pattern": string (max ${STRUCTURE_PATTERN_MAX_LENGTH} characters), "role": string (max ${STRUCTURE_ROLE_MAX_LENGTH} characters), "whyHere": string (max ${STRUCTURE_WHY_HERE_MAX_LENGTH} characters), "pitfall"?: string (max ${STRUCTURE_PITFALL_MAX_LENGTH} characters), "notApplicable"?: false}. Not applicable: {"notApplicable": true, "reason": string (max ${STRUCTURE_REASON_MAX_LENGTH} characters)}.`,
    [
      "When applicable, pattern explains the construction or form, role gives its grammatical role in this sentence, and whyHere explains why the form is used here.",
      "Do not paraphrase the primary meaning or write dictionary-definition prose, filler, greetings, or essays.",
      'Never use the pattern "Trong ngữ cảnh này, X là danh từ chỉ…".',
      "Return an honest short not-applicable reason when Structure does not apply.",
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
    `{"result": {"type": "forms", "lemma": string (required), "forms": [{"label": string, "value": string}][1-${CONJUGATION_FORMS_MAX_COUNT}] (required), "note"?: string} OR {"type": "notApplicable", "notApplicable": true, "reason": string}}`,
    [
      "First decide whether the selected word has useful morphology in this context.",
      'If the selected token does not inflect in the source language or this context (for example, it is a non-inflecting adjective, adverb, proper noun, article, preposition, conjunction, pronoun, or other non-inflecting token), you MUST return "notApplicable": true with a short Vietnamese "reason".',
      "Only return forms for useful morphology of the selected word: provide 4-6 complete forms when available, with a maximum of 6 forms.",
      "Every form requires both a short label and value.",
      `Each label has a maximum ${CONJUGATION_FORM_FIELD_MAX_LENGTH} characters and each value has a maximum ${CONJUGATION_FORM_FIELD_MAX_LENGTH} characters.`,
      "The lemma must be the dictionary headword only, never a phrase or explanation.",
      `The optional note has a maximum ${CONJUGATION_NOTE_MAX_LENGTH} characters.`,
      `A notApplicable reason has a maximum ${CONJUGATION_REASON_MAX_LENGTH} characters.`,
      "Prefer forms over prose always.",
      'Forbidden: greetings, encouragement, "hy vọng", "chúc bạn", "cảm ơn", "cố gắng", filler, or a multi-paragraph explanation.',
      "Never invent a full textbook paradigm for a word that does not conjugate.",
    ].join(" "),
    `Return exactly one nested "result" object. For useful morphology, use "type": "forms" with required "lemma" and "forms" and do not include "reason". For a truly non-inflecting token only, use "type": "notApplicable", "notApplicable": true, and a short Vietnamese "reason" with no forms. Prefer an honest "notApplicable": true only when morphology genuinely does not apply.`,
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
    case "structure":
      return buildStructurePrompt(input);
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
    case "structure":
      return {
        schema: structureDeepActionGenerationSchema,
        schemaName: "readlingo_deep_action_structure",
        schemaDescription:
          "A concise Vietnamese structure map for selected book text.",
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

export function getDeepActionStreamSettings(action: DeepAction) {
  const maxOutputTokens = {
    structure: 300,
    compare: 300,
    easierExamples: 350,
    conjugation: 300,
    collocation: 350,
  } satisfies Record<DeepAction, number>;

  return {
    temperature: 0.2,
    maxOutputTokens: maxOutputTokens[action],
  };
}

export function getDeepActionServerTimeoutMs(action: DeepAction) {
  return action === "conjugation" ? 32_000 : 22_000;
}

export function streamDeepAction(
  input: DeepActionRequest,
  callbacks: DeepActionStreamCallbacks = {},
) {
  const definition = getDeepActionDefinition(input.action);
  const modelOptions = getAiStreamObjectOptions(input.modelTier);
  const providerOptions =
    input.action === "conjugation" && modelOptions.providerOptions?.google
      ? {
          ...modelOptions.providerOptions,
          google: {
            ...modelOptions.providerOptions.google,
            structuredOutputs: false,
          },
        }
      : modelOptions.providerOptions;

  return streamObject({
    ...modelOptions,
    providerOptions,
    prompt: buildDeepActionPrompt(input),
    schema: definition.schema,
    schemaName: definition.schemaName,
    schemaDescription: definition.schemaDescription,
    ...getDeepActionStreamSettings(input.action),
    abortSignal: callbacks.abortSignal,
    onError: callbacks.onError,
    onFinish: callbacks.onFinish,
  });
}
