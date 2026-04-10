"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Minimize } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ZenModeControlsProps = {
  canGoNext: boolean;
  canGoPrevious: boolean;
  isReady: boolean;
  locationLabel: string;
  onExitZenMode: () => void;
  onNext: () => void;
  onPrevious: () => void;
  progressPercentage: number | null;
};

export function ZenModeControls({
  canGoNext,
  canGoPrevious,
  isReady,
  locationLabel,
  onExitZenMode,
  onNext,
  onPrevious,
  progressPercentage,
}: ZenModeControlsProps) {
  const [isVisible, setIsVisible] = useState(true);
  const hideTimeoutRef = useRef<number | null>(null);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = null;
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      hideTimeoutRef.current = null;
    }, 3000);
  }, [clearHideTimeout]);

  const revealControls = useCallback(() => {
    setIsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const handleControlsPointerEnter = useCallback(() => {
    clearHideTimeout();
    setIsVisible(true);
  }, [clearHideTimeout]);

  useEffect(() => {
    revealControls();

    const handlePointerDown = () => {
      revealControls();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        return;
      }

      if (event.clientY <= 80) {
        revealControls();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      clearHideTimeout();
    };
  }, [clearHideTimeout, revealControls]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-20"
      />

      <div
        className={cn(
          "fixed top-4 left-1/2 z-[70] -translate-x-1/2 transition-all duration-300 ease-out",
          isVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-3 opacity-0",
        )}
        onMouseEnter={handleControlsPointerEnter}
        onMouseLeave={scheduleHide}
        onPointerDown={revealControls}
      >
        <div className="border-border/70 bg-background/90 flex items-center gap-2 rounded-full border px-3 py-2 shadow-xl backdrop-blur-md">
          <Button
            aria-label="Exit zen mode"
            onClick={onExitZenMode}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Minimize className="size-4" />
          </Button>

          <div className="bg-border/70 h-5 w-px shrink-0" />

          <Button
            aria-label="Previous page"
            disabled={!canGoPrevious || !isReady}
            onClick={onPrevious}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ArrowLeft className="size-4" />
          </Button>

          <span className="text-muted-foreground min-w-24 text-center text-sm">
            {locationLabel}
          </span>

          <Button
            aria-label="Next page"
            disabled={!canGoNext || !isReady}
            onClick={onNext}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ArrowRight className="size-4" />
          </Button>

          {progressPercentage !== null ? (
            <>
              <div className="bg-border/70 h-5 w-px shrink-0" />
              <Badge>{progressPercentage}%</Badge>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
