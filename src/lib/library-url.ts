type LibraryUrlState = {
  page?: number | string | null;
  q?: string | null;
};

function normalizeSearchValue(value: string | null | undefined) {
  const trimmedValue = value?.trim() ?? "";

  return trimmedValue || null;
}

function normalizePage(value: number | string | null | undefined) {
  const page = typeof value === "number" ? value : parseInt(value ?? "", 10);

  if (!Number.isFinite(page) || page <= 1) {
    return null;
  }

  return Math.floor(page);
}

export function getFilteredPageHref(
  basePath: string,
  filters: LibraryUrlState,
  updates: LibraryUrlState = {},
) {
  const nextState = { ...filters, ...updates };
  const params = new URLSearchParams();
  const query = normalizeSearchValue(nextState.q);
  const page = normalizePage(nextState.page);

  if (query) {
    params.set("q", query);
  }

  if (page) {
    params.set("page", String(page));
  }

  const search = params.toString();

  return search ? `${basePath}?${search}` : basePath;
}
