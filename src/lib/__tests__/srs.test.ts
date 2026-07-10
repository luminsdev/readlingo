import { describe, expect, it } from "vitest";

import { computeSRSUpdate, SRS_DEFAULTS, SRS_RATING_VALUES } from "@/lib/srs";
import { reviewSubmitSchema, srsRatingSchema } from "@/lib/srs-validation";

const FIXED_NOW = new Date("2026-03-20T12:00:00.000Z");

describe("SRS Algorithm", () => {
  it("SRS_DEFAULTS and SRS_RATING_VALUES expose the Phase 4 baseline contract", () => {
    expect(SRS_DEFAULTS).toEqual({
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
    });
    expect(SRS_RATING_VALUES).toEqual(["again", "hard", "good", "easy"]);
  });

  it("computeSRSUpdate applies the Again transition from defaults", () => {
    expect(computeSRSUpdate(SRS_DEFAULTS, "again", FIXED_NOW)).toEqual({
      interval: 1,
      easeFactor: 2.3,
      repetitions: 0,
      lastReviewedAt: FIXED_NOW,
      nextReviewAt: new Date("2026-03-21T12:00:00.000Z"),
    });
  });

  it("computeSRSUpdate applies the Hard transition from defaults", () => {
    expect(computeSRSUpdate(SRS_DEFAULTS, "hard", FIXED_NOW)).toEqual({
      interval: 1,
      easeFactor: 2.35,
      repetitions: 0,
      lastReviewedAt: FIXED_NOW,
      nextReviewAt: new Date("2026-03-21T12:00:00.000Z"),
    });
  });

  it("computeSRSUpdate applies the Good transition from defaults", () => {
    expect(computeSRSUpdate(SRS_DEFAULTS, "good", FIXED_NOW)).toEqual({
      interval: 1,
      easeFactor: 2.5,
      repetitions: 1,
      lastReviewedAt: FIXED_NOW,
      nextReviewAt: new Date("2026-03-21T12:00:00.000Z"),
    });
  });

  it("computeSRSUpdate applies the Easy transition from defaults", () => {
    expect(computeSRSUpdate(SRS_DEFAULTS, "easy", FIXED_NOW)).toEqual({
      interval: 1,
      easeFactor: 2.65,
      repetitions: 1,
      lastReviewedAt: FIXED_NOW,
      nextReviewAt: new Date("2026-03-21T12:00:00.000Z"),
    });
  });

  it("computeSRSUpdate follows the second and third Good review intervals", () => {
    expect(
      computeSRSUpdate(
        {
          interval: 1,
          easeFactor: 2.5,
          repetitions: 1,
        },
        "good",
        FIXED_NOW,
      ),
    ).toEqual({
      interval: 6,
      easeFactor: 2.5,
      repetitions: 2,
      lastReviewedAt: FIXED_NOW,
      nextReviewAt: new Date("2026-03-26T12:00:00.000Z"),
    });

    expect(
      computeSRSUpdate(
        {
          interval: 6,
          easeFactor: 2.5,
          repetitions: 2,
        },
        "good",
        FIXED_NOW,
      ),
    ).toEqual({
      interval: 15,
      easeFactor: 2.5,
      repetitions: 3,
      lastReviewedAt: FIXED_NOW,
      nextReviewAt: new Date("2026-04-04T12:00:00.000Z"),
    });
  });

  it("computeSRSUpdate applies the Easy bonus after the Good interval is calculated", () => {
    expect(
      computeSRSUpdate(
        {
          interval: 6,
          easeFactor: 2.5,
          repetitions: 2,
        },
        "easy",
        FIXED_NOW,
      ),
    ).toEqual({
      interval: 20,
      easeFactor: 2.65,
      repetitions: 3,
      lastReviewedAt: FIXED_NOW,
      nextReviewAt: new Date("2026-04-09T12:00:00.000Z"),
    });
  });

  it("computeSRSUpdate never lowers easeFactor below 1.3", () => {
    expect(
      computeSRSUpdate(
        {
          interval: 12,
          easeFactor: 1.35,
          repetitions: 4,
        },
        "again",
        FIXED_NOW,
      ).easeFactor,
    ).toBe(1.3);

    expect(
      computeSRSUpdate(
        {
          interval: 12,
          easeFactor: 1.3,
          repetitions: 4,
        },
        "again",
        FIXED_NOW,
      ).easeFactor,
    ).toBe(1.3);

    expect(
      computeSRSUpdate(
        {
          interval: 12,
          easeFactor: 1.4,
          repetitions: 4,
        },
        "hard",
        FIXED_NOW,
      ).easeFactor,
    ).toBe(1.3);
  });

  it("computeSRSUpdate normalizes easeFactor arithmetic to two decimals", () => {
    expect(
      computeSRSUpdate(
        {
          interval: 15,
          easeFactor: 2.9499999999999997,
          repetitions: 3,
        },
        "good",
        FIXED_NOW,
      ).easeFactor,
    ).toBe(2.95);

    expect(
      computeSRSUpdate(
        {
          interval: 15,
          easeFactor: 2.95,
          repetitions: 3,
        },
        "easy",
        FIXED_NOW,
      ).easeFactor,
    ).toBe(3.1);
  });

  it("computeSRSUpdate uses the provided review time to schedule nextReviewAt", () => {
    const reviewedAt = new Date("2026-06-15T03:30:00.000Z");
    const update = computeSRSUpdate(
      {
        interval: 8,
        easeFactor: 2.2,
        repetitions: 2,
      },
      "good",
      reviewedAt,
    );

    expect(update.lastReviewedAt.toISOString()).toBe(reviewedAt.toISOString());
    expect(update.nextReviewAt.toISOString()).toBe("2026-07-03T03:30:00.000Z");
  });
});

describe("SRS Validation", () => {
  it("srsRatingSchema accepts only valid flashcard ratings", () => {
    expect(srsRatingSchema.safeParse("again").success).toBe(true);
    expect(srsRatingSchema.safeParse("easy").success).toBe(true);
    expect(srsRatingSchema.safeParse("skip").success).toBe(false);
  });

  it("reviewSubmitSchema validates review payloads", () => {
    expect(
      reviewSubmitSchema.parse({
        vocabularyId: "cm9flashcard0000000000000000",
        rating: "good",
      }),
    ).toEqual({
      vocabularyId: "cm9flashcard0000000000000000",
      rating: "good",
    });

    expect(
      reviewSubmitSchema.safeParse({
        vocabularyId: "not-a-cuid",
        rating: "good",
      }).error?.issues[0]?.message,
    ).toBe("Vocabulary not found.");

    expect(
      reviewSubmitSchema.safeParse({
        vocabularyId: "cm9flashcard0000000000000000",
        rating: "skip",
      }).success,
    ).toBe(false);
  });
});
