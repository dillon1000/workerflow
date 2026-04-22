import { mergeHeaders } from "./auth";
import { assert } from "./guards";

async function hmacSha256(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function signWebhookPayload(secret: string, payload: string) {
  return hmacSha256(secret, payload);
}

export async function signedWebhookHeaders(
  secret: string,
  payload: string,
  headers?: HeadersInit,
  headerName = "X-Workflow-Signature",
) {
  const signature = await signWebhookPayload(secret, payload);
  return mergeHeaders(headers, {
    [headerName]: signature,
  });
}

export async function verifyWebhookSignature(input: {
  secret: string;
  payload: string;
  signature: string | null;
}) {
  assert(input.signature, "Webhook signature is required.");
  const expected = await signWebhookPayload(input.secret, input.payload);
  assert(
    expected === input.signature,
    "Webhook signature verification failed.",
  );
}
