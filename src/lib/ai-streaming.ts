import type { DeepPartial } from "ai";

import {
  explanationPayloadSchema,
  type AiExplanationInput,
} from "./ai-validation.ts";
import type {
  ExplanationPayload,
  WordExplanationPayload,
} from "../types/index.ts";

export type StreamingExplanationState = "idle" | "loading" | "ready" | "error";

export type StreamingExplanationExample = {
  sentence?: string;
  translation?: string;
};

export type StreamingExplanationPayload = {
  selectionType: ExplanationPayload["selectionType"];
  translation?: string;
  explanation?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  difficultyHint?: WordExplanationPayload["difficultyHint"];
  grammaticalNote?: string;
  alternativeMeaning?: string;
  examples?: StreamingExplanationExample[];
};

function isSingleWordSelection(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length === 1;
}

function normalizeStreamingText(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function normalizeStreamingExamples(
  examples: DeepPartial<AiExplanationInput>["examples"],
) {
  if (!Array.isArray(examples)) {
    return undefined;
  }

  const normalizedExamples = examples
    .map((example) => {
      if (!example || typeof example !== "object") {
        return null;
      }

      const sentence = normalizeStreamingText(
        typeof example.sentence === "string" ? example.sentence : undefined,
      );
      const translation = normalizeStreamingText(
        typeof example.translation === "string"
          ? example.translation
          : undefined,
      );

      if (!sentence && !translation) {
        return null;
      }

      return {
        ...(sentence ? { sentence } : {}),
        ...(translation ? { translation } : {}),
      } satisfies StreamingExplanationExample;
    })
    .filter(
      (example): example is StreamingExplanationExample => example !== null,
    )
    .slice(0, 2);

  return normalizedExamples.length > 0 ? normalizedExamples : undefined;
}

export function buildStreamingExplanationPayload(
  payload: DeepPartial<AiExplanationInput> | null | undefined,
  selectedText: string,
): StreamingExplanationPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const selectionType = isSingleWordSelection(selectedText) ? "word" : "phrase";
  const translation = normalizeStreamingText(payload.translation);
  const explanation = normalizeStreamingText(payload.explanation);
  const grammaticalNote = normalizeStreamingText(payload.grammaticalNote);
  const alternativeMeaning = normalizeStreamingText(payload.alternativeMeaning);
  const examples = normalizeStreamingExamples(payload.examples);

  if (
    !translation &&
    !explanation &&
    !grammaticalNote &&
    !alternativeMeaning &&
    !examples?.length
  ) {
    return null;
  }

  return {
    selectionType,
    ...(translation ? { translation } : {}),
    ...(selectionType === "word"
      ? {
          ...(normalizeStreamingText(payload.pronunciation)
            ? { pronunciation: normalizeStreamingText(payload.pronunciation) }
            : {}),
          ...(normalizeStreamingText(payload.partOfSpeech)
            ? { partOfSpeech: normalizeStreamingText(payload.partOfSpeech) }
            : {}),
          ...(payload.difficultyHint
            ? { difficultyHint: payload.difficultyHint }
            : {}),
        }
      : {}),
    ...(explanation ? { explanation } : {}),
    ...(grammaticalNote ? { grammaticalNote } : {}),
    ...(alternativeMeaning ? { alternativeMeaning } : {}),
    ...(examples ? { examples } : {}),
  } satisfies StreamingExplanationPayload;
}

export function parseReadyStreamingExplanation(
  explanation: StreamingExplanationPayload | null,
  state: StreamingExplanationState,
): ExplanationPayload | null {
  if (state !== "ready") {
    return null;
  }

  const parsedExplanation = explanationPayloadSchema.safeParse(explanation);

  return parsedExplanation.success ? parsedExplanation.data : null;
}
