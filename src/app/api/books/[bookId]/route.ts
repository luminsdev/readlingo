import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { removeBookFile } from "@/lib/book-storage";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookId } = await params;

  const book = await prisma.book.findFirst({
    where: {
      id: bookId,
      userId: session.user.id,
    },
  });

  if (!book) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  await prisma.book.delete({ where: { id: book.id } });
  await removeBookFile(book.filePath);

  return new NextResponse(null, { status: 204 });
}
