type RateLimitEntry = {
  timestamps: number[];
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number | null;
};

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();

  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanup = now;
  const cutoff = now - windowMs;

  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(
      (timestamp) => timestamp > cutoff,
    );

    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  cleanup(windowMs);

  const entry = store.get(key) ?? { timestamps: [] };
  const cutoff = now - windowMs;

  entry.timestamps = entry.timestamps.filter((timestamp) => timestamp > cutoff);

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0]!;
    const retryAfterSeconds = Math.ceil(
      (oldestInWindow + windowMs - now) / 1000,
    );

    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  entry.timestamps.push(now);
  store.set(key, entry);

  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    retryAfterSeconds: null,
  };
}
