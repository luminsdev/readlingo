import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamObject, type LanguageModel } from "ai";

import {
  aiExplanationSchema,
  normalizeFormTip,
  PRONUNCIATION_MAX_LENGTH,
  type AiExplanationInput,
  type ExplainSelectionInput,
} from "./ai-validation.ts";
import { getAiResponseLocaleInstruction } from "./ai-locale.ts";
import type {
  AiProvider,
  ExplainModelTier,
  ExplanationPayload,
} from "../types/index.ts";

type ExplainModelTarget = {
  provider: AiProvider;
  modelId: string;
};

type ProviderRegistration = {
  providerName: AiProvider;
  createModel: (modelId: string) => LanguageModel;
};

const AI_PROMPT_TEMPLATE = `System: You are a language learning assistant.
Given a selected text and its surrounding context from a book,
provide a helpful explanation for a language learner.
${getAiResponseLocaleInstruction()}
Use short learner-facing Vietnamese only.
The primary explanation owns translation and contextual meaning.
Keep translation short while preserving the full selection meaning.
Write explanation in 2-4 short sentences maximum; target under 500 characters.
grammaticalNote is optional and only for a form detail necessary to understand meaning.
When included, write grammaticalNote in at most one short sentence and no more than 180 characters.
Do not use grammaticalNote for multi-sentence grammar prose or meaning/structure essays.
Prefer 1 example; never provide more than 2. Keep examples short and natural.
Do not include greetings, closings, thanks, wishes, or encouragement.
Never use sign-off or encouragement phrases such as "hy vọng", "chúc bạn", "cảm ơn", "cố gắng", or "nếu bạn muốn hỏi thêm".
Do not include self-referential assistant chatter.

User:
Book language: {sourceLanguage}
Selected text: "{selectedText}"
Context: "{surroundingParagraph}"

Provide:
1. Translation
2. Plain explanation for this context
3. Optional short Form tip only when needed to understand meaning
4. 1 preferred, at most 2 natural example sentences`;

const FALLBACK_EXAMPLE_SUFFIX = "appears in this reading context.";
export const PRIMARY_EXPLAIN_MAX_OUTPUT_TOKENS = 800;

const providerModelCatalog: Record<
  AiProvider,
  Record<ExplainModelTier, string>
> = {
  google: {
    primary: "gemma-4-31b-it",
    fallback: "gemini-3.5-flash-lite",
  },
  github: {
    primary: process.env.GITHUB_MODEL_ID ?? "gpt-4.1-mini",
    fallback:
      process.env.GITHUB_FALLBACK_MODEL_ID ??
      process.env.GITHUB_MODEL_ID ??
      "gpt-4.1-mini",
  },
  qwen: {
    primary: process.env.QWEN_MODEL_ID ?? "qwen3",
    fallback:
      process.env.QWEN_FALLBACK_MODEL_ID ??
      process.env.QWEN_MODEL_ID ??
      "qwen3",
  },
};

function getGoogleModelId(modelTier: ExplainModelTier) {
  const override =
    modelTier === "primary"
      ? process.env.GOOGLE_PRIMARY_MODEL_ID
      : process.env.GOOGLE_FALLBACK_MODEL_ID;

  return override?.trim() || providerModelCatalog.google[modelTier];
}

function parseAiProvider(value: string | undefined): AiProvider {
  if (value === "github" || value === "qwen") {
    return value;
  }

  return "google";
}

function getActiveAiProvider() {
  return parseAiProvider(process.env.AI_PROVIDER);
}

function getProviderRegistration(provider: AiProvider): ProviderRegistration {
  if (provider === "google") {
    return {
      providerName: provider,
      createModel: (modelId) => google(modelId),
    };
  }

  if (provider === "github") {
    const apiKey = process.env.GITHUB_TOKEN;

    if (!apiKey) {
      throw new Error(
        "GITHUB_TOKEN is required before AI_PROVIDER can be switched to github.",
      );
    }

    const providerInstance = createOpenAICompatible({
      name: "github-models",
      apiKey,
      baseURL:
        process.env.GITHUB_BASE_URL ??
        "https://models.inference.ai.azure.com/v1",
      supportsStructuredOutputs: true,
    });

    return {
      providerName: provider,
      createModel: (modelId) => providerInstance(modelId),
    };
  }

  const apiKey = process.env.QWEN_API_KEY;
  const baseURL = process.env.QWEN_BASE_URL;

  if (!apiKey || !baseURL) {
    throw new Error(
      "QWEN_API_KEY and QWEN_BASE_URL are required before AI_PROVIDER can be switched to qwen.",
    );
  }

  const providerInstance = createOpenAICompatible({
    name: "qwen-openrouter",
    apiKey,
    baseURL,
    supportsStructuredOutputs: true,
  });

  return {
    providerName: provider,
    createModel: (modelId) => providerInstance(modelId),
  };
}

export function isSingleWordSelection(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length === 1;
}

function getSelectionType(value: string): ExplanationPayload["selectionType"] {
  return isSingleWordSelection(value) ? "word" : "phrase";
}

export function getExplainModelTarget(
  modelTier: ExplainModelTier = "primary",
  provider = getActiveAiProvider(),
): ExplainModelTarget {
  return {
    provider,
    modelId:
      provider === "google"
        ? getGoogleModelId(modelTier)
        : providerModelCatalog[provider][modelTier],
  };
}

export function getGoogleThinkingConfig(
  modelId: string,
): GoogleLanguageModelOptions["thinkingConfig"] {
  if (/^gemma-4-/.test(modelId)) {
    const thinkingLevel =
      process.env.GOOGLE_GEMMA_THINKING_LEVEL?.trim().toLowerCase() === "high"
        ? "high"
        : "minimal";

    return { thinkingLevel } satisfies NonNullable<
      GoogleLanguageModelOptions["thinkingConfig"]
    >;
  }

  if (
    /^gemini-2\.5-flash(?:-lite)?(?:-preview(?:-\d+(?:-\d+)*)?)?$/.test(modelId)
  ) {
    return { thinkingBudget: 0 } satisfies NonNullable<
      GoogleLanguageModelOptions["thinkingConfig"]
    >;
  }

  if (
    modelId === "gemini-3.5-flash-lite" ||
    /^gemini-3(?:\.1)?-flash(?:-|$)/.test(modelId)
  ) {
    return { thinkingLevel: "minimal" } satisfies NonNullable<
      GoogleLanguageModelOptions["thinkingConfig"]
    >;
  }

  return undefined;
}

export function getAiLanguageModel(modelTier: ExplainModelTier = "primary") {
  const modelTarget = getExplainModelTarget(modelTier);
  const providerRegistration = getProviderRegistration(modelTarget.provider);

  return providerRegistration.createModel(modelTarget.modelId);
}

export function getAiStreamObjectOptions(
  modelTier: ExplainModelTier = "primary",
) {
  const modelTarget = getExplainModelTarget(modelTier);
  const providerRegistration = getProviderRegistration(modelTarget.provider);
  const thinkingConfig =
    providerRegistration.providerName === "google"
      ? getGoogleThinkingConfig(modelTarget.modelId)
      : undefined;

  return {
    model: providerRegistration.createModel(modelTarget.modelId),
    providerOptions:
      providerRegistration.providerName === "google"
        ? {
            google: {
              structuredOutputs: true,
              ...(thinkingConfig ? { thinkingConfig } : {}),
            } satisfies GoogleLanguageModelOptions,
          }
        : undefined,
  };
}

export function getAiSamplingOptions(
  modelTier: ExplainModelTier,
  temperature: number,
): { temperature?: number } {
  const modelTarget = getExplainModelTarget(modelTier);

  if (
    modelTarget.provider === "google" &&
    modelTarget.modelId === "gemini-3.5-flash-lite"
  ) {
    return {};
  }

  return { temperature };
}

export function buildExplainPrompt({
  selectedText,
  surroundingParagraph,
  sourceLanguage,
}: Pick<
  ExplainSelectionInput,
  "selectedText" | "surroundingParagraph" | "sourceLanguage"
>) {
  const isSingleWord = isSingleWordSelection(selectedText);
  const selectionGuidance = isSingleWord
    ? [
        "Selection type: single word.",
        "Include partOfSpeech when you are confident.",
        `Include pronunciation using IPA or the standard romanization for this language (pinyin for Chinese, romaji for Japanese, IPA for European languages). Return exactly one short IPA or standard romanization transcription. Keep pronunciation to a maximum of ${PRONUNCIATION_MAX_LENGTH} characters. Never repeat characters or transcriptions. Omit pronunciation when uncertain.`,
        'Set difficultyHint to exactly one of: "beginner", "intermediate", or "advanced".',
        "If this word has multiple common meanings, state which meaning applies here and mention 1 alternative meaning the learner might confuse it with.",
        "Each example sentence MUST include a Vietnamese translation on the next line.",
        "Use vocabulary at or below the difficulty level of the target word.",
        "Do not introduce harder words in examples.",
        "The example sentences should contain the target word (or its conjugated/inflected form).",
      ].join(" ")
    : [
        "Selection type: phrase or sentence.",
        "Translate the full selection exactly as chosen.",
        "Full translation of the complete selection is required.",
        "Explain the overall meaning in this context and do not narrow the answer to a single word or sub-phrase.",
        "Leave detailed construction mapping to the separate Structure action.",
        "Use grammaticalNote only for an optional short form detail necessary to understand meaning.",
        "Add a Cultural/contextual note when the phrase has nuance beyond the literal meaning.",
        "If this word/phrase has multiple common meanings, state which meaning applies here and mention 1 alternative meaning the learner might confuse it with.",
        "Each example sentence MUST include a Vietnamese translation on the next line.",
        "Use vocabulary at or below the difficulty level of the target word.",
        "Do not introduce harder words in examples.",
        "The example sentences should contain the target word (or its conjugated/inflected form).",
      ].join(" ");

  return AI_PROMPT_TEMPLATE.replace("{sourceLanguage}", sourceLanguage)
    .replace("{selectedText}", selectedText)
    .replace("{surroundingParagraph}", surroundingParagraph)
    .concat(`\n\n${selectionGuidance}`)
    .concat(
      '\n\nReturn only valid JSON with this shape: {"translation": string, "pronunciation"?: string, "partOfSpeech"?: string, "difficultyHint"?: "beginner" | "intermediate" | "advanced", "explanation": string, "grammaticalNote"?: string, "alternativeMeaning"?: string, "examples": [{"sentence": string, "translation": string}]}. Prefer 1 example; never provide more than 2. Use explanation for the plain learner-friendly meaning in this context. Omit pronunciation, partOfSpeech, and difficultyHint unless the selected text is a single word.',
    );
}

function normalizeOptionalField(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function getFallbackExample(selectedText: string) {
  return `${selectedText.trim()} ${FALLBACK_EXAMPLE_SUFFIX}`;
}

function normalizeExamples(payload: AiExplanationInput) {
  const seenSentences = new Set<string>();

  return payload.examples
    .map((example) => ({
      sentence: example.sentence.trim(),
      translation: example.translation.trim(),
    }))
    .filter((example) => {
      if (!example.sentence || !example.translation) {
        return false;
      }

      if (seenSentences.has(example.sentence)) {
        return false;
      }

      seenSentences.add(example.sentence);
      return true;
    })
    .slice(0, 2);
}

export function normalizeExplanationPayload(
  payload: AiExplanationInput,
  selectedText: string,
): ExplanationPayload {
  const selectionType = getSelectionType(selectedText);
  const normalizedExamples = normalizeExamples(payload);
  const trimmedTranslation = payload.translation.trim();

  return {
    selectionType,
    translation: trimmedTranslation,
    ...(selectionType === "word"
      ? {
          ...(normalizeOptionalField(payload.pronunciation)
            ? { pronunciation: normalizeOptionalField(payload.pronunciation) }
            : {}),
          ...(normalizeOptionalField(payload.partOfSpeech)
            ? { partOfSpeech: normalizeOptionalField(payload.partOfSpeech) }
            : {}),
          ...(payload.difficultyHint
            ? { difficultyHint: payload.difficultyHint }
            : {}),
        }
      : {}),
    explanation: payload.explanation.trim(),
    ...(normalizeFormTip(payload.grammaticalNote)
      ? { grammaticalNote: normalizeFormTip(payload.grammaticalNote) }
      : {}),
    ...(normalizeOptionalField(payload.alternativeMeaning)
      ? {
          alternativeMeaning: normalizeOptionalField(
            payload.alternativeMeaning,
          ),
        }
      : {}),
    examples:
      normalizedExamples.length > 0
        ? normalizedExamples
        : [
            {
              sentence: getFallbackExample(selectedText),
              translation: trimmedTranslation,
            },
          ],
  };
}

export function getAiErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "AI explanation is unavailable right now. Please try again.";
}

export function streamExplanation(input: ExplainSelectionInput) {
  return streamObject({
    ...getAiStreamObjectOptions(input.modelTier),
    prompt: buildExplainPrompt(input),
    schema: aiExplanationSchema,
    schemaName: "readlingo_explanation",
    schemaDescription:
      "Vietnamese translation and explanation for a highlighted word or sentence in an EPUB reader.",
    maxOutputTokens: PRIMARY_EXPLAIN_MAX_OUTPUT_TOKENS,
    ...getAiSamplingOptions(input.modelTier, 0.2),
    timeout: 20_000,
  });
}
