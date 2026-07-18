import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/vocabulary/route";

const routeMocks = vi.hoisted(() => ({
  auth: vi.fn(),
  bookFindMany: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  generateRequestId: vi.fn(() => "request_123"),
  logServerError: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: routeMocks.auth }));
vi.mock("@/lib/ai-mnemonic", () => ({ generateMnemonic: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  generateRequestId: routeMocks.generateRequestId,
  logServerError: routeMocks.logServerError,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: routeMocks.transaction,
    book: {
      findMany: routeMocks.bookFindMany,
    },
    vocabulary: {
      count: routeMocks.count,
      findMany: routeMocks.findMany,
      updateMany: vi.fn(),
    },
  },
}));

describe("Vocabulary GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.auth.mockResolvedValue({ user: { id: "user_123" } });
    routeMocks.findMany.mockResolvedValue([]);
  });

  it("fails closed before querying vocabulary when unauthenticated", async () => {
    routeMocks.auth.mockResolvedValueOnce(null);

    const response = await GET(
      new Request(
        "http://localhost/api/vocabulary?match=normalized&word=hello&bookId=cm9testbook0000000000000000",
      ),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(routeMocks.findMany).not.toHaveBeenCalled();
  });

  it("finds the newest normalized exact match inside the owned book scope", async () => {
    routeMocks.findMany.mockResolvedValueOnce([
      {
        id: "vocabulary_newest_match",
        word: "  Hello   World ",
        definition: "xin chao the gioi",
        explanation: "A familiar greeting.",
        exampleSentence: "Hello world.",
        srsData: {
          interval: 7,
          nextReviewAt: new Date("2026-07-17T12:00:00.000Z"),
        },
      },
      {
        id: "vocabulary_older_match",
        word: "hello world",
        definition: "older meaning",
        explanation: null,
        exampleSentence: "An older example.",
        srsData: null,
      },
      {
        id: "vocabulary_non_match",
        word: "hello worlds",
        definition: "not exact",
        explanation: null,
        exampleSentence: "Not a match.",
        srsData: null,
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/vocabulary?match=normalized&word=hello%20world&bookId=cm9testbook0000000000000000",
      ),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user_123",
        bookId: "cm9testbook0000000000000000",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        word: true,
        definition: true,
        explanation: true,
        exampleSentence: true,
        srsData: {
          select: {
            interval: true,
            nextReviewAt: true,
          },
        },
      },
    });
    expect(await response.json()).toEqual({
      items: [
        {
          id: "vocabulary_newest_match",
          word: "  Hello   World ",
          definition: "xin chao the gioi",
          explanation: "A familiar greeting.",
          exampleSentence: "Hello world.",
          srsData: {
            interval: 7,
            nextReviewAt: "2026-07-17T12:00:00.000Z",
          },
        },
      ],
      pagination: {
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      },
    });
    expect(routeMocks.count).not.toHaveBeenCalled();
    expect(routeMocks.bookFindMany).not.toHaveBeenCalled();
  });

  it("rejects normalized lookup without a current book", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/vocabulary?match=normalized&word=hello",
      ),
    );

    expect(response.status).toBe(400);
    expect(routeMocks.findMany).not.toHaveBeenCalled();
  });
});
