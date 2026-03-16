import type { ExplanationPayload } from "@/types";

import type { SaveVocabularyInput } from "./vocabulary-validation";

type BuildVocabularySavePayloadInput = {
  bookId?: string;
  explanation: ExplanationPayload;
  selectedText: string;
  sourceLanguage: string;
  surroundingParagraph: string;
};

export function buildVocabularySavePayload({
  bookId,
  explanation,
  selectedText,
  sourceLanguage,
  surroundingParagraph,
}: BuildVocabularySavePayloadInput): SaveVocabularyInput {
  return {
    word: selectedText.trim(),
    definition: explanation.translation.trim(),
    exampleSentence:
      explanation.examples[0]?.sentence.trim() ??
      explanation.translation.trim(),
    contextSentence: surroundingParagraph.trim(),
    sourceLanguage: sourceLanguage.trim().toLowerCase(),
    targetLanguage: "vi",
    ...(bookId ? { bookId } : {}),
  };
}
