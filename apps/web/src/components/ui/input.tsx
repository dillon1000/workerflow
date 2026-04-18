import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, ...props }, ref) => (
  <input
    className={cn(
      "flex h-7 w-full rounded-[3px] border border-[color:var(--color-input)] bg-[color:var(--color-card)] px-2 text-[12px] text-[color:var(--color-foreground)] outline-none transition-colors focus:border-[color:var(--color-primary)] placeholder:text-[color:var(--color-muted-foreground)]",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
