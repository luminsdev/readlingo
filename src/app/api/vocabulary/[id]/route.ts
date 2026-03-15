import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { vocabularyIdSchema } from "@/lib/vocabulary-validation";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedId = vocabularyIdSchema.safeParse((await params).id);

  if (!parsedId.success) {
    return NextResponse.json(
      {
        error:
          parsedId.error.issues[0]?.message ??
          "A valid vocabulary id is required.",
      },
      { status: 400 },
    );
  }

  try {
    const deletedVocabulary = await prisma.vocabulary.deleteMany({
      where: {
        id: parsedId.data,
        userId: session.user.id,
      },
    });

    if (!deletedVocabulary.count) {
      return NextResponse.json(
        { error: "Vocabulary not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to delete vocabulary item." },
      { status: 500 },
    );
  }
}
