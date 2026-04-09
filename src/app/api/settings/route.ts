import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { updateSettingsSchema } from "@/lib/settings-validation";
import {
  getOrCreateUserPreferences,
  updateUserPreferences,
} from "@/lib/user-preferences";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getOrCreateUserPreferences(session.user.id);

    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(
      { error: "Failed to load settings." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = updateSettingsSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error.issues[0]?.message ?? "Invalid settings payload.",
      },
      { status: 400 },
    );
  }

  try {
    const settings = await updateUserPreferences(session.user.id, result.data);

    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(
      { error: "Failed to update settings." },
      { status: 500 },
    );
  }
}
