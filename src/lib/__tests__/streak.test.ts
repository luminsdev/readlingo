import { describe, expect, it } from "vitest";

import { computeStreakUpdate } from "@/lib/streak";

const FIXED_TODAY = new Date("2026-05-03T12:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(FIXED_TODAY.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("Streak Calculation", () => {
  it("computeStreakUpdate starts a new streak when lastActiveDate is null", () => {
    const result = computeStreakUpdate(
      { currentStreak: 0, longestStreak: 0, lastActiveDate: null },
      FIXED_TODAY,
    );
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it("computeStreakUpdate does not change streak when already active today", () => {
    const result = computeStreakUpdate(
      { currentStreak: 5, longestStreak: 10, lastActiveDate: FIXED_TODAY },
      FIXED_TODAY,
    );
    expect(result.currentStreak).toBe(5);
    expect(result.longestStreak).toBe(10);
  });

  it("computeStreakUpdate increments streak when last active yesterday", () => {
    const result = computeStreakUpdate(
      { currentStreak: 5, longestStreak: 10, lastActiveDate: daysAgo(1) },
      FIXED_TODAY,
    );
    expect(result.currentStreak).toBe(6);
    expect(result.longestStreak).toBe(10);
  });

  it("computeStreakUpdate updates longestStreak when current exceeds it", () => {
    const result = computeStreakUpdate(
      { currentStreak: 10, longestStreak: 10, lastActiveDate: daysAgo(1) },
      FIXED_TODAY,
    );
    expect(result.currentStreak).toBe(11);
    expect(result.longestStreak).toBe(11);
  });

  it("computeStreakUpdate maintains streak on 1-day gap (grace period) without incrementing", () => {
    const result = computeStreakUpdate(
      { currentStreak: 7, longestStreak: 12, lastActiveDate: daysAgo(2) },
      FIXED_TODAY,
    );
    expect(
      result.currentStreak,
      "Streak should be maintained, not incremented",
    ).toBe(7);
    expect(result.longestStreak).toBe(12);
  });

  it("computeStreakUpdate resets streak after 2+ day gap", () => {
    const result = computeStreakUpdate(
      { currentStreak: 15, longestStreak: 20, lastActiveDate: daysAgo(3) },
      FIXED_TODAY,
    );
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak, "longestStreak should not decrease").toBe(20);
  });

  it("computeStreakUpdate resets streak after a very long gap", () => {
    const result = computeStreakUpdate(
      { currentStreak: 30, longestStreak: 30, lastActiveDate: daysAgo(30) },
      FIXED_TODAY,
    );
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(30);
  });

  it("computeStreakUpdate always updates lastActiveDate to today", () => {
    const result = computeStreakUpdate(
      { currentStreak: 0, longestStreak: 0, lastActiveDate: null },
      FIXED_TODAY,
    );
    expect(result.lastActiveDate.getTime()).toBe(FIXED_TODAY.getTime());
  });
});
