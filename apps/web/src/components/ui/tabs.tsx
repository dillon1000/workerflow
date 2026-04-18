import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tabs({
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root> & {
  children?: ReactNode;
}) {
  return <TabsPrimitive.Root {...props}>{children}</TabsPrimitive.Root>;
}

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-8 items-center gap-0 border-b border-[color:var(--color-border)]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px inline-flex h-8 items-center justify-center border-b-2 border-transparent px-3 text-[12px] font-medium text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)] data-[state=active]:border-[color:var(--color-primary)] data-[state=active]:text-[color:var(--color-foreground)]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("outline-none", className)}
      {...props}
    />
  );
}
