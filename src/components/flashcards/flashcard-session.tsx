"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle2,
  LibraryBig,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DueCard } from "@/lib/flashcards";
import { SRS_RATING_VALUES, type SRSRating } from "@/lib/srs";

const ratingCopy: Record<
  SRSRating,
  { label: string; hint: string; className: string }
> = {
  again: {
    label: "Again",
    hint: "Keep it close",
    className:
      "border-[#d9b0a4] bg-[#fcf1ed] text-[#8b3d2b] hover:border-[#c98a78] hover:bg-[#f8e2db]",
  },
  hard: {
    label: "Hard",
    hint: "Tomorrow, still careful",
    className:
      "border-[#dcc8a2] bg-[#fbf5e8] text-[#7f5b1c] hover:border-[#cdaa6b] hover:bg-[#f5ecd6]",
  },
  good: {
    label: "Good",
    hint: "Move the interval forward",
    className:
      "border-[#cfc8b7] bg-white/85 text-zinc-700 hover:border-zinc-400 hover:bg-white",
  },
  easy: {
    label: "Easy",
    hint: "Stretch it a little more",
    className:
      "border-[#bfd7cb] bg-[#eef7f1] text-[#2f6750] hover:border-[#8cb59f] hover:bg-[#e1f0e6]",
  },
};

type FlashcardSessionProps = {
  initialCards: DueCard[];
  initialDueCount: number;
  totalVocabularyCount: number;
};

function EmptyState({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  icon: ReactNode;
}) {
  return (
    <section className="space-y-8">
      <header className="space-y-3 border-b border-zinc-200/60 pb-6 dark:border-zinc-800/60">
        <p className="text-[10px] font-medium tracking-[0.24em] text-zinc-400 uppercase">
          Phase 4 Review
        </p>
        <div className="space-y-2">
          <h1 className="font-serif text-4xl font-light tracking-tight text-zinc-900 dark:text-zinc-100">
            Flashcard loop
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            A quiet place to revisit saved vocabulary, rate recall honestly, and
            let the next review date move itself into place.
          </p>
        </div>
      </header>

      <div className="overflow-hidden rounded-[32px] border border-zinc-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(245,241,235,0.92))] dark:border-zinc-800/70 dark:bg-[linear-gradient(135deg,rgba(25,25,24,0.96),rgba(39,39,42,0.88))]">
        <div className="border-b border-zinc-200/70 px-6 py-5 dark:border-zinc-800/70">
          <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-zinc-200/70 bg-white/80 dark:border-zinc-800/70 dark:bg-zinc-950/50">
              {icon}
            </div>
            <div>
              <p className="text-[10px] font-medium tracking-[0.24em] uppercase">
                {eyebrow}
              </p>
              <h2 className="mt-1 font-serif text-3xl font-light text-zinc-900 dark:text-zinc-100">
                {title}
              </h2>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-8 sm:px-8">
          <p className="max-w-2xl text-sm leading-loose text-zinc-600 dark:text-zinc-300">
            {description}
          </p>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={primaryHref}>{primaryLabel}</Link>
            </Button>
            {secondaryHref && secondaryLabel ? (
              <Button asChild variant="secondary">
                <Link href={secondaryHref}>{secondaryLabel}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FlashcardSession({
  initialCards,
  initialDueCount,
  totalVocabularyCount,
}: FlashcardSessionProps) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [pendingRating, setPendingRating] = useState<SRSRating | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ratingCounts, setRatingCounts] = useState<Record<SRSRating, number>>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [isRefreshing, startRefresh] = useTransition();

  const activeCard = cards[0] ?? null;
  const batchSize = initialCards.length;
  const remainingDueCount = Math.max(initialDueCount - reviewedCount, 0);

  async function handleRate(rating: SRSRating) {
    if (!activeCard || pendingRating) {
      return;
    }

    setPendingRating(rating);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/flashcards/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vocabularyId: activeCard.id,
          rating,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(
          payload?.error ?? "Unable to submit this flashcard review.",
        );
      }

      setCards((currentCards) => currentCards.slice(1));
      setReviewedCount((currentCount) => currentCount + 1);
      setRatingCounts((currentCounts) => ({
        ...currentCounts,
        [rating]: currentCounts[rating] + 1,
      }));
      setRevealed(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Unable to submit this flashcard review.",
      );
    } finally {
      setPendingRating(null);
    }
  }

  if (!totalVocabularyCount) {
    return (
      <EmptyState
        eyebrow="Zero state"
        title="Start with a first saved word"
        description="Build a small archive from the reader first. Once a word is saved to vocabulary, it will appear here as due immediately and enter the spaced-repetition loop on its first review."
        primaryHref="/library"
        primaryLabel="Open library"
        secondaryHref="/vocabulary"
        secondaryLabel="Visit vocabulary"
        icon={<LibraryBig className="size-5" />}
      />
    );
  }

  if (!activeCard && reviewedCount === 0 && initialDueCount === 0) {
    return (
      <EmptyState
        eyebrow="All caught up"
        title="Nothing is due right now"
        description="Your archive is resting. Save more vocabulary from the reader or come back after the next review window opens."
        primaryHref="/vocabulary"
        primaryLabel="Browse archive"
        secondaryHref="/library"
        secondaryLabel="Keep reading"
        icon={<CheckCircle2 className="size-5" />}
      />
    );
  }

  if (!activeCard) {
    return (
      <section className="space-y-8">
        <header className="space-y-3 border-b border-zinc-200/60 pb-6 dark:border-zinc-800/60">
          <p className="text-[10px] font-medium tracking-[0.24em] text-zinc-400 uppercase">
            Phase 4 Review
          </p>
          <div className="space-y-2">
            <h1 className="font-serif text-4xl font-light tracking-tight text-zinc-900 dark:text-zinc-100">
              Session complete
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              You moved through this review batch one card at a time and updated
              every due item in the current queue.
            </p>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Reviewed", value: reviewedCount },
            { label: "Again", value: ratingCounts.again },
            {
              label: "Good + Easy",
              value: ratingCounts.good + ratingCounts.easy,
            },
            { label: "Still due", value: remainingDueCount },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[24px] border border-zinc-200/70 bg-white/80 px-5 py-4 dark:border-zinc-800/70 dark:bg-zinc-950/30"
            >
              <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                {item.label}
              </p>
              <p className="mt-3 font-serif text-3xl font-light text-zinc-900 dark:text-zinc-100">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-[32px] border border-zinc-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(245,241,235,0.92))] px-6 py-8 sm:px-8 dark:border-zinc-800/70 dark:bg-[linear-gradient(135deg,rgba(25,25,24,0.96),rgba(39,39,42,0.88))]">
          <p className="text-[10px] font-medium tracking-[0.24em] text-zinc-400 uppercase">
            Completion note
          </p>
          <h2 className="mt-3 font-serif text-3xl font-light text-zinc-900 dark:text-zinc-100">
            {remainingDueCount
              ? `This batch is done. ${remainingDueCount} due card${remainingDueCount === 1 ? "" : "s"} remain.`
              : "The current queue is fully reviewed."}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-loose text-zinc-600 dark:text-zinc-300">
            {remainingDueCount
              ? `You loaded the first ${batchSize} cards in the queue. Refresh to pull in the next due batch and continue.`
              : "Let the schedule breathe, then return when the next words are due again."}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {remainingDueCount ? (
              <Button
                disabled={isRefreshing}
                onClick={() => {
                  startRefresh(() => {
                    router.refresh();
                  });
                }}
                type="button"
              >
                <RotateCcw className="size-4" />
                {isRefreshing ? "Loading next batch..." : "Load next batch"}
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link href="/vocabulary">Back to vocabulary</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <header className="space-y-6 border-b border-zinc-200/60 pb-6 dark:border-zinc-800/60">
        <div className="space-y-3">
          <p className="text-[10px] font-medium tracking-[0.24em] text-zinc-400 uppercase">
            Phase 4 Review
          </p>
          <div className="space-y-2">
            <h1 className="font-serif text-4xl font-light tracking-tight text-zinc-900 dark:text-zinc-100">
              Flashcard session
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Reveal only when you have truly tried to recall the meaning, then
              rate the answer with enough honesty for tomorrow&apos;s queue.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {[
            { label: "Due now", value: initialDueCount },
            { label: "In this batch", value: batchSize },
            { label: "Reviewed", value: reviewedCount },
            { label: "Remaining", value: cards.length },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[24px] border border-zinc-200/70 bg-white/70 px-5 py-4 dark:border-zinc-800/70 dark:bg-zinc-950/30"
            >
              <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                {item.label}
              </p>
              <p className="mt-3 font-serif text-3xl font-light text-zinc-900 dark:text-zinc-100">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <article className="overflow-hidden rounded-[32px] border border-zinc-200/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.95),rgba(244,239,232,0.92))] dark:border-zinc-800/70 dark:bg-[linear-gradient(145deg,rgba(24,24,27,0.98),rgba(39,39,42,0.92))]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 px-6 py-5 sm:px-8 dark:border-zinc-800/70">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{activeCard.srsData ? "Due review" : "New card"}</Badge>
              <p className="text-[11px] tracking-[0.2em] text-zinc-400 uppercase">
                Card {reviewedCount + 1} of {batchSize}
              </p>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {activeCard.book?.title ?? "Personal archive"}
            </p>
          </div>

          <div className="space-y-8 px-6 py-8 sm:px-8 sm:py-10">
            <div className="space-y-4">
              <p className="text-[10px] font-medium tracking-[0.24em] text-zinc-400 uppercase">
                Front
              </p>
              <div className="space-y-4">
                <h2 className="font-serif text-5xl font-light tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-100">
                  {activeCard.word}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                  {activeCard.pronunciation ? (
                    <span className="font-serif text-base text-zinc-600 italic dark:text-zinc-300">
                      {activeCard.pronunciation}
                    </span>
                  ) : null}
                  {activeCard.partOfSpeech ? (
                    <span className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-[10px] tracking-[0.22em] uppercase dark:border-zinc-800 dark:bg-zinc-950/40">
                      {activeCard.partOfSpeech}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {revealed ? (
              <div className="space-y-8 border-t border-zinc-200/70 pt-8 dark:border-zinc-800/70">
                <div className="space-y-3">
                  <p className="text-[10px] font-medium tracking-[0.24em] text-zinc-400 uppercase">
                    Back
                  </p>
                  <p className="font-serif text-3xl leading-tight font-light text-zinc-900 dark:text-zinc-100">
                    {activeCard.definition}
                  </p>
                </div>

                {activeCard.explanation ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                      Editorial note
                    </p>
                    <p className="text-sm leading-loose text-zinc-700 dark:text-zinc-300">
                      {activeCard.explanation}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                    Example
                  </p>
                  <div className="border-l border-[#c98a78] pl-4">
                    <p className="font-serif text-lg leading-relaxed text-zinc-800 italic dark:text-zinc-200">
                      {activeCard.exampleSentence}
                    </p>
                    {activeCard.exampleTranslation ? (
                      <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {activeCard.exampleTranslation}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
                    Reading context
                  </p>
                  <div className="rounded-[24px] border border-zinc-200/70 bg-white/70 p-5 dark:border-zinc-800/70 dark:bg-zinc-950/30">
                    <p className="font-serif text-[15px] leading-loose text-zinc-700 dark:text-zinc-300">
                      {activeCard.contextSentence}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-zinc-200/70 pt-6 dark:border-zinc-800/70">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <Sparkles className="size-4" />
                    <p className="text-[10px] font-medium tracking-[0.22em] uppercase">
                      Rate recall
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {SRS_RATING_VALUES.map((rating) => (
                      <button
                        key={rating}
                        className={cn(
                          "rounded-[24px] border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                          ratingCopy[rating].className,
                        )}
                        disabled={pendingRating !== null}
                        onClick={() => {
                          void handleRate(rating);
                        }}
                        type="button"
                      >
                        <span className="block font-semibold">
                          {pendingRating === rating
                            ? "Saving..."
                            : ratingCopy[rating].label}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed opacity-80">
                          {ratingCopy[rating].hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5 border-t border-zinc-200/70 pt-8 sm:flex-row sm:items-end sm:justify-between dark:border-zinc-800/70">
                <p className="max-w-xl text-sm leading-loose text-zinc-500 dark:text-zinc-400">
                  Pause for recall first. When you are ready, reveal the answer,
                  read the context, and choose the next interval.
                </p>
                <Button
                  className="sm:min-w-40"
                  onClick={() => {
                    setErrorMessage(null);
                    setRevealed(true);
                  }}
                  type="button"
                >
                  Reveal
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            )}

            {errorMessage ? (
              <p className="text-sm text-[#8f3625]">{errorMessage}</p>
            ) : null}
          </div>
        </article>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-zinc-200/70 bg-white/70 p-5 dark:border-zinc-800/70 dark:bg-zinc-950/30">
            <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
              Session note
            </p>
            <p className="mt-3 font-serif text-2xl font-light text-zinc-900 dark:text-zinc-100">
              Honest ratings build a better queue.
            </p>
            <p className="mt-4 text-sm leading-loose text-zinc-600 dark:text-zinc-300">
              Vocabulary without prior SRS data enters the loop as due right
              away. Each review writes the next date lazily, only when the card
              has actually been seen.
            </p>
          </div>

          <div className="rounded-[28px] border border-zinc-200/70 bg-white/70 p-5 dark:border-zinc-800/70 dark:bg-zinc-950/30">
            <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
              Rating guide
            </p>
            <div className="mt-4 space-y-4">
              {SRS_RATING_VALUES.map((rating) => (
                <div key={rating} className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {ratingCopy[rating].label}
                  </p>
                  <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {ratingCopy[rating].hint}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200/70 bg-white/70 p-5 dark:border-zinc-800/70 dark:bg-zinc-950/30">
            <p className="text-[10px] font-medium tracking-[0.22em] text-zinc-400 uppercase">
              Archive snapshot
            </p>
            <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <div className="flex items-center justify-between gap-4">
                <span>Total vocabulary</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {totalVocabularyCount}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Due today</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {initialDueCount}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Updated in session</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {reviewedCount}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
