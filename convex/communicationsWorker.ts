"use node";

import { anyApi, internalActionGeneric } from "convex/server";
import { v } from "convex/values";
import {
  buildTransactionalMessage,
  isCommunicationEventType
} from "../src/domain/communications.js";
import {
  CommunicationProviderError,
  sendTransactionalEmail,
  syncMarketingContact
} from "./mailchimpAdapters.js";

function cleanError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 1_000);
  return String(error || "Unknown communication provider error.").slice(0, 1_000);
}

function isRetryable(error: unknown) {
  return error instanceof CommunicationProviderError ? error.retryable : true;
}

export const processNotificationJob = internalActionGeneric({
  args: { jobId: v.id("notificationOutbox") },
  handler: async (ctx, args) => {
    const job: any = await ctx.runMutation(anyApi.communications.claimNotificationJob as any, {
      jobId: args.jobId
    });
    if (!job) return { status: "not_claimed" };

    const jobIsCurrent = await ctx.runQuery(anyApi.communications.notificationJobIsCurrent as any, {
      jobId: args.jobId
    });
    if (!jobIsCurrent) {
      await ctx.runMutation(anyApi.communications.suppressNotificationJob as any, {
        jobId: args.jobId,
        reason: "The stored record recipient or lifecycle details changed before delivery."
      });
      return { status: "suppressed" };
    }

    try {
      if (!isCommunicationEventType(job.templateKey) || job.templateKey !== job.eventType) {
        throw new CommunicationProviderError("Notification job has an unsupported server template.", false);
      }
      const message = buildTransactionalMessage(job.templateKey, job.templateVariables);
      const result = await sendTransactionalEmail({
        toEmail: job.recipientEmail,
        toName: job.recipientName,
        subject: message.subject,
        text: message.text,
        html: message.html,
        dedupeKey: job.dedupeKey,
        recordType: job.recordType,
        recordId: job.recordId,
        eventType: job.eventType
      });
      await ctx.runMutation(anyApi.communications.completeNotificationJob as any, {
        jobId: args.jobId,
        provider: result.provider,
        ...(result.providerMessageId ? { providerMessageId: result.providerMessageId } : {}),
        providerStatus: result.providerStatus
      });
      return { status: "accepted", providerStatus: result.providerStatus };
    } catch (error) {
      await ctx.runMutation(anyApi.communications.failNotificationJob as any, {
        jobId: args.jobId,
        error: cleanError(error),
        retryable: isRetryable(error)
      });
      return { status: "failed", retryable: isRetryable(error) };
    }
  }
});

export const processIntegrationJob = internalActionGeneric({
  args: { jobId: v.id("integrationOutbox") },
  handler: async (ctx, args) => {
    const job: any = await ctx.runMutation(anyApi.communications.claimIntegrationJob as any, {
      jobId: args.jobId
    });
    if (!job) return { status: "not_claimed" };

    const consentIsCurrent = await ctx.runQuery(anyApi.communications.integrationConsentIsCurrent as any, {
      jobId: args.jobId
    });
    if (!consentIsCurrent) {
      await ctx.runMutation(anyApi.communications.suppressIntegrationJob as any, {
        jobId: args.jobId,
        reason: "The stored record no longer contains explicit marketing consent for this email."
      });
      return { status: "suppressed" };
    }

    try {
      if (job.integration !== "mailchimp_contact" || !["upsert_pending_contact", "upsert_transactional_contact"].includes(job.operation)) {
        throw new CommunicationProviderError("Integration job has an unsupported server operation.", false);
      }
      if (job.operation === "upsert_pending_contact" && job.explicitMarketingConsent !== true) {
        throw new CommunicationProviderError("Explicit marketing consent is required for Mailchimp Marketing sync.", false);
      }
      const result = await syncMarketingContact({
        email: job.recipientEmail,
        name: job.recipientName,
        dedupeKey: job.dedupeKey,
        explicitConsent: job.explicitMarketingConsent === true
      });
      await ctx.runMutation(anyApi.communications.completeIntegrationJob as any, {
        jobId: args.jobId,
        ...(result.providerRecordId ? { providerRecordId: result.providerRecordId } : {}),
        providerStatus: result.providerStatus
      });
      return { status: "completed", providerStatus: result.providerStatus };
    } catch (error) {
      await ctx.runMutation(anyApi.communications.failIntegrationJob as any, {
        jobId: args.jobId,
        error: cleanError(error),
        retryable: isRetryable(error)
      });
      return { status: "failed", retryable: isRetryable(error) };
    }
  }
});
