import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-surface-strong/40 relative overflow-hidden rounded-md",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_2s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent dark:before:via-white/10",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
