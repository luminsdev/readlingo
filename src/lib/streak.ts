export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
};

export type StreakUpdate = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateOnly(date: Date): number {
  return Math.floor(date.getTime() / MS_PER_DAY);
}

export function computeStreakUpdate(
  state: StreakState,
  today: Date = new Date(),
): StreakUpdate {
  const todayDays = toDateOnly(today);

  if (!state.lastActiveDate) {
    return {
      currentStreak: 1,
      longestStreak: Math.max(state.longestStreak, 1),
      lastActiveDate: today,
    };
  }

  const lastDays = toDateOnly(state.lastActiveDate);
  const gap = todayDays - lastDays;

  if (gap === 0) {
    return {
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastActiveDate: today,
    };
  }

  if (gap === 1) {
    const newStreak = state.currentStreak + 1;

    return {
      currentStreak: newStreak,
      longestStreak: Math.max(state.longestStreak, newStreak),
      lastActiveDate: today,
    };
  }

  if (gap === 2) {
    return {
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastActiveDate: today,
    };
  }

  return {
    currentStreak: 1,
    longestStreak: Math.max(state.longestStreak, 1),
    lastActiveDate: today,
  };
}
