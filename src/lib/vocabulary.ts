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
  const wordMetadata =
    explanation.selectionType === "word"
      ? {
          pronunciation: explanation.pronunciation?.trim(),
          partOfSpeech: explanation.partOfSpeech?.trim(),
          difficultyHint: explanation.difficultyHint,
        }
      : {};

  return {
    word: selectedText.trim(),
    definition: explanation.translation.trim(),
    exampleSentence:
      explanation.examples[0]?.sentence.trim() ??
      explanation.translation.trim(),
    contextSentence: surroundingParagraph.trim(),
    sourceLanguage: sourceLanguage.trim().toLowerCase(),
    targetLanguage: "vi",
    ...wordMetadata,
    explanation: explanation.explanation.trim(),
    alternativeMeaning: explanation.alternativeMeaning?.trim(),
    exampleTranslation: explanation.examples[0]?.translation.trim(),
    ...(bookId ? { bookId } : {}),
  };
}
