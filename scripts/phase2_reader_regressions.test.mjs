import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { readingProgressSchema } from "../src/lib/book-validation.ts";
import {
  getUploadRoot,
  resolveStoredUploadFilePath,
  validateEpubArchive,
} from "../src/lib/book-storage.ts";
import {
  getReaderImagePageTarget,
  getReaderNavigationDirection,
  restoreReaderFocus,
} from "../src/lib/reader.ts";

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

test("resolveStoredUploadFilePath confines files to the upload root", () => {
  const uploadRoot = getUploadRoot();
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
