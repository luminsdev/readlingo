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

  assert.doesNotMatch(epubViewSource, /RenditionWithOptionalResize/);
  assert.doesNotMatch(epubViewSource, /\.resize\(/);

  assert.match(
    epubViewSource,
    /applyReaderThemeToContents\(contents, readerTheme\);\s+applyReaderFontSizeToContents\(contents, fontSize\);/s,
  );
  assert.match(epubViewSource, /const rendition = renditionRef\.current;/);
  assert.match(
    epubViewSource,
    /const currentCfi = \(rendition\?\.location as EpubLocation \| undefined\)\?\.start\s*\?\.cfi;/s,
  );
  assert.match(epubViewSource, /if \(rendition && currentCfi\) \{/);
  assert.match(
    epubViewSource,
    /requestAnimationFrame\(\(\) => \{\s+void rendition\.display\(currentCfi\);\s+\}\);/s,
  );

  const styleReaderContentsMatch = epubViewSource.match(
    /const styleReaderContents = useCallback\(\(contents: Contents\) => \{([\s\S]*?)\n\s*\}, \[\]\);/,
  );

  assert.ok(styleReaderContentsMatch);
  assert.doesNotMatch(styleReaderContentsMatch[1], /resize\(/);
  assert.doesNotMatch(styleReaderContentsMatch[1], /display\(/);
});
