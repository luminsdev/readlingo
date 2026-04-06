import { generateText } from "ai";

import { getAiLanguageModel } from "./ai.ts";
import { mnemonicSchema } from "./vocabulary-validation.ts";

export type GenerateMnemonicInput = {
  word: string;
  definition: string;
  sourceLanguage: string;
  exampleSentence: string;
  contextSentence: string;
};

export function normalizeMnemonicText(value: string) {
  const trimmedValue = value.trim();
  const withoutWrappingQuotes = trimmedValue.replace(/^['"]+|['"]+$/g, "");
  const normalizedValue = withoutWrappingQuotes.trim();

  const parsedMnemonic = mnemonicSchema.safeParse(normalizedValue);

  return parsedMnemonic.success ? parsedMnemonic.data : null;
}

export function buildMnemonicPrompt({
  word,
  definition,
  sourceLanguage,
  exampleSentence,
  contextSentence,
}: GenerateMnemonicInput) {
  return `System: You are a language memory coach.
Create a short mnemonic or memory trick for a Vietnamese learner.
Respond in Vietnamese.

User:
Word: "${word}"
Definition: "${definition}"
Source language: ${sourceLanguage}
Example sentence: "${exampleSentence}"
Context sentence: "${contextSentence}"

Requirements:
- Make the mnemonic genuinely useful for remembering the word and its meaning.
- Prefer vivid associations, sound-alike links, Vietnamese wordplay or cultural references when they genuinely help memory.
- Keep it natural, concise, and memorable.
- 1-3 sentences max.
- Do not use markdown, bullet points, labels, or quotation marks.
- Return only the mnemonic text.`;
}

export async function generateMnemonic(input: GenerateMnemonicInput) {
  const result = await generateText({
    model: getAiLanguageModel("fallback"),
    prompt: buildMnemonicPrompt(input),
    temperature: 0.4,
    timeout: 20_000,
  });

  return normalizeMnemonicText(result.text);
}
