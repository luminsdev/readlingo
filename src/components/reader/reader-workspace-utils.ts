import type Contents from "epubjs/types/contents";

import { getReaderImagePageTarget } from "@/lib/reader";
import type { SelectionViewportRect } from "@/lib/reader-selection";

const AI_POPOVER_WIDTH = 320;
const AI_POPOVER_OFFSET = 14;
const AI_VIEWPORT_MARGIN = 16;

export const SAVE_DEBOUNCE_MS = 1200;

export function getReaderErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "This EPUB could not be rendered. The file may be corrupted or unsupported.";
}

export function getReaderInitialLocationLabel(progressCfi: string | null) {
  return progressCfi ? "Restoring your last page..." : "Opening book...";
}

export function formatSavedTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return "Not synced yet";
  }

  const savedAt = new Date(timestamp);

  return `Saved ${savedAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function readSelectionStreamText(response: Response) {
  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  return (async () => {
    let text = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        return text + decoder.decode();
      }

      text += decoder.decode(value, { stream: true });
    }
  })();
}

export function getPopoverPosition(
  rect: SelectionViewportRect | null,
  fallbackSurface: HTMLDivElement | null,
) {
  if (!rect) {
    if (!fallbackSurface) {
      return {
        top: AI_VIEWPORT_MARGIN,
        left: AI_VIEWPORT_MARGIN,
      };
    }

    const surfaceRect = fallbackSurface.getBoundingClientRect();

    return {
      top: Math.max(AI_VIEWPORT_MARGIN, surfaceRect.top + AI_VIEWPORT_MARGIN),
      left: clampValue(
        surfaceRect.left + AI_VIEWPORT_MARGIN,
        AI_VIEWPORT_MARGIN,
        Math.max(
          AI_VIEWPORT_MARGIN,
          window.innerWidth - AI_POPOVER_WIDTH - AI_VIEWPORT_MARGIN,
        ),
      ),
    };
  }

  const left = clampValue(
    rect.left + rect.width / 2 - AI_POPOVER_WIDTH / 2,
    AI_VIEWPORT_MARGIN,
    Math.max(
      AI_VIEWPORT_MARGIN,
      window.innerWidth - AI_POPOVER_WIDTH - AI_VIEWPORT_MARGIN,
    ),
  );

  const spaceBelow = window.innerHeight - rect.bottom;
  // Estimate tooltip maximum height (usually ~100-150px)
  const ESTIMATED_TOOLTIP_HEIGHT = 160;

  if (
    spaceBelow < ESTIMATED_TOOLTIP_HEIGHT &&
    rect.top > ESTIMATED_TOOLTIP_HEIGHT
  ) {
    // Flip above
    return {
      top: Math.max(
        AI_VIEWPORT_MARGIN,
        rect.top - ESTIMATED_TOOLTIP_HEIGHT - AI_POPOVER_OFFSET,
      ),
      left,
    };
  }

  // Draw below
  return {
    top: Math.max(AI_VIEWPORT_MARGIN, rect.bottom + AI_POPOVER_OFFSET),
    left,
  };
}

function setImportantStyle(
  element: Element | null | undefined,
  property: string,
  value: string,
) {
  if (!element) {
    return;
  }

  (element as HTMLElement | SVGElement).style.setProperty(
    property,
    value,
    "important",
  );
}

export function styleImageOnlyContent(contents: Contents) {
  const body = contents.document?.body;

  if (!body) {
    return;
  }

  body.tabIndex = -1;

  const imagePageTarget = getReaderImagePageTarget(body);

  if (!imagePageTarget) {
    body.removeAttribute("data-readlingo-image-page");
    return;
  }

  body.setAttribute("data-readlingo-image-page", "true");

  const root = contents.document.documentElement;

  setImportantStyle(root, "width", "100%");
  setImportantStyle(root, "height", "100%");
  setImportantStyle(root, "margin", "0");
  setImportantStyle(root, "padding", "0");

  setImportantStyle(body, "width", "100%");
  setImportantStyle(body, "height", "100%");
  setImportantStyle(body, "margin", "0");
  setImportantStyle(body, "padding", "0");
  setImportantStyle(body, "display", "flex");
  setImportantStyle(body, "align-items", "center");
  setImportantStyle(body, "justify-content", "center");
  setImportantStyle(body, "overflow", "hidden");

  const containerElements = imagePageTarget.containerChain.slice(1, -1);

  for (const element of containerElements) {
    setImportantStyle(element as Element, "width", "100%");
    setImportantStyle(element as Element, "height", "100%");
    setImportantStyle(element as Element, "margin", "0");
    setImportantStyle(element as Element, "padding", "0");
    setImportantStyle(element as Element, "display", "flex");
    setImportantStyle(element as Element, "align-items", "center");
    setImportantStyle(element as Element, "justify-content", "center");
    setImportantStyle(element as Element, "overflow", "hidden");
  }

  const mediaElement = imagePageTarget.containerChain.at(-1) as
    | Element
    | undefined;

  setImportantStyle(mediaElement, "display", "block");
  setImportantStyle(mediaElement, "width", "100%");
  setImportantStyle(mediaElement, "height", "100%");
  setImportantStyle(mediaElement, "max-width", "100%");
  setImportantStyle(mediaElement, "max-height", "100%");
  setImportantStyle(mediaElement, "margin", "0 auto");
  setImportantStyle(mediaElement, "object-fit", "contain");
  setImportantStyle(mediaElement, "object-position", "center center");
}
