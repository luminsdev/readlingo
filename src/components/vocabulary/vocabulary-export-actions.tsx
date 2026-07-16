"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  createVocabularyExportFilename,
  VOCABULARY_EXPORT_MAX_ROWS,
} from "@/lib/vocabulary-export";
import type {
  VocabularySort,
  VocabularyStatusFilter,
} from "@/lib/vocabulary-query";

type ExportFormat = "csv" | "tsv";

const ANKI_FIELD_ORDER =
  "word | definition | contextSentence | exampleSentence | tags";

type VocabularyExportActionsProps = {
  matchCount: number;
  searchQuery: string;
  sortBy: VocabularySort;
  statusFilter: VocabularyStatusFilter;
};

function getDownloadFilename(contentDisposition: string | null) {
  return contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1]?.trim();
}

export function VocabularyExportActions({
  matchCount,
  searchQuery,
  sortBy,
  statusFilter,
}: VocabularyExportActionsProps) {
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOverLimit = matchCount > VOCABULARY_EXPORT_MAX_ROWS;
  const isExportDisabled =
    matchCount === 0 || isOverLimit || pendingFormat !== null;
  const matchingCountText = `${matchCount.toLocaleString("en-US")} ${matchCount === 1 ? "word" : "words"} matching current filters.`;
  const guidanceText =
    matchCount === 0
      ? "There is nothing to export for the current filters."
      : isOverLimit
        ? `${matchingCountText} Refine your filters to ${VOCABULARY_EXPORT_MAX_ROWS.toLocaleString("en-US")} words or fewer.`
        : matchingCountText;

  async function handleExport(format: ExportFormat) {
    if (pendingFormat !== null) return;

    setPendingFormat(format);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (statusFilter) params.set("status", statusFilter);
      params.set("sort", sortBy);

      const url = `/api/vocabulary/export/${format}?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        setError(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to export vocabulary. Please try again.",
        );
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download =
        getDownloadFilename(response.headers.get("Content-Disposition")) ??
        createVocabularyExportFilename(format);

      try {
        document.body.append(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      setError("Unable to export vocabulary. Please try again.");
    } finally {
      setPendingFormat(null);
    }
  }

  return (
    <section
      aria-busy={pendingFormat !== null}
      aria-labelledby="vocabulary-export-title"
      className="paper-panel border-border flex flex-col gap-4 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1.5">
        <h2
          id="vocabulary-export-title"
          className="font-serif text-base font-semibold"
        >
          Export current filters
        </h2>
        <p className="text-muted-foreground text-sm">{guidanceText}</p>
        <p className="text-muted-foreground text-xs">
          Anki fields: {ANKI_FIELD_ORDER}
        </p>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="sm"
          disabled={isExportDisabled}
          onClick={() => void handleExport("csv")}
        >
          {pendingFormat === "csv"
            ? "Exporting CSV..."
            : "Export CSV (current filters)"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isExportDisabled}
          onClick={() => void handleExport("tsv")}
        >
          {pendingFormat === "tsv"
            ? "Exporting Anki TSV..."
            : "Export Anki TSV (current filters)"}
        </Button>
      </div>
    </section>
  );
}
