import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOwnedReaderBook } from "@/lib/books";
import { getCoverR2Key, getCoverThumbnailR2Key } from "@/lib/cover-extraction";
import { downloadFromR2 } from "@/lib/r2";

function isMissingR2Object(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookId } = await params;
  const book = await getOwnedReaderBook(session.user.id, bookId);

  if (!book?.coverUrl) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const coverKey =
    searchParams.get("size") === "thumb"
      ? getCoverThumbnailR2Key(book.coverUrl)
      : getCoverR2Key(book.coverUrl);

  try {
    const coverBuffer = await downloadFromR2(coverKey);

    return new NextResponse(new Uint8Array(coverBuffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    if (isMissingR2Object(error)) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    console.error("Cover proxy failed:", error);
    return NextResponse.json({ error: "Cover unavailable." }, { status: 500 });
  }
}
