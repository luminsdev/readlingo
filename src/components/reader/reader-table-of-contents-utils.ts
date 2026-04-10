export type ReaderTocItem = {
  href: string;
  label: string;
  subitems: ReaderTocItem[];
};

export type ReaderEscapeAction =
  | "dismiss-popover"
  | "dismiss-ai-sidebar"
  | "exit-zen-mode"
  | "dismiss-toc"
  | null;

type ReaderEscapeActionState = {
  hasPopoverOpen: boolean;
  isAiSidebarOpen: boolean;
  isZenMode: boolean;
  isTocOpen: boolean;
};

type RawReaderTocItem = {
  href?: unknown;
  label?: unknown;
  subitems?: unknown;
};

type ReaderTocNormalizationOptions = {
  navigationPath?: string | null;
};

function normalizeReaderTocHref(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  const [baseHref] = trimmedValue.split("#");

  return baseHref?.trim() || trimmedValue;
}

function isRawReaderTocItem(value: unknown): value is RawReaderTocItem {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getReaderTocDirectory(pathname: string) {
  const slashIndex = pathname.lastIndexOf("/");

  if (slashIndex < 0) {
    return "";
  }

  return pathname.slice(0, slashIndex);
}

function joinReaderTocPath(basePath: string, pathname: string) {
  const segments = `${basePath}/${pathname}`.split("/");
  const resolvedSegments: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      resolvedSegments.pop();
      continue;
    }

    resolvedSegments.push(segment);
  }

  return resolvedSegments.join("/");
}

function resolveReaderTocHref(
  href: string,
  navigationPath: string | null | undefined,
) {
  if (!navigationPath || href.startsWith("#") || /^[a-z]+:/i.test(href)) {
    return href;
  }

  const [pathname, fragment] = href.split("#");

  if (!pathname) {
    return href;
  }

  const normalizedPathname = joinReaderTocPath(
    getReaderTocDirectory(navigationPath),
    pathname,
  );

  return fragment ? `${normalizedPathname}#${fragment}` : normalizedPathname;
}

export function normalizeReaderTocItems(
  items: unknown,
  options?: ReaderTocNormalizationOptions,
): ReaderTocItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item) => {
    if (!isRawReaderTocItem(item)) {
      return [];
    }

    const href =
      typeof item.href === "string"
        ? resolveReaderTocHref(item.href.trim(), options?.navigationPath)
        : "";
    const label =
      typeof item.label === "string"
        ? item.label.replace(/\s+/g, " ").trim()
        : "";

    if (!href || !label) {
      return [];
    }

    return [
      {
        href,
        label,
        subitems: normalizeReaderTocItems(item.subitems, options),
      },
    ];
  });
}

export function getReaderActiveTocHref(
  items: ReaderTocItem[],
  currentHref: string | null | undefined,
) {
  const trimmedCurrentHref = currentHref?.trim();

  if (!trimmedCurrentHref) {
    return null;
  }

  const normalizedCurrentHref = normalizeReaderTocHref(trimmedCurrentHref);
  let normalizedMatch: string | null = null;

  const visit = (tocItems: ReaderTocItem[]): string | null => {
    for (const item of tocItems) {
      if (item.href === trimmedCurrentHref) {
        return item.href;
      }

      if (
        !normalizedMatch &&
        normalizedCurrentHref &&
        normalizeReaderTocHref(item.href) === normalizedCurrentHref
      ) {
        normalizedMatch = item.href;
      }

      const nestedMatch = visit(item.subitems);

      if (nestedMatch) {
        return nestedMatch;
      }
    }

    return null;
  };

  return visit(items) ?? normalizedMatch;
}

export function getReaderEscapeAction({
  hasPopoverOpen,
  isAiSidebarOpen,
  isZenMode,
  isTocOpen,
}: ReaderEscapeActionState): ReaderEscapeAction {
  if (hasPopoverOpen) {
    return "dismiss-popover";
  }

  if (isAiSidebarOpen) {
    return "dismiss-ai-sidebar";
  }

  if (isZenMode) {
    return "exit-zen-mode";
  }

  if (isTocOpen) {
    return "dismiss-toc";
  }

  return null;
}
