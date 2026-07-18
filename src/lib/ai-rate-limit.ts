import { checkRateLimit } from "./rate-limit.ts";

export const AI_RATE_LIMIT = 30;
export const AI_RATE_WINDOW_MS = 60_000;

// Deep actions share this key family with explain; do not create a separate unlimited lane.
export function getAiRateLimitKey(userId: string) {
  return `ai:${userId}`;
}

export function checkAiRateLimit(userId: string) {
  return checkRateLimit(
    getAiRateLimitKey(userId),
    AI_RATE_LIMIT,
    AI_RATE_WINDOW_MS,
  );
}
