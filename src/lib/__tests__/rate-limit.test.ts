import { describe, expect, it } from "vitest";

import { checkRateLimit } from "@/lib/rate-limit";

describe("Rate Limiting", () => {
  it("checkRateLimit allows requests within limit", () => {
    const key = "test-allow-" + Date.now();
    const result = checkRateLimit(key, 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.retryAfterSeconds).toBeNull();
  });

  it("checkRateLimit blocks requests exceeding limit", () => {
    const key = "test-block-" + Date.now();

    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 60_000);
    }

    const result = checkRateLimit(key, 3, 60_000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeTypeOf("number");
    expect(result.retryAfterSeconds! > 0).toBeTruthy();
  });

  it("checkRateLimit returns correct remaining count", () => {
    const key = "test-remaining-" + Date.now();

    const first = checkRateLimit(key, 5, 60_000);
    expect(first.remaining).toBe(4);

    const second = checkRateLimit(key, 5, 60_000);
    expect(second.remaining).toBe(3);
  });

  it("checkRateLimit tracks separate keys independently", () => {
    const keyA = "test-indep-a-" + Date.now();
    const keyB = "test-indep-b-" + Date.now();

    for (let i = 0; i < 3; i++) {
      checkRateLimit(keyA, 3, 60_000);
    }

    const resultA = checkRateLimit(keyA, 3, 60_000);
    const resultB = checkRateLimit(keyB, 3, 60_000);

    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it("checkRateLimit resets after window expires", async () => {
    const key = "test-expire-" + Date.now();

    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 1);
    }

    await new Promise((resolve) => setTimeout(resolve, 2));

    const result = checkRateLimit(key, 3, 1);

    expect(result.allowed).toBe(true);
  });
});
