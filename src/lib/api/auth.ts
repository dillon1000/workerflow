import { fetchJson } from "@/lib/api/client";
import type { AuthSessionPayload } from "@/lib/workflow/types";

export function getSession() {
  return fetchJson<AuthSessionPayload | null>("/api/auth/get-session");
}

export function signInEmail(email: string, password: string) {
  return fetchJson("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function signUpEmail(name: string, email: string, password: string) {
  return fetchJson("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export function signOut() {
  return fetchJson("/api/auth/sign-out", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
