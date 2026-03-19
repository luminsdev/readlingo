export const SRS_RATING_VALUES = ["again", "hard", "good", "easy"] as const;

export type SRSRating = (typeof SRS_RATING_VALUES)[number];

export type SRSState = {
  interval: number;
  easeFactor: number;
  repetitions: number;
};

export type SRSUpdate = SRSState & {
  nextReviewAt: Date;
  lastReviewedAt: Date;
};

export const SRS_DEFAULTS: SRSState = {
  interval: 1,
  easeFactor: 2.5,
  repetitions: 0,
};

const MIN_EASE_FACTOR = 1.3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function roundEaseFactor(value: number) {
  return Math.round(value * 100) / 100;
}

function getGoodInterval(state: SRSState) {
  if (state.repetitions === 0) {
    return 1;
  }

  if (state.repetitions === 1) {
    return 6;
  }

  return Math.round(state.interval * state.easeFactor);
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * MS_PER_DAY);
}

export function computeSRSUpdate(
  state: SRSState,
  rating: SRSRating,
  now: Date = new Date(),
): SRSUpdate {
  let interval = state.interval;
  let easeFactor = state.easeFactor;
  let repetitions = state.repetitions;

  if (rating === "again") {
    interval = 1;
    repetitions = 0;
    easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
  } else if (rating === "hard") {
    interval = 1;
    repetitions = 0;
    easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
  } else if (rating === "good") {
    interval = getGoodInterval(state);
    repetitions += 1;
  } else {
    interval = Math.round(getGoodInterval(state) * 1.3);
    repetitions += 1;
    easeFactor += 0.15;
  }

  const normalizedEaseFactor = roundEaseFactor(
    Math.max(MIN_EASE_FACTOR, easeFactor),
  );

  return {
    interval,
    easeFactor: normalizedEaseFactor,
    repetitions,
    lastReviewedAt: now,
    nextReviewAt: addDays(now, interval),
  };
}
