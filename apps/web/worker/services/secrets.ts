import type { WorkerEnv } from "../lib/env";

function buildKey(userId: string, connectionId: string, keyName: string) {
  return `secret:${userId}:${connectionId}:${keyName}`;
}

async function importKey(secret: string) {
  const bytes = new Uint8Array(
    secret.match(/.{1,2}/g)?.map((value) => parseInt(value, 16)) ?? [],
  );
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encrypt(value: string, env: WorkerEnv) {
  if (!env.SECRETS_KEY) {
    return `plain:${value}`;
  }

  const key = await importKey(env.SECRETS_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(value);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  const payload = new Uint8Array(iv.byteLength + cipher.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(cipher), iv.byteLength);
  return `enc:${btoa(String.fromCharCode(...payload))}`;
}

async function decrypt(value: string, env: WorkerEnv) {
  if (value.startsWith("plain:")) {
    return value.slice(6);
  }
  if (!env.SECRETS_KEY || !value.startsWith("enc:")) {
    return null;
  }

  const key = await importKey(env.SECRETS_KEY);
  const combined = Uint8Array.from(atob(value.slice(4)), (char) =>
    char.charCodeAt(0),
  );
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  const decoded = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted,
  );
  return new TextDecoder().decode(decoded);
}

export async function storeSecret(
  env: WorkerEnv,
  userId: string,
  connectionId: string,
  keyName: string,
  value: string,
) {
  await env.SECRETS_KV.put(
    buildKey(userId, connectionId, keyName),
    await encrypt(value, env),
  );
}

export async function getSecret(
  env: WorkerEnv,
  userId: string,
  connectionId: string,
  keyName: string,
) {
  const value = await env.SECRETS_KV.get(
    buildKey(userId, connectionId, keyName),
  );
  if (!value) return null;
  return decrypt(value, env);
}

export async function deleteSecret(
  env: WorkerEnv,
  userId: string,
  connectionId: string,
  keyName: string,
) {
  await env.SECRETS_KV.delete(buildKey(userId, connectionId, keyName));
}
