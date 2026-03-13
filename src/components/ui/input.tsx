import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "border-border text-foreground placeholder:text-muted-foreground focus:border-accent focus:ring-ring flex h-12 w-full rounded-2xl border bg-white/80 px-4 py-3 text-sm shadow-sm outline-none focus:ring-4",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
