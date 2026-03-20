import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-accent px-5 py-2.5 text-accent-foreground shadow-[0_12px_30px_var(--accent-shadow)] hover:-translate-y-0.5 hover:bg-[var(--accent-hover)]",
        secondary:
          "bg-surface-strong px-5 py-2.5 text-foreground ring-1 ring-border hover:-translate-y-0.5 hover:bg-surface",
        ghost:
          "px-4 py-2 text-muted-foreground hover:bg-surface hover:text-foreground",
        danger:
          "bg-danger px-5 py-2.5 text-danger-foreground shadow-[0_12px_30px_var(--danger-shadow)] hover:-translate-y-0.5 hover:bg-[var(--danger-hover)]",
      },
      size: {
        default: "h-11",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
