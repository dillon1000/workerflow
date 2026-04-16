import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[2px] border px-1.5 h-[18px] text-[10px] font-mono font-medium uppercase tracking-[0.06em]",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]",
        muted:
          "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-muted-foreground)]",
        outline:
          "border-[color:var(--color-border)] bg-transparent text-[color:var(--color-muted-foreground)]",
        success:
          "border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]",
        warning: "border-amber-300/50 bg-amber-50 text-amber-800",
        destructive:
          "border-[color:var(--color-destructive)]/30 bg-[color:var(--color-destructive)]/10 text-[color:var(--color-destructive)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
