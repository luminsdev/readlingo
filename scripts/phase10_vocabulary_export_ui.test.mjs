import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const vocabularyPageSource = await readFile(
  new URL("../src/app/(main)/vocabulary/page.tsx", import.meta.url),
  "utf8",
);
const vocabularyExportActionsSource = await readFile(
  new URL(
    "../src/components/vocabulary/vocabulary-export-actions.tsx",
    import.meta.url,
  ),
  "utf8",
).catch((error) => {
  if (error?.code === "ENOENT") {
    return "";
  }

  throw error;
});

test("vocabulary page places export actions below the compact archive header", () => {
  assert.match(
    vocabularyPageSource,
    /import \{ VocabularyExportActions \} from "@\/components\/vocabulary\/vocabulary-export-actions";/,
  );
  assert.match(
    vocabularyPageSource,
    /<\/header>\s*<VocabularyExportActions[\s\S]*?matchCount=\{totalCount\}[\s\S]*?searchQuery=\{searchQuery\}[\s\S]*?sortBy=\{sortBy\}[\s\S]*?statusFilter=\{statusFilter\}/,
  );
});

test("export actions explain current-filter counts and disabled states", () => {
  assert.match(vocabularyExportActionsSource, /Export CSV \(current filters\)/);
  assert.match(
    vocabularyExportActionsSource,
    /Export Anki TSV \(current filters\)/,
  );
  assert.match(
    vocabularyExportActionsSource,
    /word \| definition \| contextSentence \| exampleSentence \| tags/,
  );
  assert.match(vocabularyExportActionsSource, /matchCount === 0/);
  assert.match(
    vocabularyExportActionsSource,
    /matchCount > VOCABULARY_EXPORT_MAX_ROWS/,
  );
  assert.match(vocabularyExportActionsSource, /nothing to export/i);
  assert.match(vocabularyExportActionsSource, /Refine your filters/);
  assert.match(vocabularyExportActionsSource, /disabled=\{isExportDisabled\}/g);
});

test("export requests forward only the active vocabulary filters", () => {
  assert.match(
    vocabularyExportActionsSource,
    /params\.set\("q", searchQuery\)/,
  );
  assert.match(
    vocabularyExportActionsSource,
    /params\.set\("status", statusFilter\)/,
  );
  assert.match(vocabularyExportActionsSource, /params\.set\("sort", sortBy\)/);
  assert.doesNotMatch(
    vocabularyExportActionsSource,
    /params\.(?:set|append)\("page"/,
  );
  assert.match(
    vocabularyExportActionsSource,
    /`\/api\/vocabulary\/export\/\$\{format\}\?\$\{params\.toString\(\)\}`/,
  );
});

test("export actions surface API errors and download successful blobs", () => {
  assert.match(vocabularyExportActionsSource, /await fetch\(url\)/);
  assert.match(vocabularyExportActionsSource, /response\.json\(\)\.catch/);
  assert.match(vocabularyExportActionsSource, /payload\?\.error/);
  assert.match(vocabularyExportActionsSource, /role="alert"/);
  assert.match(vocabularyExportActionsSource, /await response\.blob\(\)/);
  assert.match(vocabularyExportActionsSource, /URL\.createObjectURL/);
  assert.match(
    vocabularyExportActionsSource,
    /response\.headers\.get\("Content-Disposition"\)/,
  );
  assert.match(
    vocabularyExportActionsSource,
    /createVocabularyExportFilename\(format\)/,
  );
  assert.match(vocabularyExportActionsSource, /anchor\.download =/);
  assert.match(vocabularyExportActionsSource, /anchor\.click\(\)/);
  assert.match(vocabularyExportActionsSource, /URL\.revokeObjectURL/);
  assert.match(vocabularyExportActionsSource, /Exporting CSV\.\.\./);
  assert.match(vocabularyExportActionsSource, /Exporting Anki TSV\.\.\./);
});
