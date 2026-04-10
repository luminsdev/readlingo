import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

test("reader reflows pagination after font-size and zen-mode container changes", async () => {
  const epubViewSource = await readWorkspaceFile(
    "src/components/reader/reader-epub-view.tsx",
  );

  assert.match(
    epubViewSource,
    /type RenditionWithOptionalResize = Rendition & \{/,
  );
  assert.match(
    epubViewSource,
    /resize: \(width\?: number, height\?: number\) => void;/,
  );

  assert.match(
    epubViewSource,
    /applyReaderThemeToContents\(contents, readerTheme\);\s+applyReaderFontSizeToContents\(contents, fontSize\);/s,
  );
  assert.match(epubViewSource, /const rendition = renditionRef\.current;/);
  assert.match(
    epubViewSource,
    /const currentCfi = \(rendition\?\.location as EpubLocation \| undefined\)\?\.start\s*\?\.cfi;/s,
  );
  assert.match(epubViewSource, /const viewer = viewerRef\.current;/);
  assert.match(epubViewSource, /if \(rendition && currentCfi\) \{/);
  assert.match(
    epubViewSource,
    /requestAnimationFrame\(\(\) => \{\s+if \(viewer\) \{\s+const width = viewer\.clientWidth;\s+const height = viewer\.clientHeight;\s+if \(width > 0 && height > 0\) \{\s+\(rendition as RenditionWithOptionalResize\)\.resize\(width, height\);\s+\}\s+\}\s+void rendition\.display\(currentCfi\);\s+\}\);/s,
  );
  assert.match(epubViewSource, /useEffect\(\(\) => \{\s+if \(!isReady\) \{/s);
  assert.match(
    epubViewSource,
    /if \(!rendition \|\| !viewer \|\| !currentCfi\) \{\s+return;\s+\}/s,
  );
  assert.match(
    epubViewSource,
    /const frameId = requestAnimationFrame\(\(\) => \{\s+const width = viewer\.clientWidth;\s+const height = viewer\.clientHeight;\s+if \(width > 0 && height > 0\) \{\s+\(rendition as RenditionWithOptionalResize\)\.resize\(width, height\);\s+void rendition\.display\(currentCfi\);\s+\}\s+\}\);/s,
  );
  assert.match(
    epubViewSource,
    /return \(\) => cancelAnimationFrame\(frameId\);/,
  );
  assert.match(epubViewSource, /\}, \[isZenMode, isReady\]\);/);

  const styleReaderContentsMatch = epubViewSource.match(
    /const styleReaderContents = useCallback\(\(contents: Contents\) => \{([\s\S]*?)\n\s*\}, \[\]\);/,
  );

  assert.ok(styleReaderContentsMatch);
  assert.doesNotMatch(styleReaderContentsMatch[1], /resize\(/);
  assert.doesNotMatch(styleReaderContentsMatch[1], /display\(/);
});
