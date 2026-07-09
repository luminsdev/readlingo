import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function readWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

async function listRouteFiles(directory) {
  const entries = await readdir(path.resolve(process.cwd(), directory), {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listRouteFiles(relativePath)));
      continue;
    }

    if (entry.name === "route.ts") {
      files.push(relativePath.replaceAll(path.sep, "/"));
    }
  }

  return files;
}

test("logServerError writes a single structured JSON error entry", async () => {
  const { generateRequestId, logServerError } =
    await import("../src/lib/logger.ts");
  const originalConsoleError = console.error;
  const messages = [];

  console.error = (message) => {
    messages.push(String(message));
  };

  try {
    const requestId = generateRequestId();

    logServerError("TEST_ERROR", "Test failure", {
      error: "boom",
      requestId,
    });

    assert.equal(messages.length, 1);

    const entry = JSON.parse(messages[0]);

    assert.equal(entry.level, "error");
    assert.equal(entry.type, "TEST_ERROR");
    assert.equal(entry.message, "Test failure");
    assert.equal(entry.error, "boom");
    assert.equal(entry.requestId, requestId);
    assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    console.error = originalConsoleError;
  }
});

test("custom error and not-found routes use safe editorial fallback copy", async () => {
  const pages = [
    ["src/app/error.tsx", "Something went wrong", "/dashboard"],
    ["src/app/not-found.tsx", "Page Not Found", "/dashboard"],
    ["src/app/(main)/reader/[bookId]/error.tsx", "Reader Error", "/library"],
    [
      "src/app/(main)/reader/[bookId]/not-found.tsx",
      "Book Not Found",
      "/library",
    ],
    [
      "src/app/(main)/vocabulary/flashcards/error.tsx",
      "Flashcard Error",
      "/vocabulary",
    ],
    ["src/app/(main)/dashboard/error.tsx", "Dashboard Error", "/library"],
  ];

  for (const [filePath, heading, href] of pages) {
    const source = await readWorkspaceFile(filePath);

    assert.match(source, /paper-panel/);
    assert.match(source, new RegExp(heading));
    assert.match(source, new RegExp(`href=\\"${href}\\"`));
    assert.doesNotMatch(source, /error\.message/);
  }
});

test("API route handlers use structured logging and requestId for server errors", async () => {
  const routeFiles = await listRouteFiles("src/app/api");
  const routeSources = await Promise.all(
    routeFiles.map(async (filePath) => [
      filePath,
      await readWorkspaceFile(filePath),
    ]),
  );

  for (const [filePath, source] of routeSources) {
    assert.doesNotMatch(source, /console\.error/, filePath);
  }

  const serverErrorRoutes = [
    "src/app/api/ai/explain/route.ts",
    "src/app/api/books/route.ts",
    "src/app/api/books/[bookId]/file/route.ts",
    "src/app/api/books/[bookId]/locations/route.ts",
    "src/app/api/covers/[bookId]/route.ts",
    "src/app/api/flashcards/route.ts",
    "src/app/api/flashcards/review/route.ts",
    "src/app/api/settings/route.ts",
    "src/app/api/vocabulary/route.ts",
    "src/app/api/vocabulary/[id]/route.ts",
  ];

  for (const filePath of serverErrorRoutes) {
    const source = await readWorkspaceFile(filePath);

    assert.match(source, /generateRequestId/, filePath);
    assert.match(source, /logServerError\(/, filePath);
    assert.match(source, /requestId/, filePath);
  }
});

test("intentional non-API console.error calls remain unchanged", async () => {
  const intentionalFiles = [
    "src/components/reader/reader-epub-view.tsx",
    "src/lib/reader-progress.ts",
    "src/lib/cover-extraction.ts",
  ];

  for (const filePath of intentionalFiles) {
    const source = await readWorkspaceFile(filePath);

    assert.match(source, /console\.error/, filePath);
  }
});
