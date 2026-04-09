import {
  READER_FONT_SIZE_DEFAULT,
  READER_THEME_DEFAULT,
  type ReaderTheme,
} from "@/lib/settings-validation";

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

type StyleWritableLike = {
  style?: {
    setProperty?: (property: string, value: string, priority?: string) => void;
  } | null;
};

type ReaderDocumentLike = {
  body?: (FocusableLike & StyleWritableLike) | null;
  documentElement?: StyleWritableLike | null;
};

type ReaderContentsLike = {
  document?: ReaderDocumentLike | null;
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

export const READER_THEME_CONFIG = {
  light: {
    background: "#ffffff",
    foreground: "#1a1a1a",
    colorScheme: "light" as const,
  },
  sepia: {
    background: "#f4ecd8",
    foreground: "#5b4636",
    colorScheme: "light" as const,
  },
  dark: {
    background: "#1a1a1a",
    foreground: "#d4d4d4",
    colorScheme: "dark" as const,
  },
} as const;

export function getReaderViewportBackground(
  theme: ReaderTheme = READER_THEME_DEFAULT,
) {
  return READER_THEME_CONFIG[theme].background;
}

export const READER_VIEWPORT_BACKGROUND =
  getReaderViewportBackground(READER_THEME_DEFAULT);
export const READER_VIEWPORT_FOREGROUND =
  READER_THEME_CONFIG[READER_THEME_DEFAULT].foreground;

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

function setImportantStyle(
  target: StyleWritableLike | null | undefined,
  property: string,
  value: string,
) {
  target?.style?.setProperty?.(property, value, "important");
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

export function applyReaderThemeToContents(
  contents: ReaderContentsLike[] | null | undefined,
  theme: ReaderTheme = READER_THEME_DEFAULT,
) {
  const config = READER_THEME_CONFIG[theme];

  for (const content of contents ?? []) {
    const document = content.document;

    if (!document) {
      continue;
    }

    setImportantStyle(
      document.documentElement,
      "color-scheme",
      config.colorScheme,
    );
    setImportantStyle(
      document.documentElement,
      "background-color",
      config.background,
    );
    setImportantStyle(document.body, "background-color", config.background);
    setImportantStyle(document.body, "color", config.foreground);
  }
}

export function applyReaderFontSizeToContents(
  contents: ReaderContentsLike[] | null | undefined,
  fontSize: number = READER_FONT_SIZE_DEFAULT,
) {
  for (const content of contents ?? []) {
    setImportantStyle(content.document?.body, "font-size", `${fontSize}px`);
  }
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
