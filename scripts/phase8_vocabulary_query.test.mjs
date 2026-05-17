import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVocabularyWhere,
  deriveVocabularyStatus,
  getVocabularyOrderBy,
  getVocabularyStatusBadge,
  parseVocabularySearchParams,
} from "../src/lib/vocabulary-query.ts";

test("deriveVocabularyStatus maps missing and reviewed SRS data to archive statuses", () => {
  assert.equal(deriveVocabularyStatus(null), "new");
  assert.equal(deriveVocabularyStatus({ interval: 20 }), "learning");
  assert.equal(deriveVocabularyStatus({ interval: 21 }), "mastered");
});

test("parseVocabularySearchParams normalizes page, search, status, and sort values", () => {
  assert.deepEqual(
    parseVocabularySearchParams({
      page: "3",
      q: "  maison  ",
      status: "learning",
      sort: "az",
    }),
    {
      currentPage: 3,
      searchQuery: "maison",
      statusFilter: "learning",
      sortBy: "az",
    },
  );

  assert.deepEqual(
    parseVocabularySearchParams({
      page: "0",
      q: "   ",
      status: "archived",
      sort: "random",
    }),
    {
      currentPage: 1,
      searchQuery: "",
      statusFilter: "",
      sortBy: "newest",
    },
  );
});

test("buildVocabularyWhere scopes search and SRS status filters to the user", () => {
  assert.deepEqual(
    buildVocabularyWhere({
      userId: "user_123",
      searchQuery: "casa",
      statusFilter: "mastered",
    }),
    {
      userId: "user_123",
      OR: [
        { word: { contains: "casa", mode: "insensitive" } },
        { definition: { contains: "casa", mode: "insensitive" } },
      ],
      srsData: { is: { interval: { gte: 21 } } },
    },
  );

  assert.deepEqual(
    buildVocabularyWhere({
      userId: "user_123",
      searchQuery: "",
      statusFilter: "new",
    }),
    {
      userId: "user_123",
      srsData: null,
    },
  );

  assert.deepEqual(
    buildVocabularyWhere({
      userId: "user_123",
      searchQuery: "",
      statusFilter: "learning",
    }),
    {
      userId: "user_123",
      srsData: { is: { interval: { lt: 21 } } },
    },
  );
});

test("getVocabularyOrderBy maps toolbar sort values to Prisma order clauses", () => {
  assert.deepEqual(getVocabularyOrderBy("newest"), { createdAt: "desc" });
  assert.deepEqual(getVocabularyOrderBy("oldest"), { createdAt: "asc" });
  assert.deepEqual(getVocabularyOrderBy("az"), { word: "asc" });
  assert.deepEqual(getVocabularyOrderBy("za"), { word: "desc" });
});

test("getVocabularyStatusBadge exposes human labels for status badges", () => {
  assert.equal(getVocabularyStatusBadge("new").label, "New");
  assert.equal(getVocabularyStatusBadge("learning").label, "Learning");
  assert.equal(getVocabularyStatusBadge("mastered").label, "Mastered");
});
