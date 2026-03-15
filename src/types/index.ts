export type AiProvider = "github" | "google" | "qwen";

export type ExplainModelTier = "primary" | "fallback";

export type ExplanationPayload = {
  translation: string;
  partOfSpeech?: string;
  explanation: string;
  examples: string[];
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
