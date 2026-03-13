import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { registerSchema } from "@/lib/auth-validation";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsedPayload = registerSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        error:
          parsedPayload.error.issues[0]?.message ??
          "Invalid registration payload.",
      },
      { status: 400 },
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsedPayload.data.email },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "An account already exists for that email." },
      { status: 409 },
    );
  }

  const passwordHash = await hash(parsedPayload.data.password, 12);

  await prisma.user.create({
    data: {
      email: parsedPayload.data.email,
      name: parsedPayload.data.name || null,
      passwordHash,
    },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
