import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { readingProgressSchema } from "../src/lib/book-validation.ts";
import {
  createStoredR2FilePath,
  getStoredBookR2Key,
  removeBookFileBestEffort,
  resolveStoredUploadFilePath,
  validateEpubArchive,
} from "../src/lib/book-storage.ts";
import {
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

test("getReaderNavigationDirection maps arrow keys to reader movement", () => {
  assert.equal(getReaderNavigationDirection("ArrowLeft"), "previous");
  assert.equal(getReaderNavigationDirection("ArrowRight"), "next");
  assert.equal(getReaderNavigationDirection("Enter"), null);
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
