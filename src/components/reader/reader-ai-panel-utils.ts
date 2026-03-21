import type { ExplanationPayload } from "@/types";
import type { StreamingExplanationPayload } from "@/lib/ai-streaming";

export type ReaderAiStreamingCursorTarget =
  | "translation"
  | "explanation"
  | "grammatical-note"
  | "alternative-meaning"
  | `example-sentence-${number}`
  | `example-translation-${number}`;

export function shouldShowReaderAiContext(
  selectionType: ExplanationPayload["selectionType"],
  contextSentence?: string | null,
) {
  return selectionType === "word" && Boolean(contextSentence?.trim());
}

export function getReaderAiStreamingCursorTarget(
  explanation: StreamingExplanationPayload | null,
): ReaderAiStreamingCursorTarget | null {
  if (!explanation) {
    return null;
  }

  let cursorTarget: ReaderAiStreamingCursorTarget | null = null;

  if (explanation.translation) {
    cursorTarget = "translation";
  }

  if (explanation.explanation) {
    cursorTarget = "explanation";
  }

  if (explanation.grammaticalNote) {
    cursorTarget = "grammatical-note";
  }

  if (explanation.alternativeMeaning) {
    cursorTarget = "alternative-meaning";
  }

  explanation.examples?.forEach((example, index) => {
    if (example.sentence) {
      cursorTarget = `example-sentence-${index}`;
    }

    if (example.translation) {
      cursorTarget = `example-translation-${index}`;
    }
  });

  return cursorTarget;
}
