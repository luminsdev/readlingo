import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { renameCollectionSchema } from "@/lib/collection-validation";
import {
  deleteCollection,
  getUserCollections,
  renameCollection,
} from "@/lib/collections";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsedPayload = renameCollectionSchema.safeParse(body);

  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        error:
          parsedPayload.error.issues[0]?.message ??
          "A valid collection name is required.",
      },
      { status: 400 },
    );
  }

  const { id } = await params;
  const collections = await getUserCollections(session.user.id);
  const currentCollection = collections.find(
    (collection) => collection.id === id,
  );

  if (!currentCollection) {
    return NextResponse.json(
      { error: "Collection not found." },
      { status: 404 },
    );
  }

  const normalizedName = parsedPayload.data.name.toLowerCase();
  const conflictingCollection = collections.find(
    (collection) =>
      collection.normalizedName === normalizedName && collection.id !== id,
  );

  if (conflictingCollection) {
    return NextResponse.json(
      { error: "A collection with this name already exists" },
      { status: 409 },
    );
  }

  const collection = await renameCollection(
    session.user.id,
    id,
    parsedPayload.data.name,
  );

  if (!collection) {
    const collectionStillExists = (
      await getUserCollections(session.user.id)
    ).some((existingCollection) => existingCollection.id === id);

    if (collectionStillExists) {
      return NextResponse.json(
        { error: "A collection with this name already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Collection not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ collection });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const collection = await deleteCollection(session.user.id, id);

  if (!collection) {
    return NextResponse.json(
      { error: "Collection not found." },
      { status: 404 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
