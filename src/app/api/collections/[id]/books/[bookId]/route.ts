import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { removeBookFromCollection } from "@/lib/collections";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; bookId: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, bookId } = await params;
  const bookCollection = await removeBookFromCollection(
    session.user.id,
    id,
    bookId,
  );

  if (!bookCollection) {
    return NextResponse.json(
      { error: "Collection book not found." },
      { status: 404 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
