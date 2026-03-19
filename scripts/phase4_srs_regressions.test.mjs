import assert from "node:assert/strict";
import test from "node:test";

import {
  computeSRSUpdate,
  SRS_DEFAULTS,
  SRS_RATING_VALUES,
} from "../src/lib/srs.ts";
import {
  reviewSubmitSchema,
  srsRatingSchema,
} from "../src/lib/srs-validation.ts";

const FIXED_NOW = new Date("2026-03-20T12:00:00.000Z");

test("SRS_DEFAULTS and SRS_RATING_VALUES expose the Phase 4 baseline contract", () => {
  assert.deepEqual(SRS_DEFAULTS, {
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
  });
  assert.deepEqual(SRS_RATING_VALUES, ["again", "hard", "good", "easy"]);
});

test("computeSRSUpdate applies the Again transition from defaults", () => {
  assert.deepEqual(computeSRSUpdate(SRS_DEFAULTS, "again", FIXED_NOW), {
    interval: 1,
    easeFactor: 2.3,
    repetitions: 0,
    lastReviewedAt: FIXED_NOW,
    nextReviewAt: new Date("2026-03-21T12:00:00.000Z"),
  });
});

test("computeSRSUpdate applies the Hard transition from defaults", () => {
  assert.deepEqual(computeSRSUpdate(SRS_DEFAULTS, "hard", FIXED_NOW), {
    interval: 1,
    easeFactor: 2.35,
    repetitions: 0,
    lastReviewedAt: FIXED_NOW,
    nextReviewAt: new Date("2026-03-21T12:00:00.000Z"),
  });
});

test("computeSRSUpdate applies the Good transition from defaults", () => {
  assert.deepEqual(computeSRSUpdate(SRS_DEFAULTS, "good", FIXED_NOW), {
    interval: 1,
    easeFactor: 2.5,
    repetitions: 1,
    lastReviewedAt: FIXED_NOW,
    nextReviewAt: new Date("2026-03-21T12:00:00.000Z"),
  });
});

test("computeSRSUpdate applies the Easy transition from defaults", () => {
  assert.deepEqual(computeSRSUpdate(SRS_DEFAULTS, "easy", FIXED_NOW), {
    interval: 1,
    easeFactor: 2.65,
    repetitions: 1,
    lastReviewedAt: FIXED_NOW,
    nextReviewAt: new Date("2026-03-21T12:00:00.000Z"),
  });
});

test("computeSRSUpdate follows the second and third Good review intervals", () => {
  assert.deepEqual(
    computeSRSUpdate(
      {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 1,
      },
      "good",
      FIXED_NOW,
    ),
    {
      interval: 6,
      easeFactor: 2.5,
      repetitions: 2,
      lastReviewedAt: FIXED_NOW,
      nextReviewAt: new Date("2026-03-26T12:00:00.000Z"),
    },
  );

  assert.deepEqual(
    computeSRSUpdate(
      {
        interval: 6,
        easeFactor: 2.5,
        repetitions: 2,
      },
      "good",
      FIXED_NOW,
    ),
    {
      interval: 15,
      easeFactor: 2.5,
      repetitions: 3,
      lastReviewedAt: FIXED_NOW,
      nextReviewAt: new Date("2026-04-04T12:00:00.000Z"),
    },
  );
});

test("computeSRSUpdate applies the Easy bonus after the Good interval is calculated", () => {
  assert.deepEqual(
    computeSRSUpdate(
      {
        interval: 6,
        easeFactor: 2.5,
        repetitions: 2,
      },
      "easy",
      FIXED_NOW,
    ),
    {
      interval: 20,
      easeFactor: 2.65,
      repetitions: 3,
      lastReviewedAt: FIXED_NOW,
      nextReviewAt: new Date("2026-04-09T12:00:00.000Z"),
    },
  );
});

test("computeSRSUpdate never lowers easeFactor below 1.3", () => {
  assert.equal(
    computeSRSUpdate(
      {
        interval: 12,
        easeFactor: 1.35,
        repetitions: 4,
      },
      "again",
      FIXED_NOW,
    ).easeFactor,
    1.3,
  );

  assert.equal(
    computeSRSUpdate(
      {
        interval: 12,
        easeFactor: 1.3,
        repetitions: 4,
      },
      "again",
      FIXED_NOW,
    ).easeFactor,
    1.3,
  );

  assert.equal(
    computeSRSUpdate(
      {
        interval: 12,
        easeFactor: 1.4,
        repetitions: 4,
      },
      "hard",
      FIXED_NOW,
    ).easeFactor,
    1.3,
  );
});

test("computeSRSUpdate normalizes easeFactor arithmetic to two decimals", () => {
  assert.equal(
    computeSRSUpdate(
      {
        interval: 15,
        easeFactor: 2.9499999999999997,
        repetitions: 3,
      },
      "good",
      FIXED_NOW,
    ).easeFactor,
    2.95,
  );

  assert.equal(
    computeSRSUpdate(
      {
        interval: 15,
        easeFactor: 2.95,
        repetitions: 3,
      },
      "easy",
      FIXED_NOW,
    ).easeFactor,
    3.1,
  );
});

test("computeSRSUpdate uses the provided review time to schedule nextReviewAt", () => {
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

  assert.equal(update.lastReviewedAt.toISOString(), reviewedAt.toISOString());
  assert.equal(update.nextReviewAt.toISOString(), "2026-07-03T03:30:00.000Z");
});

test("srsRatingSchema accepts only valid flashcard ratings", () => {
  assert.equal(srsRatingSchema.safeParse("again").success, true);
  assert.equal(srsRatingSchema.safeParse("easy").success, true);
  assert.equal(srsRatingSchema.safeParse("skip").success, false);
});

test("reviewSubmitSchema validates review payloads", () => {
  assert.deepEqual(
    reviewSubmitSchema.parse({
      vocabularyId: "cm9flashcard0000000000000000",
      rating: "good",
    }),
    {
      vocabularyId: "cm9flashcard0000000000000000",
      rating: "good",
    },
  );

  assert.equal(
    reviewSubmitSchema.safeParse({
      vocabularyId: "not-a-cuid",
      rating: "good",
    }).error?.issues[0]?.message,
    "Vocabulary not found.",
  );

  assert.equal(
    reviewSubmitSchema.safeParse({
      vocabularyId: "cm9flashcard0000000000000000",
      rating: "skip",
    }).success,
    false,
  );
});
