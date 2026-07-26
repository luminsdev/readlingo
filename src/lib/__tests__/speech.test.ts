import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cancelSpeech,
  getSpeechAccentPreference,
  isSpeechTextEligible,
  isSpeechSynthesisSupported,
  normalizeSpeechLang,
  resolveSpeechVoice,
  setSpeechAccentPreference,
  shouldUseEnglishAccentControls,
  SPEECH_ACCENT_PREFERENCE_KEY,
  speakText,
} from "@/lib/speech";

function createVoice(lang: string, name: string) {
  return { lang, name } as SpeechSynthesisVoice;
}

function installSpeechBrowser(voices: SpeechSynthesisVoice[] = []) {
  const calls: string[] = [];
  const storage = new Map<string, string>();
  const speechSynthesis = {
    cancel: vi.fn(() => calls.push("cancel")),
    getVoices: vi.fn(() => voices),
    speak: vi.fn(() => calls.push("speak")),
  };

  class MockSpeechSynthesisUtterance {
    lang = "";
    voice: SpeechSynthesisVoice | null = null;

    constructor(public text: string) {}
  }

  vi.stubGlobal("window", {
    localStorage: {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    },
    speechSynthesis,
  });
  vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);

  return { calls, speechSynthesis, storage };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("speech helpers", () => {
  it("allows words and capped phrases without consulting browser support", () => {
    const sixTokensAtBoundary =
      "aaaaaaaa bbbbbbb ccccccc ddddddd eeeeeee fffffff";
    const phraseAtBoundary = `${"a".repeat(23)} ${"b".repeat(24)}`;

    expect(isSpeechTextEligible("   ")).toBe(false);
    expect(isSpeechTextEligible("word")).toBe(true);
    expect(isSpeechTextEligible("a".repeat(49))).toBe(true);
    expect(sixTokensAtBoundary).toHaveLength(48);
    expect(isSpeechTextEligible(sixTokensAtBoundary)).toBe(true);
    expect(phraseAtBoundary).toHaveLength(48);
    expect(isSpeechTextEligible(phraseAtBoundary)).toBe(true);
    expect(isSpeechTextEligible(`${"a".repeat(23)} ${"b".repeat(25)}`)).toBe(
      false,
    );
    expect(isSpeechTextEligible("one two three four five six seven")).toBe(
      false,
    );
  });

  it.each([
    ["en", "en-US"],
    ["vi", "vi-VN"],
    ["fr", "fr-FR"],
    ["es", "es-ES"],
    ["de", "de-DE"],
    ["it", "it-IT"],
    ["pt", "pt-PT"],
  ])("maps the short speech language %s to %s", (source, expected) => {
    expect(normalizeSpeechLang(source)).toBe(expected);
  });

  it("canonicalizes valid speech language tags", () => {
    expect(normalizeSpeechLang(" FR_ca ")).toBe("fr-CA");
    expect(normalizeSpeechLang("ja-JP")).toBe("ja-JP");
    expect(normalizeSpeechLang("zh_Hant_TW")).toBe("zh-Hant-TW");
  });

  it.each([undefined, null, "", "   ", "und", "UND", "unknown", "en--US", "a"])(
    "uses browser defaults for an unusable speech language (%s)",
    (source) => {
      expect(normalizeSpeechLang(source)).toBeUndefined();
    },
  );

  it("allows accent controls only for normalized English", () => {
    expect(shouldUseEnglishAccentControls("en")).toBe(true);
    expect(shouldUseEnglishAccentControls("EN_gb")).toBe(true);
    expect(shouldUseEnglishAccentControls("fr")).toBe(false);
    expect(shouldUseEnglishAccentControls(undefined)).toBe(false);
    expect(shouldUseEnglishAccentControls("und")).toBe(false);
    expect(shouldUseEnglishAccentControls("unknown")).toBe(false);
    expect(shouldUseEnglishAccentControls("en--US")).toBe(false);
  });

  it("returns an unsupported result without browser speech APIs", () => {
    expect(isSpeechSynthesisSupported()).toBe(false);
    expect(speakText("bonjour")).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("does not speak empty text", () => {
    const { speechSynthesis } = installSpeechBrowser();

    expect(speakText("   ")).toEqual({ ok: false, reason: "empty" });
    expect(speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it("resolves the requested US or UK voice and falls back to null", () => {
    const usVoice = createVoice("en-US", "Samantha");
    const ukVoice = createVoice("en_GB", "Google UK English Female");
    const frenchVoice = createVoice("fr-FR", "Thomas");
    const spanishVoice = createVoice("es-US", "American Spanish");
    const voices = [frenchVoice, ukVoice, usVoice];

    expect(resolveSpeechVoice(voices, "us")).toBe(usVoice);
    expect(resolveSpeechVoice(voices, "uk")).toBe(ukVoice);
    expect(resolveSpeechVoice([frenchVoice], "us")).toBeNull();
    expect(resolveSpeechVoice([spanishVoice], "us")).toBeNull();
  });

  it("reads and writes the local accent preference with a US fallback", () => {
    expect(getSpeechAccentPreference()).toBe("us");

    const { storage } = installSpeechBrowser();
    storage.set(SPEECH_ACCENT_PREFERENCE_KEY, "invalid");
    expect(getSpeechAccentPreference()).toBe("us");

    setSpeechAccentPreference("uk");
    expect(storage.get(SPEECH_ACCENT_PREFERENCE_KEY)).toBe("uk");
    expect(getSpeechAccentPreference()).toBe("uk");
  });

  it("trims the word and cancels previous speech before speaking", () => {
    const ukVoice = createVoice("en-GB", "Daniel");
    const { calls, speechSynthesis } = installSpeechBrowser([ukVoice]);

    expect(speakText("  colour  ", { accent: "uk" })).toEqual({ ok: true });
    expect(calls).toEqual(["cancel", "speak"]);
    expect(speechSynthesis.speak).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: "en-GB",
        text: "colour",
        voice: ukVoice,
      }),
    );
  });

  it("assigns a normalized non-English language without an accent voice", () => {
    const { speechSynthesis } = installSpeechBrowser();

    expect(speakText(" bonjour ", { lang: "fr-FR" })).toEqual({ ok: true });
    expect(speechSynthesis.speak).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: "fr-FR",
        text: "bonjour",
        voice: null,
      }),
    );
  });

  it("cancels speech directly when browser speech is available", () => {
    const { speechSynthesis } = installSpeechBrowser();

    cancelSpeech();

    expect(speechSynthesis.cancel).toHaveBeenCalledOnce();
  });

  it("uses browser defaults when the requested accent has no voice", () => {
    const usVoice = createVoice("en-US", "Samantha");
    const { speechSynthesis } = installSpeechBrowser([usVoice]);

    expect(speakText("colour", { accent: "uk" })).toEqual({ ok: true });
    expect(speechSynthesis.speak).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: "",
        voice: null,
      }),
    );
  });
});
