import { describe, expect, it } from "vitest";

import {
  buildVocabularyWhere,
  deriveVocabularyStatus,
  getVocabularyOrderBy,
  getVocabularyStatusBadge,
  MASTERY_INTERVAL_THRESHOLD,
  parseVocabularySearchParams,
} from "@/lib/vocabulary-query";

describe("Vocabulary Query", () => {
  it("deriveVocabularyStatus maps missing and reviewed SRS data to archive statuses", () => {
    expect(deriveVocabularyStatus(null)).toBe("new");
    expect(deriveVocabularyStatus({ interval: 20 })).toBe("learning");
    expect(deriveVocabularyStatus({ interval: 21 })).toBe("mastered");
  });

  it("parseVocabularySearchParams normalizes page, search, status, and sort values", () => {
    expect(
      parseVocabularySearchParams({
        page: "3",
        q: "  maison  ",
        status: "learning",
        sort: "az",
      }),
    ).toEqual({
      currentPage: 3,
      searchQuery: "maison",
      statusFilter: "learning",
      sortBy: "az",
    });

    expect(
      parseVocabularySearchParams({
        page: "0",
        q: "   ",
        status: "archived",
        sort: "random",
      }),
    ).toEqual({
      currentPage: 1,
      searchQuery: "",
      statusFilter: "",
      sortBy: "newest",
    });
  });

  it("buildVocabularyWhere scopes search and SRS status filters to the user", () => {
    expect(
      buildVocabularyWhere({
        userId: "user_123",
        searchQuery: "casa",
        statusFilter: "mastered",
      }),
    ).toEqual({
      userId: "user_123",
      OR: [
        { word: { contains: "casa", mode: "insensitive" } },
        { definition: { contains: "casa", mode: "insensitive" } },
      ],
      srsData: { is: { interval: { gte: 21 } } },
    });

    expect(
      buildVocabularyWhere({
        userId: "user_123",
        searchQuery: "",
        statusFilter: "new",
      }),
    ).toEqual({
      userId: "user_123",
      srsData: null,
    });

    expect(
      buildVocabularyWhere({
        userId: "user_123",
        searchQuery: "",
        statusFilter: "learning",
      }),
    ).toEqual({
      userId: "user_123",
      srsData: { is: { interval: { lt: 21 } } },
    });
  });

  it("getVocabularyOrderBy maps toolbar sort values to Prisma order clauses", () => {
    expect(getVocabularyOrderBy("newest")).toEqual({ createdAt: "desc" });
    expect(getVocabularyOrderBy("oldest")).toEqual({ createdAt: "asc" });
    expect(getVocabularyOrderBy("az")).toEqual({ word: "asc" });
    expect(getVocabularyOrderBy("za")).toEqual({ word: "desc" });
  });

  it("getVocabularyStatusBadge exposes human labels for status badges", () => {
    expect(getVocabularyStatusBadge("new").label).toBe("New");
    expect(getVocabularyStatusBadge("learning").label).toBe("Learning");
    expect(getVocabularyStatusBadge("mastered").label).toBe("Mastered");
  });
});

describe("Vocabulary Status", () => {
  it("deriveVocabularyStatus returns 'new' when no SRS data", () => {
    expect(deriveVocabularyStatus(null)).toBe("new");
  });

  it("deriveVocabularyStatus returns 'learning' when interval is below threshold", () => {
    expect(deriveVocabularyStatus({ interval: 1 })).toBe("learning");
    expect(deriveVocabularyStatus({ interval: 6 })).toBe("learning");
    expect(deriveVocabularyStatus({ interval: 20 })).toBe("learning");
  });

  it("deriveVocabularyStatus returns 'mastered' when interval meets threshold", () => {
    expect(
      deriveVocabularyStatus({ interval: MASTERY_INTERVAL_THRESHOLD }),
    ).toBe("mastered");
    expect(deriveVocabularyStatus({ interval: 30 })).toBe("mastered");
    expect(deriveVocabularyStatus({ interval: 90 })).toBe("mastered");
  });

  it("deriveVocabularyStatus boundary: threshold minus one is 'learning'", () => {
    expect(
      deriveVocabularyStatus({ interval: MASTERY_INTERVAL_THRESHOLD - 1 }),
    ).toBe("learning");
  });
});
