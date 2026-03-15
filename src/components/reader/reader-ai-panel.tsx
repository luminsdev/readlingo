"use client";

import {
  AlertCircle,
  BookOpenText,
  ChevronRight,
  Copy,
  LoaderCircle,
  Save,
  Sparkles,
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
import type { ExplanationPayload } from "@/types";

type AiPanelState = "idle" | "loading" | "ready" | "error";

type PopoverPosition = {
  top: number;
  left: number;
};

function getBriefExplanation(explanation: string | undefined) {
  if (!explanation) {
    return "";
  }

  if (explanation.length <= 140) {
    return explanation;
  }

  return `${explanation.slice(0, 137).trimEnd()}...`;
}

export function ReaderAiPanel({
  state,
  errorMessage,
  explanation,
  isSidebarOpen,
  popoverPosition,
  selectedText,
  tooltipSelectedText,
  onCopySelection,
  onExplainSelection,
  onOpenSidebar,
  onRetry,
}: {
  state: AiPanelState;
  errorMessage: string | null;
  explanation: ExplanationPayload | null;
  isSidebarOpen: boolean;
  popoverPosition: PopoverPosition | null;
  selectedText: string | null;
  tooltipSelectedText: string | null;
  onCopySelection: () => void;
  onExplainSelection: () => void;
  onOpenSidebar: () => void;
  onRetry: () => void;
}) {
  const showPopover = popoverPosition && tooltipSelectedText;
  const briefExplanation = getBriefExplanation(explanation?.explanation);
  const showIdlePanel = !isSidebarOpen && state === "idle";
  const showLoadingPanel = !isSidebarOpen && state === "loading";
  const showErrorPanel = !isSidebarOpen && state === "error";
  const showCompactReadyPanel =
    !isSidebarOpen && state === "ready" && !!explanation;
  const showSidebarLoading = isSidebarOpen && state === "loading";
  const showSidebarError = isSidebarOpen && state === "error";
  const showSidebarReady = isSidebarOpen && state === "ready" && !!explanation;

  return (
    <>
      {showPopover ? (
        <div
          className="paper-panel border-border/80 fixed z-50 w-[min(320px,calc(100vw-2rem))] rounded-[26px] border p-4 shadow-[0_28px_60px_rgba(47,31,18,0.18)]"
          style={{
            top: popoverPosition.top,
            left: popoverPosition.left,
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Badge>Selection</Badge>
              <span className="text-muted-foreground text-xs">
                Reader tools
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-foreground text-sm leading-5 font-medium">
                {tooltipSelectedText}
              </p>
              <p className="text-muted-foreground text-xs leading-5">
                Explain this selection or copy it without opening the AI panel.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={onExplainSelection} size="sm" type="button">
                <Sparkles className="size-4" />
                Explain
              </Button>
              <Button
                onClick={onCopySelection}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <Badge>Phase 3 AI layer</Badge>
          <CardTitle className="font-serif text-2xl">
            AI explanation panel
          </CardTitle>
          <CardDescription>
            Highlight a word or sentence, then choose Explain to open a full
            in-context Vietnamese explanation.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          {showIdlePanel ? (
            <div className="text-muted-foreground border-border/80 flex items-start gap-3 rounded-[24px] border border-dashed bg-white/60 p-4">
              <Sparkles className="mt-0.5 size-4 shrink-0" />
              Highlight text inside the EPUB to open the floating selection
              actions. Choose Explain only when you want the AI sidebar.
            </div>
          ) : null}

          {showLoadingPanel ? (
            <div className="text-muted-foreground border-border/70 flex items-start gap-3 rounded-[24px] border bg-white/70 p-4">
              <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" />
              <div className="space-y-1">
                <p className="text-foreground font-medium">Working on it...</p>
                <p>
                  AI is preparing a richer explanation for
                  {selectedText ? ` "${selectedText}".` : " your selection."}
                </p>
              </div>
            </div>
          ) : null}

          {showErrorPanel ? (
            <div className="space-y-3 rounded-[24px] border border-[#d9b7a8] bg-[#fff4ef] p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-[#8a3522]">
                <AlertCircle className="size-4" />
                The AI request did not finish.
              </p>
              <p className="text-[#7a5748]">{errorMessage}</p>
              <Button
                onClick={onRetry}
                size="sm"
                type="button"
                variant="secondary"
              >
                Retry explanation
              </Button>
            </div>
          ) : null}

          {showCompactReadyPanel ? (
            <div className="border-border/70 space-y-4 rounded-[28px] border bg-white/72 p-5">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                  Translation
                </p>
                <p className="text-foreground font-serif text-2xl">
                  {explanation.translation}
                </p>
              </div>

              <p className="text-muted-foreground">{briefExplanation}</p>

              <Button onClick={onOpenSidebar} size="sm" type="button">
                See more
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : null}

          {isSidebarOpen ? (
            <div className="border-border/70 space-y-5 rounded-[28px] border bg-white/76 p-5 shadow-[0_18px_42px_rgba(47,31,18,0.08)]">
              {showSidebarLoading ? (
                <div className="text-muted-foreground flex items-start gap-3">
                  <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" />
                  <div className="space-y-1">
                    <p className="text-foreground font-medium">
                      Expanding the explanation...
                    </p>
                    <p>The full sidebar content is still streaming.</p>
                  </div>
                </div>
              ) : null}

              {showSidebarError ? (
                <div className="space-y-3 text-sm">
                  <p className="flex items-center gap-2 font-medium text-[#8a3522]">
                    <AlertCircle className="size-4" />
                    AI explanation unavailable
                  </p>
                  <p className="text-muted-foreground">{errorMessage}</p>
                  <Button
                    onClick={onRetry}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Retry explanation
                  </Button>
                </div>
              ) : null}

              {showSidebarReady ? (
                <>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                          Selected text
                        </p>
                        <p className="text-foreground text-sm font-medium">
                          {selectedText}
                        </p>
                      </div>

                      {explanation.partOfSpeech ? (
                        <Badge>{explanation.partOfSpeech}</Badge>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                        Translation
                      </p>
                      <p className="text-foreground font-serif text-2xl leading-tight">
                        {explanation.translation}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                      Explanation
                    </p>
                    <p className="text-foreground leading-6">
                      {explanation.explanation}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                      Example sentences
                    </p>

                    <div className="space-y-2">
                      {explanation.examples.map((example) => (
                        <div
                          className="border-border/70 rounded-[22px] border bg-[#fff8f0] p-4"
                          key={example}
                        >
                          <p className="text-foreground leading-6">{example}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button disabled type="button" variant="secondary">
                      <Save className="size-4" />
                      Save to Vocabulary
                    </Button>
                    <p className="text-muted-foreground flex items-start gap-2 text-xs">
                      <BookOpenText className="mt-0.5 size-3.5 shrink-0" />
                      Vocabulary saving stays disabled until Phase 4.
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
