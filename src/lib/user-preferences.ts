import { prisma } from "@/lib/prisma";
import {
  DAILY_GOAL_DEFAULT,
  normalizeReaderFontSize,
  normalizeReaderTheme,
  READER_FONT_SIZE_DEFAULT,
  READER_THEME_DEFAULT,
  type ReaderTheme,
  type UpdateSettingsInput,
} from "@/lib/settings-validation";

export type UserPreferencesSnapshot = {
  readerFontSize: number;
  readerTheme: ReaderTheme;
  dailyGoal: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
};

function buildDefaultPreferences(userId: string) {
  return {
    userId,
    readerFontSize: READER_FONT_SIZE_DEFAULT,
    readerTheme: READER_THEME_DEFAULT,
    dailyGoal: DAILY_GOAL_DEFAULT,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
  };
}

function normalizePreferences(preferences: {
  readerFontSize: number;
  readerTheme: string;
  dailyGoal: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
}): UserPreferencesSnapshot {
  return {
    readerFontSize: normalizeReaderFontSize(preferences.readerFontSize),
    readerTheme: normalizeReaderTheme(preferences.readerTheme),
    dailyGoal: preferences.dailyGoal,
    currentStreak: preferences.currentStreak,
    longestStreak: preferences.longestStreak,
    lastActiveDate: preferences.lastActiveDate,
  };
}

export async function getOrCreateUserPreferences(
  userId: string,
): Promise<UserPreferencesSnapshot> {
  const preferences = await prisma.userPreferences.upsert({
    where: {
      userId,
    },
    create: buildDefaultPreferences(userId),
    update: {},
  });

  return normalizePreferences(preferences);
}

export async function updateUserPreferences(
  userId: string,
  input: UpdateSettingsInput,
): Promise<UserPreferencesSnapshot> {
  const preferences = await prisma.userPreferences.upsert({
    where: {
      userId,
    },
    create: {
      ...buildDefaultPreferences(userId),
      ...input,
    },
    update: input,
  });

  return normalizePreferences(preferences);
}
