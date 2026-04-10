import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function readWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

test("books delete route removes stored covers after deleting EPUB files", async () => {
  const routeSource = await readWorkspaceFile(
    "src/app/api/books/[bookId]/route.ts",
  );

  assert.match(routeSource, /from "@\/lib\/cover-extraction"/);
  assert.match(
    routeSource,
    /await removeBookFileBestEffort\(book\.filePath, \{/,
  );
  assert.match(
    routeSource,
    /if \(book\.coverUrl\) \{\s*await removeBookCover\(book\.coverUrl\);/s,
  );
});
