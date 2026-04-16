async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function hmac(secret: string, input: string) {
  const key = await importHmacKey(secret);
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(signed))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function verifyGithubSignature(
  secret: string,
  body: string,
  header?: string | null,
) {
  if (!header?.startsWith("sha256=")) return false;
  const digest = await hmac(secret, body);
  return timingSafeEqual(digest, header.slice("sha256=".length));
}

export async function verifyLinearSignature(
  secret: string,
  body: string,
  header?: string | null,
  timestamp?: string | number,
) {
  if (!header || !timestamp) return false;
  const digest = await hmac(secret, `${timestamp}.${body}`);
  return timingSafeEqual(digest, header);
}
