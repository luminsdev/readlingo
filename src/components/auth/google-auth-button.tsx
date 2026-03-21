"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

type GoogleAuthButtonProps = {
  label: string;
};

export function GoogleAuthButton({ label }: GoogleAuthButtonProps) {
  const [isPending, setIsPending] = useState(false);

  return (
    <Button
      className="w-full justify-center gap-3"
      disabled={isPending}
      onClick={async () => {
        setIsPending(true);
        await signIn("google", { redirectTo: "/library" });
        setIsPending(false);
      }}
      type="button"
      variant="secondary"
    >
      <GoogleIcon />
      {isPending ? "Redirecting..." : label}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.805 10.023H12v3.955h5.617c-.242 1.27-.967 2.346-2.058 3.068v2.545h3.327c1.947-1.793 3.063-4.436 3.063-7.591 0-.661-.059-1.296-.164-1.977Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.79 0 5.131-.922 6.84-2.5l-3.327-2.545c-.924.619-2.107.989-3.513.989-2.698 0-4.983-1.821-5.801-4.27H2.76v2.625A10.323 10.323 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.199 13.674A6.197 6.197 0 0 1 5.875 12c0-.581.117-1.141.324-1.674V7.701H2.76A10.327 10.327 0 0 0 1.688 12c0 1.65.395 3.213 1.072 4.299Z"
        fill="#FBBC04"
      />
      <path
        d="M12 6.055c1.518 0 2.88.522 3.951 1.545l2.963-2.963C17.127 2.979 14.786 2 12 2A10.323 10.323 0 0 0 2.76 7.701l3.439 2.625c.818-2.449 3.103-4.271 5.801-4.271Z"
        fill="#EA4335"
      />
    </svg>
  );
}
