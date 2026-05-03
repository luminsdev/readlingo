import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Flame,
  Languages,
  Target,
  type LucideIcon,
} from "lucide-react";

import { auth } from "@/auth";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/dashboard";

const RECENT_WORD_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

function formatProgressPercentage(percentage: number | null) {
  if (percentage == null) {
    return null;
  }

  return Math.round(percentage <= 1 ? percentage * 100 : percentage);
}

function DashboardProgressRing({ value }: { value: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg aria-hidden="true" className="size-12 -rotate-90" viewBox="0 0 48 48">
      <circle
        className="stroke-line"
        cx="24"
        cy="24"
        fill="none"
        r={radius}
        strokeWidth="5"
      />
      <circle
        cx="24"
        cy="24"
        fill="none"
        r={radius}
        stroke="var(--accent)"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth="5"
      />
    </svg>
  );
}

function DashboardStatCard({
  icon: Icon,
  label,
  subtitle,
  value,
  progress,
}: {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  value: string | number;
  progress?: number;
}) {
  return (
    <div className="border-line bg-surface-strong rounded-[24px] border px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-ink-kicker text-[10px] font-medium tracking-[0.22em] uppercase">
            {label}
          </p>
          <p className="text-foreground mt-3 font-serif text-3xl font-light">
            {value}
          </p>
          {subtitle ? (
            <p className="text-ink-muted mt-2 text-xs">{subtitle}</p>
          ) : null}
        </div>

        {progress != null ? (
          <DashboardProgressRing value={progress} />
        ) : (
          <div className="border-line bg-surface flex size-10 items-center justify-center rounded-full border">
            <Icon className="text-ink-soft size-4" />
          </div>
        )}
      </div>
    </div>
  );
}

function ContinueReadingCard({
  book,
}: {
  book: NonNullable<
    Awaited<ReturnType<typeof getDashboardData>>["continueReading"]
  >;
}) {
  const progressPercentage = formatProgressPercentage(book.percentage);

  return (
    <div className="border-line bg-surface rounded-[24px] border p-4">
      <div className="flex gap-4">
        <div className="bg-surface-strong border-border/50 relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-[10px] border shadow-[0_12px_28px_var(--paper-shadow)]">
          {book.coverImageUrl ? (
            <Image
              alt={book.title}
              className="h-full w-full object-cover"
              height={320}
              sizes="80px"
              src={book.coverImageUrl}
              unoptimized
              width={240}
            />
          ) : (
            <div className="flex h-full w-full items-end bg-[linear-gradient(145deg,var(--surface-strong),var(--surface))] p-3">
              <span className="text-foreground line-clamp-3 font-serif text-sm leading-tight">
                {book.title}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
            Continue reading
          </p>
          <h3 className="text-foreground mt-2 line-clamp-2 font-serif text-2xl font-light tracking-tight">
            {book.title}
          </h3>
          <p className="text-ink-muted mt-1 line-clamp-1 text-sm">
            {book.author ?? "Unknown author"}
          </p>
          {progressPercentage != null ? (
            <p className="text-ink-soft mt-3 text-xs">
              {progressPercentage}% through the book
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const data = await getDashboardData(session.user.id);
  const hasAnyData =
    data.totalVocabularyCount > 0 || data.continueReading !== null;
  const goalProgress = Math.min(
    data.reviewedTodayCount,
    data.preferences.dailyGoal,
  );
  const goalComplete = goalProgress >= data.preferences.dailyGoal;
  const goalProgressPercent = Math.min(
    100,
    Math.round((goalProgress / data.preferences.dailyGoal) * 100),
  );

  return (
    <div className="library-grain animate-content-in relative flex flex-col gap-8">
      <header className="relative flex flex-col gap-5 overflow-hidden rounded-[28px] px-1 py-2">
        <div className="pointer-events-none absolute inset-x-8 -top-10 h-28 bg-[radial-gradient(circle_at_top,var(--page-glow-primary),transparent_68%)] opacity-90" />
        <div className="pointer-events-none absolute top-3 right-10 h-16 w-40 bg-[radial-gradient(circle,var(--page-glow-secondary),transparent_72%)] opacity-80" />

        <div className="relative mt-2 flex flex-col gap-2 pt-2 pb-4">
          <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
            Your Dashboard
          </p>
          <h1 className="text-foreground font-serif text-4xl font-light tracking-tight sm:text-5xl">
            Reading room
          </h1>
        </div>

        <div className="bg-line-strong h-px" />
      </header>

      <section className="paper-panel border-border rounded-[32px] border p-6 sm:p-8">
        {!hasAnyData ? (
          <div className="max-w-2xl space-y-4">
            <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
              Welcome
            </p>
            <h2 className="text-foreground font-serif text-4xl font-light tracking-tight">
              Welcome to your reading room
            </h2>
            <p className="text-ink-soft text-sm leading-loose">
              Upload your first book to get started. Your dashboard will fill in
              with review queues, reading progress, and saved words as you read.
            </p>
            <Button asChild>
              <Link href="/library">
                Go to Library
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-4">
              {data.dueCardCount > 0 ? (
                <>
                  <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
                    Review queue
                  </p>
                  <h2 className="text-foreground font-serif text-4xl font-light tracking-tight">
                    You have {data.dueCardCount} words to review
                  </h2>
                  <p className="text-ink-soft text-sm leading-loose">
                    {goalProgress}/{data.preferences.dailyGoal} today. Keep the
                    streak alive with a focused review pass.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link href="/vocabulary/flashcards">
                        Start Review
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/library">Browse Library</Link>
                    </Button>
                  </div>
                </>
              ) : goalComplete && data.continueReading ? (
                <>
                  <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
                    <CheckCircle2 className="mr-2 inline size-3" />
                    All caught up
                  </p>
                  <h2 className="text-foreground font-serif text-4xl font-light tracking-tight">
                    Your reviews are complete
                  </h2>
                  <p className="text-ink-soft text-sm leading-loose">
                    The daily goal is done. Move back into the text and gather
                    the next useful words.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link href={`/reader/${data.continueReading.bookId}`}>
                        Continue Reading
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/library">Browse Library</Link>
                    </Button>
                  </div>
                </>
              ) : goalComplete ? (
                <>
                  <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
                    <CheckCircle2 className="mr-2 inline size-3" />
                    All caught up for today
                  </p>
                  <h2 className="text-foreground font-serif text-4xl font-light tracking-tight">
                    The review desk is clear
                  </h2>
                  <p className="text-ink-soft text-sm leading-loose">
                    Add another book when you are ready to collect more language
                    from context.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link href="/library">
                        Go to Library
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/library">Browse Library</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
                    Reading queue
                  </p>
                  <h2 className="text-foreground font-serif text-4xl font-light tracking-tight">
                    No words are due right now
                  </h2>
                  <p className="text-ink-soft text-sm leading-loose">
                    You are at {goalProgress}/{data.preferences.dailyGoal}{" "}
                    today. Read a few more pages or review your saved vocabulary
                    list.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {data.continueReading ? (
                      <Button asChild>
                        <Link href={`/reader/${data.continueReading.bookId}`}>
                          Continue Reading
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    ) : null}
                    <Button asChild variant="secondary">
                      <Link href="/vocabulary">View Vocabulary</Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/library">Browse Library</Link>
                    </Button>
                  </div>
                </>
              )}
            </div>

            {data.continueReading ? (
              <ContinueReadingCard book={data.continueReading} />
            ) : (
              <div className="border-line bg-surface rounded-[24px] border p-5">
                <p className="text-ink-kicker text-[10px] font-medium tracking-[0.2em] uppercase">
                  Daily goal
                </p>
                <div className="mt-4 flex items-center gap-5">
                  <DashboardProgressRing value={goalProgressPercent} />
                  <div>
                    <p className="text-foreground font-serif text-3xl font-light">
                      {goalProgress}/{data.preferences.dailyGoal}
                    </p>
                    <p className="text-ink-muted text-sm">reviews completed</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {hasAnyData ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <DashboardStatCard
              icon={Flame}
              label="Current streak"
              subtitle={`Best: ${data.preferences.longestStreak}`}
              value={`${data.preferences.currentStreak} days`}
            />
            <DashboardStatCard
              icon={BookOpen}
              label="Books"
              subtitle={`${data.booksCompleted} completed`}
              value={`${data.booksInProgress} in progress`}
            />
            <DashboardStatCard
              icon={Languages}
              label="Words learned"
              value={data.totalVocabularyCount}
            />
            <DashboardStatCard
              icon={Target}
              label="Daily goal"
              progress={goalProgressPercent}
              value={`${goalProgress}/${data.preferences.dailyGoal}`}
            />
          </div>

          <ActivityHeatmap data={data.activityHeatmap} />

          {data.recentWords.length > 0 ? (
            <section className="border-line bg-surface rounded-[28px] border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-ink-kicker text-[10px] font-medium tracking-[0.24em] uppercase">
                    Recently saved
                  </p>
                  <h2 className="text-foreground mt-2 font-serif text-2xl font-light tracking-tight">
                    Fresh vocabulary
                  </h2>
                </div>
                <Link
                  className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-sm font-semibold"
                  href="/vocabulary"
                >
                  View all
                  <ArrowRight className="size-4" />
                </Link>
              </div>

              <div className="mt-5 divide-y divide-[var(--line)]">
                {data.recentWords.map((item) => (
                  <div
                    className="grid gap-2 py-3 sm:grid-cols-[12rem_1fr_auto] sm:items-center"
                    key={item.id}
                  >
                    <p className="text-foreground font-semibold">{item.word}</p>
                    <p className="text-ink-muted line-clamp-1 text-sm">
                      {item.definition}
                    </p>
                    <time
                      className="text-ink-muted text-xs"
                      dateTime={item.createdAt.toISOString()}
                    >
                      {RECENT_WORD_DATE_FORMATTER.format(item.createdAt)}
                    </time>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
