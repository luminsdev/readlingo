import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const selectionHandlerSource = await readFile(
  new URL(
    "../src/components/reader/reader-selection-handler.tsx",
    import.meta.url,
  ),
  "utf8",
);
const aiPanelSource = await readFile(
  new URL("../src/components/reader/reader-ai-panel.tsx", import.meta.url),
  "utf8",
);

test("reader lookup requests normalized book-scoped continuity fields", () => {
  assert.match(
    selectionHandlerSource,
    /searchParams\.set\("match", "normalized"\)/,
  );
  assert.match(aiPanelSource, /definition: string/);
  assert.match(aiPanelSource, /explanation: string \| null/);
  assert.match(aiPanelSource, /exampleSentence: string \| null/);
  assert.match(aiPanelSource, /srsData:/);
  assert.match(aiPanelSource, /nextReviewAt: string/);
  assert.match(
    selectionHandlerSource,
    /existingVocabulary=\{existingVocabulary\}/,
  );
});

test("reader clears continuity across selection lifecycle boundaries", () => {
  const resets = selectionHandlerSource.match(/setExistingVocabulary\(null\)/g);

  assert.ok((resets?.length ?? 0) >= 4);
  assert.match(
    selectionHandlerSource,
    /vocabularyLookupAbortControllerRef\.current\?\.abort\(\)/,
  );
});

test("reader keeps archive save disabled until continuity lookup settles", () => {
  assert.match(
    selectionHandlerSource,
    /isVocabularyLookupPending=\{isVocabularyLookupPending\}/,
  );
  assert.match(
    selectionHandlerSource,
    /setIsVocabularyLookupPending\(\s*isSingleWordSelection\(requestPayload\.selectedText\)/,
  );
  assert.match(selectionHandlerSource, /setIsVocabularyLookupPending\(true\)/);
  assert.match(selectionHandlerSource, /setIsVocabularyLookupPending\(false\)/);
  assert.match(
    selectionHandlerSource,
    /if \(aiState !== "loading"\) \{\s*setIsVocabularyLookupPending\(false\)/,
  );
  assert.match(
    aiPanelSource,
    /isVocabularyLookupPending \|\|\s*saveState !== "idle"/,
  );
});

test("AI panel shows a short saved-meaning cue only for already-saved words", () => {
  assert.match(aiPanelSource, /existingVocabulary/);
  assert.match(aiPanelSource, /saveState === "alreadySaved"/);
  assert.match(aiPanelSource, /Saved meaning/);
  assert.match(aiPanelSource, /existingVocabulary\?\.definition\.trim\(\)/);
  assert.match(aiPanelSource, /getBriefExplanation/);
  assert.match(aiPanelSource, /getVocabularyReencounterCue/);
  assert.match(aiPanelSource, /Due/);
  assert.match(aiPanelSource, /Learning/);
  assert.match(aiPanelSource, /Mastered/);
});

test("new saves offer a non-blocking flashcard path and abort stale due-count work", () => {
  assert.match(selectionHandlerSource, /setVocabularySaveStatus\("saved"\)/);
  assert.match(selectionHandlerSource, /fetch\("\/api\/flashcards"/);
  assert.match(selectionHandlerSource, /dueCardCount=/);
  assert.match(
    selectionHandlerSource,
    /dueCardCountAbortControllerRef\.current\?\.abort\(\)/,
  );
  assert.match(aiPanelSource, /href="\/vocabulary\/flashcards"/);
  assert.match(aiPanelSource, /saveState === "saved"/);
  assert.match(aiPanelSource, /due now/);
  assert.doesNotMatch(aiPanelSource, /frequently missed/i);
});
