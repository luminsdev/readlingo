"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span
        aria-hidden="true"
        className="border-line bg-surface-strong inline-flex size-11 rounded-full border"
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="border-line bg-surface-strong text-foreground hover:bg-surface focus-visible:ring-ring relative inline-flex size-11 items-center justify-center overflow-hidden rounded-full border shadow-[0_12px_30px_var(--paper-shadow)] focus-visible:ring-4 focus-visible:outline-none"
      onClick={() => {
        setTheme(isDark ? "light" : "dark");
      }}
      type="button"
    >
      <Sun
        className={cn(
          "absolute size-4 transition-all duration-300 ease-out",
          isDark
            ? "scale-0 rotate-90 opacity-0"
            : "scale-100 rotate-0 opacity-100",
        )}
      />
      <Moon
        className={cn(
          "absolute size-4 transition-all duration-300 ease-out",
          isDark
            ? "scale-100 rotate-0 opacity-100"
            : "scale-0 -rotate-90 opacity-0",
        )}
      />
    </button>
  );
}
