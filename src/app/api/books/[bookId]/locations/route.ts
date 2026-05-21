import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOwnedReaderBook } from "@/lib/books";
import {
  downloadLocationsFromR2,
  locationsPayloadSchema,
  uploadLocationsToR2,
} from "@/lib/locations-cache";

const MAX_LOCATIONS_PAYLOAD_BYTES = 2_000_000;

function isMissingR2Object(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function validateLocationsJson(locationsJson: string) {
  let locations: unknown;

  try {
    locations = JSON.parse(locationsJson);
  } catch {
    return false;
  }

  return (
    Array.isArray(locations) &&
    locations.length <= 10_000 &&
    locations.every(
      (location) => typeof location === "string" && location.length <= 256,
    )
  );
}

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
    const locationsJson = await downloadLocationsFromR2(
      session.user.id,
      book.id,
    );

    return NextResponse.json({ locationsJson });
  } catch (error) {
    if (isMissingR2Object(error)) {
      return NextResponse.json({ locationsJson: null });
    }

    console.error("Locations cache download failed:", error);
    return NextResponse.json(
      { error: "Locations cache unavailable." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
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

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > MAX_LOCATIONS_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const rawBody = await request.text();

  if (
    rawBody.length > MAX_LOCATIONS_PAYLOAD_BYTES ||
    Buffer.byteLength(rawBody, "utf8") > MAX_LOCATIONS_PAYLOAD_BYTES
  ) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "A valid locations payload is required." },
      { status: 400 },
    );
  }

  const parsedPayload = locationsPayloadSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return NextResponse.json(
      { error: "A valid locations payload is required." },
      { status: 400 },
    );
  }

  if (!validateLocationsJson(parsedPayload.data.locationsJson)) {
    return NextResponse.json(
      { error: "Locations payload is invalid." },
      { status: 400 },
    );
  }

  await uploadLocationsToR2(
    session.user.id,
    book.id,
    parsedPayload.data.locationsJson,
  );

  return NextResponse.json({ ok: true });
}
