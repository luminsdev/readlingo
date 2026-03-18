import type { ExplanationPayload } from "@/types";

export function shouldShowReaderAiContext(
  selectionType: ExplanationPayload["selectionType"],
  contextSentence?: string | null,
) {
  return selectionType === "word" && Boolean(contextSentence?.trim());
}
