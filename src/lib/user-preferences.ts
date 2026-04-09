import { prisma } from "@/lib/prisma";
import {
  normalizeReaderFontSize,
  normalizeReaderTheme,
  READER_FONT_SIZE_DEFAULT,
  READER_THEME_DEFAULT,
  type ReaderTheme,
  type UpdateSettingsInput,
} from "@/lib/settings-validation";

export type ReaderSettingsSnapshot = {
  readerFontSize: number;
  readerTheme: ReaderTheme;
};

function buildDefaultPreferences(userId: string) {
  return {
    userId,
    readerFontSize: READER_FONT_SIZE_DEFAULT,
    readerTheme: READER_THEME_DEFAULT,
  };
}

function normalizeReaderSettings(preferences: {
  readerFontSize: number;
  readerTheme: string;
}): ReaderSettingsSnapshot {
  return {
    readerFontSize: normalizeReaderFontSize(preferences.readerFontSize),
    readerTheme: normalizeReaderTheme(preferences.readerTheme),
  };
}

export async function getOrCreateUserPreferences(
  userId: string,
): Promise<ReaderSettingsSnapshot> {
  const preferences = await prisma.userPreferences.upsert({
    where: {
      userId,
    },
    create: buildDefaultPreferences(userId),
    update: {},
  });

  return normalizeReaderSettings(preferences);
}

export async function updateUserPreferences(
  userId: string,
  input: UpdateSettingsInput,
): Promise<ReaderSettingsSnapshot> {
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

  return normalizeReaderSettings(preferences);
}
