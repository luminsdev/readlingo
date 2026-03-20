import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenText, LayoutGrid, Languages, RotateCcw } from "lucide-react";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/library", label: "Library", icon: LayoutGrid },
  { href: "/vocabulary", label: "Vocabulary", icon: Languages },
  { href: "/vocabulary/flashcards", label: "Flashcards", icon: RotateCcw },
];

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="paper-panel border-border flex flex-col gap-4 rounded-[32px] border px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-2xl shadow-[0_18px_45px_var(--accent-shadow)]">
                <BookOpenText className="size-5" />
              </div>
              <div>
                <p className="font-serif text-2xl tracking-tight">ReadLingo</p>
                <p className="text-muted-foreground text-sm">
                  Read, understand, save, review.
                </p>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              {navigation.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    className={cn(
                      "text-muted-foreground hover:bg-surface hover:text-foreground inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                    )}
                    href={item.href}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            <Badge>Phase 5 live</Badge>
            <div className="text-muted-foreground text-sm">
              {session.user.email}
            </div>
            <SignOutButton />
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
