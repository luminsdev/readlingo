import { describe, expect, it } from "vitest";

import {
  getProgressSyncBackoffMs,
  getProgressSyncStatusLabel,
  getProgressSyncStateForAttempt,
  shouldSyncProgress,
} from "@/lib/reader-progress";

describe("Reader Progress Sync", () => {
  it("maps progress sync states to reader-facing status labels", () => {
    expect(getProgressSyncStatusLabel({ state: "idle", syncedAt: null })).toBe(
      "Progress tracking starts after your first move",
    );
    expect(
      getProgressSyncStatusLabel({ state: "saved_local", syncedAt: null }),
    ).toBe("Saved on this device");
    expect(
      getProgressSyncStatusLabel({ state: "syncing", syncedAt: null }),
    ).toBe("Syncing…");
    expect(getProgressSyncStatusLabel({ state: "error", syncedAt: null })).toBe(
      "Couldn't sync · will retry",
    );
    expect(
      getProgressSyncStatusLabel({ state: "retrying", syncedAt: null }),
    ).toBe("Retrying sync…");
  });

  it("formats server-acked progress as synced with a timestamp", () => {
    const label = getProgressSyncStatusLabel({
      state: "synced",
      syncedAt: "2026-07-13T10:42:00.000Z",
    });

    expect(label).toMatch(/^Synced · \d{1,2}:\d{2}/);
    expect(label).not.toContain("Saved");
  });

  it("keeps the happy path in saved-local state after durable local writes", () => {
    expect(
      getProgressSyncStateForAttempt({ didSaveLocally: true, isRetry: false }),
    ).toBe("saved_local");
    expect(
      getProgressSyncStateForAttempt({ didSaveLocally: false, isRetry: false }),
    ).toBe("syncing");
    expect(
      getProgressSyncStateForAttempt({ didSaveLocally: true, isRetry: true }),
    ).toBe("retrying");
  });

  it("backs off retries exponentially with a cap", () => {
    expect(getProgressSyncBackoffMs(0)).toBe(1_000);
    expect(getProgressSyncBackoffMs(1)).toBe(2_000);
    expect(getProgressSyncBackoffMs(2)).toBe(4_000);
    expect(getProgressSyncBackoffMs(5)).toBe(30_000);
    expect(getProgressSyncBackoffMs(-1)).toBe(1_000);
  });

  it("syncs only when local progress differs from the last server ACK", () => {
    expect(shouldSyncProgress(null, "epubcfi(/6/2!/4/2/8)")).toBe(false);
    expect(shouldSyncProgress("", "epubcfi(/6/2!/4/2/8)")).toBe(false);
    expect(
      shouldSyncProgress("epubcfi(/6/2!/4/2/8)", "epubcfi(/6/2!/4/2/8)"),
    ).toBe(false);
    expect(
      shouldSyncProgress("epubcfi(/6/2!/4/2/10)", "epubcfi(/6/2!/4/2/8)"),
    ).toBe(true);
    expect(shouldSyncProgress("epubcfi(/6/2!/4/2/10)", null)).toBe(true);
  });
});
