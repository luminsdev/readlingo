import * as React from "react";

import { cn } from "@/lib/utils";

function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "border-border text-muted-foreground inline-flex items-center rounded-full border bg-white/80 px-3 py-1 text-xs font-medium tracking-[0.16em] uppercase",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
