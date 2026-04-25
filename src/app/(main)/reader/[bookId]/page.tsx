import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { ReaderWorkspace } from "@/components/reader/reader-workspace";
import { getOwnedReaderBook } from "@/lib/books";
import { getOrCreateUserPreferences } from "@/lib/user-preferences";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const session = await auth();
  const { bookId } = await params;

  if (!session?.user) {
    redirect("/login");
  }

  const book = await getOwnedReaderBook(session.user.id, bookId);

  if (!book) {
    notFound();
  }

  const preferences = await getOrCreateUserPreferences(session.user.id);

  return (
    <div className="animate-content-in">
      <ReaderWorkspace
        initialBook={{
          id: book.id,
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl,
          language: book.language,
          createdAt: book.createdAt.toISOString(),
          progressCfi: book.readingProgress?.cfi ?? null,
          progressUpdatedAt:
            book.readingProgress?.updatedAt.toISOString() ?? null,
        }}
        initialFontSize={preferences.readerFontSize}
        initialReaderTheme={preferences.readerTheme}
      />
    </div>
  );
}
