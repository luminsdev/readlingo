import type { ReactNode } from "react";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  List,
  LoaderCircle,
  Minus,
  Plus,
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
import {
  READER_FONT_SIZE_MAX,
  READER_FONT_SIZE_MIN,
  READER_FONT_SIZE_STEP,
  type ReaderTheme,
} from "@/lib/settings-validation";
import { cn } from "@/lib/utils";

import type { SaveState } from "@/components/reader/reader-workspace-types";

const READER_THEME_OPTIONS: Array<{
  theme: ReaderTheme;
  label: string;
  swatchClassName: string;
}> = [
  {
    theme: "light",
    label: "Light",
    swatchClassName: "border-slate-400 bg-white",
  },
  {
    theme: "sepia",
    label: "Sepia",
    swatchClassName: "border-[#c8b08a] bg-[#f4ecd8]",
  },
  {
    theme: "dark",
    label: "Dark",
    swatchClassName: "border-slate-700 bg-[#1a1a1a]",
  },
];

type ReaderToolbarProps = {
  canGoNext: boolean;
  canGoPrevious: boolean;
  children: ReactNode;
  fontSize: number;
  isReady: boolean;
  isTocOpen: boolean;
  locationLabel: string;
  metadata: ReaderMetadata;
  onFontSizeChange: (size: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onReaderThemeChange: (theme: ReaderTheme) => void;
  onToggleToc: () => void;
  progressPercentage: number | null;
  readerTheme: ReaderTheme;
  tocItemCount: number;
  saveState: SaveState;
  saveStatusLabel: string;
};

export function ReaderToolbar({
  canGoNext,
  canGoPrevious,
  children,
  fontSize,
  isReady,
  isTocOpen,
  locationLabel,
  metadata,
  onFontSizeChange,
  onNext,
  onPrevious,
  onReaderThemeChange,
  onToggleToc,
  progressPercentage,
  readerTheme,
  saveState,
  saveStatusLabel,
  tocItemCount,
}: ReaderToolbarProps) {
  const canToggleToc = isReady && tocItemCount > 0;
  const canDecreaseFontSize = isReady && fontSize > READER_FONT_SIZE_MIN;
  const canIncreaseFontSize = isReady && fontSize < READER_FONT_SIZE_MAX;

  return (
    <Card>
      <CardHeader className="border-border/70 gap-5 border-b pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
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
            {progressPercentage !== null ? (
              <Badge>{progressPercentage}%</Badge>
            ) : null}
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={!canGoPrevious || !isReady}
              onClick={onPrevious}
              type="button"
              variant="secondary"
            >
              <ArrowLeft className="size-4" />
              Previous
            </Button>

            <Button
              aria-haspopup="dialog"
              aria-label={
                isTocOpen ? "Close table of contents" : "Open table of contents"
              }
              aria-pressed={isTocOpen}
              data-reader-toc-toggle="true"
              disabled={!canToggleToc}
              onClick={onToggleToc}
              size="sm"
              type="button"
              variant="secondary"
            >
              <List className="size-4" />
              <span className="hidden sm:inline">Contents</span>
            </Button>

            <div className="border-border/70 bg-muted/30 flex items-center gap-1 rounded-full border px-2 py-1">
              <Button
                aria-label={`Decrease font size to ${fontSize - READER_FONT_SIZE_STEP}px`}
                disabled={!canDecreaseFontSize}
                onClick={() =>
                  onFontSizeChange(fontSize - READER_FONT_SIZE_STEP)
                }
                size="icon"
                type="button"
                variant="ghost"
              >
                <Minus className="size-4" />
              </Button>

              <span className="min-w-12 text-center text-sm font-medium">
                {fontSize}px
              </span>

              <Button
                aria-label={`Increase font size to ${fontSize + READER_FONT_SIZE_STEP}px`}
                disabled={!canIncreaseFontSize}
                onClick={() =>
                  onFontSizeChange(fontSize + READER_FONT_SIZE_STEP)
                }
                size="icon"
                type="button"
                variant="ghost"
              >
                <Plus className="size-4" />
              </Button>
            </div>

            <div className="border-border/70 bg-muted/30 flex items-center gap-2 rounded-full border px-3 py-2">
              {READER_THEME_OPTIONS.map((option) => {
                const isActive = readerTheme === option.theme;

                return (
                  <button
                    aria-label={`Switch reader theme to ${option.label.toLowerCase()}`}
                    aria-pressed={isActive}
                    className={cn(
                      "focus-visible:border-ring focus-visible:ring-ring/50 relative rounded-full border border-transparent p-1 transition focus-visible:ring-[3px] focus-visible:outline-none",
                      isActive
                        ? "border-foreground/20 bg-background"
                        : "hover:bg-background/70",
                    )}
                    key={option.theme}
                    onClick={() => onReaderThemeChange(option.theme)}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "block size-5 rounded-full border shadow-sm",
                        option.swatchClassName,
                      )}
                    />
                    {isActive ? (
                      <Check className="text-foreground absolute -top-1 -right-1 size-3.5 rounded-full bg-white p-0.5 dark:bg-slate-900" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-muted-foreground text-sm">
            Use arrow keys to turn pages. Press Escape to close overlays.
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
