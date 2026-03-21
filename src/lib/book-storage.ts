import { unlink } from "node:fs/promises";
import path from "node:path";

import { deleteFromR2, uploadToR2 } from "./r2.ts";

const MAX_EPUB_SIZE_BYTES = 25 * 1024 * 1024;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const;
const REQUIRED_EPUB_MARKERS = [
  "mimetype",
  "META-INF/container.xml",
  "application/epub+zip",
] as const;

const R2_FILE_PATH_PREFIX = "r2://";

export function assertEpubFile(file: File) {
  const hasEpubExtension = /\.epub$/i.test(file.name);
  const knownMimeTypes = new Set([
    "application/epub+zip",
    "application/octet-stream",
    "",
  ]);

  if (!hasEpubExtension || !knownMimeTypes.has(file.type)) {
    throw new Error("Only EPUB files are supported for uploads.");
  }

  if (file.size <= 0 || file.size > MAX_EPUB_SIZE_BYTES) {
    throw new Error("EPUB files must be between 1 byte and 25 MB.");
  }
}

function hasZipLocalFileHeader(bytes: Uint8Array) {
  return ZIP_LOCAL_FILE_HEADER_SIGNATURE.every(
    (value, index) => bytes[index] === value,
  );
}

function hasRequiredEpubMarkers(bytes: Uint8Array) {
  const content = Buffer.from(bytes).toString("latin1");

  return REQUIRED_EPUB_MARKERS.every((marker) => content.includes(marker));
}

export async function validateEpubArchive(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (!hasZipLocalFileHeader(bytes)) {
    throw new Error("Only valid EPUB archives are supported for uploads.");
  }

  if (!hasRequiredEpubMarkers(bytes)) {
    throw new Error(
      "This EPUB is missing required package files and cannot be opened.",
    );
  }

  return bytes;
}

export function createBookTitle(fileName: string) {
  return fileName.replace(/\.epub$/i, "").trim() || "Untitled book";
}

function createR2ObjectKey(userId: string, bookId: string) {
  return `${userId}/${bookId}.epub`;
}

export function createStoredR2FilePath(key: string) {
  return `${R2_FILE_PATH_PREFIX}${key}`;
}

export function getStoredBookR2Key(filePath: string) {
  if (!filePath.startsWith(R2_FILE_PATH_PREFIX)) {
    throw new Error("Stored EPUB path is not an R2 object path.");
  }

  const key = filePath.slice(R2_FILE_PATH_PREFIX.length);

  if (!key || key.startsWith("/")) {
    throw new Error("Stored EPUB R2 object key is invalid.");
  }

  return key;
}

export async function persistBookFile(options: {
  userId: string;
  bookId: string;
  file: File;
  fileBytes?: Uint8Array;
}) {
  const key = createR2ObjectKey(options.userId, options.bookId);

  const bytes =
    options.fileBytes ?? new Uint8Array(await options.file.arrayBuffer());
  await uploadToR2(key, bytes, "application/epub+zip");

  return createStoredR2FilePath(key);
}

export function resolveStoredUploadFilePath(filePath: string) {
  if (filePath.startsWith(R2_FILE_PATH_PREFIX)) {
    return filePath;
  }

  if (!filePath || path.isAbsolute(filePath)) {
    throw new Error("Stored EPUB path is invalid.");
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  const uploadRoot = path.resolve(
    process.cwd(),
    process.env.UPLOAD_DIR ?? "uploads",
  );
  const relativeToUploadRoot = path.relative(uploadRoot, absolutePath);

  if (
    relativeToUploadRoot.startsWith("..") ||
    path.isAbsolute(relativeToUploadRoot)
  ) {
    throw new Error("Stored EPUB path escapes the upload directory.");
  }

  return absolutePath;
}

export async function removeBookFile(filePath: string) {
  if (filePath.startsWith(R2_FILE_PATH_PREFIX)) {
    await deleteFromR2(getStoredBookR2Key(filePath));
    return;
  }

  const absolutePath = resolveStoredUploadFilePath(filePath);

  try {
    await unlink(absolutePath);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

export async function removeBookFileBestEffort(
  filePath: string,
  options: {
    onError?: (error: unknown) => void;
    removeFile?: (filePath: string) => Promise<void>;
  } = {},
) {
  const removeFile = options.removeFile ?? removeBookFile;

  try {
    await removeFile(filePath);
  } catch (error) {
    options.onError?.(error);
  }
}

export { MAX_EPUB_SIZE_BYTES, R2_FILE_PATH_PREFIX };
