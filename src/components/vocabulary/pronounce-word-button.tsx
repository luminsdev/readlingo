"use client";

import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  cancelSpeech,
  getSpeechAccentPreference,
  isSpeechSynthesisSupported,
  resolveSpeechVoice,
  setSpeechAccentPreference,
  speakText,
  type SpeechAccent,
} from "@/lib/speech";
import { cn } from "@/lib/utils";

const SPEECH_ACCENT_CHANGE_EVENT = "readlingo:speech-accent-change";

type PronounceWordButtonProps = {
  word: string;
  className?: string;
};

export function PronounceWordButton({
  word,
  className,
}: PronounceWordButtonProps) {
  const [accent, setAccent] = useState<SpeechAccent>("us");
  const [isSupported, setIsSupported] = useState(false);
  const [voiceAvailability, setVoiceAvailability] = useState({
    us: false,
    uk: false,
  });

  useEffect(() => {
    if (!isSpeechSynthesisSupported()) {
      return;
    }

    const speechSynthesis = window.speechSynthesis;

    setAccent(getSpeechAccentPreference());
    setIsSupported(true);

    function updateVoiceAvailability() {
      try {
        const voices = speechSynthesis.getVoices();
        setVoiceAvailability({
          us: Boolean(resolveSpeechVoice(voices, "us")),
          uk: Boolean(resolveSpeechVoice(voices, "uk")),
        });
      } catch {
        setIsSupported(false);
      }
    }

    function syncAccentPreference(event: Event) {
      const nextAccent = (event as CustomEvent<SpeechAccent>).detail;
      setAccent(nextAccent === "uk" ? "uk" : "us");
    }

    updateVoiceAvailability();
    speechSynthesis.addEventListener("voiceschanged", updateVoiceAvailability);
    window.addEventListener(SPEECH_ACCENT_CHANGE_EVENT, syncAccentPreference);

    return () => {
      speechSynthesis.removeEventListener(
        "voiceschanged",
        updateVoiceAvailability,
      );
      window.removeEventListener(
        SPEECH_ACCENT_CHANGE_EVENT,
        syncAccentPreference,
      );
    };
  }, []);

  useEffect(() => {
    return () => cancelSpeech();
  }, [word]);

  if (!isSupported || !word.trim()) {
    return null;
  }

  function handleSpeak(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    speakText(word, { accent });
  }

  function handleAccentChange(
    event: MouseEvent<HTMLButtonElement>,
    nextAccent: SpeechAccent,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setSpeechAccentPreference(nextAccent);
    window.dispatchEvent(
      new CustomEvent<SpeechAccent>(SPEECH_ACCENT_CHANGE_EVENT, {
        detail: nextAccent,
      }),
    );
  }

  const hasBothAccents = voiceAvailability.us && voiceAvailability.uk;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Pronounce ${word}`}
        onClick={handleSpeak}
      >
        <Volume2 aria-hidden="true" />
      </Button>

      {hasBothAccents ? (
        <div
          role="group"
          aria-label="Pronunciation accent"
          className="flex items-center gap-1"
        >
          <Button
            type="button"
            variant={accent === "us" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={accent === "us"}
            onClick={(event) => handleAccentChange(event, "us")}
          >
            US
          </Button>
          <Button
            type="button"
            variant={accent === "uk" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={accent === "uk"}
            onClick={(event) => handleAccentChange(event, "uk")}
          >
            UK
          </Button>
        </div>
      ) : null}
    </div>
  );
}
