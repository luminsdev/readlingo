export type AiProvider = "github" | "google" | "qwen";

export type ExplanationPayload = {
  translation: string;
  partOfSpeech?: string;
  pronunciation?: string;
  explanation: string;
  exampleSentences: string[];
};
