import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function readWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

test("library book card and continue reading components present the upgraded reading UI", async () => {
  const [bookCardSource, continueReadingSource] = await Promise.all([
    readWorkspaceFile("src/components/library/book-card.tsx"),
    readWorkspaceFile("src/components/library/continue-reading.tsx"),
  ]);

  assert.match(bookCardSource, /export function BookCard\(/);
  assert.match(bookCardSource, /import Image from "next\/image"/);
  assert.match(bookCardSource, /const FALLBACK_COLORS = \[/);
  assert.match(bookCardSource, /DeleteBookButton/);
  assert.match(
    bookCardSource,
    /<Link href=\{`\/reader\/\$\{id\}`\}>Read<\/Link>/,
  );
  assert.match(bookCardSource, /Unknown author/);
  assert.match(bookCardSource, /aspect-\[3\/4\]/);
  assert.doesNotMatch(bookCardSource, /<img\b/);

  assert.match(continueReadingSource, /export function ContinueReading\(/);
  assert.match(continueReadingSource, /import Image from "next\/image"/);
  assert.match(continueReadingSource, /Continue/);
  assert.match(continueReadingSource, /complete/);
  assert.match(continueReadingSource, /In progress/);
  assert.doesNotMatch(continueReadingSource, /<img\b/);
});

test("library helpers resolve continue reading entries and signed cover URLs", async () => {
  const booksSource = await readWorkspaceFile("src/lib/books.ts");

  assert.match(booksSource, /export async function getContinueReadingBook\(/);
  assert.match(booksSource, /orderBy:\s*\{\s*updatedAt:\s*"desc",?\s*\}/);
  assert.match(booksSource, /export async function resolveBookCoverUrl\(/);
  assert.match(
    booksSource,
    /getR2SignedUrl\(getCoverR2Key\(coverUrl\), 60 \* 60 \* 24\)/,
  );
});

test("library page uses continue reading, responsive cover grid, and updated upload copy", async () => {
  const [nextConfigSource, pageSource, uploadFormSource] = await Promise.all([
    readWorkspaceFile("next.config.ts"),
    readWorkspaceFile("src/app/(main)/library/page.tsx"),
    readWorkspaceFile("src/components/library/upload-book-form.tsx"),
  ]);

  assert.match(nextConfigSource, /remotePatterns/);
  assert.match(nextConfigSource, /R2_ENDPOINT/);
  assert.match(nextConfigSource, /R2_BUCKET_NAME/);

  assert.match(pageSource, /from "@\/components\/library\/book-card"/);
  assert.match(pageSource, /from "@\/components\/library\/continue-reading"/);
  assert.match(pageSource, /getContinueReadingBook/);
  assert.match(pageSource, /resolveBookCoverUrl/);
  assert.match(pageSource, /Promise\.all\(\[/);
  assert.match(
    pageSource,
    /grid-cols-2[\s\S]*sm:grid-cols-3[\s\S]*lg:grid-cols-4[\s\S]*xl:grid-cols-5/,
  );
  assert.match(pageSource, /Your Library/);
  assert.doesNotMatch(pageSource, /Phase 2/);
  assert.doesNotMatch(
    pageSource,
    /Author enrichment comes in the reader slice\./,
  );
  assert.doesNotMatch(pageSource, /Open the reader to parse metadata/);

  assert.match(uploadFormSource, /Book uploaded successfully\./);
});
