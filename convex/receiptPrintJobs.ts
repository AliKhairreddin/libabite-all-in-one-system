import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const PRINT_JOB_STATUSES = new Set(["queued", "claimed", "printed", "failed", "cancelled"]);

function cleanText(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function getAppStateDocument(ctx: any, key: string) {
  return await ctx.db
    .query("appStates")
    .withIndex("by_key", (query: any) => query.eq("key", key))
    .first();
}

function normalizeJobs(state: any) {
  return Array.isArray(state?.receiptPrintJobs) ? [...state.receiptPrintJobs] : [];
}

function findJobIndex(jobs: any[], jobId: string) {
  return jobs.findIndex((job) => cleanText(job?.id) === jobId);
}

function patchJob(jobs: any[], jobId: string, patch: Record<string, any>) {
  const index = findJobIndex(jobs, jobId);
  if (index < 0) return null;
  const current = jobs[index];
  const next = {
    ...current,
    ...patch,
    status: PRINT_JOB_STATUSES.has(patch.status) ? patch.status : current.status,
    updatedAtMs: Date.now()
  };
  jobs[index] = next;
  return next;
}

async function saveStateWithJobs(ctx: any, document: any, jobs: any[], eventType: string, payload: any) {
  const state = {
    ...(document.state || {}),
    receiptPrintJobs: jobs
  };
  const now = Date.now();
  const version = (Number(document.version) || 0) + 1;
  await ctx.db.patch(document._id, {
    state,
    version,
    updatedAt: now
  });
  await ctx.db.insert("syncEvents", {
    appStateKey: document.key,
    type: eventType,
    payload: {
      ...payload,
      version
    },
    at: now
  });
  return { state, version, updatedAt: now };
}

export const pending = queryGeneric({
  args: {
    appStateKey: v.string(),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const document = await getAppStateDocument(ctx, args.appStateKey);
    const limit = Math.max(1, Math.min(25, Math.floor(Number(args.limit) || 10)));
    const jobs = normalizeJobs(document?.state)
      .filter((job) => job.status === "queued")
      .slice(0, limit);
    return {
      jobs,
      version: Number(document?.version) || 0,
      updatedAt: Number(document?.updatedAt) || 0
    };
  }
});

export const claimNext = mutationGeneric({
  args: {
    appStateKey: v.string(),
    agentId: v.string()
  },
  handler: async (ctx, args) => {
    const document = await getAppStateDocument(ctx, args.appStateKey);
    if (!document?.state) return { job: null, state: null, message: "App state not found." };

    const agentId = cleanText(args.agentId) || "receipt-printer-agent";
    const jobs = normalizeJobs(document.state);
    const index = jobs.findIndex((job) => {
      const attempts = Math.max(0, Number(job.attemptCount) || 0);
      const maxAttempts = Math.max(1, Number(job.maxAttempts) || 3);
      return job.status === "queued" && attempts < maxAttempts;
    });
    if (index < 0) return { job: null, state: document.state, version: document.version };

    const now = Date.now();
    const current = jobs[index];
    const job = {
      ...current,
      status: "claimed",
      attemptCount: Math.max(0, Number(current.attemptCount) || 0) + 1,
      claimedAtMs: now,
      claimedBy: agentId,
      updatedAtMs: now,
      error: ""
    };
    jobs[index] = job;

    const result = await saveStateWithJobs(ctx, document, jobs, "receipt_print:claimed", {
      jobId: job.id,
      orderId: job.orderId,
      agentId
    });

    return {
      job,
      state: result.state,
      version: result.version,
      updatedAt: result.updatedAt
    };
  }
});

export const complete = mutationGeneric({
  args: {
    appStateKey: v.string(),
    jobId: v.string(),
    agentId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const document = await getAppStateDocument(ctx, args.appStateKey);
    if (!document?.state) return { ok: false, message: "App state not found." };

    const jobs = normalizeJobs(document.state);
    const now = Date.now();
    const job = patchJob(jobs, args.jobId, {
      status: "printed",
      printedAtMs: now,
      error: "",
      claimedBy: cleanText(args.agentId)
    });
    if (!job) return { ok: false, message: "Print job not found." };

    const result = await saveStateWithJobs(ctx, document, jobs, "receipt_print:printed", {
      jobId: job.id,
      orderId: job.orderId,
      agentId: cleanText(args.agentId)
    });
    return { ok: true, job, version: result.version };
  }
});

export const fail = mutationGeneric({
  args: {
    appStateKey: v.string(),
    jobId: v.string(),
    error: v.string(),
    agentId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const document = await getAppStateDocument(ctx, args.appStateKey);
    if (!document?.state) return { ok: false, message: "App state not found." };

    const jobs = normalizeJobs(document.state);
    const index = findJobIndex(jobs, args.jobId);
    if (index < 0) return { ok: false, message: "Print job not found." };

    const current = jobs[index];
    const attemptCount = Math.max(0, Number(current.attemptCount) || 0);
    const maxAttempts = Math.max(1, Number(current.maxAttempts) || 3);
    const retry = attemptCount < maxAttempts;
    const now = Date.now();
    const job = {
      ...current,
      status: retry ? "queued" : "failed",
      failedAtMs: now,
      updatedAtMs: now,
      claimedBy: cleanText(args.agentId) || current.claimedBy || "",
      error: cleanText(args.error) || "Printer failed."
    };
    jobs[index] = job;

    const result = await saveStateWithJobs(ctx, document, jobs, retry ? "receipt_print:retry" : "receipt_print:failed", {
      jobId: job.id,
      orderId: job.orderId,
      agentId: cleanText(args.agentId),
      retry
    });
    return { ok: true, job, retry, version: result.version };
  }
});
