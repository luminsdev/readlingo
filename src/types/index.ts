export type AiProvider = "github" | "google" | "qwen";

export type ExplanationPayload = {
  translation: string;
  partOfSpeech?: string;
  pronunciation?: string;
  explanation: string;
  exampleSentences: string[];
};

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
