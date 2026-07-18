import { deriveVocabularyStatus } from "@/lib/vocabulary-query";

export type VocabularyReencounterCue = "due" | "learning" | "mastered" | null;

export function normalizeVocabularyWord(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function wordsMatchNormalized(left: string, right: string) {
  const normalizedLeft = normalizeVocabularyWord(left);

  return (
    normalizedLeft.length > 0 &&
    normalizedLeft === normalizeVocabularyWord(right)
  );
}

export function getVocabularyReencounterCue({
  srsData,
  now = new Date(),
}: {
  srsData?: {
    interval: number;
    nextReviewAt: string | Date;
  } | null;
  now?: Date;
}): VocabularyReencounterCue {
  if (!srsData) {
    return null;
  }

  const nextReviewAt =
    typeof srsData.nextReviewAt === "string"
      ? new Date(srsData.nextReviewAt)
      : srsData.nextReviewAt;

  if (nextReviewAt.getTime() <= now.getTime()) {
    return "due";
  }

  const status = deriveVocabularyStatus(srsData);

  return status === "new" ? null : status;
}
