"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import {
  ArrowRight,
  Brain,
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
      "border-[#d9b0a4] bg-[#fcf1ed] text-[#8b3d2b] hover:border-[#c98a78] hover:bg-[#f8e2db] dark:border-[#7f4b3d] dark:bg-[#3a211b] dark:text-[#f1c3b5] dark:hover:border-[#b46d57] dark:hover:bg-[#472820]",
  },
  hard: {
    label: "Hard",
    hint: "Tomorrow, still careful",
    className:
      "border-[#dcc8a2] bg-[#fbf5e8] text-[#7f5b1c] hover:border-[#cdaa6b] hover:bg-[#f5ecd6] dark:border-[#7a6342] dark:bg-[#34291d] dark:text-[#eed49b] dark:hover:border-[#b5904f] dark:hover:bg-[#3f3122]",
  },
  good: {
    label: "Good",
    hint: "Move the interval forward",
    className:
      "border-line-strong bg-surface-strong text-ink-soft hover:border-quote hover:bg-surface",
  },
  easy: {
    label: "Easy",
    hint: "Stretch it a little more",
    className:
      "border-[#bfd7cb] bg-[#eef7f1] text-[#2f6750] hover:border-[#8cb59f] hover:bg-[#e1f0e6] dark:border-[#49675a] dark:bg-[#1f3128] dark:text-[#b8e0c9] dark:hover:border-[#70917f] dark:hover:bg-[#264033]",
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
      <header className="border-line space-y-3 border-b pb-6">
        <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
          Phase 4 Review
        </p>
        <div className="space-y-2">
          <h1 className="text-foreground font-serif text-4xl font-light tracking-tight">
            Flashcard loop
          </h1>
          <p className="text-ink-muted max-w-2xl text-sm leading-relaxed">
            A quiet place to revisit saved vocabulary, rate recall honestly, and
            let the next review date move itself into place.
          </p>
        </div>
      </header>

      <div className="paper-panel border-border overflow-hidden rounded-[32px] border">
        <div className="border-line border-b px-6 py-5">
          <div className="text-ink-muted flex items-center gap-3">
            <div className="border-line bg-surface-strong flex size-11 items-center justify-center rounded-2xl border">
              {icon}
            </div>
            <div>
              <p className="text-[10px] font-medium tracking-[0.24em] uppercase">
                {eyebrow}
              </p>
              <h2 className="text-foreground mt-1 font-serif text-3xl font-light">
                {title}
              </h2>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-8 sm:px-8">
          <p className="text-ink-soft max-w-2xl text-sm leading-loose">
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
  const [hintVisible, setHintVisible] = useState(false);
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
  const hasMnemonicHint = Boolean(activeCard?.mnemonic?.trim());

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
      setHintVisible(false);
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
        <header className="border-line space-y-3 border-b pb-6">
          <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
            Phase 4 Review
          </p>
          <div className="space-y-2">
            <h1 className="text-foreground font-serif text-4xl font-light tracking-tight">
              Session complete
            </h1>
            <p className="text-ink-muted max-w-2xl text-sm leading-relaxed">
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
              className="border-line bg-surface-strong rounded-[24px] border px-5 py-4"
            >
              <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
                {item.label}
              </p>
              <p className="text-foreground mt-3 font-serif text-3xl font-light">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="paper-panel border-border rounded-[32px] border px-6 py-8 sm:px-8">
          <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
            Completion note
          </p>
          <h2 className="text-foreground mt-3 font-serif text-3xl font-light">
            {remainingDueCount
              ? `This batch is done. ${remainingDueCount} due card${remainingDueCount === 1 ? "" : "s"} remain.`
              : "The current queue is fully reviewed."}
          </h2>
          <p className="text-ink-soft mt-4 max-w-2xl text-sm leading-loose">
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
      <header className="border-line space-y-6 border-b pb-6">
        <div className="space-y-3">
          <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
            Phase 4 Review
          </p>
          <div className="space-y-2">
            <h1 className="text-foreground font-serif text-4xl font-light tracking-tight">
              Flashcard session
            </h1>
            <p className="text-ink-muted max-w-2xl text-sm leading-relaxed">
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
              className="border-line bg-surface rounded-[24px] border px-5 py-4"
            >
              <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
                {item.label}
              </p>
              <p className="text-foreground mt-3 font-serif text-3xl font-light">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <article className="paper-panel border-border overflow-hidden rounded-[32px] border">
          <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{activeCard.srsData ? "Due review" : "New card"}</Badge>
              <p className="text-ink-kicker text-[11px] tracking-[0.2em] uppercase">
                Card {reviewedCount + 1} of {batchSize}
              </p>
            </div>
            <p className="text-ink-muted text-sm">
              {activeCard.book?.title ?? "Personal archive"}
            </p>
          </div>

          <div className="space-y-8 px-6 py-8 sm:px-8 sm:py-10">
            <div className="space-y-4">
              <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
                Front
              </p>
              <div className="space-y-4">
                <h2 className="text-foreground font-serif text-5xl font-light tracking-tight sm:text-6xl">
                  {activeCard.word}
                </h2>
                <div className="text-ink-muted flex flex-wrap items-center gap-3 text-sm">
                  {activeCard.pronunciation ? (
                    <span className="text-ink-soft font-serif text-base italic">
                      {activeCard.pronunciation}
                    </span>
                  ) : null}
                  {activeCard.partOfSpeech ? (
                    <span className="border-line bg-surface-strong rounded-full border px-3 py-1 text-[10px] tracking-[0.22em] uppercase">
                      {activeCard.partOfSpeech}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {revealed ? (
              <div className="border-line space-y-8 border-t pt-8">
                <div className="space-y-3">
                  <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
                    Back
                  </p>
                  <p className="text-foreground font-serif text-3xl leading-tight font-light">
                    {activeCard.definition}
                  </p>
                </div>

                {activeCard.explanation ? (
                  <div className="space-y-2">
                    <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
                      Editorial note
                    </p>
                    <p className="text-ink-soft text-sm leading-loose">
                      {activeCard.explanation}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
                    Example
                  </p>
                  <div className="border-quote border-l pl-4">
                    <p className="text-ink-soft font-serif text-lg leading-relaxed italic">
                      {activeCard.exampleSentence}
                    </p>
                    {activeCard.exampleTranslation ? (
                      <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                        {activeCard.exampleTranslation}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
                    Reading context
                  </p>
                  <div className="border-line bg-surface rounded-[24px] border p-5">
                    <p className="text-ink-soft font-serif text-[15px] leading-loose">
                      {activeCard.contextSentence}
                    </p>
                  </div>
                </div>

                <div className="border-line space-y-3 border-t pt-6">
                  <div className="text-ink-muted flex items-center gap-2">
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
              <div className="border-line space-y-5 border-t pt-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <p className="text-ink-muted max-w-xl text-sm leading-loose">
                    Pause for recall first. When you are ready, reveal the
                    answer, read the context, and choose the next interval.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {hasMnemonicHint ? (
                      <Button
                        onClick={() => {
                          setHintVisible((currentValue) => !currentValue);
                        }}
                        type="button"
                        variant="secondary"
                      >
                        {hintVisible ? "Hide hint" : "Show hint"}
                      </Button>
                    ) : null}
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
                </div>

                {hasMnemonicHint && hintVisible ? (
                  <div className="border-line bg-surface rounded-[24px] border p-4">
                    <div className="flex items-start gap-3">
                      <div className="border-line bg-surface-strong flex size-9 shrink-0 items-center justify-center rounded-full border">
                        <Brain className="text-ink-muted size-4" />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
                          Memory hint
                        </p>
                        <p className="text-ink-muted text-xs leading-relaxed italic">
                          {activeCard.mnemonic}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {errorMessage ? (
              <p className="text-danger text-sm">{errorMessage}</p>
            ) : null}
          </div>
        </article>

        <aside className="space-y-4">
          <div className="border-line bg-surface rounded-[28px] border p-5">
            <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
              Session note
            </p>
            <p className="text-foreground mt-3 font-serif text-2xl font-light">
              Honest ratings build a better queue.
            </p>
            <p className="text-ink-soft mt-4 text-sm leading-loose">
              Vocabulary without prior SRS data enters the loop as due right
              away. Each review writes the next date lazily, only when the card
              has actually been seen.
            </p>
          </div>

          <div className="border-line bg-surface rounded-[28px] border p-5">
            <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
              Rating guide
            </p>
            <div className="mt-4 space-y-4">
              {SRS_RATING_VALUES.map((rating) => (
                <div key={rating} className="space-y-1">
                  <p className="text-ink-soft text-sm font-semibold">
                    {ratingCopy[rating].label}
                  </p>
                  <p className="text-ink-muted text-sm leading-relaxed">
                    {ratingCopy[rating].hint}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-line bg-surface rounded-[28px] border p-5">
            <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
              Archive snapshot
            </p>
            <div className="text-ink-soft mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span>Total vocabulary</span>
                <span className="text-foreground font-medium">
                  {totalVocabularyCount}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Due today</span>
                <span className="text-foreground font-medium">
                  {initialDueCount}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Updated in session</span>
                <span className="text-foreground font-medium">
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
