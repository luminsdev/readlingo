export type SpeechAccent = "us" | "uk";

export const SPEECH_ACCENT_PREFERENCE_KEY = "readlingo.speech.accent";

const SPEECH_ACCENT_LANGS: Record<SpeechAccent, string> = {
  us: "en-US",
  uk: "en-GB",
};

const SHORT_SPEECH_LANGS: Record<string, string> = {
  en: "en-US",
  vi: "vi-VN",
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
};

export function isSpeechTextEligible(text: string | null | undefined) {
  const trimmedText = text?.trim();

  if (!trimmedText) {
    return false;
  }

  const tokenCount = trimmedText.split(/\s+/).length;

  return tokenCount === 1 || (tokenCount <= 6 && trimmedText.length <= 48);
}

export function normalizeSpeechLang(
  sourceLanguage: string | null | undefined,
): string | undefined {
  const languageTag = sourceLanguage?.trim().replaceAll("_", "-");

  if (!languageTag) {
    return undefined;
  }

  try {
    const [canonicalTag] = Intl.getCanonicalLocales(languageTag);
    const baseLanguage = canonicalTag?.split("-")[0].toLowerCase();

    if (!canonicalTag || baseLanguage === "und" || baseLanguage === "unknown") {
      return undefined;
    }

    return SHORT_SPEECH_LANGS[canonicalTag.toLowerCase()] ?? canonicalTag;
  } catch {
    return undefined;
  }
}

export function shouldUseEnglishAccentControls(
  sourceLanguage: string | null | undefined,
) {
  return normalizeSpeechLang(sourceLanguage)?.split("-")[0] === "en";
}

/**
 * Browser speech support and voice inventories vary. Chromium often loads voices
 * asynchronously via `voiceschanged`; Safari and Firefox may expose fewer voices.
 */
export function isSpeechSynthesisSupported() {
  return (
    typeof window !== "undefined" &&
    typeof SpeechSynthesisUtterance !== "undefined" &&
    typeof window.speechSynthesis?.cancel === "function" &&
    typeof window.speechSynthesis?.getVoices === "function" &&
    typeof window.speechSynthesis?.speak === "function"
  );
}

export function getSpeechAccentPreference(): SpeechAccent {
  if (typeof window === "undefined") {
    return "us";
  }

  try {
    return window.localStorage.getItem(SPEECH_ACCENT_PREFERENCE_KEY) === "uk"
      ? "uk"
      : "us";
  } catch {
    return "us";
  }
}

export function setSpeechAccentPreference(accent: SpeechAccent) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SPEECH_ACCENT_PREFERENCE_KEY, accent);
  } catch {
    // Storage can be unavailable in private browsing; speech still works.
  }
}

export function resolveSpeechVoice(
  voices: SpeechSynthesisVoice[],
  accent: SpeechAccent,
) {
  const expectedLang = SPEECH_ACCENT_LANGS[accent].toLowerCase();
  const exactLanguageVoice = voices.find(
    (voice) => voice.lang.replaceAll("_", "-").toLowerCase() === expectedLang,
  );

  if (exactLanguageVoice) {
    return exactLanguageVoice;
  }

  const namePattern =
    accent === "us" ? /\b(us|american)\b/i : /\b(uk|british)\b/i;

  return (
    voices.find(
      (voice) =>
        /^en(?:[-_]|$)/i.test(voice.lang) && namePattern.test(voice.name),
    ) ?? null
  );
}

export function cancelSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }

  try {
    window.speechSynthesis.cancel();
  } catch {
    // Treat browser speech failures as an unsupported capability.
  }
}

export function speakText(
  text: string,
  options?: { accent?: SpeechAccent; lang?: string },
): { ok: boolean; reason?: "unsupported" | "empty" } {
  if (!isSpeechSynthesisSupported()) {
    return { ok: false, reason: "unsupported" };
  }

  cancelSpeech();

  const trimmedText = text.trim();

  if (!trimmedText) {
    return { ok: false, reason: "empty" };
  }

  try {
    const utterance = new SpeechSynthesisUtterance(trimmedText);

    if (options?.accent) {
      const voice = resolveSpeechVoice(
        window.speechSynthesis.getVoices(),
        options.accent,
      );

      if (voice) {
        utterance.lang = SPEECH_ACCENT_LANGS[options.accent];
        utterance.voice = voice;
      }
    } else if (options?.lang) {
      utterance.lang = options.lang;
    }

    window.speechSynthesis.speak(utterance);
    return { ok: true };
  } catch {
    return { ok: false, reason: "unsupported" };
  }
}
