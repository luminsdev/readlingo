"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import type { ReaderTocItem } from "@/components/reader/reader-table-of-contents-utils";
import { cn } from "@/lib/utils";

function ReaderTableOfContentsBranch({
  activeHref,
  depth,
  items,
  onNavigate,
}: {
  activeHref: string | null;
  depth: number;
  items: ReaderTocItem[];
  onNavigate: (href: string) => void;
}) {
  return items.map((item) => {
    const isActive = activeHref === item.href;

    return (
      <div className="space-y-0.5" key={item.href}>
        <button
          aria-current={isActive ? "location" : undefined}
          className="group focus-visible:ring-ring relative flex min-h-11 w-full cursor-pointer items-start justify-between gap-4 py-2.5 pr-8 text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
          onClick={() => onNavigate(item.href)}
          style={{ paddingLeft: `${depth * 28 + 32}px` }}
          type="button"
        >
          <div className="flex items-start gap-4">
            <span
              className={cn(
                "mt-[11px] size-1.5 shrink-0 rounded-full transition-opacity duration-300",
                isActive
                  ? "bg-foreground opacity-100"
                  : "bg-transparent opacity-0",
              )}
            />
            <span
              className={cn(
                "font-serif leading-relaxed transition-all duration-300",
                depth === 0 ? "text-[16px]" : "text-[14px]",
                isActive
                  ? "text-foreground font-medium italic"
                  : "text-ink-muted group-hover:text-foreground",
              )}
            >
              {item.label}
            </span>
          </div>
        </button>

        {item.subitems.length > 0 ? (
          <div className="mt-1 mb-2 space-y-0.5">
            <ReaderTableOfContentsBranch
              activeHref={activeHref}
              depth={depth + 1}
              items={item.subitems}
              onNavigate={onNavigate}
            />
          </div>
        ) : null}
      </div>
    );
  });
}

export function ReaderTableOfContents({
  activeHref,
  errorMessage,
  isOpen,
  items,
  onClose,
  onNavigate,
}: {
  activeHref: string | null;
  errorMessage: string | null;
  isOpen: boolean;
  items: ReaderTocItem[];
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isOpen) {
      setMounted(true);
    } else {
      timeout = setTimeout(() => {
        setMounted(false);
      }, 500); // 500ms to match the CSS transition duration
    }
    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const panelElement = panelRef.current;
    if (!panelElement) return;

    window.requestAnimationFrame(() => {
      const initialFocusTarget =
        panelElement.querySelector<HTMLElement>("[data-reader-toc-close]") ??
        panelElement;

      // Small delay prevents focus-stealing issues during intense renders
      setTimeout(() => {
        initialFocusTarget?.focus({ preventScroll: true });
      }, 50);
    });
  }, [isOpen, mounted]);

  if (!mounted && !isOpen) {
    return null;
  }

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") {
      return;
    }

    const panelElement = panelRef.current;

    if (!panelElement) {
      return;
    }

    const focusableElements = Array.from(
      panelElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("hidden"));

    if (focusableElements.length === 0) {
      event.preventDefault();
      panelElement.focus({ preventScroll: true });
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus({ preventScroll: true });
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus({ preventScroll: true });
    }
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-[24px]",
      )}
    >
      <button
        aria-label="Dismiss table of contents"
        className={cn(
          "pointer-events-auto absolute inset-0 bg-black/5 backdrop-blur-[2px] transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] dark:bg-black/20",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        type="button"
        tabIndex={-1}
      />

      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          "bg-surface pointer-events-auto relative flex h-full w-full max-w-[min(24rem,calc(100%-1rem))] flex-col shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        onKeyDown={handlePanelKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex flex-col gap-6 px-8 pt-10 pb-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2
                className="text-foreground font-serif text-3xl font-light tracking-wide"
                id={titleId}
              >
                Contents
              </h2>
              <p
                className="text-ink-muted max-w-xs text-[10px] font-medium tracking-[0.2em] uppercase opacity-60"
                id={descriptionId}
              >
                Book Index
              </p>
            </div>

            <button
              aria-label="Close table of contents"
              className="text-muted-foreground hover:bg-surface-soft hover:text-foreground focus-visible:ring-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
              data-reader-toc-close="true"
              onClick={onClose}
              type="button"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="from-ink-soft/40 h-px w-full bg-gradient-to-r to-transparent" />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto pt-2 pb-8">
          {errorMessage ? (
            <div className="mx-8 mb-6 border-l-2 border-red-400 bg-red-400/5 px-5 py-4">
              <p className="text-foreground text-sm leading-relaxed">
                {errorMessage}
              </p>
            </div>
          ) : null}

          {items.length > 0 ? (
            <div className="pr-4">
              <ReaderTableOfContentsBranch
                activeHref={activeHref}
                depth={0}
                items={items}
                onNavigate={onNavigate}
              />
            </div>
          ) : (
            <div className="px-8 py-8">
              <p className="text-ink-muted text-sm leading-relaxed italic">
                This EPUB does not expose a navigable chapter outline.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
