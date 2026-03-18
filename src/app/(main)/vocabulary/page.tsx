import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DeleteVocabularyButton } from "@/components/vocabulary/delete-vocabulary-button";
import { getHighlightedExampleSegments } from "@/components/reader/reader-workspace-utils";
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

function getDifficultyBadgeClass(difficultyHint: string | null) {
  if (difficultyHint === "beginner") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (difficultyHint === "intermediate") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300";
  }

  return "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";
}

function renderHighlightedText(text: string, selectedText: string) {
  return getHighlightedExampleSegments(text, selectedText).map(
    (segment, index) => {
      if (segment.isHighlighted) {
        return (
          <strong
            key={`${segment.text}-${index}`}
            className="font-semibold text-zinc-950 dark:text-zinc-50"
          >
            {segment.text}
          </strong>
        );
      }

      return <span key={`${segment.text}-${index}`}>{segment.text}</span>;
    },
  );
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
              className="space-y-8 border border-zinc-200/70 bg-white/80 p-6 dark:border-zinc-800/70 dark:bg-zinc-950/30"
            >
              <div className="space-y-4 border-b border-zinc-100 pb-6 dark:border-zinc-900">
                <div className="space-y-3">
                  <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                    Saved term
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <h2 className="font-serif text-3xl font-light text-zinc-900 dark:text-zinc-100">
                      {item.word}
                    </h2>
                    {item.pronunciation ? (
                      <p className="pb-1 text-sm text-zinc-500 italic dark:text-zinc-400">
                        {item.pronunciation}
                      </p>
                    ) : null}
                  </div>
                  {item.partOfSpeech || item.difficultyHint ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {item.partOfSpeech ? (
                        <span className="inline-block border border-zinc-200 px-2 py-0.5 text-[10px] tracking-widest text-zinc-500 uppercase dark:border-zinc-800">
                          {item.partOfSpeech}
                        </span>
                      ) : null}
                      {item.difficultyHint ? (
                        <span
                          className={`inline-block border px-2 py-0.5 text-[10px] tracking-widest uppercase ${getDifficultyBadgeClass(item.difficultyHint)}`}
                        >
                          {item.difficultyHint}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-8 xl:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                <div className="space-y-2">
                  <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                    Translation
                  </p>
                  <p className="font-serif text-2xl leading-tight text-zinc-900 dark:text-zinc-100">
                    {item.definition}
                  </p>
                </div>

                <div className="space-y-5">
                  {item.explanation ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                        Editorial note
                      </p>
                      <p className="text-sm leading-loose text-zinc-700 dark:text-zinc-300">
                        {item.explanation}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                      Example
                    </p>
                    <div className="space-y-1.5 border-l border-zinc-300 pl-4 dark:border-zinc-700">
                      <p className="font-serif text-sm leading-relaxed text-zinc-800 italic dark:text-zinc-200">
                        {renderHighlightedText(item.exampleSentence, item.word)}
                      </p>
                      {item.exampleTranslation ? (
                        <p className="text-xs leading-relaxed text-zinc-500 italic dark:text-zinc-400">
                          {item.exampleTranslation}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {item.alternativeMeaning ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                        Alternative meaning
                      </p>
                      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {item.alternativeMeaning}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                      In context
                    </p>
                    <div className="border border-zinc-200/70 bg-zinc-50/80 p-5 dark:border-zinc-800/70 dark:bg-zinc-900/50">
                      <p className="font-serif text-[15px] leading-loose text-zinc-700 dark:text-zinc-300">
                        {renderHighlightedText(item.contextSentence, item.word)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-900">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                    From
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {item.bookTitle ?? "Personal archive"}
                  </p>
                  <p className="text-[11px] tracking-[0.2em] text-zinc-400 uppercase">
                    {formatVocabularyDate(item.createdAt)}
                  </p>
                </div>

                <DeleteVocabularyButton
                  action={deleteVocabularyAction}
                  vocabularyId={item.id}
                  word={item.word}
                />
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
