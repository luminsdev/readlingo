import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function readWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

test("cover persistence creates thumbnail and blur variants", async () => {
  const source = await readWorkspaceFile("src/lib/cover-extraction.ts");

  assert.match(source, /coverBlurDataUrl/);
  assert.match(source, /resize\(\{ width: 360, withoutEnlargement: true \}\)/);
  assert.match(source, /jpeg\(\{ quality: 85 \}\)/);
  assert.match(source, /resize\(\{ width: 10, withoutEnlargement: true \}\)/);
  assert.match(source, /jpeg\(\{ quality: 20 \}\)/);
  assert.match(source, /`covers\/\$\{bookId\}-thumb\.jpg`/);
  assert.match(source, /return \{ coverBlurDataUrl, coverUrl:/);
  assert.match(source, /getCoverThumbnailR2Key\(coverUrl\)/);
  assert.match(source, /deleteFromR2\(key\)/);
});

test("cover proxy route is private, auth-gated, and size-aware", async () => {
  const source = await readWorkspaceFile(
    "src/app/api/covers/[bookId]/route.ts",
  );

  assert.match(source, /export async function GET/);
  assert.match(source, /const session = await auth\(\);/);
  assert.match(source, /getOwnedReaderBook\(session\.user\.id, bookId\)/);
  assert.match(
    source,
    /return NextResponse\.json\(\{ error: "Book not found\." \}, \{ status: 404 \}\)/,
  );
  assert.match(source, /searchParams\.get\("size"\) === "thumb"/);
  assert.match(source, /getCoverThumbnailR2Key\(book\.coverUrl\)/);
  assert.match(source, /downloadFromR2\(coverKey\)/);
  assert.match(source, /"Content-Type": "image\/jpeg"/);
  assert.match(source, /"Cache-Control": "private, max-age=86400"/);
});

test("locations cache helper stores per-user per-book JSON in R2", async () => {
  const source = await readWorkspaceFile("src/lib/locations-cache.ts");

  assert.match(source, /locationsPayloadSchema = z\.object\(\{/);
  assert.match(source, /locationsJson: z\.string\(\)\.max\(2_000_000\)/);
  assert.match(
    source,
    /export function getLocationsR2Key\(userId: string, bookId: string\)/,
  );
  assert.match(source, /return `\$\{userId\}\/\$\{bookId\}\/locations\.json`/);
  assert.match(source, /export async function uploadLocationsToR2/);
  assert.match(source, /export async function downloadLocationsFromR2/);
  assert.match(source, /export async function deleteLocationsFromR2/);
});

test("locations route validates size, shape, ownership, and missing cache", async () => {
  const source = await readWorkspaceFile(
    "src/app/api/books/[bookId]/locations/route.ts",
  );

  assert.match(source, /const MAX_LOCATIONS_PAYLOAD_BYTES = 2_000_000/);
  assert.match(source, /export async function GET/);
  assert.match(source, /export async function POST/);
  assert.match(source, /getOwnedReaderBook\(session\.user\.id, bookId\)/);
  assert.match(
    source,
    /return NextResponse\.json\(\{ locationsJson: null \}\)/,
  );
  assert.match(source, /contentLength > MAX_LOCATIONS_PAYLOAD_BYTES/);
  assert.match(source, /request\.text\(\)/);
  assert.match(source, /rawBody\.length > MAX_LOCATIONS_PAYLOAD_BYTES/);
  assert.match(source, /locationsPayloadSchema\.safeParse/);
  assert.match(source, /Array\.isArray\(locations\)/);
  assert.match(source, /locations\.length <= 10_000/);
  assert.match(source, /location\.length <= 256/);
  assert.match(
    source,
    /await uploadLocationsToR2\(\s*session\.user\.id,\s*book\.id,\s*parsedPayload\.data\.locationsJson,\s*\)/,
  );
});

test("reader loads cached locations before generating and posts first generation", async () => {
  const source = await readWorkspaceFile(
    "src/components/reader/reader-epub-view.tsx",
  );

  assert.match(
    source,
    /fetch\(`\/api\/books\/\$\{initialBookId\}\/locations`\)/,
  );
  assert.match(source, /book\.locations\.load\(locData\.locationsJson\)/);
  assert.match(source, /let locationsLoaded = false;/);
  assert.match(source, /if \(locationsLoaded\) \{/);
  assert.match(source, /book\.locations\s*\.generate\(1024\)/);
  assert.match(source, /locationsJson: book\.locations\.save\(\)/);
  assert.match(source, /method: "POST"/);
});
