import { prisma } from "@/lib/prisma";
import { computeStreakUpdate } from "@/lib/streak";

export const ACTIVITY_TYPES = ["review", "reading"] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export async function recordLearningActivity(
  userId: string,
  type: ActivityType,
  today: Date = new Date(),
) {
  const dateOnly = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  await prisma.$transaction(async (tx) => {
    await tx.learningActivity.upsert({
      where: {
        userId_date_type: {
          userId,
          date: dateOnly,
          type,
        },
      },
      create: {
        userId,
        date: dateOnly,
        type,
        count: 1,
      },
      update: {
        count: {
          increment: 1,
        },
      },
    });

    const preferences = await tx.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        dailyGoal: 10,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
      },
      update: {},
      select: {
        currentStreak: true,
        longestStreak: true,
        lastActiveDate: true,
      },
    });

    const streakUpdate = computeStreakUpdate(
      {
        currentStreak: preferences.currentStreak,
        longestStreak: preferences.longestStreak,
        lastActiveDate: preferences.lastActiveDate,
      },
      dateOnly,
    );

    await tx.userPreferences.update({
      where: { userId },
      data: {
        currentStreak: streakUpdate.currentStreak,
        longestStreak: streakUpdate.longestStreak,
        lastActiveDate: streakUpdate.lastActiveDate,
      },
    });
  });
}
