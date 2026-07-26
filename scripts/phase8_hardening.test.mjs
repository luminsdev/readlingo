import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  AI_RATE_LIMIT,
  AI_RATE_WINDOW_MS,
  checkAiRateLimit,
  getAiRateLimitKey,
} from "../src/lib/ai-rate-limit.ts";
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

test("shared AI rate budget uses the locked key family and limits", () => {
  const userId = "phase11-" + Date.now();

  assert.equal(AI_RATE_LIMIT, 30);
  assert.equal(AI_RATE_WINDOW_MS, 60_000);
  assert.equal(getAiRateLimitKey(userId), `ai:${userId}`);

  for (let i = 0; i < AI_RATE_LIMIT; i++) {
    assert.equal(checkAiRateLimit(userId).allowed, true);
  }

  const blocked = checkAiRateLimit(userId);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
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

test("AI routes share the locked rate budget and preserve 429 responses", async () => {
  const [rateLimitSource, explainSource, deepActionSource] = await Promise.all([
    readWorkspaceFile("src/lib/ai-rate-limit.ts"),
    readWorkspaceFile("src/app/api/ai/explain/route.ts"),
    readWorkspaceFile("src/app/api/ai/deep-action/route.ts"),
  ]);

  assert.match(rateLimitSource, /getAiRateLimitKey/);
  assert.match(rateLimitSource, /`ai:\$\{userId\}`/);
  assert.match(rateLimitSource, /checkRateLimit/);
  assert.match(rateLimitSource, /deep actions share/i);

  for (const source of [explainSource, deepActionSource]) {
    assert.match(source, /checkAiRateLimit/);
    assert.match(source, /429/);
    assert.match(source, /Retry-After/);
  }
});

test("deep-action route is authenticated, validated, streamed, and logged", async () => {
  const [routeSource, helperSource] = await Promise.all([
    readWorkspaceFile("src/app/api/ai/deep-action/route.ts"),
    readWorkspaceFile("src/lib/ai-deep-actions.ts"),
  ]);

  assert.match(routeSource, /await auth\(\)/);
  assert.match(routeSource, /status: 401/);
  assert.match(routeSource, /deepActionRequestSchema\.safeParse/);
  assert.match(routeSource, /status: 400/);
  assert.match(routeSource, /streamDeepAction/);
  assert.match(routeSource, /toTextStreamResponse/);
  assert.match(routeSource, /Cache-Control/);
  assert.match(routeSource, /no-store/);
  assert.match(routeSource, /logServerError/);
  assert.match(routeSource, /requestId/);
  assert.match(routeSource, /onError/);
  assert.match(routeSource, /onFinish/);
  assert.match(routeSource, /errorType/);
  assert.match(helperSource, /onError: callbacks\.onError/);
  assert.match(helperSource, /onFinish: callbacks\.onFinish/);
});

test("deep-action route validates eligibility before mutating the rate budget", async () => {
  const routeSource = await readWorkspaceFile(
    "src/app/api/ai/deep-action/route.ts",
  );
  const authIndex = routeSource.indexOf("await auth()");
  const unauthorizedIndex = routeSource.indexOf("status: 401");
  const requestIdIndex = routeSource.indexOf("generateRequestId()");
  const jsonParseIndex = routeSource.indexOf(
    "await request.json().catch(() => null)",
  );
  const schemaValidationIndex = routeSource.indexOf(
    "deepActionRequestSchema.safeParse(body)",
  );
  const eligibilityIndex = routeSource.indexOf("getEligibleDeepActions({");
  const rateLimitIndex = routeSource.indexOf("checkAiRateLimit(");
  const retryAfterIndex = routeSource.indexOf("Retry-After");
  const abortControllerIndex = routeSource.indexOf("new AbortController()");
  const timeoutStateIndex = routeSource.indexOf(
    "getDeepActionServerTimeoutMs(parsedPayload.data.action)",
  );
  const timeoutIndex = routeSource.indexOf("setTimeout(");
  const loggingIndex = routeSource.indexOf("logServerError(");
  const streamIndex = routeSource.indexOf("streamDeepAction(");

  assert.ok(
    routeSource.includes("getEligibleDeepActions"),
    "route must import and use getEligibleDeepActions",
  );
  assert.ok(authIndex >= 0, "route must authenticate the request");
  assert.ok(
    unauthorizedIndex > authIndex,
    "401 guard must follow authentication",
  );
  assert.ok(
    requestIdIndex > unauthorizedIndex,
    "request ID generation must follow the authentication guard",
  );
  assert.ok(
    jsonParseIndex > unauthorizedIndex,
    "JSON parsing must follow the authentication guard",
  );
  assert.ok(
    schemaValidationIndex > jsonParseIndex,
    "schema validation must follow JSON parsing",
  );
  assert.ok(
    eligibilityIndex > schemaValidationIndex,
    "eligibility validation must follow schema validation",
  );
  assert.ok(
    rateLimitIndex > eligibilityIndex,
    "rate-limit mutation must follow eligibility validation",
  );
  for (const [sideEffect, sideEffectIndex] of [
    ["abort-controller setup", abortControllerIndex],
    ["timeout-state setup", timeoutStateIndex],
    ["timeout scheduling", timeoutIndex],
    ["server logging", loggingIndex],
  ]) {
    assert.ok(
      sideEffectIndex > retryAfterIndex,
      `${sideEffect} must follow eligibility validation and the 429 path`,
    );
  }
  assert.ok(
    streamIndex > retryAfterIndex,
    "streaming must follow eligibility validation and the 429 path",
  );

  const invalidSegment = routeSource.slice(
    schemaValidationIndex,
    eligibilityIndex,
  );
  assert.ok(
    invalidSegment.includes("status: 400"),
    "schema-invalid requests must return 400 before eligibility validation",
  );
  assert.equal(
    invalidSegment.includes("Retry-After"),
    false,
    "schema-invalid requests must not include Retry-After",
  );

  const ineligibleSegment = routeSource.slice(eligibilityIndex, rateLimitIndex);
  assert.ok(
    ineligibleSegment.includes(
      "eligibleActions.includes(parsedPayload.data.action)",
    ),
    "route must check the requested action against eligible actions",
  );
  assert.ok(
    ineligibleSegment.includes(
      "This AI action is not available for the current selection or language.",
    ),
    "ineligible requests must use the locked user-safe error copy",
  );
  assert.ok(
    ineligibleSegment.includes("status: 400"),
    "ineligible requests must return status 400",
  );
  const ineligibleResponse = ineligibleSegment.match(
    /return NextResponse\.json\(\s*(\{[\s\S]*?\}),\s*\{ status: 400 \},\s*\);/,
  );
  assert.ok(
    ineligibleResponse,
    "ineligible requests must use the normal JSON failure response",
  );
  assert.equal(
    ineligibleResponse[1].replace(/\s+/g, " "),
    '{ error: "This AI action is not available for the current selection or language.", }',
    "ineligible responses must contain only the locked error field",
  );
  assert.equal(
    ineligibleSegment.includes("Retry-After"),
    false,
    "ineligible requests must not include Retry-After",
  );

  assert.equal(
    (routeSource.match(/Retry-After/g) ?? []).length,
    1,
    "Retry-After must remain exclusive to the later 429 path",
  );
  assert.ok(
    retryAfterIndex > rateLimitIndex,
    "Retry-After must appear only after the shared rate-limit check",
  );
});
