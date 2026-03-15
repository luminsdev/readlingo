import type { ReactNode } from "react";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  LoaderCircle,
  RefreshCcw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ReaderMetadata } from "@/lib/reader";

import type { SaveState } from "@/components/reader/reader-workspace-types";

type ReaderToolbarProps = {
  canGoNext: boolean;
  canGoPrevious: boolean;
  children: ReactNode;
  isReady: boolean;
  locationLabel: string;
  metadata: ReaderMetadata;
  onNext: () => void;
  onPrevious: () => void;
  saveState: SaveState;
  saveStatusLabel: string;
};

export function ReaderToolbar({
  canGoNext,
  canGoPrevious,
  children,
  isReady,
  locationLabel,
  metadata,
  onNext,
  onPrevious,
  saveState,
  saveStatusLabel,
}: ReaderToolbarProps) {
  return (
    <Card>
      <CardHeader className="border-border/70 gap-5 border-b pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Badge>Phase 2 reader</Badge>
            <div className="space-y-2">
              <CardTitle className="font-serif text-3xl sm:text-4xl">
                {metadata.title}
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {metadata.author ??
                  "Author metadata is unavailable for this EPUB."}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-right">
            <Badge>
              {metadata.language === "und"
                ? "Language pending"
                : metadata.language}
            </Badge>
            <Badge>{locationLabel}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <BookOpen className="size-4" />
            Paginated EPUB rendering is live, with resume-by-CFI enabled.
          </div>

          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            {saveState === "saving" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            {saveStatusLabel}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            disabled={!canGoPrevious || !isReady}
            onClick={onPrevious}
            type="button"
            variant="secondary"
          >
            <ArrowLeft className="size-4" />
            Previous
          </Button>

          <div className="text-muted-foreground text-sm">
            Use the arrow keys or navigation controls to turn pages.
          </div>

          <Button
            disabled={!canGoNext || !isReady}
            onClick={onNext}
            type="button"
          >
            Next
            <ArrowRight className="size-4" />
          </Button>
        </div>

        {children}
      </CardContent>
    </Card>
  );
}
