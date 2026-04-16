import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ReferenceFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  references: string[];
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Input / Textarea wrapper that offers typeahead when the caret sits
 * inside a `{{ ... }}` token. Pressing Tab or Enter commits the
 * highlighted suggestion; Escape closes the menu.
 */
export function ReferenceField({
  id,
  value,
  onChange,
  references,
  multiline = false,
  placeholder,
  className,
}: ReferenceFieldProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [tokenStart, setTokenStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    if (query === null) return [] as string[];
    const q = query.trim().toLowerCase();
    const list = q
      ? references.filter((reference) => reference.toLowerCase().includes(q))
      : references;
    return list.slice(0, 8);
  }, [query, references]);

  // Clamp active index during render when the filtered list shrinks.
  const clampedActive =
    filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);

  function detectToken(text: string, caret: number) {
    // Find the nearest `{{` behind the caret that isn't already closed by `}}`.
    const segment = text.slice(0, caret);
    const lastOpen = segment.lastIndexOf("{{");
    if (lastOpen === -1) return null;
    const between = segment.slice(lastOpen + 2);
    if (between.includes("}}")) return null;
    return { start: lastOpen, query: between };
  }

  function handleInput(next: string, caret: number) {
    onChange(next);
    const token = detectToken(next, caret);
    if (token) {
      setTokenStart(token.start);
      setQuery(token.query);
      setActiveIndex(0);
    } else {
      setTokenStart(null);
      setQuery(null);
    }
  }

  function commit(reference: string) {
    if (tokenStart === null || !inputRef.current) return;
    const el = inputRef.current;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, tokenStart);
    const after = value.slice(caret);
    const next = `${before}${reference}${after}`;
    onChange(next);
    setTokenStart(null);
    setQuery(null);
    // Place caret after inserted reference
    requestAnimationFrame(() => {
      const position = before.length + reference.length;
      el.focus();
      el.setSelectionRange(position, position);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (query === null || filtered.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % filtered.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + filtered.length) % filtered.length,
      );
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      commit(filtered[clampedActive]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setTokenStart(null);
      setQuery(null);
    }
  }

  const showMenu = query !== null && filtered.length > 0;

  // Reposition menu below caret.
  const menuRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!showMenu || !inputRef.current || !menuRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    menuRef.current.style.top = `${rect.bottom + window.scrollY + 2}px`;
    menuRef.current.style.left = `${rect.left + window.scrollX}px`;
    menuRef.current.style.width = `${rect.width}px`;
  }, [showMenu, value]);

  const sharedClasses = cn(
    "flex w-full rounded-[3px] border border-[color:var(--color-input)] bg-[color:var(--color-card)] px-2 text-[12px] text-[color:var(--color-foreground)] outline-none transition-colors focus:border-[color:var(--color-primary)] placeholder:text-[color:var(--color-muted-foreground)] font-mono",
    multiline ? "min-h-[72px] py-1.5" : "h-7 items-center",
    className,
  );

  return (
    <>
      {multiline ? (
        <textarea
          id={id}
          ref={(element) => {
            inputRef.current = element;
          }}
          className={sharedClasses}
          placeholder={placeholder}
          value={value}
          onChange={(event) =>
            handleInput(event.target.value, event.target.selectionStart ?? 0)
          }
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay so click on suggestion lands first
            window.setTimeout(() => {
              setTokenStart(null);
              setQuery(null);
            }, 120);
          }}
        />
      ) : (
        <input
          id={id}
          ref={(element) => {
            inputRef.current = element;
          }}
          className={sharedClasses}
          placeholder={placeholder}
          value={value}
          onChange={(event) =>
            handleInput(event.target.value, event.target.selectionStart ?? 0)
          }
          onKeyDown={handleKeyDown}
          onBlur={() => {
            window.setTimeout(() => {
              setTokenStart(null);
              setQuery(null);
            }, 120);
          }}
        />
      )}
      {showMenu && (
        <div
          ref={menuRef}
          style={{ position: "fixed", zIndex: 60 }}
          className="max-h-[200px] overflow-auto rounded-[3px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-1 shadow-lg"
        >
          {filtered.map((reference, index) => (
            <button
              key={reference}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(reference)}
              className={cn(
                "mono flex w-full items-center gap-1 rounded-[2px] px-2 py-1 text-left text-[11px] transition-colors",
                index === clampedActive
                  ? "bg-[color:var(--color-primary)] text-white"
                  : "text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface)]",
              )}
            >
              {reference}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
