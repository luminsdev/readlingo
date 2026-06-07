import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { addBookToCollectionSchema } from "@/lib/collection-validation";
import { addBookToCollection } from "@/lib/collections";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsedPayload = addBookToCollectionSchema.safeParse(body);

  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        error:
          parsedPayload.error.issues[0]?.message ??
          "A valid book id is required.",
      },
      { status: 400 },
    );
  }

  const { id } = await params;
  const bookCollection = await addBookToCollection(
    session.user.id,
    id,
    parsedPayload.data.bookId,
  );

  if (!bookCollection) {
    return NextResponse.json(
      { error: "Collection or book not found." },
      { status: 404 },
    );
  }

  if (bookCollection === "exists") {
    return NextResponse.json(
      { error: "Book is already in this collection." },
      { status: 409 },
    );
  }

  return NextResponse.json({ bookCollection }, { status: 201 });
}
