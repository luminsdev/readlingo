import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  createDownloadFileName,
  getOwnedReaderBook,
  readStoredBookFile,
} from "@/lib/books";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookId } = await params;
  const book = await getOwnedReaderBook(session.user.id, bookId);

  if (!book) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  try {
    const file = await readStoredBookFile(book.filePath);

    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
        "Content-Disposition": `inline; filename="${createDownloadFileName(book.title)}"`,
        "Content-Length": String(file.byteLength),
        "Content-Type": "application/epub+zip",
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json(
        { error: "Stored EPUB file not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Unable to open this EPUB file." },
      { status: 500 },
    );
  }
}
