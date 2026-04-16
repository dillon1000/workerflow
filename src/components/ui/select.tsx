import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Select({
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root> & {
  children?: ReactNode;
}) {
  return <SelectPrimitive.Root {...props}>{children}</SelectPrimitive.Root>;
}

export function SelectValue(
  props: React.ComponentProps<typeof SelectPrimitive.Value>,
) {
  return <SelectPrimitive.Value {...props} />;
}

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-7 w-full items-center justify-between rounded-[3px] border border-[color:var(--color-input)] bg-[color:var(--color-card)] px-2 text-[12px] outline-none transition-colors focus:border-[color:var(--color-primary)]",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 text-[color:var(--color-muted-foreground)]" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          "z-50 overflow-hidden rounded-[3px] border border-[color:var(--color-border)] bg-[color:var(--color-popover)] p-1 shadow-md",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex h-7 cursor-default select-none items-center rounded-[2px] pl-7 pr-3 text-[12px] outline-none data-[highlighted]:bg-[color:var(--color-surface)]",
        className,
      )}
      {...props}
    >
      <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
