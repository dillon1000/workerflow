import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "min-h-[72px] w-full rounded-[3px] border border-[color:var(--color-input)] bg-[color:var(--color-card)] px-2 py-1.5 text-[12px] text-[color:var(--color-foreground)] outline-none transition-colors focus:border-[color:var(--color-primary)] placeholder:text-[color:var(--color-muted-foreground)] font-mono",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";
