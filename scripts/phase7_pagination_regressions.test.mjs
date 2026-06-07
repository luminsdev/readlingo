import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

test("library page uses URL-backed server-side pagination", async () => {
  const source = await readWorkspaceFile("src/app/(main)/library/page.tsx");

  assert.match(
    source,
    /searchParams:\s*Promise<\{ page\?: string; q\?: string; collection\?: string \}>/,
  );
  assert.match(source, /const PAGE_SIZE = 20;/);
  assert.match(source, /Promise\.all\(\[/);
  assert.match(source, /prisma\.book\.count\(/);
  assert.match(source, /skip:\s*\(currentPage - 1\) \* PAGE_SIZE/);
  assert.match(source, /take:\s*PAGE_SIZE/);
  assert.match(source, /redirect\(\s*getLibraryHref\(/);
  assert.match(source, /<LibraryPagination/);
  assert.match(
    source,
    /filters=\{\{ q: trimmedQuery, collection: collectionId \}\}/,
  );
  assert.match(source, /getLibraryHref\(filters, \{\s*page/s);
  assert.doesNotMatch(source, /href=\{`\/library\?page=/);
});

test("vocabulary page uses URL-backed server-side pagination", async () => {
  const source = await readWorkspaceFile("src/app/(main)/vocabulary/page.tsx");

  assert.match(
    source,
    /searchParams:\s*Promise<\{\s*page\?: string;\s*q\?: string;\s*status\?: string;\s*sort\?: string;\s*\}>/s,
  );
  assert.match(source, /const PAGE_SIZE = 20;/);
  assert.match(source, /Promise\.all\(\[/);
  assert.match(source, /prisma\.vocabulary\.count\(/);
  assert.match(source, /skip:\s*\(currentPage - 1\) \* PAGE_SIZE/);
  assert.match(source, /take:\s*PAGE_SIZE/);
  assert.match(source, /redirectParams\.set\("page", String\(totalPages\)\)/);
  assert.match(
    source,
    /redirect\(`\/vocabulary\?\$\{redirectParams\.toString\(\)\}`\)/,
  );
  assert.match(source, /<VocabularyPagination/);
  assert.match(source, /href=\{buildPageUrl\(page\)\}/);
  assert.doesNotMatch(source, /href=\{`\/vocabulary\?page=/);
});

test("library loading state reserves pagination space", async () => {
  const source = await readWorkspaceFile("src/app/(main)/library/loading.tsx");

  assert.match(source, /Pagination skeleton/);
  assert.match(source, /mt-8 flex items-center justify-center gap-2/);
  assert.match(source, /Array\.from\(\{ length: 3 \}/);
});
