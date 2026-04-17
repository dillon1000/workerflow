import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatRelativeTime(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();

  if (Number.isNaN(timestamp)) return "";

  const diffMs = timestamp - Date.now();
  const absDiffMs = Math.abs(diffMs);
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (absDiffMs < minuteMs) return "just now";

  if (absDiffMs < hourMs) {
    const minutes = Math.round(absDiffMs / minuteMs);
    return `${minutes}m ${diffMs < 0 ? "ago" : "from now"}`;
  }

  if (absDiffMs < dayMs) {
    const hours = Math.round(absDiffMs / hourMs);
    return `${hours}h ${diffMs < 0 ? "ago" : "from now"}`;
  }

  const days = Math.round(absDiffMs / dayMs);
  return `${days}d ${diffMs < 0 ? "ago" : "from now"}`;
}
