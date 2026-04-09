import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readingProgressSchema } from "../src/lib/book-validation.ts";
import {
  getReaderActiveTocHref,
  getReaderEscapeAction,
  normalizeReaderTocItems,
} from "../src/components/reader/reader-table-of-contents-utils.ts";
import { getReaderBookLoadKey } from "../src/components/reader/reader-epub-view-utils.ts";
import {
  createStoredR2FilePath,
  getStoredBookR2Key,
  removeBookFileBestEffort,
  resolveStoredUploadFilePath,
  validateEpubArchive,
} from "../src/lib/book-storage.ts";
import {
  applyReaderThemeToContents,
  getReaderImagePageTarget,
  getReaderNavigationDirection,
  restoreReaderFocus,
} from "../src/lib/reader.ts";
import { createReaderPagehideFlushHandler } from "../src/lib/reader-progress.ts";

function createNode(tagName, children = [], textContent = "") {
  const node = {
    tagName,
    textContent,
    children,
  };

  for (const child of children) {
    child.parentElement = node;
  }

  return node;
}

function createStyleTarget() {
  const properties = new Map();

  return {
    style: {
      setProperty(name, value, priority = "") {
        properties.set(name, { priority, value });
      },
    },
    getProperty(name) {
      return properties.get(name);
    },
  };
}

async function readWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

test("getReaderNavigationDirection maps arrow keys to reader movement", () => {
  assert.equal(getReaderNavigationDirection("ArrowLeft"), "previous");
  assert.equal(getReaderNavigationDirection("ArrowRight"), "next");
  assert.equal(getReaderNavigationDirection("Enter"), null);
});

test("reader preference persistence stays fire-and-forget without a sync indicator", async () => {
  const [toolbarSource, workspaceSource] = await Promise.all([
    readWorkspaceFile("src/components/reader/reader-toolbar.tsx"),
    readWorkspaceFile("src/components/reader/reader-workspace.tsx"),
  ]);

  assert.doesNotMatch(toolbarSource, /Syncing reader settings\.\.\./);
  assert.doesNotMatch(toolbarSource, /isPersistingPreferences/);
  assert.doesNotMatch(workspaceSource, /isPersistingPreferences/);
});

test("reader progress percentage state is threaded through the workspace", async () => {
  const [workspaceTypesSource, workspaceSource] = await Promise.all([
    readWorkspaceFile("src/components/reader/reader-workspace-types.ts"),
    readWorkspaceFile("src/components/reader/reader-workspace.tsx"),
  ]);

  assert.match(workspaceTypesSource, /progressPercentage: number \| null;/);
  assert.match(workspaceSource, /progressPercentage: null,\s*\n\s*};/);
  assert.match(
    workspaceSource,
    /<ReaderToolbar[\s\S]*progressPercentage=\{readerState\.progressPercentage\}/,
  );
  assert.match(
    workspaceSource,
    /<ReaderEpubView[\s\S]*progressPercentage=\{readerState\.progressPercentage\}/,
  );
  assert.match(
    workspaceSource,
    /<ReaderProgressSync[\s\S]*progressPercentage=\{readerState\.progressPercentage\}/,
  );
});

test("reader progress UI renders percentage badges and status copy", async () => {
  const [toolbarSource, progressSyncSource] = await Promise.all([
    readWorkspaceFile("src/components/reader/reader-toolbar.tsx"),
    readWorkspaceFile("src/components/reader/reader-progress-sync.tsx"),
  ]);

  assert.match(toolbarSource, /progressPercentage: number \| null;/);
  assert.match(toolbarSource, /\{progressPercentage !== null \? \(/);
  assert.match(toolbarSource, /<Badge>\{progressPercentage}%<\/Badge>/);

  assert.match(progressSyncSource, /progressPercentage: number \| null;/);
  assert.match(progressSyncSource, /\{progressPercentage !== null \? \(/);
  assert.match(progressSyncSource, /\{progressPercentage}% complete/);
});

test("reader EPUB view generates locations in the background and renders a progress bar", async () => {
  const epubViewSource = await readWorkspaceFile(
    "src/components/reader/reader-epub-view.tsx",
  );
  const locationLengthGuards = [
    ...epubViewSource.matchAll(/book\.locations\.length\(\) > 0/g),
  ];

  assert.match(epubViewSource, /progressPercentage: number \| null;/);
  assert.match(epubViewSource, /progressPercentage: null,\s*\n\s*}\);/);
  assert.match(epubViewSource, /book\.locations\s*\.generate\(1024\)/);
  assert.doesNotMatch(
    epubViewSource,
    /await\s+book\.locations\.generate\(1024\)/,
  );
  assert.equal(locationLengthGuards.length, 2);
  assert.match(
    epubViewSource,
    /progressPercentage = Math\.round\(pct \* 100\);/,
  );
  assert.match(epubViewSource, /role="progressbar"/);
  assert.match(epubViewSource, /aria-label="Reading progress"/);
  assert.match(
    epubViewSource,
    /style=\{\{ width: `\$\{progressPercentage}%` \}\}/,
  );
});

test("normalizeReaderTocItems keeps nested chapter structure and drops invalid entries", () => {
  assert.deepEqual(
    normalizeReaderTocItems([
      {
        href: "Text/chapter-1.xhtml#intro",
        label: " Chapter 1 ",
        subitems: [
          {
            href: "Text/chapter-1.xhtml#scene-1",
            label: " Scene 1 ",
            subitems: [],
          },
        ],
      },
      {
        href: "   ",
        label: "Missing href",
        subitems: [],
      },
      {
        href: "Text/chapter-2.xhtml",
        label: "",
        subitems: [],
      },
    ]),
    [
      {
        href: "Text/chapter-1.xhtml#intro",
        label: "Chapter 1",
        subitems: [
          {
            href: "Text/chapter-1.xhtml#scene-1",
            label: "Scene 1",
            subitems: [],
          },
        ],
      },
    ],
  );
});

test("normalizeReaderTocItems resolves nav-relative hrefs to spine-relative targets", () => {
  assert.deepEqual(
    normalizeReaderTocItems(
      [
        {
          href: "../Text/chapter-1.xhtml#intro",
          label: " Chapter 1 ",
          subitems: [
            {
              href: "../Text/chapter-1.xhtml#scene-1",
              label: " Scene 1 ",
              subitems: [],
            },
          ],
        },
      ],
      { navigationPath: "nav/toc.xhtml" },
    ),
    [
      {
        href: "Text/chapter-1.xhtml#intro",
        label: "Chapter 1",
        subitems: [
          {
            href: "Text/chapter-1.xhtml#scene-1",
            label: "Scene 1",
            subitems: [],
          },
        ],
      },
    ],
  );
});

test("getReaderActiveTocHref matches the current chapter when TOC entries include anchors", () => {
  const tocItems = [
    {
      href: "Text/cover.xhtml",
      label: "Cover",
      subitems: [],
    },
    {
      href: "Text/chapter-1.xhtml#intro",
      label: "Chapter 1",
      subitems: [
        {
          href: "Text/chapter-1.xhtml#scene-1",
          label: "Scene 1",
          subitems: [],
        },
      ],
    },
  ];

  assert.equal(
    getReaderActiveTocHref(tocItems, "Text/chapter-1.xhtml"),
    "Text/chapter-1.xhtml#intro",
  );
  assert.equal(
    getReaderActiveTocHref(tocItems, "Text/chapter-1.xhtml#scene-1"),
    "Text/chapter-1.xhtml#scene-1",
  );
  assert.equal(getReaderActiveTocHref(tocItems, "Text/appendix.xhtml"), null);
});

test("getReaderEscapeAction prioritizes popover, AI sidebar, then TOC", () => {
  assert.equal(
    getReaderEscapeAction({
      hasPopoverOpen: true,
      isAiSidebarOpen: true,
      isTocOpen: true,
    }),
    "dismiss-popover",
  );
  assert.equal(
    getReaderEscapeAction({
      hasPopoverOpen: false,
      isAiSidebarOpen: true,
      isTocOpen: true,
    }),
    "dismiss-ai-sidebar",
  );
  assert.equal(
    getReaderEscapeAction({
      hasPopoverOpen: false,
      isAiSidebarOpen: false,
      isTocOpen: true,
    }),
    "dismiss-toc",
  );
  assert.equal(
    getReaderEscapeAction({
      hasPopoverOpen: false,
      isAiSidebarOpen: false,
      isTocOpen: false,
    }),
    null,
  );
});

test("getReaderBookLoadKey stays stable for the same book snapshot values", () => {
  const initialKey = getReaderBookLoadKey({
    id: "book-123",
    title: "The Reader",
    author: "A. Writer",
    language: "en",
    progressCfi: "epubcfi(/6/2!/4/2/8,/1:0,/1:12)",
  });

  assert.equal(
    initialKey,
    getReaderBookLoadKey({
      id: "book-123",
      title: "The Reader",
      author: "A. Writer",
      language: "en",
      progressCfi: "epubcfi(/6/2!/4/2/8,/1:0,/1:12)",
    }),
  );

  assert.notEqual(
    initialKey,
    getReaderBookLoadKey({
      id: "book-123",
      title: "The Reader",
      author: "A. Writer",
      language: "en",
      progressCfi: "epubcfi(/6/2!/4/2/9,/1:0,/1:12)",
    }),
  );
});

test("restoreReaderFocus focuses the reader surface and active rendition contents", () => {
  const calls = [];
  const surface = {
    focus(options) {
      calls.push(["surface", options]);
    },
  };
  const readerBody = {
    focus(options) {
      calls.push(["body", options]);
    },
  };
  const readerWindow = {
    focus() {
      calls.push(["window"]);
    },
  };

  const focused = restoreReaderFocus(surface, [
    {
      document: { body: readerBody },
      window: readerWindow,
    },
  ]);

  assert.equal(focused, true);
  assert.deepEqual(calls, [
    ["surface", { preventScroll: true }],
    ["window"],
    ["body", { preventScroll: true }],
  ]);
});

test("getReaderImagePageTarget finds nested image-only pages", () => {
  const image = createNode("IMG");
  const wrapper = createNode("DIV", [image]);
  const body = createNode("BODY", [wrapper]);

  assert.deepEqual(getReaderImagePageTarget(body), {
    containerChain: [body, wrapper, image],
    mediaTagName: "IMG",
  });
});

test("getReaderImagePageTarget ignores chapters with mixed text content", () => {
  const paragraph = createNode("P", [], "Chapter opener");
  const image = createNode("IMG");
  const wrapper = createNode("DIV", [paragraph, image]);
  const body = createNode("BODY", [wrapper], "Chapter opener");

  assert.equal(getReaderImagePageTarget(body), null);
});

test("applyReaderThemeToContents applies the default light reader theme for rendition documents", () => {
  const root = createStyleTarget();
  const body = createStyleTarget();

  applyReaderThemeToContents([
    {
      document: {
        body,
        documentElement: root,
      },
    },
  ]);

  assert.deepEqual(root.getProperty("color-scheme"), {
    priority: "important",
    value: "light",
  });
  assert.deepEqual(root.getProperty("background-color"), {
    priority: "important",
    value: "#ffffff",
  });
  assert.deepEqual(body.getProperty("background-color"), {
    priority: "important",
    value: "#ffffff",
  });
  assert.deepEqual(body.getProperty("color"), {
    priority: "important",
    value: "#1a1a1a",
  });
});

test("applyReaderThemeToContents honors explicit dark reader theme colors", () => {
  const root = createStyleTarget();
  const body = createStyleTarget();

  applyReaderThemeToContents(
    [
      {
        document: {
          body,
          documentElement: root,
        },
      },
    ],
    "dark",
  );

  assert.deepEqual(root.getProperty("color-scheme"), {
    priority: "important",
    value: "dark",
  });
  assert.deepEqual(root.getProperty("background-color"), {
    priority: "important",
    value: "#1a1a1a",
  });
  assert.deepEqual(body.getProperty("background-color"), {
    priority: "important",
    value: "#1a1a1a",
  });
  assert.deepEqual(body.getProperty("color"), {
    priority: "important",
    value: "#d4d4d4",
  });
});

test("readingProgressSchema rejects malformed EPUB CFIs", () => {
  assert.equal(
    readingProgressSchema.safeParse({ cfi: "epubcfi(/6/2!/4/2/8,/1:0,/1:12)" })
      .success,
    true,
  );
  assert.equal(
    readingProgressSchema.safeParse({ cfi: "chapter-1" }).success,
    false,
  );
});

test("createReaderPagehideFlushHandler uses the latest CFI and skips persisted positions", async () => {
  let activeCfi = "epubcfi(/6/2!/4/2/8,/1:0,/1:12)";
  let lastPersistedCfi = activeCfi;
  const calls = [];

  const flushProgress = createReaderPagehideFlushHandler({
    getActiveCfi: () => activeCfi,
    getLastPersistedCfi: () => lastPersistedCfi,
    saveProgress: async (cfi, keepalive = false) => {
      calls.push({ cfi, keepalive });
    },
  });

  flushProgress();
  assert.equal(calls.length, 0);

  activeCfi = "epubcfi(/6/2!/4/2/10,/1:0,/1:12)";
  flushProgress();
  assert.deepEqual(calls, [
    { cfi: "epubcfi(/6/2!/4/2/10,/1:0,/1:12)", keepalive: true },
  ]);

  lastPersistedCfi = activeCfi;
  flushProgress();
  assert.equal(calls.length, 1);
});

test("resolveStoredUploadFilePath confines files to the upload root", () => {
  const uploadRoot = path.resolve(
    process.cwd(),
    process.env.UPLOAD_DIR ?? "uploads",
  );
  const validPath = path.join("uploads", "user-1", "book-1.epub");

  assert.equal(
    resolveStoredUploadFilePath(validPath),
    path.resolve(uploadRoot, "user-1", "book-1.epub"),
  );
  assert.throws(() => resolveStoredUploadFilePath("..\\..\\secret.txt"));
  assert.throws(() =>
    resolveStoredUploadFilePath(path.resolve(process.cwd(), "package.json")),
  );
});

test("resolveStoredUploadFilePath leaves r2 storage paths untouched", () => {
  assert.equal(
    resolveStoredUploadFilePath("r2://user-1/book-1.epub"),
    "r2://user-1/book-1.epub",
  );
});

test("createStoredR2FilePath and getStoredBookR2Key round-trip R2 object keys", () => {
  const key = "user-1/book-1.epub";

  assert.equal(createStoredR2FilePath(key), "r2://user-1/book-1.epub");
  assert.equal(getStoredBookR2Key("r2://user-1/book-1.epub"), key);
  assert.throws(() => getStoredBookR2Key("uploads/user-1/book-1.epub"));
  assert.throws(() => getStoredBookR2Key("r2://"));
});

test("getR2SignedUrl works without R2_PUBLIC_URL configured", async () => {
  const previousEnv = {
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  };

  process.env.R2_ACCOUNT_ID = "test-account";
  process.env.R2_ACCESS_KEY_ID = "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
  delete process.env.R2_PUBLIC_URL;

  try {
    const moduleUrl = new URL(
      `../src/lib/r2.ts?case=${Date.now()}`,
      import.meta.url,
    );
    const { getR2SignedUrl } = await import(moduleUrl.href);

    const signedUrl = await getR2SignedUrl("user-1/book-1.epub", 60);
    const parsedUrl = new URL(signedUrl);

    assert.equal(parsedUrl.origin, "https://example.r2.cloudflarestorage.com");
    assert.equal(parsedUrl.pathname, "/test-bucket/user-1/book-1.epub");
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("removeBookFileBestEffort logs cleanup failures without throwing", async () => {
  const loggedErrors = [];

  await assert.doesNotReject(() =>
    removeBookFileBestEffort("r2://user-1/book-1.epub", {
      removeFile: async () => {
        throw new Error("cleanup failed");
      },
      onError: (error) => {
        loggedErrors.push(
          error instanceof Error ? error.message : String(error),
        );
      },
    }),
  );

  assert.deepEqual(loggedErrors, ["cleanup failed"]);
});

test("validateEpubArchive rejects malformed uploads and accepts minimal EPUB structure", async () => {
  const validFile = new File(
    [
      Buffer.from(
        "PK\x03\x04mimetypeapplication/epub+zipMETA-INF/container.xmlOPS/content.opf",
        "latin1",
      ),
    ],
    "book.epub",
    { type: "application/epub+zip" },
  );
  const invalidFile = new File([Buffer.from("not-an-epub")], "book.epub", {
    type: "application/epub+zip",
  });

  assert.equal(
    (await validateEpubArchive(validFile)) instanceof Uint8Array,
    true,
  );
  await assert.rejects(() => validateEpubArchive(invalidFile));
});
