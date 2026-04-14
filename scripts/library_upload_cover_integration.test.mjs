import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function readWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

test("books upload route persists extracted covers and cleans them up on rollback", async () => {
  const routeSource = await readWorkspaceFile("src/app/api/books/route.ts");

  assert.match(routeSource, /from "@\/lib\/cover-extraction"/);
  assert.match(routeSource, /let coverUrl: string \| null = null;/);
  assert.match(
    routeSource,
    /const extractedInfo = await extractEpubInfo\(validatedFileBytes\);/,
  );
  assert.match(
    routeSource,
    /title: extractedInfo\.metadata\.title \|\| createBookTitle\(file\.name\),/,
  );
  assert.match(routeSource, /author: extractedInfo\.metadata\.author,/);
  assert.match(
    routeSource,
    /language: extractedInfo\.metadata\.language \|\| "und",/,
  );
  assert.match(
    routeSource,
    /if \(extractedInfo\.cover\) \{\s*coverUrl = await persistBookCover\(\s*provisionalBook\.id,\s*extractedInfo\.cover,?\s*\);/s,
  );
  assert.match(routeSource, /data: \{ filePath, coverUrl \},/);
  assert.match(
    routeSource,
    /if \(coverUrl\) \{\s*await removeBookCover\(coverUrl\);/s,
  );
});
