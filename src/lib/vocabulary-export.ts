import type { Prisma } from "@prisma/client";

import {
  buildVocabularyWhere,
  deriveVocabularyStatus,
  getVocabularyOrderBy,
  parseVocabularySearchParams,
  type VocabularyStatus,
} from "@/lib/vocabulary-query";

export const VOCABULARY_EXPORT_MAX_ROWS = 5_000;
export const VOCABULARY_EXPORT_RATE_LIMIT = 10;
export const VOCABULARY_EXPORT_RATE_WINDOW_MS = 60_000;

const CSV_COLUMNS = [
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
] as const;

const VOCABULARY_EXPORT_SELECT = {
  word: true,
  definition: true,
  contextSentence: true,
  exampleSentence: true,
  partOfSpeech: true,
  pronunciation: true,
  mnemonic: true,
  createdAt: true,
  srsData: {
    select: {
      interval: true,
    },
  },
  book: {
    select: {
      title: true,
    },
  },
} satisfies Prisma.VocabularySelect;

export type VocabularyExportRecord = Prisma.VocabularyGetPayload<{
  select: typeof VOCABULARY_EXPORT_SELECT;
}>;

export type VocabularyExportRow = {
  word: string;
  definition: string;
  contextSentence: string;
  exampleSentence: string;
  partOfSpeech: string;
  pronunciation: string;
  mnemonic: string;
  status: VocabularyStatus;
  bookTitle: string;
  createdAt: string;
};

export function buildVocabularyExportQuery(
  userId: string,
  searchParams: URLSearchParams,
) {
  const { searchQuery, statusFilter, sortBy } = parseVocabularySearchParams({
    page: searchParams.get("page") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
  });

  return {
    where: buildVocabularyWhere({ userId, searchQuery, statusFilter }),
    orderBy: getVocabularyOrderBy(sortBy),
    select: VOCABULARY_EXPORT_SELECT,
  };
}

export function mapVocabularyExportRow(
  record: VocabularyExportRecord,
): VocabularyExportRow {
  return {
    word: record.word,
    definition: record.definition,
    contextSentence: record.contextSentence,
    exampleSentence: record.exampleSentence,
    partOfSpeech: record.partOfSpeech ?? "",
    pronunciation: record.pronunciation ?? "",
    mnemonic: record.mnemonic ?? "",
    status: deriveVocabularyStatus(record.srsData),
    bookTitle: record.book?.title ?? "",
    createdAt: record.createdAt.toISOString(),
  };
}

function escapeDelimitedField(
  value: string,
  delimiter: string,
  forceQuote = false,
): string {
  if (!forceQuote && !value.includes(delimiter) && !/["\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

export function formatVocabularyCsv(
  records: readonly VocabularyExportRecord[],
): string {
  const rows = records.map((record) => {
    const row = mapVocabularyExportRow(record);

    return CSV_COLUMNS.map((column) =>
      escapeDelimitedField(row[column], ","),
    ).join(",");
  });

  return `\uFEFF${[CSV_COLUMNS.join(","), ...rows].join("\r\n")}`;
}

export function formatVocabularyTsv(
  records: readonly VocabularyExportRecord[],
): string {
  return records
    .map((record) => {
      const row = mapVocabularyExportRow(record);
      const fields = [
        row.word,
        row.definition,
        row.contextSentence,
        row.exampleSentence,
        `readlingo status:${row.status}`,
      ];

      return fields
        .map((field, index) =>
          escapeDelimitedField(
            field,
            "\t",
            index === 0 && field.startsWith("#"),
          ),
        )
        .join("\t");
    })
    .join("\r\n");
}

export function createVocabularyExportFilename(
  extension: "csv" | "tsv",
  date = new Date(),
): string {
  return `readlingo-vocab-${date.toISOString().slice(0, 10)}.${extension}`;
}
