type ReaderBookLoadSnapshot = {
  author: string | null;
  id: string;
  language: string | null;
  title: string;
};

export type ReaderLocationsCacheOutcome =
  | "cache_hit"
  | "cache_miss"
  | "cache_error";

export function getReaderBookLoadKey(book: ReaderBookLoadSnapshot) {
  return JSON.stringify([book.id, book.title, book.author, book.language]);
}

export function classifyLocationsCacheResult({
  didThrow = false,
  locationsJson,
  responseOk = true,
}: {
  didThrow?: boolean;
  locationsJson?: string | null;
  responseOk?: boolean;
}): ReaderLocationsCacheOutcome {
  if (didThrow || !responseOk) {
    return "cache_error";
  }

  return locationsJson ? "cache_hit" : "cache_miss";
}

export function shouldGenerateLocations(outcome: ReaderLocationsCacheOutcome) {
  return outcome !== "cache_hit";
}
