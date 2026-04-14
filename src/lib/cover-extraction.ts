import path from "node:path";

import JSZip from "jszip";
import sharp from "sharp";

import { R2_FILE_PATH_PREFIX } from "./book-storage.ts";
import { deleteFromR2, uploadToR2 } from "./r2.ts";

type ManifestItem = {
  href: string;
  id: string | null;
  mediaType: string | null;
  properties: string[];
};

type EpubExtractedMetadata = {
  title: string | null;
  author: string | null;
  language: string | null;
};

type EpubExtractedInfo = {
  cover: Buffer | null;
  metadata: EpubExtractedMetadata;
};

function getXmlAttribute(element: string, attributeName: string) {
  const match = element.match(
    new RegExp(`${attributeName}\\s*=\\s*(["'])(.*?)\\1`, "i"),
  );

  return match?.[2] ?? null;
}

function decodeXmlPath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeXmlText(value: string) {
  return value.replace(
    /&(?:amp|lt|gt|quot|apos);|&#(?:x([\da-f]+)|(\d+));/giu,
    (
      match,
      hexCodePoint: string | undefined,
      decimalCodePoint: string | undefined,
    ) => {
      if (hexCodePoint || decimalCodePoint) {
        const codePoint = Number.parseInt(
          hexCodePoint ?? decimalCodePoint ?? "",
          hexCodePoint ? 16 : 10,
        );

        if (
          !Number.isInteger(codePoint) ||
          codePoint < 0 ||
          codePoint > 0x10ffff
        ) {
          return match;
        }

        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return match;
        }
      }

      switch (match.toLowerCase()) {
        case "&amp;":
          return "&";
        case "&lt;":
          return "<";
        case "&gt;":
          return ">";
        case "&quot;":
          return '"';
        case "&apos;":
          return "'";
        default:
          return match;
      }
    },
  );
}

function sanitizeManifestPath(href: string) {
  return decodeXmlPath(href).split(/[?#]/u, 1)[0]?.trim() ?? "";
}

function parseManifestItems(opfContent: string): ManifestItem[] {
  const itemElements = opfContent.match(/<item\b[^>]*>/giu) ?? [];

  return itemElements.map((itemElement) => ({
    href: getXmlAttribute(itemElement, "href") ?? "",
    id: getXmlAttribute(itemElement, "id"),
    mediaType: getXmlAttribute(itemElement, "media-type"),
    properties: (getXmlAttribute(itemElement, "properties") ?? "")
      .split(/\s+/u)
      .filter(Boolean),
  }));
}

function extractDublinCoreText(opfContent: string, element: string) {
  const match = opfContent.match(
    new RegExp(`<dc:${element}[^>]*>([^<]+)</dc:${element}>`, "si"),
  );
  const value = match?.[1]?.trim();

  return value ? decodeXmlText(value) : null;
}

function getCoverHrefFromOpf(opfContent: string) {
  const manifestItems = parseManifestItems(opfContent);
  const metaElements = opfContent.match(/<meta\b[^>]*>/giu) ?? [];

  for (const metaElement of metaElements) {
    const name = getXmlAttribute(metaElement, "name")?.trim().toLowerCase();
    const content = getXmlAttribute(metaElement, "content")?.trim();

    if (name !== "cover" || !content) {
      continue;
    }

    const coverItem = manifestItems.find((item) => item.id === content);

    if (coverItem?.href && coverItem.mediaType?.startsWith("image/")) {
      return coverItem.href;
    }
  }

  const epub3CoverItem = manifestItems.find(
    (item) =>
      item.href &&
      item.mediaType?.startsWith("image/") &&
      item.properties.includes("cover-image"),
  );

  if (epub3CoverItem) {
    return epub3CoverItem.href;
  }

  const fallbackImageItem = manifestItems.find(
    (item) => item.href && item.mediaType?.startsWith("image/"),
  );

  return fallbackImageItem?.href ?? null;
}

function getZipCoverCandidates(opfPath: string, href: string) {
  const sanitizedHref = sanitizeManifestPath(href);

  if (!sanitizedHref) {
    return [];
  }

  const opfDirectory = path.posix.dirname(opfPath);
  const rootRelativePath = path.posix.normalize(
    sanitizedHref.replace(/^\/+/, ""),
  );
  const opfRelativePath = path.posix.normalize(
    path.posix.join(opfDirectory === "." ? "" : opfDirectory, sanitizedHref),
  );

  const candidates = sanitizedHref.startsWith("/")
    ? [rootRelativePath, opfRelativePath]
    : [opfRelativePath, rootRelativePath];

  return [...new Set(candidates)].filter(
    (candidate) => candidate && !candidate.startsWith("../"),
  );
}

export async function extractEpubInfo(
  epubBytes: Uint8Array,
): Promise<EpubExtractedInfo> {
  const emptyResult: EpubExtractedInfo = {
    cover: null,
    metadata: {
      title: null,
      author: null,
      language: null,
    },
  };

  try {
    const zip = await new JSZip().loadAsync(epubBytes);
    const containerEntry = zip.file("META-INF/container.xml");

    if (!containerEntry) {
      return emptyResult;
    }

    const containerXml = await containerEntry.async("string");
    const rootfileElement = (containerXml.match(/<rootfile\b[^>]*>/iu) ??
      [])[0];
    const opfPath = rootfileElement
      ? getXmlAttribute(rootfileElement, "full-path")?.trim()
      : null;

    if (!opfPath) {
      return emptyResult;
    }

    const opfEntry = zip.file(opfPath);

    if (!opfEntry) {
      return emptyResult;
    }

    const opfContent = await opfEntry.async("string");
    const metadata: EpubExtractedMetadata = {
      title: extractDublinCoreText(opfContent, "title"),
      author: extractDublinCoreText(opfContent, "creator"),
      language:
        extractDublinCoreText(opfContent, "language")?.toLowerCase() ?? null,
    };

    let cover: Buffer | null = null;

    try {
      const coverHref = getCoverHrefFromOpf(opfContent);

      if (!coverHref) {
        return { cover, metadata };
      }

      const coverEntry = getZipCoverCandidates(opfPath, coverHref)
        .map((candidate) => zip.file(candidate))
        .find((entry) => entry != null);

      if (!coverEntry) {
        return { cover, metadata };
      }

      const imageBuffer = await coverEntry.async("nodebuffer");

      cover = await sharp(imageBuffer)
        .resize({ width: 400, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (error) {
      console.error("Cover extraction failed:", error);
    }

    return { cover, metadata };
  } catch (error) {
    console.error("EPUB info extraction failed:", error);
    return emptyResult;
  }
}

export async function persistBookCover(bookId: string, imageBuffer: Buffer) {
  const key = `covers/${bookId}.jpg`;

  await uploadToR2(key, imageBuffer, "image/jpeg");

  return `${R2_FILE_PATH_PREFIX}${key}`;
}

export function getCoverR2Key(coverUrl: string) {
  if (!coverUrl.startsWith(R2_FILE_PATH_PREFIX)) {
    throw new Error("Stored cover path is not an R2 object path.");
  }

  const key = coverUrl.slice(R2_FILE_PATH_PREFIX.length);

  if (!key || key.startsWith("/")) {
    throw new Error("Stored cover R2 object key is invalid.");
  }

  return key;
}

export async function removeBookCover(coverUrl: string) {
  try {
    await deleteFromR2(getCoverR2Key(coverUrl));
  } catch (error) {
    console.error("Cover cleanup failed:", error);
  }
}
