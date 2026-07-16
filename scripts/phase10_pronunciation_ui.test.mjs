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
    "../src/components/vocabulary/pronounce-word-button.tsx",
  );

  assert.match(source, /aria-label=\{`Pronounce \$\{word\}`\}/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /voiceschanged/);
  assert.match(source, /cancelSpeech\(\)/);
  assert.match(source, /readlingo:speech-accent-change/);
  assert.match(source, /window\.dispatchEvent/);
  assert.match(source, /new CustomEvent/);
  assert.match(source, /detail: nextAccent/);
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
