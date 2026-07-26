import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8").catch(
    (error) => {
      if (error?.code === "ENOENT") {
        return "";
      }

      throw error;
    },
  );
}

test("shared pronunciation control is accessible and manages browser speech", async () => {
  const source = await readSource(
    "../src/components/speech/pronounce-text-button.tsx",
  );

  assert.match(source, /aria-label=\{`Pronounce \$\{text\}`\}/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /voiceschanged/);
  assert.match(source, /cancelSpeech\(\)/);
  assert.match(source, /readlingo:speech-accent-change/);
  assert.match(source, /window\.dispatchEvent/);
  assert.match(source, /new CustomEvent/);
  assert.match(source, /detail: nextAccent/);
  assert.match(source, /normalizeSpeechLang\(sourceLanguage\)/);
  assert.match(source, /shouldUseEnglishAccentControls\(sourceLanguage\)/);
  assert.match(source, /speakText\(text/);
});

test("the word control remains a compatibility wrapper", async () => {
  const source = await readSource(
    "../src/components/vocabulary/pronounce-word-button.tsx",
  );

  assert.match(source, /PronounceTextButton/);
  assert.match(source, /text=\{word\}/);
  assert.match(source, /sourceLanguage="en"/);
  assert.match(source, /allowEnglishAccentControls/);
});

test("vocabulary rows mount the shared pronunciation control", async () => {
  const source = await readSource("../src/app/(main)/vocabulary/page.tsx");

  assert.match(source, /PronounceWordButton/);
  assert.match(source, /<PronounceWordButton word=\{item\.word\}/);
});

test("flashcard fronts mount the shared pronunciation control", async () => {
  const source = await readSource(
    "../src/components/flashcards/flashcard-session.tsx",
  );

  assert.match(source, /PronounceWordButton/);
  assert.match(source, /<PronounceWordButton word=\{activeCard\.word\}/);
});

test("reader pronunciation is eligibility-driven and receives book language", async () => {
  const panelSource = await readSource(
    "../src/components/reader/reader-ai-panel.tsx",
  );
  const selectionSource = await readSource(
    "../src/components/reader/reader-selection-handler.tsx",
  );

  assert.match(
    panelSource,
    /const canSpeakSelection = isSpeechTextEligible\(selectedText\)/,
  );
  assert.match(panelSource, /canSpeakSelection && selectedText/);
  assert.match(panelSource, /<PronounceTextButton/);
  assert.match(panelSource, /text=\{selectedText\}/);
  assert.match(panelSource, /sourceLanguage=\{sourceLanguage\}/);
  assert.match(selectionSource, /sourceLanguage=\{language\}/);
});

test("reader speech cancellation covers dismiss, replacement, and unmount", async () => {
  const source = await readSource(
    "../src/components/reader/reader-selection-handler.tsx",
  );

  assert.match(
    source,
    /const clearPendingSelection = useCallback\(\(\) => \{\s+cancelSpeech\(\)/,
  );
  assert.match(
    source,
    /const handleSelection = useCallback\([\s\S]*?if \(!selectionPayload\) \{[\s\S]*?return;[\s\S]*?\}\s+cancelSpeech\(\)/,
  );
  assert.match(
    source,
    /return \(\) => \{\s+cancelSpeech\(\);[\s\S]*?explainAbortControllerRef/,
  );
  assert.match(
    source,
    /const dismissPanels = useCallback\([\s\S]*?clearPendingSelection\(\)/,
  );
});

test("reader IPA and romanization remain single-word-only", async () => {
  const source = await readSource(
    "../src/components/reader/reader-ai-panel.tsx",
  );

  assert.match(
    source,
    /explanation\.selectionType === "word" &&\s+explanation\.pronunciation/,
  );
});
