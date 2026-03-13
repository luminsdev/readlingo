"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      onClick={() => signOut({ callbackUrl: "/login" })}
      size="sm"
      variant="secondary"
    >
      <LogOut className="size-4" />
      Sign out
    </Button>
  );
}
