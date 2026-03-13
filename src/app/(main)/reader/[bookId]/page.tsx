import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export default async function ReaderScaffoldPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const session = await auth();
  const { bookId } = await params;

  const book = await prisma.book.findFirst({
    where: {
      id: bookId,
      userId: session!.user.id,
    },
  });

  if (!book) {
    notFound();
  }

  return (
    <Card>
      <CardHeader>
        <Badge>Phase 2 scaffold</Badge>
        <CardTitle className="font-serif text-3xl">{book.title}</CardTitle>
        <CardDescription>
          This route is wired and protected. `epub.js`, pagination, and CFI
          save/resume come in the next vertical slice.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        Your upload is already stored for this account and ready for the Phase 2
        reader implementation.
      </CardContent>
    </Card>
  );
}
