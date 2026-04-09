import type Contents from "epubjs/types/contents";
import type { ReactNode } from "react";

import type { ReaderTocItem } from "./reader-table-of-contents-utils";

import type { ExplainSelectionInput } from "@/lib/ai-validation";

export type SaveState = "idle" | "saving" | "saved" | "error";

export type AiPanelState = "idle" | "loading" | "ready" | "error";

export type PendingExplainRequest = Pick<
  ExplainSelectionInput,
  "selectedText" | "surroundingParagraph" | "sourceLanguage"
>;

export type ReaderViewState = {
  activeCfi: string | null;
  canGoNext: boolean;
  canGoPrevious: boolean;
  chapterHref: string | null;
  errorMessage: string | null;
  isReady: boolean;
  locationLabel: string;
  progressPercentage: number | null;
};

export type ReaderTableOfContentsState = {
  items: ReaderTocItem[];
  isOpen: boolean;
};

export type ReaderSelectionHandlerRenderProps = {
  clearPendingSelection: () => void;
  dismissPanels: () => void;
  dismissPopover: () => void;
  hasPopoverOpen: boolean;
  isAiSidebarOpen: boolean;
  onSelection: (_cfiRange: string, contents: Contents) => void;
  panel: ReactNode;
};
