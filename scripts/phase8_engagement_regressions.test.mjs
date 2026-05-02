import assert from "node:assert/strict";
import test from "node:test";

import { computeStreakUpdate } from "../src/lib/streak.ts";

const FIXED_TODAY = new Date("2026-05-03T12:00:00.000Z");

function daysAgo(days) {
  return new Date(FIXED_TODAY.getTime() - days * 24 * 60 * 60 * 1000);
}

test("computeStreakUpdate starts a new streak when lastActiveDate is null", () => {
  const result = computeStreakUpdate(
    { currentStreak: 0, longestStreak: 0, lastActiveDate: null },
    FIXED_TODAY,
  );
  assert.equal(result.currentStreak, 1);
  assert.equal(result.longestStreak, 1);
});

test("computeStreakUpdate does not change streak when already active today", () => {
  const result = computeStreakUpdate(
    { currentStreak: 5, longestStreak: 10, lastActiveDate: FIXED_TODAY },
    FIXED_TODAY,
  );
  assert.equal(result.currentStreak, 5);
  assert.equal(result.longestStreak, 10);
});

test("computeStreakUpdate increments streak when last active yesterday", () => {
  const result = computeStreakUpdate(
    { currentStreak: 5, longestStreak: 10, lastActiveDate: daysAgo(1) },
    FIXED_TODAY,
  );
  assert.equal(result.currentStreak, 6);
  assert.equal(result.longestStreak, 10);
});

test("computeStreakUpdate updates longestStreak when current exceeds it", () => {
  const result = computeStreakUpdate(
    { currentStreak: 10, longestStreak: 10, lastActiveDate: daysAgo(1) },
    FIXED_TODAY,
  );
  assert.equal(result.currentStreak, 11);
  assert.equal(result.longestStreak, 11);
});

test("computeStreakUpdate maintains streak on 1-day gap (grace period) without incrementing", () => {
  const result = computeStreakUpdate(
    { currentStreak: 7, longestStreak: 12, lastActiveDate: daysAgo(2) },
    FIXED_TODAY,
  );
  assert.equal(
    result.currentStreak,
    7,
    "Streak should be maintained, not incremented",
  );
  assert.equal(result.longestStreak, 12);
});

test("computeStreakUpdate resets streak after 2+ day gap", () => {
  const result = computeStreakUpdate(
    { currentStreak: 15, longestStreak: 20, lastActiveDate: daysAgo(3) },
    FIXED_TODAY,
  );
  assert.equal(result.currentStreak, 1);
  assert.equal(result.longestStreak, 20, "longestStreak should not decrease");
});

test("computeStreakUpdate resets streak after a very long gap", () => {
  const result = computeStreakUpdate(
    { currentStreak: 30, longestStreak: 30, lastActiveDate: daysAgo(30) },
    FIXED_TODAY,
  );
  assert.equal(result.currentStreak, 1);
  assert.equal(result.longestStreak, 30);
});

test("computeStreakUpdate always updates lastActiveDate to today", () => {
  const result = computeStreakUpdate(
    { currentStreak: 0, longestStreak: 0, lastActiveDate: null },
    FIXED_TODAY,
  );
  assert.equal(result.lastActiveDate.getTime(), FIXED_TODAY.getTime());
});
