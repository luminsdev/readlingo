import { z } from "zod";

import { deleteFromR2, downloadFromR2, uploadToR2 } from "@/lib/r2";

export const locationsPayloadSchema = z.object({
  locationsJson: z.string().max(2_000_000),
});

export function getLocationsR2Key(userId: string, bookId: string) {
  return `${userId}/${bookId}/locations.json`;
}

export async function uploadLocationsToR2(
  userId: string,
  bookId: string,
  locationsJson: string,
) {
  await uploadToR2(
    getLocationsR2Key(userId, bookId),
    Buffer.from(locationsJson),
    "application/json",
  );
}

export async function downloadLocationsFromR2(userId: string, bookId: string) {
  const buffer = await downloadFromR2(getLocationsR2Key(userId, bookId));

  return buffer.toString("utf8");
}

export async function deleteLocationsFromR2(userId: string, bookId: string) {
  await deleteFromR2(getLocationsR2Key(userId, bookId));
}
