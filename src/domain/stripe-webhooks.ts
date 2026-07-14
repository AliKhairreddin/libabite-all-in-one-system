const DEFAULT_STRIPE_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function signatureParts(header: string) {
  const values = new Map<string, string[]>();
  String(header || "").split(",").forEach((part) => {
    const separator = part.indexOf("=");
    if (separator <= 0) return;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key || !value) return;
    values.set(key, [...(values.get(key) || []), value]);
  });
  return values;
}

function hexBytes(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(first: Uint8Array, second: Uint8Array) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) difference |= first[index] ^ second[index];
  return difference === 0;
}

export async function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
  options: { nowMs?: number; toleranceSeconds?: number } = {}
) {
  const parts = signatureParts(signatureHeader);
  const timestamp = Number(parts.get("t")?.[0]);
  const signatures = parts.get("v1") || [];
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const toleranceSeconds = Math.max(
    0,
    Math.floor(Number(options.toleranceSeconds) || DEFAULT_STRIPE_SIGNATURE_TOLERANCE_SECONDS)
  );
  if (!Number.isInteger(timestamp) || timestamp <= 0 || !signatures.length || !webhookSecret) {
    return { ok: false as const, reason: "malformed_signature_header" };
  }
  if (Math.abs(Math.floor(nowMs / 1000) - timestamp) > toleranceSeconds) {
    return { ok: false as const, reason: "timestamp_outside_tolerance" };
  }

  try {
    const encoder = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expected = new Uint8Array(await globalThis.crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${timestamp}.${rawBody}`)
    ));
    const matched = signatures.some((signature) => {
      const candidate = hexBytes(signature);
      return candidate ? constantTimeEqual(expected, candidate) : false;
    });
    return matched
      ? { ok: true as const, timestamp }
      : { ok: false as const, reason: "signature_mismatch" };
  } catch {
    return { ok: false as const, reason: "signature_verification_failed" };
  }
}
