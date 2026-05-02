import { z } from "zod";

export const READER_FONT_SIZE_MIN = 14;
export const READER_FONT_SIZE_MAX = 28;
export const READER_FONT_SIZE_STEP = 2;
export const READER_FONT_SIZE_DEFAULT = 18;

export const READER_THEMES = ["light", "sepia", "dark"] as const;
export type ReaderTheme = (typeof READER_THEMES)[number];
export const READER_THEME_DEFAULT: ReaderTheme = "light";

export const DAILY_GOAL_MIN = 1;
export const DAILY_GOAL_MAX = 50;
export const DAILY_GOAL_DEFAULT = 10;

export function isValidReaderFontSize(value: number) {
  return (
    Number.isInteger(value) &&
    value >= READER_FONT_SIZE_MIN &&
    value <= READER_FONT_SIZE_MAX &&
    (value - READER_FONT_SIZE_MIN) % READER_FONT_SIZE_STEP === 0
  );
}

export function normalizeReaderFontSize(value: number | null | undefined) {
  return typeof value === "number" && isValidReaderFontSize(value)
    ? value
    : READER_FONT_SIZE_DEFAULT;
}

export function isReaderTheme(
  value: string | null | undefined,
): value is ReaderTheme {
  return READER_THEMES.some((theme) => theme === value);
}

export function normalizeReaderTheme(
  value: string | null | undefined,
): ReaderTheme {
  return isReaderTheme(value) ? value : READER_THEME_DEFAULT;
}

export const updateSettingsSchema = z.object({
  readerFontSize: z
    .number()
    .int()
    .min(READER_FONT_SIZE_MIN)
    .max(READER_FONT_SIZE_MAX)
    .refine(
      (value) => (value - READER_FONT_SIZE_MIN) % READER_FONT_SIZE_STEP === 0,
      {
        message: `Font size must be in ${READER_FONT_SIZE_STEP}px increments starting from ${READER_FONT_SIZE_MIN}px`,
      },
    )
    .optional(),
  readerTheme: z.enum(READER_THEMES).optional(),
  dailyGoal: z
    .number()
    .int()
    .min(DAILY_GOAL_MIN)
    .max(DAILY_GOAL_MAX)
    .optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
