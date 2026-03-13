import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_EPUB_SIZE_BYTES = 25 * 1024 * 1024;

function getUploadRoot() {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
}

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

export function createBookTitle(fileName: string) {
  return fileName.replace(/\.epub$/i, "").trim() || "Untitled book";
}

export async function persistBookFile(options: {
  userId: string;
  bookId: string;
  file: File;
}) {
  const uploadRoot = getUploadRoot();
  const relativeUploadRoot = path
    .relative(process.cwd(), uploadRoot)
    .split(path.sep)
    .join(path.posix.sep);
  const relativePath = path.posix.join(
    relativeUploadRoot,
    options.userId,
    `${options.bookId}.epub`,
  );
  const absolutePath = path.join(
    uploadRoot,
    options.userId,
    `${options.bookId}.epub`,
  );

  await mkdir(path.dirname(absolutePath), { recursive: true });

  const bytes = await options.file.arrayBuffer();
  await writeFile(absolutePath, Buffer.from(bytes));

  return relativePath;
}

export async function removeBookFile(filePath: string) {
  const absolutePath = path.resolve(process.cwd(), filePath);

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

export { MAX_EPUB_SIZE_BYTES, getUploadRoot };
