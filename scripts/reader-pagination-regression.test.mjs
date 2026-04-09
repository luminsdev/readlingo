import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

test("reader reflows pagination after applying loaded-content presentation changes", async () => {
  const epubViewSource = await readWorkspaceFile(
    "src/components/reader/reader-epub-view.tsx",
  );

  assert.match(
    epubViewSource,
    /applyReaderThemeToContents\(contents, readerTheme\);\s+applyReaderFontSizeToContents\(contents, fontSize\);[\s\S]*?resize\(\);/s,
  );

  const styleReaderContentsMatch = epubViewSource.match(
    /const styleReaderContents = useCallback\(\(contents: Contents\) => \{([\s\S]*?)\n\s*\}, \[\]\);/,
  );

  assert.ok(styleReaderContentsMatch);
  assert.doesNotMatch(styleReaderContentsMatch[1], /resize\(/);
});
