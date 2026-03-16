export type AiProvider = "github" | "google" | "qwen";

export type ExplainModelTier = "primary" | "fallback";

type SharedExplanationPayload = {
  translation: string;
  explanation: string;
  grammaticalNote?: string;
  alternativeMeaning?: string;
  examples: Array<{
    sentence: string;
    translation: string;
  }>;
};

export type WordExplanationPayload = SharedExplanationPayload & {
  selectionType: "word";
  pronunciation?: string;
  partOfSpeech?: string;
  difficultyHint?: "beginner" | "intermediate" | "advanced";
};

export type PhraseExplanationPayload = SharedExplanationPayload & {
  selectionType: "phrase";
};

export type ExplanationPayload =
  | WordExplanationPayload
  | PhraseExplanationPayload;

export type ReaderBookSnapshot = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  language: string;
  createdAt: string;
  progressCfi: string | null;
  progressUpdatedAt: string | null;
};
