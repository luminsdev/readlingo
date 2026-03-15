import type Contents from "epubjs/types/contents";

export type SelectionViewportRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

export type ReaderSelectionPayload = {
  selectedText: string;
  surroundingParagraph: string;
  rect: SelectionViewportRect | null;
};

const CONTEXT_BLOCK_SELECTOR = [
  "p",
  "li",
  "blockquote",
  "dd",
  "dt",
  "figcaption",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "pre",
].join(",");

function normalizeReaderText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function getRangeElement(range: Range) {
  const commonNode = range.commonAncestorContainer;

  if (commonNode.nodeType === Node.ELEMENT_NODE) {
    return commonNode as Element;
  }

  return commonNode.parentElement;
}

function getContextElement(range: Range) {
  const element = getRangeElement(range);

  if (!element) {
    return null;
  }

  return (
    element.closest(CONTEXT_BLOCK_SELECTOR) ??
    element.closest("div, section, article") ??
    element.parentElement
  );
}

function getRangeRect(range: Range) {
  const firstClientRect = Array.from(range.getClientRects()).find(
    (rect) => rect.width > 0 && rect.height > 0,
  );

  const rangeRect = firstClientRect ?? range.getBoundingClientRect();

  if (!rangeRect.width && !rangeRect.height) {
    return null;
  }

  return rangeRect;
}

function getViewportSelectionRect(
  contents: Contents,
  range: Range,
): SelectionViewportRect | null {
  const rangeRect = getRangeRect(range);

  if (!rangeRect) {
    return null;
  }

  const frameElement = contents.window?.frameElement;
  const frameRect = frameElement?.getBoundingClientRect();

  if (!frameRect) {
    return {
      top: rangeRect.top,
      left: rangeRect.left,
      width: rangeRect.width,
      height: rangeRect.height,
      right: rangeRect.right,
      bottom: rangeRect.bottom,
    };
  }

  return {
    top: frameRect.top + rangeRect.top,
    left: frameRect.left + rangeRect.left,
    width: rangeRect.width,
    height: rangeRect.height,
    right: frameRect.left + rangeRect.right,
    bottom: frameRect.top + rangeRect.bottom,
  };
}

export function clearReaderSelection(contents: Contents | null | undefined) {
  const selection = contents?.window?.getSelection?.();

  if (!selection) {
    return;
  }

  selection.removeAllRanges();
}

export function getReaderSelectionPayload(
  contents: Contents,
): ReaderSelectionPayload | null {
  const selection = contents.window?.getSelection?.();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const selectedText = normalizeReaderText(selection.toString());

  if (!selectedText) {
    return null;
  }

  const contextElement = getContextElement(range);
  const surroundingParagraph =
    normalizeReaderText(contextElement?.textContent) || selectedText;

  return {
    selectedText,
    surroundingParagraph,
    rect: getViewportSelectionRect(contents, range),
  };
}
