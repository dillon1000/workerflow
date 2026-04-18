import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkflowNode } from "@/lib/workflow/types";

type AskForInputNode = WorkflowNode & {
  data: WorkflowNode["data"] & {
    kind: "askForInput";
  };
};

interface AskForInputDialogProps {
  open: boolean;
  nodes: AskForInputNode[];
  submitLabel: string;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void> | void;
}

function configValue(node: AskForInputNode, key: string, fallback = "") {
  const value = node.data.config[key];
  return typeof value === "string" ? value : fallback;
}

export function AskForInputDialog({
  open,
  nodes,
  submitLabel,
  onClose,
  onSubmit,
}: AskForInputDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      nodes.map((node) => [node.id, configValue(node, "defaultValue")]),
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => firstInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const missingRequired = nodes.some((node) => {
    const required = configValue(node, "required", "true") !== "false";
    return required && !String(values[node.id] ?? "").trim();
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => (!next ? onClose() : null)}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogTitle>Ask for input</AlertDialogTitle>
          <AlertDialogDescription>
            Provide the values this button-triggered workflow needs before the
            run starts.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {nodes.map((node, index) => {
            const label = configValue(node, "label", node.data.title);
            const placeholder = configValue(node, "placeholder");
            const required = configValue(node, "required", "true") !== "false";

            return (
              <div className="space-y-1.5" key={node.id}>
                <Label htmlFor={node.id}>
                  {label}
                  {required ? " *" : ""}
                </Label>
                <Input
                  id={node.id}
                  ref={index === 0 ? firstInputRef : undefined}
                  value={values[node.id] ?? ""}
                  placeholder={placeholder}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [node.id]: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !missingRequired &&
                      !submitting
                    ) {
                      event.preventDefault();
                      void (async () => {
                        setSubmitting(true);
                        try {
                          await onSubmit({ askForInput: values });
                        } finally {
                          setSubmitting(false);
                        }
                      })();
                    }
                  }}
                />
                <p className="text-[11px] text-[color:var(--color-muted-foreground)]">
                  {node.data.subtitle}
                </p>
              </div>
            );
          })}
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            type="button"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              void (async () => {
                setSubmitting(true);
                try {
                  await onSubmit({ askForInput: values });
                } finally {
                  setSubmitting(false);
                }
              })();
            }}
            disabled={submitting || missingRequired}
            type="button"
          >
            {submitLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
