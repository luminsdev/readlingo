"use client";

import { PronounceTextButton } from "@/components/speech/pronounce-text-button";

type PronounceWordButtonProps = {
  word: string;
  className?: string;
};

export function PronounceWordButton({
  word,
  className,
}: PronounceWordButtonProps) {
  return (
    <PronounceTextButton
      text={word}
      sourceLanguage="en"
      className={className}
      allowEnglishAccentControls
    />
  );
}
