import { describe, expect, it } from "vitest";

import {
  classifyLocationsCacheResult,
  getReaderBookLoadKey,
  shouldGenerateLocations,
} from "@/components/reader/reader-epub-view-utils";

describe("Reader EPUB view utilities", () => {
  it("keeps the load key stable when restored progress hydrates", () => {
    const book = {
      author: "A. Writer",
      id: "book-123",
      language: "en",
      progressCfi: "epubcfi(/6/2!/4/2/8,/1:0,/1:12)",
      title: "The Reader",
    };
    const hydratedBook = {
      ...book,
      progressCfi: "epubcfi(/6/2!/4/2/9,/1:0,/1:12)",
    };

    expect(getReaderBookLoadKey(book)).toBe(getReaderBookLoadKey(hydratedBook));
  });

  it("changes the load key when the book identity changes", () => {
    const book = {
      author: "A. Writer",
      id: "book-123",
      language: "en",
      title: "The Reader",
    };

    expect(getReaderBookLoadKey(book)).not.toBe(
      getReaderBookLoadKey({
        ...book,
        id: "book-456",
      }),
    );
  });

  it("classifies cached locations as hit, miss, or error", () => {
    expect(
      classifyLocationsCacheResult({
        locationsJson: '["epubcfi(/6/2)"]',
        responseOk: true,
      }),
    ).toBe("cache_hit");
    expect(
      classifyLocationsCacheResult({ locationsJson: null, responseOk: true }),
    ).toBe("cache_miss");
    expect(
      classifyLocationsCacheResult({
        locationsJson: null,
        responseOk: false,
      }),
    ).toBe("cache_error");
    expect(classifyLocationsCacheResult({ didThrow: true })).toBe(
      "cache_error",
    );
  });

  it("generates locations only after a cache miss or error", () => {
    expect(shouldGenerateLocations("cache_hit")).toBe(false);
    expect(shouldGenerateLocations("cache_miss")).toBe(true);
    expect(shouldGenerateLocations("cache_error")).toBe(true);
  });
});
