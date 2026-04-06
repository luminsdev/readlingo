import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Lightbulb } from "lucide-react";

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

  return "border-line-strong bg-surface-strong text-ink-soft";
}

function renderHighlightedText(text: string, selectedText: string) {
  return getHighlightedExampleSegments(text, selectedText).map(
    (segment, index) => {
      if (segment.isHighlighted) {
        return (
          <strong
            key={`${segment.text}-${index}`}
            className="text-foreground font-semibold"
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
      <header className="border-line space-y-3 border-b pb-6">
        <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
          Phase 3 Archive
        </p>
        <div className="space-y-2">
          <h1 className="text-foreground font-serif text-4xl font-light tracking-tight">
            Vocabulary archive
          </h1>
          <p className="text-ink-muted max-w-2xl text-sm leading-relaxed">
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
              className="paper-panel border-border space-y-8 rounded-[32px] border p-6"
            >
              <div className="border-line space-y-4 border-b pb-6">
                <div className="space-y-3">
                  <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
                    Saved term
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <h2 className="text-foreground font-serif text-3xl font-light">
                      {item.word}
                    </h2>
                    {item.pronunciation ? (
                      <p className="text-ink-muted pb-1 text-sm italic">
                        {item.pronunciation}
                      </p>
                    ) : null}
                  </div>
                  {item.partOfSpeech || item.difficultyHint ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {item.partOfSpeech ? (
                        <span className="border-line text-ink-muted inline-block border px-2 py-0.5 text-[10px] tracking-widest uppercase">
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
                  <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
                    Translation
                  </p>
                  <div className="space-y-3">
                    <p className="text-foreground font-serif text-2xl leading-tight">
                      {item.definition}
                    </p>
                    {item.mnemonic ? (
                      <div className="text-ink-muted flex items-start gap-2 text-xs italic">
                        <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
                        <p>{item.mnemonic}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-5">
                  {item.explanation ? (
                    <div className="space-y-2">
                      <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
                        Editorial note
                      </p>
                      <p className="text-ink-soft text-sm leading-loose">
                        {item.explanation}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
                      Example
                    </p>
                    <div className="border-quote space-y-1.5 border-l pl-4">
                      <p className="text-ink-soft font-serif text-sm leading-relaxed italic">
                        {renderHighlightedText(item.exampleSentence, item.word)}
                      </p>
                      {item.exampleTranslation ? (
                        <p className="text-ink-muted text-xs leading-relaxed italic">
                          {item.exampleTranslation}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {item.alternativeMeaning ? (
                    <div className="space-y-2">
                      <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
                        Alternative meaning
                      </p>
                      <p className="text-ink-muted text-xs leading-relaxed">
                        {item.alternativeMeaning}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
                      In context
                    </p>
                    <div className="border-line bg-surface rounded-[24px] border p-5">
                      <p className="text-ink-soft font-serif text-[15px] leading-loose">
                        {renderHighlightedText(item.contextSentence, item.word)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-line flex flex-wrap items-end justify-between gap-4 border-t pt-4">
                <div className="space-y-1.5">
                  <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
                    From
                  </p>
                  <p className="text-ink-soft text-sm">
                    {item.bookTitle ?? "Personal archive"}
                  </p>
                  <p className="text-ink-kicker text-[11px] tracking-[0.2em] uppercase">
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
        <div className="paper-panel border-border rounded-[32px] border p-8">
          <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
            Empty archive
          </p>
          <h2 className="text-foreground mt-3 font-serif text-3xl font-light">
            Your saved vocabulary will appear here.
          </h2>
          <p className="text-ink-muted mt-4 max-w-2xl text-sm leading-relaxed">
            Highlight text in the reader, ask for an explanation, then save the
            result to build a personal archive from the books you read.
          </p>
        </div>
      )}
    </div>
  );
}
