import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(200,106,60,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(92,130,95,0.18),transparent_28%)]" />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
