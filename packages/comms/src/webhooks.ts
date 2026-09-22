import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Twilio request validation: base64(HMAC-SHA1(authToken, url + concat(sorted key+value of POST params))).
 * `url` must be the exact public URL Twilio called (scheme, host, path, query).
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function verifyTwilio(authToken: string, url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!signature) return false;
  return safeEqual(twilioSignature(authToken, url, params), signature);
}

/**
 * Svix-style signatures (used by Resend webhooks): HMAC-SHA256 over `${id}.${timestamp}.${body}` with the
 * base64 key after "whsec_"; header "svix-signature" holds space-separated "v1,<base64>" entries.
 */
export function svixSignature(secret: string, id: string, timestamp: string, body: string): string {
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`, "utf8").digest("base64");
}

export function verifySvix(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  now: Date = new Date(),
  toleranceSec = 300,
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now.getTime() / 1000 - ts) > toleranceSec) return false;
  const expected = svixSignature(secret, id, timestamp, body);
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    return version === "v1" && sig !== undefined && safeEqual(sig, expected);
  });
}
