import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { checkRateLimit } from "../src/lib/rate-limit.ts";
import {
  deriveVocabularyStatus,
  MASTERY_INTERVAL_THRESHOLD,
} from "../src/lib/vocabulary-query.ts";

async function readWorkspaceFile(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

test("checkRateLimit allows requests within limit", () => {
  const key = "test-allow-" + Date.now();
  const result = checkRateLimit(key, 5, 60_000);

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
  assert.equal(result.retryAfterSeconds, null);
});

test("checkRateLimit blocks requests exceeding limit", () => {
  const key = "test-block-" + Date.now();

  for (let i = 0; i < 3; i++) {
    checkRateLimit(key, 3, 60_000);
  }

  const result = checkRateLimit(key, 3, 60_000);

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(typeof result.retryAfterSeconds, "number");
  assert.ok(result.retryAfterSeconds > 0);
});

test("checkRateLimit returns correct remaining count", () => {
  const key = "test-remaining-" + Date.now();

  const first = checkRateLimit(key, 5, 60_000);
  assert.equal(first.remaining, 4);

  const second = checkRateLimit(key, 5, 60_000);
  assert.equal(second.remaining, 3);
});

test("checkRateLimit tracks separate keys independently", () => {
  const keyA = "test-indep-a-" + Date.now();
  const keyB = "test-indep-b-" + Date.now();

  for (let i = 0; i < 3; i++) {
    checkRateLimit(keyA, 3, 60_000);
  }

  const resultA = checkRateLimit(keyA, 3, 60_000);
  const resultB = checkRateLimit(keyB, 3, 60_000);

  assert.equal(resultA.allowed, false);
  assert.equal(resultB.allowed, true);
});

test("checkRateLimit resets after window expires", async () => {
  const key = "test-expire-" + Date.now();

  for (let i = 0; i < 3; i++) {
    checkRateLimit(key, 3, 1);
  }

  await new Promise((resolve) => setTimeout(resolve, 2));

  const result = checkRateLimit(key, 3, 1);

  assert.equal(result.allowed, true);
});

test("deriveVocabularyStatus returns 'new' when no SRS data", () => {
  assert.equal(deriveVocabularyStatus(null), "new");
});

test("deriveVocabularyStatus returns 'learning' when interval is below threshold", () => {
  assert.equal(deriveVocabularyStatus({ interval: 1 }), "learning");
  assert.equal(deriveVocabularyStatus({ interval: 6 }), "learning");
  assert.equal(deriveVocabularyStatus({ interval: 20 }), "learning");
});

test("deriveVocabularyStatus returns 'mastered' when interval meets threshold", () => {
  assert.equal(
    deriveVocabularyStatus({ interval: MASTERY_INTERVAL_THRESHOLD }),
    "mastered",
  );
  assert.equal(deriveVocabularyStatus({ interval: 30 }), "mastered");
  assert.equal(deriveVocabularyStatus({ interval: 90 }), "mastered");
});

test("deriveVocabularyStatus boundary: threshold minus one is 'learning'", () => {
  assert.equal(
    deriveVocabularyStatus({ interval: MASTERY_INTERVAL_THRESHOLD - 1 }),
    "learning",
  );
});

test("getDashboardData uses Promise.all for parallel queries", async () => {
  const source = await readWorkspaceFile("src/lib/dashboard.ts");

  assert.match(source, /Promise\.all\(\[/);
});

test("getDashboardData fetches heatmap data for 84 days", async () => {
  const source = await readWorkspaceFile("src/lib/dashboard.ts");

  assert.match(
    source,
    /heatmapStart\.setUTCDate\(heatmapStart\.getUTCDate\(\) - 83\)/,
  );
});

test("getDashboardData excludes completed books from booksInProgress count", async () => {
  const source = await readWorkspaceFile("src/lib/dashboard.ts");

  assert.match(source, /COMPLETED_BOOK_THRESHOLD/);
});

test("next.config.ts includes all required security response headers", async () => {
  const source = await readWorkspaceFile("next.config.ts");

  assert.match(source, /X-Content-Type-Options/);
  assert.match(source, /nosniff/);
  assert.match(source, /X-Frame-Options/);
  assert.match(source, /DENY/);
  assert.match(source, /Referrer-Policy/);
  assert.match(source, /strict-origin-when-cross-origin/);
  assert.match(source, /Permissions-Policy/);
  assert.match(source, /Content-Security-Policy/);
});

test("AI explain route includes rate limiting with 429 response", async () => {
  const source = await readWorkspaceFile("src/app/api/ai/explain/route.ts");

  assert.match(source, /checkRateLimit/);
  assert.match(source, /429/);
  assert.match(source, /Retry-After/);
});
