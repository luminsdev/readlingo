import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createCollectionSchema } from "@/lib/collection-validation";
import { createCollection, getUserCollections } from "@/lib/collections";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const collections = await getUserCollections(session.user.id);

  return NextResponse.json({ collections });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsedPayload = createCollectionSchema.safeParse(body);

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

  const collection = await createCollection(
    session.user.id,
    parsedPayload.data.name,
  );

  if (!collection) {
    return NextResponse.json(
      { error: "A collection with this name already exists" },
      { status: 409 },
    );
  }

  return NextResponse.json({ collection }, { status: 201 });
}
