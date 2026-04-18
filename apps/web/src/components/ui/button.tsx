import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[3px] text-[12px] font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--color-background)] disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[color:var(--color-ink)] px-2.5 text-[color:var(--color-primary-foreground)] hover:bg-[color:var(--color-foreground)]/90",
        primary:
          "bg-[color:var(--color-primary)] px-2.5 text-[color:var(--color-primary-foreground)] hover:brightness-95",
        secondary:
          "border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2.5 text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface)]",
        ghost:
          "bg-transparent px-2 text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface)]",
        outline:
          "border border-[color:var(--color-border)] bg-transparent px-2.5 text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface)]",
        destructive:
          "bg-[color:var(--color-destructive)] px-2.5 text-[color:var(--color-destructive-foreground)] hover:opacity-95",
      },
      size: {
        default: "h-7",
        sm: "h-6 px-2 text-[11px]",
        lg: "h-8 px-3",
        icon: "h-7 w-7 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
