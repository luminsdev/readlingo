import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getCsvExport } from "@/app/api/vocabulary/export/csv/route";
import { GET as getTsvExport } from "@/app/api/vocabulary/export/tsv/route";
import {
  buildVocabularyExportQuery,
  createVocabularyExportFilename,
  formatVocabularyCsv,
  formatVocabularyTsv,
  mapVocabularyExportRow,
  VOCABULARY_EXPORT_MAX_ROWS,
  type VocabularyExportRecord,
} from "@/lib/vocabulary-export";

const routeMocks = vi.hoisted(() => ({
  auth: vi.fn<() => Promise<{ user: { id: string } } | null>>(async () => ({
    user: { id: "user_123" },
  })),
  count: vi.fn<() => Promise<number>>(async () => 0),
  findMany: vi.fn<() => Promise<VocabularyExportRecord[]>>(async () => []),
  checkRateLimit: vi.fn<
    () => {
      allowed: boolean;
      remaining: number;
      retryAfterSeconds: number | null;
    }
  >(() => ({ allowed: true, remaining: 9, retryAfterSeconds: null })),
  generateRequestId: vi.fn(() => "request_123"),
  logServerError: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: routeMocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    vocabulary: {
      count: routeMocks.count,
      findMany: routeMocks.findMany,
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: routeMocks.checkRateLimit,
}));
vi.mock("@/lib/logger", () => ({
  generateRequestId: routeMocks.generateRequestId,
  logServerError: routeMocks.logServerError,
}));

const BASE_RECORD: VocabularyExportRecord = {
  word: "bonjour",
  definition: "hello",
  contextSentence: "Bonjour, mon ami.",
  exampleSentence: "A polite greeting.",
  partOfSpeech: null,
  pronunciation: null,
  mnemonic: null,
  createdAt: new Date("2026-07-16T08:30:00.000Z"),
  srsData: null,
  book: null,
};

function createRecord(
  overrides: Partial<VocabularyExportRecord> = {},
): VocabularyExportRecord {
  return { ...BASE_RECORD, ...overrides };
}

describe("Vocabulary Export", () => {
  it("maps optional fields, derived status, book title, and ISO date", () => {
    expect(
      mapVocabularyExportRow(
        createRecord({
          partOfSpeech: "noun",
          pronunciation: "/bɔ̃.ʒuʁ/",
          mnemonic: "Bon journey starts with bonjour.",
          srsData: { interval: 21 },
          book: { title: "Le Petit Prince" },
        }),
      ),
    ).toEqual({
      word: "bonjour",
      definition: "hello",
      contextSentence: "Bonjour, mon ami.",
      exampleSentence: "A polite greeting.",
      partOfSpeech: "noun",
      pronunciation: "/bɔ̃.ʒuʁ/",
      mnemonic: "Bon journey starts with bonjour.",
      status: "mastered",
      bookTitle: "Le Petit Prince",
      createdAt: "2026-07-16T08:30:00.000Z",
    });

    expect(mapVocabularyExportRow(createRecord({ srsData: null })).status).toBe(
      "new",
    );
    expect(
      mapVocabularyExportRow(createRecord({ srsData: { interval: 20 } }))
        .status,
    ).toBe("learning");
  });

  it("formats CSV with a BOM, exact header, empty optionals, and RFC4180 escaping", () => {
    const csv = formatVocabularyCsv([
      createRecord({
        word: 'say "hello"',
        definition: "greeting, welcome",
        contextSentence: "first line\nsecond line",
      }),
    ]);
    const header = [
      "word",
      "definition",
      "contextSentence",
      "exampleSentence",
      "partOfSpeech",
      "pronunciation",
      "mnemonic",
      "status",
      "bookTitle",
      "createdAt",
    ].join(",");
    const row = [
      '"say ""hello"""',
      '"greeting, welcome"',
      '"first line\nsecond line"',
      "A polite greeting.",
      "",
      "",
      "",
      "new",
      "",
      "2026-07-16T08:30:00.000Z",
    ].join(",");

    expect(csv).toBe(`\uFEFF${header}\r\n${row}`);
  });

  it("returns a BOM and header only for an empty CSV export", () => {
    expect(formatVocabularyCsv([])).toBe(
      "\uFEFFword,definition,contextSentence,exampleSentence,partOfSpeech,pronunciation,mnemonic,status,bookTitle,createdAt",
    );
  });

  it("formats headerless Anki TSV with five fields and delimited-field escaping", () => {
    const tsv = formatVocabularyTsv([
      createRecord({
        word: "mot\tclé",
        definition: 'He said "hello"',
        contextSentence: "first line\nsecond line",
        srsData: { interval: 21 },
      }),
    ]);

    expect(tsv).toBe(
      [
        '"mot\tclé"',
        '"He said ""hello"""',
        '"first line\nsecond line"',
        "A polite greeting.",
        "readlingo status:mastered",
      ].join("\t"),
    );
    expect(formatVocabularyTsv([])).toBe("");
  });

  it("quotes a leading hash in the first TSV field so Anki keeps the row", () => {
    expect(formatVocabularyTsv([createRecord({ word: "#bonjour" })])).toBe(
      [
        '"#bonjour"',
        "hello",
        "Bonjour, mon ami.",
        "A polite greeting.",
        "readlingo status:new",
      ].join("\t"),
    );
  });

  it("assembles an ownership-scoped filtered query and ignores page", () => {
    const query = buildVocabularyExportQuery(
      "user_123",
      new URLSearchParams({
        q: "  maison  ",
        status: "learning",
        sort: "az",
        page: "9",
      }),
    );

    expect(query).toEqual({
      where: {
        userId: "user_123",
        OR: [
          { word: { contains: "maison", mode: "insensitive" } },
          { definition: { contains: "maison", mode: "insensitive" } },
        ],
        srsData: { is: { interval: { lt: 21 } } },
      },
      orderBy: { word: "asc" },
      select: {
        word: true,
        definition: true,
        contextSentence: true,
        exampleSentence: true,
        partOfSpeech: true,
        pronunciation: true,
        mnemonic: true,
        createdAt: true,
        srsData: { select: { interval: true } },
        book: { select: { title: true } },
      },
    });
    expect(query).not.toHaveProperty("skip");
    expect(query).not.toHaveProperty("take");
  });

  it("uses the locked soft cap and safe UTC-dated filenames", () => {
    const date = new Date("2026-07-16T23:59:59.000Z");

    expect(VOCABULARY_EXPORT_MAX_ROWS).toBe(5_000);
    expect(createVocabularyExportFilename("csv", date)).toBe(
      "readlingo-vocab-2026-07-16.csv",
    );
    expect(createVocabularyExportFilename("tsv", date)).toBe(
      "readlingo-vocab-2026-07-16.tsv",
    );
  });
});

describe("Vocabulary Export Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.auth.mockResolvedValue({ user: { id: "user_123" } });
    routeMocks.count.mockResolvedValue(0);
    routeMocks.findMany.mockResolvedValue([]);
    routeMocks.checkRateLimit.mockReturnValue({
      allowed: true,
      remaining: 9,
      retryAfterSeconds: null,
    });
  });

  it.each([
    ["CSV", getCsvExport, "csv"],
    ["TSV", getTsvExport, "tsv"],
  ])(
    "rejects unauthenticated %s exports",
    async (_label, handler, extension) => {
      routeMocks.auth.mockResolvedValueOnce(null);

      const response = await handler(
        new Request(`http://localhost/api/vocabulary/export/${extension}`),
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
      expect(routeMocks.count).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["CSV", getCsvExport, "csv"],
    ["TSV", getTsvExport, "tsv"],
  ])("rate limits %s exports per user", async (_label, handler, extension) => {
    routeMocks.checkRateLimit.mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 17,
    });

    const response = await handler(
      new Request(`http://localhost/api/vocabulary/export/${extension}`),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(routeMocks.checkRateLimit).toHaveBeenCalledWith(
      "vocab-export:user_123",
      10,
      60_000,
    );
    expect(routeMocks.count).not.toHaveBeenCalled();
  });

  it.each([
    ["CSV", getCsvExport, "csv"],
    ["TSV", getTsvExport, "tsv"],
  ])(
    "rejects over-cap %s exports before loading rows",
    async (_label, handler, extension) => {
      routeMocks.count.mockResolvedValueOnce(5_001);

      const response = await handler(
        new Request(`http://localhost/api/vocabulary/export/${extension}`),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error:
          "5,001 vocabulary items match these filters. Refine your filters to export 5,000 items or fewer.",
      });
      expect(routeMocks.findMany).not.toHaveBeenCalled();
    },
  );

  it("returns an empty CSV download with exact headers", async () => {
    const response = await getCsvExport(
      new Request("http://localhost/api/vocabulary/export/csv"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/csv; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="readlingo-vocab-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    const body = new Uint8Array(await response.arrayBuffer());

    expect(Array.from(body.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(body.slice(3))).toBe(
      "word,definition,contextSentence,exampleSentence,partOfSpeech,pronunciation,mnemonic,status,bookTitle,createdAt",
    );
    expect(routeMocks.findMany).not.toHaveBeenCalled();
  });

  it("returns an empty headerless TSV download with exact headers", async () => {
    const response = await getTsvExport(
      new Request("http://localhost/api/vocabulary/export/tsv"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/tab-separated-values; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="readlingo-vocab-\d{4}-\d{2}-\d{2}\.tsv"$/,
    );
    expect(await response.text()).toBe("");
    expect(routeMocks.findMany).not.toHaveBeenCalled();
  });

  it("loads all matching rows with the assembled query and no pagination", async () => {
    routeMocks.count.mockResolvedValueOnce(1);
    routeMocks.findMany.mockResolvedValueOnce([BASE_RECORD]);

    const response = await getCsvExport(
      new Request(
        "http://localhost/api/vocabulary/export/csv?q=maison&status=learning&sort=az&page=9",
      ),
    );
    const expectedQuery = buildVocabularyExportQuery(
      "user_123",
      new URLSearchParams({
        q: "maison",
        status: "learning",
        sort: "az",
        page: "9",
      }),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.count).toHaveBeenCalledWith({
      where: expectedQuery.where,
    });
    expect(routeMocks.findMany).toHaveBeenCalledWith(expectedQuery);
  });

  it("logs unexpected failures and returns a user-safe request ID", async () => {
    routeMocks.count.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await getCsvExport(
      new Request("http://localhost/api/vocabulary/export/csv"),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to export vocabulary.",
      requestId: "request_123",
    });
    expect(routeMocks.logServerError).toHaveBeenCalledWith(
      "VOCABULARY_EXPORT_FAILED",
      "Failed to export vocabulary as CSV",
      {
        requestId: "request_123",
        userId: "user_123",
        error: "database unavailable",
      },
    );
  });
});
