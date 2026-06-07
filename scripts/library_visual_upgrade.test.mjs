import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function readWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

test("library book card and progress ring present the hover overlay reading UI", async () => {
  const [
    bookCardSource,
    progressRingSource,
    deleteButtonSource,
    bookCardActionsSource,
  ] = await Promise.all([
    readWorkspaceFile("src/components/library/book-card.tsx"),
    readWorkspaceFile("src/components/library/progress-ring.tsx"),
    readWorkspaceFile("src/components/library/delete-book-button.tsx"),
    readWorkspaceFile("src/components/library/book-card-actions.tsx"),
  ]);

  assert.match(bookCardSource, /export function BookCard\(/);
  assert.match(bookCardSource, /progressPercentage: number \| null;/);
  assert.match(bookCardSource, /hasCover: boolean;/);
  assert.match(bookCardSource, /coverBlurDataUrl: string \| null;/);
  assert.match(
    bookCardSource,
    /import \{ ProgressRing \} from "@\/components\/library\/progress-ring"/,
  );
  assert.doesNotMatch(bookCardSource, /next\/image/);
  assert.match(bookCardSource, /<img/);
  assert.match(bookCardSource, /src=\{`\/api\/covers\/\$\{id\}\?size=thumb`\}/);
  assert.match(bookCardSource, /loading="lazy"/);
  assert.match(bookCardSource, /decoding="async"/);
  assert.match(
    bookCardSource,
    /backgroundImage: `url\(\$\{coverBlurDataUrl\}\)`/,
  );
  assert.match(bookCardSource, /BookCardActions/);
  assert.match(bookCardSource, /group-hover:pointer-events-auto/);
  assert.match(bookCardSource, /group-hover:opacity-100/);
  assert.match(bookCardSource, /\[@media\(hover:none\)\]:pointer-events-auto/);
  assert.match(bookCardSource, /\[@media\(hover:none\)\]:opacity-100/);
  assert.match(bookCardSource, /Continue · /);
  assert.match(bookCardSource, /const actionLabel =/);
  assert.match(bookCardSource, /hasStartedReading = false/);
  assert.match(
    bookCardSource,
    /hasStartedReading\s*\?\s*progressPercentage != null/,
  );
  assert.match(bookCardSource, /:\s*"Continue"/);
  assert.match(bookCardSource, /Math\.round\(progressPercentage \* 100\)/);
  assert.match(bookCardSource, /percentage=\{progressPercentage \* 100\}/);
  assert.match(bookCardSource, /size=\{24\}/);
  assert.match(bookCardActionsSource, /DeleteBookButton/);
  assert.match(bookCardActionsSource, /iconOnly/);
  assert.match(bookCardSource, /aspect-\[3\/4\]/);
  assert.doesNotMatch(bookCardSource, /CardFooter/);

  assert.match(progressRingSource, /export function ProgressRing\(/);
  assert.match(progressRingSource, /size = 28/);
  assert.match(progressRingSource, /strokeDasharray=\{circumference\}/);
  assert.match(progressRingSource, /strokeDashoffset=\{offset\}/);
  assert.match(progressRingSource, /rotate\(-90/);
  assert.match(progressRingSource, /Math\.round\(percentage\)/);

  assert.match(deleteButtonSource, /iconOnly = false/);
  assert.match(deleteButtonSource, /const handleDelete = \(\) => \{/);
  assert.match(deleteButtonSource, /variant="danger"/);
  assert.match(deleteButtonSource, /hover:bg-red-500\/80/);
});

test("library helpers no longer resolve signed cover URLs", async () => {
  const booksSource = await readWorkspaceFile("src/lib/books.ts");

  assert.doesNotMatch(
    booksSource,
    /export async function getContinueReadingBook\(/,
  );
  assert.doesNotMatch(booksSource, /resolveBookCoverUrl/);
  assert.doesNotMatch(booksSource, /getR2SignedUrl\(getCoverR2Key/);
});

test("library page uses proxy covers, responsive cover grid, and updated upload copy", async () => {
  const [nextConfigSource, pageSource, uploadDialogSource, uploadFormSource] =
    await Promise.all([
      readWorkspaceFile("next.config.ts"),
      readWorkspaceFile("src/app/(main)/library/page.tsx"),
      readWorkspaceFile("src/components/library/upload-book-dialog.tsx"),
      readWorkspaceFile("src/components/library/upload-book-form.tsx"),
    ]);

  assert.doesNotMatch(nextConfigSource, /remotePatterns/);
  assert.doesNotMatch(nextConfigSource, /R2_ENDPOINT/);
  assert.doesNotMatch(nextConfigSource, /R2_BUCKET_NAME/);
  assert.doesNotMatch(nextConfigSource, /images:/);

  assert.match(pageSource, /from "@\/components\/library\/book-card"/);
  assert.doesNotMatch(pageSource, /resolveBookCoverUrl/);
  assert.match(pageSource, /coverBlurDataUrl: true/);
  assert.match(pageSource, /readingProgress:\s*\{[\s\S]*percentage: true/);
  assert.match(pageSource, /updatedAt: true/);
  assert.match(pageSource, /hasCover=\{!!book\.coverUrl\}/);
  assert.match(pageSource, /coverBlurDataUrl=\{book\.coverBlurDataUrl\}/);
  assert.match(
    pageSource,
    /progressPercentage=\{book\.readingProgress\?\.percentage \?\? null\}/,
  );
  assert.match(
    pageSource,
    /hasStartedReading=\{book\.readingProgress != null\}/,
  );
  assert.match(
    pageSource,
    /grid-cols-2[\s\S]*sm:grid-cols-2[\s\S]*md:grid-cols-3[\s\S]*lg:grid-cols-4[\s\S]*xl:grid-cols-5/,
  );
  assert.match(pageSource, /Your Library/);
  assert.match(uploadDialogSource, /Add a new EPUB/);
  assert.doesNotMatch(pageSource, /ContinueReading/);
  assert.doesNotMatch(pageSource, /Curated reading desk/);
  assert.match(pageSource, /Your shelf is waiting/);
  assert.doesNotMatch(pageSource, /Phase 2/);
  assert.doesNotMatch(
    pageSource,
    /Author enrichment comes in the reader slice\./,
  );
  assert.doesNotMatch(pageSource, /Open the reader to parse metadata/);

  assert.match(uploadFormSource, /Book uploaded successfully\./);
});
