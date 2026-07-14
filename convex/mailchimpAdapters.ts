"use node";

import { createHash } from "node:crypto";

export type TransactionalEmailInput = {
  toEmail: string;
  toName?: string;
  subject: string;
  text: string;
  html: string;
  dedupeKey: string;
  recordType: string;
  recordId: string;
  eventType: string;
};

export type MarketingContactInput = {
  email: string;
  name?: string;
  dedupeKey: string;
  explicitConsent: boolean;
};

export class CommunicationProviderError extends Error {
  retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = "CommunicationProviderError";
    this.retryable = retryable;
  }
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function env(name: string) {
  return cleanText(process.env[name]);
}

function requiredEnv(name: string) {
  const value = env(name);
  if (!value) throw new CommunicationProviderError(`Missing ${name} in the Convex environment.`, false);
  return value;
}

function errorMessage(payload: any, fallback: string) {
  return cleanText(
    payload?.detail
      || payload?.title
      || payload?.message
      || payload?.error
      || payload?.reject_reason
      || fallback
  );
}

function retryableHttpStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function responsePayload(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

export function mailchimpSubscriberHash(email: string) {
  return createHash("md5").update(cleanText(email).toLowerCase()).digest("hex");
}

export async function sendMailchimpTransactional(input: TransactionalEmailInput) {
  const apiKey = requiredEnv("MAILCHIMP_TRANSACTIONAL_API_KEY");
  const fromEmail = requiredEnv("MAILCHIMP_TRANSACTIONAL_FROM_EMAIL");
  const fromName = env("MAILCHIMP_TRANSACTIONAL_FROM_NAME") || "Libabite";
  const replyTo = env("MAILCHIMP_TRANSACTIONAL_REPLY_TO");
  let response: Response;

  try {
    response = await fetch("https://mandrillapp.com/api/1.0/messages/send.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: apiKey,
        message: {
          from_email: fromEmail,
          from_name: fromName,
          subject: input.subject,
          text: input.text,
          html: input.html,
          to: [{ email: input.toEmail, name: input.toName || undefined, type: "to" }],
          ...(replyTo ? { headers: { "Reply-To": replyTo } } : {}),
          metadata: {
            dedupe_key: input.dedupeKey,
            record_type: input.recordType,
            record_id: input.recordId,
            event_type: input.eventType
          },
          tags: [input.recordType === "reservation" ? "reservation" : "order"]
        },
        async: false
      }),
      signal: AbortSignal.timeout(15_000)
    });
  } catch (error) {
    throw new CommunicationProviderError(`Mailchimp Transactional request failed: ${errorMessage(error, "network error")}`, true);
  }

  const payload = await responsePayload(response);
  if (!response.ok) {
    throw new CommunicationProviderError(
      `Mailchimp Transactional rejected the message: ${errorMessage(payload, `HTTP ${response.status}`)}`,
      retryableHttpStatus(response.status)
    );
  }

  const result = Array.isArray(payload) ? payload[0] : payload;
  const status = cleanText(result?.status).toLowerCase();
  if (!["sent", "queued", "scheduled"].includes(status)) {
    throw new CommunicationProviderError(
      `Mailchimp Transactional did not accept the message: ${errorMessage(result, status || "unknown status")}`,
      false
    );
  }

  return {
    provider: "mailchimp_transactional",
    providerMessageId: cleanText(result?._id),
    providerStatus: status
  };
}

function mailchimpServerPrefix(apiKey: string) {
  const configured = env("MAILCHIMP_MARKETING_SERVER_PREFIX").toLowerCase();
  if (configured) return configured;
  const suffix = apiKey.split("-").at(-1)?.toLowerCase() || "";
  if (/^[a-z]{2}\d+$/.test(suffix)) return suffix;
  throw new CommunicationProviderError("Missing MAILCHIMP_MARKETING_SERVER_PREFIX in the Convex environment.", false);
}

function splitContactName(value: string | undefined) {
  const parts = cleanText(value).split(" ").filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ")
  };
}

async function mailchimpMarketingRequest(url: string, apiKey: string, options: { method: string; body: Record<string, unknown> }) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers: {
        Authorization: `Basic ${Buffer.from(`libabite:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(options.body),
      signal: AbortSignal.timeout(15_000)
    });
  } catch (error) {
    throw new CommunicationProviderError(`Mailchimp Marketing request failed: ${errorMessage(error, "network error")}`, true);
  }

  const payload = await responsePayload(response);
  if (!response.ok) {
    throw new CommunicationProviderError(
      `Mailchimp Marketing rejected the contact sync: ${errorMessage(payload, `HTTP ${response.status}`)}`,
      retryableHttpStatus(response.status)
    );
  }
  return payload;
}

export async function upsertMailchimpContact(input: MarketingContactInput) {
  const apiKey = requiredEnv("MAILCHIMP_MARKETING_API_KEY");
  const audienceId = requiredEnv("MAILCHIMP_MARKETING_AUDIENCE_ID");
  const storeId = requiredEnv("MAILCHIMP_MARKETING_STORE_ID");
  const serverPrefix = mailchimpServerPrefix(apiKey);
  const subscriberHash = mailchimpSubscriberHash(input.email);
  const customerId = createHash("sha256").update(input.email).digest("hex").slice(0, 40);
  const { firstName, lastName } = splitContactName(input.name);
  const customerUrl = `https://${serverPrefix}.api.mailchimp.com/3.0/ecommerce/stores/${encodeURIComponent(storeId)}/customers/${customerId}`;
  const customer = await mailchimpMarketingRequest(customerUrl, apiKey, {
    method: "PUT",
    body: {
      id: customerId,
      email_address: input.email,
      opt_in_status: false,
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {})
    }
  });

  // Mailchimp's documented double-opt-in sequence is transactional first,
  // followed by `pending`. Never set `subscribed` from this integration.
  if (input.explicitConsent) {
    const memberUrl = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${encodeURIComponent(audienceId)}/members/${subscriberHash}`;
    const member = await mailchimpMarketingRequest(memberUrl, apiKey, {
      method: "PATCH",
      body: { status: "pending" }
    });
    return {
      provider: "mailchimp_marketing",
      providerRecordId: cleanText(member?.id) || subscriberHash,
      providerStatus: cleanText(member?.status) || "pending"
    };
  }

  return {
    provider: "mailchimp_marketing",
    providerRecordId: cleanText(customer?.id) || customerId,
    providerStatus: "transactional"
  };
}

export async function sendTransactionalEmail(input: TransactionalEmailInput) {
  const provider = (env("TRANSACTIONAL_EMAIL_PROVIDER") || "mailchimp_transactional").toLowerCase();
  if (provider === "mailchimp" || provider === "mailchimp_transactional") {
    return await sendMailchimpTransactional(input);
  }
  throw new CommunicationProviderError(`Unsupported TRANSACTIONAL_EMAIL_PROVIDER: ${provider}`, false);
}

export async function syncMarketingContact(input: MarketingContactInput) {
  return await upsertMailchimpContact(input);
}
