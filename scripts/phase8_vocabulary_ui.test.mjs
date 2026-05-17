import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const vocabularyPageSource = await readFile(
  new URL("../src/app/(main)/vocabulary/page.tsx", import.meta.url),
  "utf8",
);
const vocabularyToolbarSource = await readFile(
  new URL(
    "../src/components/vocabulary/vocabulary-toolbar.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("vocabulary page keeps the archive header and toolbar in one compact block", () => {
  assert.match(vocabularyPageSource, /animate-content-in space-y-6/);
  assert.match(vocabularyPageSource, /<header className="space-y-5">/);
  assert.match(
    vocabularyPageSource,
    /<div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">/,
  );
  assert.doesNotMatch(
    vocabularyPageSource,
    /border-line space-y-3 border-b pb-6/,
  );
});

test("vocabulary toolbar uses direct navigation without transition dimming", () => {
  assert.doesNotMatch(vocabularyToolbarSource, /useTransition/);
  assert.doesNotMatch(vocabularyToolbarSource, /startTransition/);
  assert.doesNotMatch(vocabularyToolbarSource, /isPending/);
  assert.doesNotMatch(vocabularyToolbarSource, /opacity-70/);
  assert.match(
    vocabularyToolbarSource,
    /router\.push\(queryString \? `\/vocabulary\?\$\{queryString\}` : "\/vocabulary"\);/,
  );
});

test("vocabulary toolbar renders sort options as pill buttons", () => {
  assert.doesNotMatch(vocabularyToolbarSource, /<select/);
  assert.doesNotMatch(vocabularyToolbarSource, /<option/);
  assert.match(
    vocabularyToolbarSource,
    /\{SORT_OPTIONS\.map\(\(option\) => \(\s*<button/s,
  );
  assert.match(vocabularyToolbarSource, /bg-surface-strong text-foreground/);
});
