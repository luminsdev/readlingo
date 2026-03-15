import type Contents from "epubjs/types/contents";
import type { ReactNode } from "react";

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
  errorMessage: string | null;
  isReady: boolean;
  locationLabel: string;
};

export type ReaderSelectionHandlerRenderProps = {
  clearPendingSelection: () => void;
  dismissPanels: () => void;
  onSelection: (_cfiRange: string, contents: Contents) => void;
  panel: ReactNode;
};
