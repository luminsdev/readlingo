import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DeleteVocabularyButton } from "@/components/vocabulary/delete-vocabulary-button";
import { prisma } from "@/lib/prisma";
import { vocabularyIdSchema } from "@/lib/vocabulary-validation";

type VocabularyArchiveRecord = Awaited<
  ReturnType<typeof prisma.vocabulary.findMany>
>[number];

async function attachOwnedBookTitles(
  userId: string,
  items: VocabularyArchiveRecord[],
) {
  const bookIds = Array.from(
    new Set(
      items
        .map((item) => item.bookId)
        .filter((bookId): bookId is string => typeof bookId === "string"),
    ),
  );

  if (!bookIds.length) {
    return items.map((item) => ({
      ...item,
      bookTitle: null,
    }));
  }

  const books = await prisma.book.findMany({
    where: {
      id: {
        in: bookIds,
      },
      userId,
    },
    select: {
      id: true,
      title: true,
    },
  });

  const booksById = new Map(books.map((book) => [book.id, book.title]));

  return items.map((item) => ({
    ...item,
    bookTitle: item.bookId ? (booksById.get(item.bookId) ?? null) : null,
  }));
}

async function deleteVocabularyAction(formData: FormData) {
  "use server";

  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const parsedId = vocabularyIdSchema.safeParse(formData.get("vocabularyId"));

  if (!parsedId.success) {
    return;
  }

  const deletedVocabulary = await prisma.vocabulary.deleteMany({
    where: {
      id: parsedId.data,
      userId: session.user.id,
    },
  });

  if (!deletedVocabulary.count) {
    return;
  }

  revalidatePath("/vocabulary");
}

function formatVocabularyDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(value);
}

export default async function VocabularyPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const vocabularyItems = await prisma.vocabulary.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  const vocabularyArchiveItems = await attachOwnedBookTitles(
    session.user.id,
    vocabularyItems,
  );

  return (
    <div className="space-y-10">
      <header className="space-y-3 border-b border-zinc-200/60 pb-6 dark:border-zinc-800/60">
        <p className="text-[10px] font-medium tracking-[0.24em] text-zinc-400 uppercase">
          Phase 3 Archive
        </p>
        <div className="space-y-2">
          <h1 className="font-serif text-4xl font-light tracking-tight text-zinc-900 dark:text-zinc-100">
            Vocabulary archive
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Revisit saved words, keep their reading context close at hand, and
            prepare the collection for the flashcard loop.
          </p>
        </div>
      </header>

      {vocabularyArchiveItems.length ? (
        <div className="grid gap-4">
          {vocabularyArchiveItems.map((item) => (
            <article
              key={item.id}
              className="space-y-6 border border-zinc-200/70 bg-white/80 p-6 dark:border-zinc-800/70 dark:bg-zinc-950/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-900">
                <div className="space-y-2">
                  <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                    Saved term
                  </p>
                  <h2 className="font-serif text-3xl font-light text-zinc-900 dark:text-zinc-100">
                    {item.word}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {item.bookTitle ?? "Personal archive"}
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-right text-[11px] tracking-[0.2em] text-zinc-400 uppercase">
                    {formatVocabularyDate(item.createdAt)}
                  </div>

                  <DeleteVocabularyButton
                    action={deleteVocabularyAction}
                    vocabularyId={item.id}
                    word={item.word}
                  />
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                <div className="space-y-2">
                  <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                    Translation
                  </p>
                  <p className="font-serif text-2xl leading-tight text-zinc-900 dark:text-zinc-100">
                    {item.definition}
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                      Example
                    </p>
                    <p className="text-sm leading-loose text-zinc-700 italic dark:text-zinc-300">
                      {item.exampleSentence}
                    </p>
                  </div>

                  <div className="space-y-2 border-l border-zinc-300 pl-4 dark:border-zinc-700">
                    <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                      Reading context
                    </p>
                    <p className="text-sm leading-loose text-zinc-600 dark:text-zinc-400">
                      {item.contextSentence}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="border border-zinc-200/70 bg-zinc-50/70 p-8 dark:border-zinc-800/70 dark:bg-zinc-950/30">
          <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
            Empty archive
          </p>
          <h2 className="mt-3 font-serif text-3xl font-light text-zinc-900 dark:text-zinc-100">
            Your saved vocabulary will appear here.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Highlight text in the reader, ask for an explanation, then save the
            result to build a personal archive from the books you read.
          </p>
        </div>
      )}
    </div>
  );
}
