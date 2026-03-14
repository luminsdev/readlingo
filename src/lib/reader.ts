type MetadataLike = Partial<{
  title: string;
  creator: string;
  language: string;
}>;

type LocationLike = {
  start?: {
    cfi?: string;
    displayed?: {
      page?: number;
      total?: number;
    };
  };
};

type FocusableLike = {
  focus?: (options?: { preventScroll?: boolean }) => void;
};

type ReaderContentsLike = {
  document?: {
    body?: FocusableLike | null;
  } | null;
  window?: {
    focus?: () => void;
  } | null;
};

type ReaderImagePageNodeLike = {
  children?: ArrayLike<ReaderImagePageNodeLike> | ReaderImagePageNodeLike[];
  tagName?: string | null;
  textContent?: string | null;
};

const IMAGE_PAGE_MEDIA_TAGS = new Set(["IMG", "SVG"]);
const MAX_IMAGE_PAGE_DEPTH = 12;

export type ReaderMetadata = {
  title: string;
  author: string | null;
  language: string;
};

export type ReaderNavigationDirection = "previous" | "next";

export type ReaderImagePageTarget = {
  containerChain: ReaderImagePageNodeLike[];
  mediaTagName: string;
};

function normalizeNodeText(value: string | null | undefined) {
  return value?.replace(/\s+/g, "").trim() ?? "";
}

function getNodeChildren(node: ReaderImagePageNodeLike | null | undefined) {
  return Array.from(node?.children ?? []);
}

function isMeaningfulNode(node: ReaderImagePageNodeLike) {
  const tagName = node.tagName?.toUpperCase() ?? "";

  return (
    IMAGE_PAGE_MEDIA_TAGS.has(tagName) ||
    getNodeChildren(node).length > 0 ||
    normalizeNodeText(node.textContent).length > 0
  );
}

function focusIfPossible(target: FocusableLike | null | undefined) {
  if (!target?.focus) {
    return false;
  }

  target.focus({ preventScroll: true });

  return true;
}

export function getReaderNavigationDirection(
  key: string,
): ReaderNavigationDirection | null {
  if (key === "ArrowLeft") {
    return "previous";
  }

  if (key === "ArrowRight") {
    return "next";
  }

  return null;
}

export function restoreReaderFocus(
  surface: FocusableLike | null | undefined,
  contents: ReaderContentsLike[] | null | undefined,
) {
  let focused = focusIfPossible(surface);

  for (const content of contents ?? []) {
    if (content.window?.focus) {
      content.window.focus();
      focused = true;
    }

    if (focusIfPossible(content.document?.body)) {
      focused = true;
    }
  }

  return focused;
}

export function getReaderImagePageTarget(
  root: ReaderImagePageNodeLike | null | undefined,
): ReaderImagePageTarget | null {
  if (!root) {
    return null;
  }

  const containerChain: ReaderImagePageNodeLike[] = [root];
  let current = root;

  for (let depth = 0; depth < MAX_IMAGE_PAGE_DEPTH; depth += 1) {
    const meaningfulChildren =
      getNodeChildren(current).filter(isMeaningfulNode);

    if (meaningfulChildren.length !== 1) {
      return null;
    }

    const next = meaningfulChildren[0];
    const mediaTagName = next.tagName?.toUpperCase() ?? "";

    containerChain.push(next);

    if (IMAGE_PAGE_MEDIA_TAGS.has(mediaTagName)) {
      return {
        containerChain,
        mediaTagName,
      };
    }

    current = next;
  }

  return null;
}

export function normalizeReaderMetadata(
  metadata: MetadataLike | null | undefined,
  fallback: ReaderMetadata,
): ReaderMetadata {
  const title = metadata?.title?.trim() || fallback.title;
  const author = metadata?.creator?.trim() || fallback.author;
  const language =
    metadata?.language?.trim().toLowerCase() || fallback.language;

  return {
    title,
    author,
    language,
  };
}

export function hasReaderMetadataChanged(
  previous: ReaderMetadata,
  next: ReaderMetadata,
) {
  return (
    previous.title !== next.title ||
    previous.author !== next.author ||
    previous.language !== next.language
  );
}

export function getReaderCfi(location: LocationLike | null | undefined) {
  return location?.start?.cfi?.trim() || null;
}

export function getReaderLocationLabel(
  location: LocationLike | null | undefined,
) {
  const page = location?.start?.displayed?.page;
  const total = location?.start?.displayed?.total;

  if (!page || !total) {
    return "Opening book...";
  }

  return `Page ${page} of ${total}`;
}
