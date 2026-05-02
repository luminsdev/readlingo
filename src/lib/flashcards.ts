import { Prisma, type SRSData } from "@prisma/client";

import { recordLearningActivity } from "@/lib/learning-activity";
import { prisma } from "@/lib/prisma";
import {
  computeSRSUpdate,
  SRS_DEFAULTS,
  type SRSRating,
  type SRSState,
} from "@/lib/srs";

const DEFAULT_DUE_CARD_LIMIT = 50;
const SUBMIT_REVIEW_MAX_RETRIES = 2;

const dueCardInclude = {
  srsData: true,
  book: {
    select: {
      title: true,
    },
  },
} satisfies Prisma.VocabularyInclude;

export type DueCard = Prisma.VocabularyGetPayload<{
  include: typeof dueCardInclude;
}>;

function normalizeLimit(limit: number) {
  return Math.max(1, Math.trunc(limit || DEFAULT_DUE_CARD_LIMIT));
}

function getSRSState(srsData: SRSData | null): SRSState {
  if (!srsData) {
    return SRS_DEFAULTS;
  }

  return {
    interval: srsData.interval,
    easeFactor: srsData.easeFactor,
    repetitions: srsData.repetitions,
  };
}

export async function getDueCards(
  userId: string,
  limit = DEFAULT_DUE_CARD_LIMIT,
): Promise<DueCard[]> {
  const now = new Date();
  const normalizedLimit = normalizeLimit(limit);

  return prisma.$transaction(async (tx) => {
    const newCards = await tx.vocabulary.findMany({
      where: {
        userId,
        srsData: {
          is: null,
        },
      },
      include: dueCardInclude,
      orderBy: {
        createdAt: "asc",
      },
      take: normalizedLimit,
    });

    const remainingLimit = normalizedLimit - newCards.length;

    if (remainingLimit === 0) {
      return newCards;
    }

    const scheduledCards = await tx.sRSData.findMany({
      where: {
        nextReviewAt: {
          lte: now,
        },
        vocabulary: {
          userId,
        },
      },
      orderBy: {
        nextReviewAt: "asc",
      },
      include: {
        vocabulary: {
          include: dueCardInclude,
        },
      },
      take: remainingLimit,
    });

    return [...newCards, ...scheduledCards.map((item) => item.vocabulary)];
  });
}

export async function getDueCardCount(userId: string) {
  const now = new Date();

  return prisma.vocabulary.count({
    where: {
      userId,
      OR: [
        {
          srsData: {
            is: null,
          },
        },
        {
          srsData: {
            is: {
              nextReviewAt: {
                lte: now,
              },
            },
          },
        },
      ],
    },
  });
}

export async function submitReview(
  userId: string,
  vocabularyId: string,
  rating: SRSRating,
): Promise<SRSData | null> {
  for (let attempt = 0; attempt <= SUBMIT_REVIEW_MAX_RETRIES; attempt += 1) {
    try {
      const result = await submitReviewAttempt(userId, vocabularyId, rating);

      if (result) {
        await recordLearningActivity(userId, "review").catch(() => {
          // Activity recording is non-critical; do not fail the review.
        });
      }

      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < SUBMIT_REVIEW_MAX_RETRIES
      ) {
        continue;
      }

      throw error;
    }
  }

  return null;
}

async function submitReviewAttempt(
  userId: string,
  vocabularyId: string,
  rating: SRSRating,
) {
  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      const vocabulary = await tx.vocabulary.findFirst({
        where: {
          id: vocabularyId,
          userId,
        },
        include: {
          srsData: true,
        },
      });

      if (!vocabulary) {
        return null;
      }

      const srsUpdate = computeSRSUpdate(
        getSRSState(vocabulary.srsData),
        rating,
        now,
      );

      return tx.sRSData.upsert({
        where: {
          vocabularyId: vocabulary.id,
        },
        update: srsUpdate,
        create: {
          vocabularyId: vocabulary.id,
          ...srsUpdate,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
