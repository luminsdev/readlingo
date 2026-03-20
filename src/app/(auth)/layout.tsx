import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (session?.user) {
    redirect("/library");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute top-6 right-6 z-10">
        <ThemeToggle />
      </div>
      <div className="auth-atmosphere pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
