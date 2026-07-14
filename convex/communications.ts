import {
  anyApi,
  internalMutationGeneric,
  internalQueryGeneric
} from "convex/server";
import { v } from "convex/values";
import {
  COMMUNICATION_TEMPLATE_VERSION,
  communicationEventIsCurrent,
  getCommunicationTemplateVariables,
  getMarketingConsentEvidence,
  getRecordRecipient,
  hasExplicitMarketingConsent,
  marketingConsentProviderStatusAfterIntegration,
  marketingIntegrationDedupeKey,
  notificationDedupeKey,
  validateCommunicationEvent
} from "../src/domain/communications.js";

const recordTypeValidator = v.union(v.literal("order"), v.literal("reservation"));
const eventTypeValidator = v.union(
  v.literal("order.received"),
  v.literal("order.confirmed"),
  v.literal("order.ready"),
  v.literal("order.out_for_delivery"),
  v.literal("order.delivered"),
  v.literal("order.cancelled"),
  v.literal("order.refunded"),
  v.literal("order.payment_failed"),
  v.literal("reservation.request_received"),
  v.literal("reservation.confirmed"),
  v.literal("reservation.rescheduled"),
  v.literal("reservation.reminder"),
  v.literal("reservation.declined"),
  v.literal("reservation.cancelled")
);

const MAX_IDENTIFIER_LENGTH = 200;
const PROCESSING_LEASE_MS = 15 * 60 * 1000;

function cleanText(value: unknown, maxLength = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function requiredIdentifier(value: unknown, label: string) {
  const identifier = cleanText(value, MAX_IDENTIFIER_LENGTH);
  if (!identifier) throw new Error(`${label} is required.`);
  return identifier;
}

async function getOperationalRecord(ctx: any, appStateKey: string, recordType: "order" | "reservation", recordId: string) {
  const table = recordType === "order" ? "orders" : "reservations";
  return await ctx.db
    .query(table)
    .withIndex("by_app_external", (query: any) => query.eq("appStateKey", appStateKey).eq("externalId", recordId))
    .first();
}

async function getRestaurantName(ctx: any, appStateKey: string) {
  const profile = await ctx.db
    .query("restaurantProfiles")
    .withIndex("by_app_state", (query: any) => query.eq("appStateKey", appStateKey))
    .first();
  return cleanText(profile?.restaurantName) || "Libabite";
}

function retryDelayMs(attemptCount: number) {
  return Math.min(15 * 60 * 1000, 15_000 * (2 ** Math.max(0, attemptCount - 1)));
}

async function scheduleNotification(ctx: any, jobId: any, delayMs = 0) {
  await ctx.scheduler.runAfter(
    Math.max(0, Math.floor(delayMs)),
    anyApi.communicationsWorker.processNotificationJob as any,
    { jobId }
  );
}

async function scheduleIntegration(ctx: any, jobId: any, delayMs = 0) {
  await ctx.scheduler.runAfter(
    Math.max(0, Math.floor(delayMs)),
    anyApi.communicationsWorker.processIntegrationJob as any,
    { jobId }
  );
}

/**
 * Trusted internal communications entry point. Recipient, consent, template, and
 * content are always derived from the stored operational record on the server.
 */
export const queueRecordEvent = internalMutationGeneric({
  args: {
    appStateKey: v.string(),
    recordType: recordTypeValidator,
    recordId: v.string(),
    eventType: eventTypeValidator
  },
  handler: async (ctx, args) => {
    const appStateKey = requiredIdentifier(args.appStateKey, "appStateKey");
    const recordId = requiredIdentifier(args.recordId, "recordId");
    const record = await getOperationalRecord(ctx, appStateKey, args.recordType, recordId);
    if (!record) throw new Error(`Stored ${args.recordType} not found.`);

    const validation = validateCommunicationEvent(args.recordType, args.eventType, record);
    if (!validation.ok) throw new Error(validation.reason);

    const recipient = getRecordRecipient(args.recordType, record);
    if (!recipient.email) {
      return {
        status: "skipped",
        reason: "stored_record_has_no_valid_email",
        notificationJobId: null,
        integrationJobId: null
      };
    }

    const now = Date.now();
    const dedupeKey = notificationDedupeKey(
      appStateKey,
      args.recordType,
      recordId,
      args.eventType,
      record
    );
    let notificationJob = await ctx.db
      .query("notificationOutbox")
      .withIndex("by_dedupe", (query: any) => query.eq("dedupeKey", dedupeKey))
      .first();
    let notificationCreated = false;

    if (!notificationJob) {
      const restaurantName = await getRestaurantName(ctx, appStateKey);
      const notificationJobId = await ctx.db.insert("notificationOutbox", {
        appStateKey,
        dedupeKey,
        recordType: args.recordType,
        recordId,
        eventType: args.eventType,
        recipientEmail: recipient.email,
        ...(recipient.name ? { recipientName: recipient.name } : {}),
        provider: "configured_transactional_email",
        templateKey: args.eventType,
        templateVersion: COMMUNICATION_TEMPLATE_VERSION,
        templateVariables: getCommunicationTemplateVariables(args.recordType, recordId, record, restaurantName),
        status: "queued",
        attemptCount: 0,
        maxAttempts: 5,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now
      });
      notificationJob = await ctx.db.get(notificationJobId);
      notificationCreated = true;
      await scheduleNotification(ctx, notificationJobId);
    } else if (["queued", "retry"].includes(notificationJob.status)) {
      await scheduleNotification(ctx, notificationJob._id, Math.max(0, notificationJob.nextAttemptAt - now));
    }

    let integrationJob: any = null;
    let integrationCreated = false;
    if (hasExplicitMarketingConsent(record)) {
      const evidence = getMarketingConsentEvidence(record);
      const existingConsent = await ctx.db
        .query("marketingConsents")
        .withIndex("by_app_email", (query: any) => query.eq("appStateKey", appStateKey).eq("email", recipient.email))
        .first();
      const consentedAt = evidence.consentedAt || existingConsent?.consentedAt || now;
      if (existingConsent) {
        await ctx.db.patch(existingConsent._id, {
          explicitConsent: true,
          sourceRecordType: args.recordType,
          sourceRecordId: recordId,
          consentedAt,
          ...(evidence.policyVersion ? { policyVersion: evidence.policyVersion } : {}),
          updatedAt: now
        });
      } else {
        await ctx.db.insert("marketingConsents", {
          appStateKey,
          email: recipient.email,
          explicitConsent: true,
          sourceRecordType: args.recordType,
          sourceRecordId: recordId,
          consentedAt,
          ...(evidence.policyVersion ? { policyVersion: evidence.policyVersion } : {}),
          updatedAt: now
        });
      }

      const previousOptInJob = await ctx.db
        .query("integrationOutbox")
        .withIndex("by_app_email", (query: any) => query.eq("appStateKey", appStateKey).eq("recipientEmail", recipient.email))
        .filter((query: any) => query.eq(query.field("explicitMarketingConsent"), true))
        .order("desc")
        .first();
      const recordedProviderStatus = cleanText(existingConsent?.mailchimpStatus).toLowerCase();
      const optInAlreadyActive = ["pending", "subscribed"].includes(recordedProviderStatus)
        || ["queued", "retry", "processing", "completed"].includes(cleanText(previousOptInJob?.status).toLowerCase());

      const integrationDedupeKey = marketingIntegrationDedupeKey(
        appStateKey,
        args.recordType,
        recordId,
        recipient.email,
        evidence.policyVersion,
        true
      );
      integrationJob = optInAlreadyActive
        ? previousOptInJob
        : await ctx.db
            .query("integrationOutbox")
            .withIndex("by_dedupe", (query: any) => query.eq("dedupeKey", integrationDedupeKey))
            .first();
      if (!integrationJob) {
        const integrationJobId = await ctx.db.insert("integrationOutbox", {
          appStateKey,
          dedupeKey: integrationDedupeKey,
          integration: "mailchimp_contact",
          operation: "upsert_pending_contact",
          recordType: args.recordType,
          recordId,
          recipientEmail: recipient.email,
          ...(recipient.name ? { recipientName: recipient.name } : {}),
          explicitMarketingConsent: true,
          ...(evidence.consentedAt ? { consentedAt: evidence.consentedAt } : {}),
          ...(evidence.policyVersion ? { consentPolicyVersion: evidence.policyVersion } : {}),
          status: "queued",
          attemptCount: 0,
          maxAttempts: 5,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now
        });
        integrationJob = await ctx.db.get(integrationJobId);
        integrationCreated = true;
        await scheduleIntegration(ctx, integrationJobId);
      } else if (["queued", "retry"].includes(integrationJob.status)) {
        await scheduleIntegration(ctx, integrationJob._id, Math.max(0, integrationJob.nextAttemptAt - now));
      }
    }

    if (!integrationJob && !hasExplicitMarketingConsent(record)) {
      const integrationDedupeKey = marketingIntegrationDedupeKey(
        appStateKey,
        args.recordType,
        recordId,
        recipient.email,
        "",
        false
      );
      integrationJob = await ctx.db
        .query("integrationOutbox")
        .withIndex("by_dedupe", (query: any) => query.eq("dedupeKey", integrationDedupeKey))
        .first();
      if (!integrationJob) {
        const integrationJobId = await ctx.db.insert("integrationOutbox", {
          appStateKey,
          dedupeKey: integrationDedupeKey,
          integration: "mailchimp_contact",
          operation: "upsert_transactional_contact",
          recordType: args.recordType,
          recordId,
          recipientEmail: recipient.email,
          ...(recipient.name ? { recipientName: recipient.name } : {}),
          explicitMarketingConsent: false,
          status: "queued",
          attemptCount: 0,
          maxAttempts: 5,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now
        });
        integrationJob = await ctx.db.get(integrationJobId);
        integrationCreated = true;
        await scheduleIntegration(ctx, integrationJobId);
      } else if (["queued", "retry"].includes(integrationJob.status)) {
        await scheduleIntegration(ctx, integrationJob._id, Math.max(0, integrationJob.nextAttemptAt - now));
      }
    }

    return {
      status: notificationCreated ? "queued" : "existing",
      notificationJobId: notificationJob?._id || null,
      notificationStatus: notificationJob?.status || "unknown",
      integrationJobId: integrationJob?._id || null,
      integrationStatus: integrationJob?.status || "unknown",
      integrationCreated
    };
  }
});

export const claimNotificationJob = internalMutationGeneric({
  args: { jobId: v.id("notificationOutbox") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    const now = Date.now();
    const processingIsStale = job.status === "processing"
      && Number(job.lastAttemptAt || 0) + PROCESSING_LEASE_MS <= now;
    if (!["queued", "retry"].includes(job.status) && !processingIsStale) return null;
    if (job.nextAttemptAt > now) {
      await scheduleNotification(ctx, job._id, job.nextAttemptAt - now);
      return null;
    }
    if (job.attemptCount >= job.maxAttempts) {
      await ctx.db.patch(job._id, { status: "failed", error: "Maximum attempts reached.", updatedAt: now });
      return null;
    }
    const attemptCount = job.attemptCount + 1;
    await ctx.db.patch(job._id, {
      status: "processing",
      attemptCount,
      lastAttemptAt: now,
      error: undefined,
      updatedAt: now
    });
    await scheduleNotification(ctx, job._id, PROCESSING_LEASE_MS);
    return { ...job, status: "processing", attemptCount, lastAttemptAt: now, updatedAt: now };
  }
});

export const completeNotificationJob = internalMutationGeneric({
  args: {
    jobId: v.id("notificationOutbox"),
    provider: v.string(),
    providerMessageId: v.optional(v.string()),
    providerStatus: v.string()
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "processing") return { ok: false };
    const now = Date.now();
    await ctx.db.patch(job._id, {
      provider: cleanText(args.provider, 100),
      ...(args.providerMessageId ? { providerMessageId: cleanText(args.providerMessageId, 300) } : {}),
      providerStatus: cleanText(args.providerStatus, 100),
      status: "accepted",
      error: undefined,
      acceptedAt: now,
      updatedAt: now
    });
    return { ok: true };
  }
});

export const notificationJobIsCurrent = internalQueryGeneric({
  args: { jobId: v.id("notificationOutbox") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return false;
    const record = await getOperationalRecord(ctx, job.appStateKey, job.recordType as "order" | "reservation", job.recordId);
    if (!record) return false;
    const recordType = job.recordType as "order" | "reservation";
    const recipientMatches = getRecordRecipient(recordType, record).email === job.recipientEmail;
    return recipientMatches && communicationEventIsCurrent(
      job.appStateKey,
      recordType,
      job.recordId,
      job.eventType,
      record,
      job.dedupeKey,
      job.templateVariables
    );
  }
});

export const suppressNotificationJob = internalMutationGeneric({
  args: { jobId: v.id("notificationOutbox"), reason: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "processing") return { ok: false };
    await ctx.db.patch(job._id, {
      status: "suppressed",
      error: cleanText(args.reason, 1_000) || "The stored recipient or event is no longer current.",
      updatedAt: Date.now()
    });
    return { ok: true };
  }
});

export const failNotificationJob = internalMutationGeneric({
  args: {
    jobId: v.id("notificationOutbox"),
    error: v.string(),
    retryable: v.boolean()
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "processing") return { ok: false, retry: false };
    const now = Date.now();
    const retry = args.retryable && job.attemptCount < job.maxAttempts;
    const delayMs = retry ? retryDelayMs(job.attemptCount) : 0;
    await ctx.db.patch(job._id, {
      status: retry ? "retry" : "failed",
      error: cleanText(args.error, 1_000) || "Transactional email failed.",
      nextAttemptAt: retry ? now + delayMs : now,
      updatedAt: now
    });
    if (retry) await scheduleNotification(ctx, job._id, delayMs);
    return { ok: true, retry };
  }
});

export const claimIntegrationJob = internalMutationGeneric({
  args: { jobId: v.id("integrationOutbox") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    const now = Date.now();
    const processingIsStale = job.status === "processing"
      && Number(job.lastAttemptAt || 0) + PROCESSING_LEASE_MS <= now;
    if (!["queued", "retry"].includes(job.status) && !processingIsStale) return null;
    if (job.nextAttemptAt > now) {
      await scheduleIntegration(ctx, job._id, job.nextAttemptAt - now);
      return null;
    }
    if (job.attemptCount >= job.maxAttempts) {
      await ctx.db.patch(job._id, { status: "failed", error: "Maximum attempts reached.", updatedAt: now });
      return null;
    }
    const attemptCount = job.attemptCount + 1;
    await ctx.db.patch(job._id, {
      status: "processing",
      attemptCount,
      lastAttemptAt: now,
      error: undefined,
      updatedAt: now
    });
    await scheduleIntegration(ctx, job._id, PROCESSING_LEASE_MS);
    return { ...job, status: "processing", attemptCount, lastAttemptAt: now, updatedAt: now };
  }
});

export const integrationConsentIsCurrent = internalQueryGeneric({
  args: { jobId: v.id("integrationOutbox") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return false;
    const record = await getOperationalRecord(ctx, job.appStateKey, job.recordType as "order" | "reservation", job.recordId);
    if (!record) return false;
    const recipient = getRecordRecipient(job.recordType as "order" | "reservation", record);
    if (recipient.email !== job.recipientEmail) return false;
    if (job.explicitMarketingConsent !== true) return true;
    if (!hasExplicitMarketingConsent(record)) return false;
    const consent = await ctx.db
      .query("marketingConsents")
      .withIndex("by_app_email", (query: any) => query.eq("appStateKey", job.appStateKey).eq("email", job.recipientEmail))
      .first();
    return consent?.explicitConsent === true;
  }
});

export const completeIntegrationJob = internalMutationGeneric({
  args: {
    jobId: v.id("integrationOutbox"),
    providerRecordId: v.optional(v.string()),
    providerStatus: v.string()
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "processing") return { ok: false };
    const now = Date.now();
    const providerStatus = cleanText(args.providerStatus, 100);
    await ctx.db.patch(job._id, {
      ...(args.providerRecordId ? { providerRecordId: cleanText(args.providerRecordId, 300) } : {}),
      providerStatus,
      status: "completed",
      error: undefined,
      completedAt: now,
      updatedAt: now
    });
    const consent = await ctx.db
      .query("marketingConsents")
      .withIndex("by_app_email", (query: any) => query.eq("appStateKey", job.appStateKey).eq("email", job.recipientEmail))
      .first();
    if (consent) {
      const mailchimpStatus = marketingConsentProviderStatusAfterIntegration(
        consent.mailchimpStatus,
        providerStatus,
        job.explicitMarketingConsent === true
      );
      if (mailchimpStatus !== cleanText(consent.mailchimpStatus, 100)) {
        await ctx.db.patch(consent._id, { mailchimpStatus, updatedAt: now });
      }
    }
    return { ok: true };
  }
});

export const suppressIntegrationJob = internalMutationGeneric({
  args: { jobId: v.id("integrationOutbox"), reason: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "processing") return { ok: false };
    await ctx.db.patch(job._id, {
      status: "suppressed",
      error: cleanText(args.reason, 1_000) || "Marketing consent is no longer current.",
      updatedAt: Date.now()
    });
    return { ok: true };
  }
});

export const failIntegrationJob = internalMutationGeneric({
  args: {
    jobId: v.id("integrationOutbox"),
    error: v.string(),
    retryable: v.boolean()
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "processing") return { ok: false, retry: false };
    const now = Date.now();
    const retry = args.retryable && job.attemptCount < job.maxAttempts;
    const delayMs = retry ? retryDelayMs(job.attemptCount) : 0;
    await ctx.db.patch(job._id, {
      status: retry ? "retry" : "failed",
      error: cleanText(args.error, 1_000) || "Mailchimp Marketing sync failed.",
      nextAttemptAt: retry ? now + delayMs : now,
      updatedAt: now
    });
    if (retry) await scheduleIntegration(ctx, job._id, delayMs);
    return { ok: true, retry };
  }
});
