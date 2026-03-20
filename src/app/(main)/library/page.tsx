import Link from "next/link";
import { redirect } from "next/navigation";
import { BookCopy, Clock3, FolderOpenDot } from "lucide-react";

import { auth } from "@/auth";
import { DeleteBookButton } from "@/components/library/delete-book-button";
import { UploadBookForm } from "@/components/library/upload-book-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export default async function LibraryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const books = await prisma.book.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <Badge>Phase 2</Badge>
          <CardTitle className="font-serif text-3xl">
            Your reading library
          </CardTitle>
          <CardDescription>
            Upload EPUB files here, then open them in the live reader to enrich
            metadata and resume from saved progress.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadBookForm />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {books.length ? (
          books.map((book) => (
            <Card className="flex h-full flex-col" key={book.id}>
              <CardHeader className="gap-4">
                <div className="bg-accent/12 text-accent flex size-14 items-center justify-center rounded-3xl">
                  <BookCopy className="size-6" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="line-clamp-2 text-xl">
                    {book.title}
                  </CardTitle>
                  <CardDescription>
                    {book.author ??
                      "Author enrichment comes in the reader slice."}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge>
                    {book.language === "und"
                      ? "Language pending"
                      : book.language}
                  </Badge>
                  <Badge>{new Date(book.createdAt).toLocaleDateString()}</Badge>
                </div>

                <div className="border-border text-muted-foreground bg-surface rounded-3xl border border-dashed p-4 text-sm">
                  Open the reader to parse metadata, page through the EPUB, and
                  keep your place synced in the background.
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/reader/${book.id}`}>Open reader</Link>
                </Button>
                <DeleteBookButton bookId={book.id} title={book.title} />
              </CardFooter>
            </Card>
          ))
        ) : (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardHeader>
              <div className="bg-accent/12 text-accent flex size-14 items-center justify-center rounded-3xl">
                <FolderOpenDot className="size-6" />
              </div>
              <CardTitle className="font-serif text-3xl">
                Your shelf is ready.
              </CardTitle>
              <CardDescription>
                Upload a first EPUB to seed the library slice. Book metadata and
                inline reading come next.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground flex items-center gap-3 text-sm">
              <Clock3 className="size-4" />
              Files are stored per user with ownership checks already enforced
              in the API layer.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
