import {
  actionGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric
} from "convex/server";
import { v } from "convex/values";
import { anyApi } from "convex/server";
import { mirrorOperationalTables } from "./operationalSync";
import {
  paymentRequiresReconciliation,
  shouldQueuePaymentConfirmation
} from "../src/domain/payments.js";

declare const process: {
  env: Record<string, string | undefined>;
};

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const MOLLIE_API_BASE = "https://api.mollie.com/v2";
const STRIPE_NL_PAYMENT_METHOD_TYPES = ["ideal", "card"];
const DEFAULT_CUSTOMER_SITE_URL = "https://libabite-order.thatcanadian.dev";

function cleanText(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripeSecretKey() {
  return cleanText(process.env.STRIPE_SECRET_KEY);
}

function mollieApiKey() {
  return cleanText(process.env.MOLLIE_API_KEY);
}

function customerSiteUrl() {
  const configured = cleanText(process.env.CUSTOMER_SITE_URL);
  if (!configured) return DEFAULT_CUSTOMER_SITE_URL;
  try {
    const url = new URL(configured);
    const isLocalHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !isLocalHttp) {
      return DEFAULT_CUSTOMER_SITE_URL;
    }
    return url.origin;
  } catch {
    return DEFAULT_CUSTOMER_SITE_URL;
  }
}

function paymentReturnUrl(orderId: string, result: "success" | "cancelled", provider: "stripe" | "mollie") {
  const url = new URL(customerSiteUrl());
  url.searchParams.set("order", "website");
  url.searchParams.set("payment", result);
  url.searchParams.set("provider", provider);
  url.searchParams.set("orderId", orderId);
  return url.toString();
}

function stripeId(value: any) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.id === "string") return value.id;
  return "";
}

function orderLabel(order: any) {
  return `Libabite order #${cleanText(order?.number) || cleanText(order?.id) || "online"}`;
}

function orderDescription(order: any) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const itemCount = items.reduce((sum: number, item: any) => sum + Math.max(0, Number(item?.quantity) || 0), 0);
  const fulfillment = cleanText(order?.fulfillment);
  return [itemCount ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : "", fulfillment].filter(Boolean).join(" - ");
}

function appendStripeSessionPlaceholder(successUrl: string) {
  const url = new URL(successUrl);
  if (!url.searchParams.get("session_id")) {
    url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  }
  return url.toString().replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}");
}

async function stripeRequest(path: string, options: { method?: string; body?: URLSearchParams; idempotencyKey?: string } = {}) {
  const secretKey = stripeSecretKey();
  if (!secretKey) {
    return {
      ok: false,
      message: "Stripe checkout is missing STRIPE_SECRET_KEY in Convex."
    };
  }

  let response: Response;
  try {
    response = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
        ...(options.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
      },
      body: options.body,
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    return { ok: false, message: "Stripe could not be reached. Please try again." };
  }
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      message: cleanText(payload?.error?.message) || "Stripe rejected the checkout request."
    };
  }

  return { ok: true, payload };
}

async function mollieRequest(path: string, options: { method?: string; body?: Record<string, any>; idempotencyKey?: string } = {}) {
  const apiKey = mollieApiKey();
  if (!apiKey) {
    return {
      ok: false,
      message: "Mollie checkout is missing MOLLIE_API_KEY in Convex."
    };
  }

  let response: Response;
  try {
    response = await fetch(`${MOLLIE_API_BASE}${path}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    return { ok: false, message: "Mollie could not be reached. Please try again." };
  }
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      message: cleanText(payload?.detail || payload?.title || payload?.message) || "Mollie rejected the payment request."
    };
  }

  return { ok: true, payload };
}

function getOrderFromState(state: any, orderId: string) {
  return (Array.isArray(state?.orders) ? state.orders : []).find((order: any) => cleanText(order?.id) === orderId) || null;
}

function orderAmountCentsFromState(state: any, order: any) {
  const products = new Map(
    (Array.isArray(state?.products) ? state.products : []).map((product: any) => [cleanText(product?.id), product])
  );
  return (Array.isArray(order?.items) ? order.items : []).reduce((sum: number, item: any) => {
    const product: any = products.get(cleanText(item?.productId));
    const quantity = Math.max(0, Math.floor(Number(item?.quantity) || 0));
    const storedUnitCents = Number(item?.unitPriceCents);
    const unitCents = Number.isInteger(storedUnitCents) && storedUnitCents >= 0
      ? storedUnitCents
      : Math.max(0, Math.round((Number(product?.price) || 0) * 100));
    return sum + (unitCents * quantity);
  }, 0);
}

function isEligibleWebsiteCheckoutOrder(order: any) {
  const channel = cleanText(order?.channel || order?.orderType);
  const status = cleanText(order?.status);
  const paymentStatus = cleanText(order?.paymentStatus);
  return channel === "Website order"
    && status === "New"
    && cleanText(order?.paymentMethod) === "Online payment"
    && ["Unpaid", "Pending", "Failed", "Cancelled"].includes(paymentStatus || "Unpaid");
}

function isRecordedWebsiteCheckoutOrder(order: any) {
  const channel = cleanText(order?.channel || order?.orderType);
  return channel === "Website order"
    && cleanText(order?.paymentMethod) === "Online payment"
    && Boolean(cleanText(order?.stripeCheckoutSessionId || order?.paymentReference));
}

function checkoutCurrency(state: any) {
  const currency = cleanText(state?.restaurantSettings?.currency).toLowerCase();
  return /^[a-z]{3}$/.test(currency) ? currency : "eur";
}

export const getCheckoutOrder = internalQueryGeneric({
  args: {
    appStateKey: v.string(),
    orderId: v.string()
  },
  handler: async (ctx, args) => {
    const appStateKey = cleanText(args.appStateKey);
    const orderId = cleanText(args.orderId);
    const document = await ctx.db
      .query("appStates")
      .withIndex("by_key", (query: any) => query.eq("key", appStateKey))
      .first();
    const order = getOrderFromState(document?.state, orderId);
    if (!document || !order) return null;

    return {
      appStateKey,
      order,
      amountCents: orderAmountCentsFromState(document.state, order),
      currency: checkoutCurrency(document.state)
    };
  }
});

async function patchOrderState(ctx: any, args: {
  appStateKey: string;
  orderId: string;
  patch: Record<string, any>;
  eventType: string;
}) {
  const existing = await ctx.db
    .query("appStates")
    .withIndex("by_key", (query: any) => query.eq("key", args.appStateKey))
    .first();
  if (!existing?.state || typeof existing.state !== "object") return null;

  const state = {
    ...existing.state,
    orders: Array.isArray(existing.state.orders) ? [...existing.state.orders] : []
  };
  const index = state.orders.findIndex((item: any) => item?.id === args.orderId);
  if (index < 0) return null;
  const baseOrder = state.orders[index];
  const nextOrder = {
    ...baseOrder,
    ...args.patch
  };

  state.orders[index] = nextOrder;
  state.websiteLastOrderId = args.orderId;
  state.receiptOrderId = args.orderId;

  const now = Date.now();
  const nextVersion = (Number(existing.version) || 0) + 1;
  await ctx.db.patch(existing._id, {
    state,
    version: nextVersion,
    updatedAt: now
  });
  await ctx.db.insert("syncEvents", {
    appStateKey: args.appStateKey,
    type: args.eventType,
    payload: {
      orderId: args.orderId,
      version: nextVersion
    },
    at: now
  });
  await mirrorOperationalTables(ctx, args.appStateKey, state, now);

  return { state, order: nextOrder, version: nextVersion, updatedAt: now };
}

export const markCheckoutSessionStarted = internalMutationGeneric({
  args: {
    appStateKey: v.string(),
    orderId: v.string(),
    checkoutSessionId: v.string(),
    checkoutUrl: v.string(),
    provider: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    amountCents: v.number(),
    currency: v.string(),
    attempt: v.number()
  },
  handler: async (ctx, args) => {
    const orderId = cleanText(args.orderId);
    if (!orderId) return null;

    const existing = await ctx.db
      .query("appStates")
      .withIndex("by_key", (query: any) => query.eq("key", args.appStateKey))
      .first();
    const order = getOrderFromState(existing?.state, orderId);
    if (!existing || !order || !isEligibleWebsiteCheckoutOrder(order)) return null;
    if (
      orderAmountCentsFromState(existing.state, order) !== Math.round(args.amountCents)
      || checkoutCurrency(existing.state) !== cleanText(args.currency).toLowerCase()
    ) return null;
    if (cleanText(order.paymentStatus) === "Pending") {
      const activeReference = cleanText(order.stripeCheckoutSessionId || order.paymentReference);
      const activeProvider = cleanText(order.paymentProcessor).toLowerCase();
      const requestedProvider = cleanText(args.provider).toLowerCase();
      if ((activeReference && activeReference !== cleanText(args.checkoutSessionId))
        || (activeProvider && activeProvider !== requestedProvider)) return null;
    }

    return await patchOrderState(ctx, {
      appStateKey: args.appStateKey,
      orderId,
      eventType: "payment:checkout_started",
      patch: {
        paymentStatus: "Pending",
        paymentMethod: "Online payment",
        paymentReference: args.checkoutSessionId,
        paymentProcessor: cleanText(args.provider) || "Stripe",
        stripeCheckoutSessionId: args.checkoutSessionId,
        stripeCheckoutUrl: args.checkoutUrl,
        checkoutAttempt: Math.max(1, Math.floor(args.attempt)),
        ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {})
      }
    });
  }
});

export const markCheckoutSessionPaid = internalMutationGeneric({
  args: {
    appStateKey: v.string(),
    orderId: v.string(),
    checkoutSessionId: v.string(),
    provider: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    providerEventId: v.optional(v.string()),
    amountCents: v.number(),
    currency: v.string()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appStates")
      .withIndex("by_key", (query: any) => query.eq("key", args.appStateKey))
      .first();
    const order = getOrderFromState(existing?.state, cleanText(args.orderId));
    if (!order) return null;
    const recordedSessionId = cleanText(order.stripeCheckoutSessionId || order.paymentReference);
    if (recordedSessionId && recordedSessionId !== cleanText(args.checkoutSessionId)) return null;
    if (order.paymentStatus === "Paid") {
      return { state: existing.state, order, version: existing.version, updatedAt: existing.updatedAt, duplicate: true };
    }
    if (!isRecordedWebsiteCheckoutOrder(order)) return null;
    if (
      orderAmountCentsFromState(existing.state, order) !== Math.round(args.amountCents)
      || checkoutCurrency(existing.state) !== cleanText(args.currency).toLowerCase()
    ) return null;

    const provider = cleanText(args.provider) || "Stripe";
    const operationalStatus = cleanText(order.status);
    const cancelled = operationalStatus === "Cancelled";
    const alreadyDispatched = !["", "New"].includes(operationalStatus);
    return await patchOrderState(ctx, {
      appStateKey: args.appStateKey,
      orderId: args.orderId,
      eventType: "payment:checkout_paid",
      patch: {
        paymentStatus: "Paid",
        paymentMethod: "Online payment",
        paymentReference: args.checkoutSessionId,
        paymentProcessor: provider,
        stripeCheckoutSessionId: args.checkoutSessionId,
        ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
        ...(args.providerEventId ? { paymentWebhookEventId: args.providerEventId } : {}),
        paidAt: new Date().toISOString(),
        paidAtMs: Date.now(),
        paidByName: `${provider} checkout`,
        needsKitchenDispatch: !cancelled && !alreadyDispatched,
        ...(cancelled ? {
          paymentReconciliationRequired: true,
          paymentReconciliationReason: "Provider payment completed after the order was cancelled. Review and refund or reinstate it."
        } : {})
      }
    });
  }
});

export const markCheckoutSessionFailed = internalMutationGeneric({
  args: {
    appStateKey: v.string(),
    orderId: v.string(),
    checkoutSessionId: v.string(),
    provider: v.optional(v.string()),
    providerEventId: v.optional(v.string()),
    reason: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appStates")
      .withIndex("by_key", (query: any) => query.eq("key", args.appStateKey))
      .first();
    const order = getOrderFromState(existing?.state, cleanText(args.orderId));
    if (!order || order.paymentStatus === "Paid") return null;
    const recordedSessionId = cleanText(order.stripeCheckoutSessionId || order.paymentReference);
    if (recordedSessionId && recordedSessionId !== cleanText(args.checkoutSessionId)) return null;
    if (order.paymentStatus === "Failed") {
      return { state: existing.state, order, version: existing.version, updatedAt: existing.updatedAt, duplicate: true };
    }
    const provider = cleanText(args.provider) || "Online payment";
    return await patchOrderState(ctx, {
      appStateKey: args.appStateKey,
      orderId: args.orderId,
      eventType: "payment:checkout_failed",
      patch: {
        paymentStatus: "Failed",
        paymentMethod: "Online payment",
        paymentProcessor: provider,
        paymentReference: args.checkoutSessionId,
        stripeCheckoutSessionId: args.checkoutSessionId,
        paymentFailureReason: cleanText(args.reason) || "The payment provider did not complete this checkout.",
        ...(args.providerEventId ? { paymentWebhookEventId: args.providerEventId } : {}),
        failedAt: new Date().toISOString(),
        failedAtMs: Date.now(),
        needsKitchenDispatch: false
      }
    });
  }
});

function checkoutAttempt(order: any) {
  return Math.max(0, Math.floor(Number(order?.checkoutAttempt) || 0)) + 1;
}

function checkoutIdempotencyKey(provider: string, appStateKey: string, orderId: string, attempt: number) {
  return ["libabite", provider, appStateKey, orderId, attempt].join(":").slice(0, 255);
}

function paymentReconciliationOrderPatch(order: any) {
  if (!order?.id || order.paymentReconciliationRequired !== true) return null;
  return {
    id: order.id,
    status: cleanText(order.status),
    operationalStatus: cleanText(order.operationalStatus),
    fulfillmentStatus: cleanText(order.fulfillmentStatus),
    paymentStatus: cleanText(order.paymentStatus),
    paymentMethod: cleanText(order.paymentMethod),
    paymentReference: cleanText(order.paymentReference),
    paymentProcessor: cleanText(order.paymentProcessor),
    stripeCheckoutSessionId: cleanText(order.stripeCheckoutSessionId),
    stripePaymentIntentId: cleanText(order.stripePaymentIntentId),
    paidAt: cleanText(order.paidAt),
    paidAtMs: Number(order.paidAtMs) || 0,
    paidByName: cleanText(order.paidByName),
    needsKitchenDispatch: order.needsKitchenDispatch === true,
    paymentReconciliationRequired: true,
    paymentReconciliationReason: cleanText(order.paymentReconciliationReason)
  };
}

function mollieWebhookUrl() {
  const siteUrl = cleanText(process.env.CONVEX_SITE_URL);
  if (!siteUrl) return "";
  try {
    return new URL("/payments/mollie/webhook", siteUrl).toString();
  } catch {
    return "";
  }
}

async function queueOrderCommunication(ctx: any, appStateKey: string, orderId: string, eventType: "order.confirmed" | "order.payment_failed") {
  try {
    await ctx.runMutation(anyApi.communications.queueRecordEvent as any, {
      appStateKey,
      recordType: "order",
      recordId: orderId,
      eventType
    });
  } catch (error) {
    // A provider outage or missing email configuration must never undo a
    // successfully verified payment. The payment remains visible for staff,
    // while queue/provider failures stay observable in the communications tables.
    console.error("Could not queue the order communication.", orderId, eventType, error);
  }
}

async function reusableStripeCheckout(ctx: any, source: any) {
  const order = source?.order;
  const checkoutSessionId = cleanText(order?.stripeCheckoutSessionId || order?.paymentReference);
  const checkoutUrl = cleanText(order?.stripeCheckoutUrl);
  if (
    cleanText(order?.paymentStatus) !== "Pending"
    || cleanText(order?.paymentProcessor).toLowerCase() !== "stripe"
    || !checkoutSessionId
  ) return null;

  const result = await stripeRequest(`/checkout/sessions/${encodeURIComponent(checkoutSessionId)}`);
  if (!result.ok) return result;
  const session = result.payload;
  if (session?.payment_status === "paid") {
    const confirmation = await ctx.runAction(anyApi.payments.confirmStripeCheckoutSession as any, {
      appStateKey: source.appStateKey,
      checkoutSessionId
    });
    return confirmation?.ok
      ? { ...confirmation, message: "Payment was already received for this order." }
      : confirmation;
  }
  if (cleanText(session?.status).toLowerCase() === "open" && (cleanText(session?.url) || checkoutUrl)) {
    return {
      ok: true,
      provider: "stripe",
      checkoutSessionId,
      checkoutUrl: cleanText(session?.url) || checkoutUrl,
      checkoutAttempt: Math.max(1, Math.floor(Number(order?.checkoutAttempt) || 1)),
      reused: true
    };
  }
  if (cleanText(session?.status).toLowerCase() !== "expired") {
    return { ok: false, message: "This Stripe payment is still processing. Please wait before starting another payment." };
  }
  const failed = await ctx.runMutation(anyApi.payments.markCheckoutSessionFailed as any, {
    appStateKey: source.appStateKey,
    orderId: order.id,
    checkoutSessionId,
    provider: "Stripe",
    reason: "Stripe checkout expired before a replacement payment was started."
  });
  if (!failed) {
    return { ok: false, message: "The active Stripe payment changed while it was being checked. Refresh before trying again." };
  }
  return null;
}

function pendingCheckoutBelongsToAnotherProvider(order: any, provider: "stripe" | "mollie") {
  if (cleanText(order?.paymentStatus) !== "Pending") return false;
  const currentProvider = cleanText(order?.paymentProcessor).toLowerCase();
  return currentProvider !== provider;
}

async function reusableMollieCheckout(ctx: any, source: any) {
  const order = source?.order;
  const paymentId = cleanText(order?.stripeCheckoutSessionId || order?.paymentReference);
  const recordedCheckoutUrl = cleanText(order?.stripeCheckoutUrl);
  if (
    cleanText(order?.paymentStatus) !== "Pending"
    || cleanText(order?.paymentProcessor).toLowerCase() !== "mollie"
    || !paymentId
  ) return null;

  const result = await mollieRequest(`/payments/${encodeURIComponent(paymentId)}`);
  if (!result.ok) return result;
  const payment = result.payload;
  const providerStatus = cleanText(payment?.status).toLowerCase();
  if (providerStatus === "paid") {
    const confirmation = await ctx.runAction(anyApi.payments.confirmMollieCheckoutPayment as any, {
      appStateKey: source.appStateKey,
      checkoutSessionId: paymentId
    });
    return confirmation?.ok
      ? { ...confirmation, message: "Payment was already received for this order." }
      : confirmation;
  }
  const checkoutUrl = cleanText(payment?._links?.checkout?.href) || recordedCheckoutUrl;
  if (providerStatus === "open" && checkoutUrl) {
    return {
      ok: true,
      provider: "mollie",
      checkoutSessionId: paymentId,
      checkoutUrl,
      checkoutAttempt: Math.max(1, Math.floor(Number(order?.checkoutAttempt) || 1)),
      reused: true
    };
  }
  if (!["canceled", "cancelled", "expired", "failed"].includes(providerStatus)) {
    return { ok: false, message: "This Mollie payment is still processing. Please wait before starting another payment." };
  }
  const failed = await ctx.runMutation(anyApi.payments.markCheckoutSessionFailed as any, {
    appStateKey: source.appStateKey,
    orderId: order.id,
    checkoutSessionId: paymentId,
    provider: "Mollie",
    reason: `Mollie payment ${providerStatus} before a replacement payment was started.`
  });
  if (!failed) {
    return { ok: false, message: "The active Mollie payment changed while it was being checked. Refresh before trying again." };
  }
  return null;
}

async function closeUnrecordedStripeCheckout(checkoutSessionId: string) {
  const result = await stripeRequest(
    `/checkout/sessions/${encodeURIComponent(checkoutSessionId)}/expire`,
    { method: "POST", body: new URLSearchParams() }
  );
  if (!result.ok) {
    console.error("Could not expire an unrecorded Stripe checkout session.", checkoutSessionId, result.message);
  }
  return result.ok;
}

async function closeUnrecordedMolliePayment(paymentId: string) {
  const result = await mollieRequest(`/payments/${encodeURIComponent(paymentId)}`, { method: "DELETE" });
  if (!result.ok) {
    console.error("Could not cancel an unrecorded Mollie payment.", paymentId, result.message);
  }
  return result.ok;
}

export const createStripeCheckoutSession = internalActionGeneric({
  args: {
    appStateKey: v.string(),
    orderId: v.string()
  },
  handler: async (ctx, args) => {
    const source: any = await ctx.runQuery(anyApi.payments.getCheckoutOrder as any, args);
    if (!source?.order) return { ok: false, message: "The order no longer exists." };
    if (!isEligibleWebsiteCheckoutOrder(source.order)) return { ok: false, message: "This order is not eligible for public online checkout." };
    if (source.order.paymentStatus === "Paid") return { ok: false, message: "This order is already paid." };
    if (source.amountCents <= 0) return { ok: false, message: "Add a paid item before checkout." };
    const reusableCheckout = await reusableStripeCheckout(ctx, source);
    if (reusableCheckout) return reusableCheckout;
    if (pendingCheckoutBelongsToAnotherProvider(source.order, "stripe")) {
      return {
        ok: false,
        message: "This order already has an active payment with another provider. Resume or finish that payment first."
      };
    }

    const attempt = checkoutAttempt(source.order);
    const body = new URLSearchParams();
    body.set("mode", "payment");
    STRIPE_NL_PAYMENT_METHOD_TYPES.forEach((method, index) => {
      body.set(`payment_method_types[${index}]`, method);
    });
    body.set("success_url", appendStripeSessionPlaceholder(paymentReturnUrl(source.order.id, "success", "stripe")));
    body.set("cancel_url", paymentReturnUrl(source.order.id, "cancelled", "stripe"));
    body.set("client_reference_id", source.order.id);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", source.currency);
    body.set("line_items[0][price_data][unit_amount]", String(source.amountCents));
    body.set("line_items[0][price_data][product_data][name]", orderLabel(source.order));
    const description = orderDescription(source.order);
    if (description) body.set("line_items[0][price_data][product_data][description]", description);
    const customerEmail = cleanText(source.order.customerEmail).toLowerCase();
    if (customerEmail) body.set("customer_email", customerEmail);
    body.set("metadata[app_state_key]", source.appStateKey);
    body.set("metadata[order_id]", source.order.id);
    body.set("metadata[order_number]", cleanText(source.order.number));
    body.set("payment_intent_data[metadata][app_state_key]", source.appStateKey);
    body.set("payment_intent_data[metadata][order_id]", source.order.id);

    const result = await stripeRequest("/checkout/sessions", {
      method: "POST",
      body,
      idempotencyKey: checkoutIdempotencyKey("stripe", source.appStateKey, source.order.id, attempt)
    });
    if (!result.ok) return result;

    const session = result.payload;
    const checkoutSessionId = stripeId(session);
    const checkoutUrl = cleanText(session?.url);
    if (!checkoutSessionId || !checkoutUrl) {
      return { ok: false, message: "Stripe did not return a checkout URL." };
    }

    const paymentIntentId = stripeId(session?.payment_intent);
    const recorded = await ctx.runMutation(anyApi.payments.markCheckoutSessionStarted as any, {
      appStateKey: source.appStateKey,
      orderId: source.order.id,
      checkoutSessionId,
      checkoutUrl,
      provider: "Stripe",
      amountCents: source.amountCents,
      currency: source.currency,
      attempt,
      ...(paymentIntentId ? { paymentIntentId } : {})
    });
    if (!recorded) {
      const closed = await closeUnrecordedStripeCheckout(checkoutSessionId);
      return {
        ok: false,
        message: closed
          ? "The order changed before checkout could be recorded. The unused payment session was closed."
          : "The order changed during checkout. Please contact the restaurant before trying another payment."
      };
    }

    return {
      ok: true,
      provider: "stripe",
      checkoutUrl,
      checkoutSessionId,
      checkoutAttempt: attempt,
      ...(paymentIntentId ? { paymentIntentId } : {})
    };
  }
});

export const createMollieCheckoutPayment = internalActionGeneric({
  args: {
    appStateKey: v.string(),
    orderId: v.string()
  },
  handler: async (ctx, args) => {
    const source: any = await ctx.runQuery(anyApi.payments.getCheckoutOrder as any, args);
    if (!source?.order) return { ok: false, message: "The order no longer exists." };
    if (!isEligibleWebsiteCheckoutOrder(source.order)) return { ok: false, message: "This order is not eligible for public online checkout." };
    if (source.order.paymentStatus === "Paid") return { ok: false, message: "This order is already paid." };
    if (source.amountCents <= 0) return { ok: false, message: "Add a paid item before checkout." };
    const reusableCheckout = await reusableMollieCheckout(ctx, source);
    if (reusableCheckout) return reusableCheckout;
    if (pendingCheckoutBelongsToAnotherProvider(source.order, "mollie")) {
      return {
        ok: false,
        message: "This order already has an active payment with another provider. Resume or finish that payment first."
      };
    }

    const attempt = checkoutAttempt(source.order);
    const webhookUrl = mollieWebhookUrl();
    const result = await mollieRequest("/payments", {
      method: "POST",
      idempotencyKey: checkoutIdempotencyKey("mollie", source.appStateKey, source.order.id, attempt),
      body: {
        amount: {
          currency: source.currency.toUpperCase(),
          value: (source.amountCents / 100).toFixed(2)
        },
        description: orderLabel(source.order),
        redirectUrl: paymentReturnUrl(source.order.id, "success", "mollie"),
        cancelUrl: paymentReturnUrl(source.order.id, "cancelled", "mollie"),
        ...(webhookUrl ? { webhookUrl } : {}),
        metadata: {
          app_state_key: source.appStateKey,
          order_id: source.order.id,
          order_number: cleanText(source.order.number)
        }
      }
    });
    if (!result.ok) return result;

    const payment = result.payload;
    const paymentId = stripeId(payment);
    const checkoutUrl = cleanText(payment?._links?.checkout?.href);
    if (!paymentId || !checkoutUrl) {
      return { ok: false, message: "Mollie did not return a checkout URL." };
    }

    const recorded = await ctx.runMutation(anyApi.payments.markCheckoutSessionStarted as any, {
      appStateKey: source.appStateKey,
      orderId: source.order.id,
      checkoutSessionId: paymentId,
      checkoutUrl,
      provider: "Mollie",
      amountCents: source.amountCents,
      currency: source.currency,
      attempt
    });
    if (!recorded) {
      const closed = await closeUnrecordedMolliePayment(paymentId);
      return {
        ok: false,
        message: closed
          ? "The order changed before checkout could be recorded. The unused payment session was closed."
          : "The order changed during checkout. Please contact the restaurant before trying another payment."
      };
    }

    return {
      ok: true,
      provider: "mollie",
      checkoutUrl,
      checkoutSessionId: paymentId,
      checkoutAttempt: attempt
    };
  }
});

export const createOnlineCheckoutSession = actionGeneric({
  args: {
    provider: v.optional(v.string()),
    appStateKey: v.string(),
    orderId: v.string()
  },
  handler: async (ctx, args) => {
    const provider = cleanText(args.provider).toLowerCase() === "mollie" ? "mollie" : "stripe";
    const payload = { appStateKey: cleanText(args.appStateKey), orderId: cleanText(args.orderId) };
    return provider === "mollie"
      ? await ctx.runAction(anyApi.payments.createMollieCheckoutPayment as any, payload)
      : await ctx.runAction(anyApi.payments.createStripeCheckoutSession as any, payload);
  }
});

export const confirmStripeCheckoutSession = internalActionGeneric({
  args: {
    appStateKey: v.optional(v.string()),
    checkoutSessionId: v.string(),
    providerEventId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const checkoutSessionId = cleanText(args.checkoutSessionId);
    if (!checkoutSessionId) return { ok: false, message: "Missing Stripe checkout session." };

    const result = await stripeRequest(`/checkout/sessions/${encodeURIComponent(checkoutSessionId)}`);
    if (!result.ok) return result;

    const session = result.payload;
    const orderId = cleanText(session?.metadata?.order_id || session?.client_reference_id);
    const metadataOrderId = cleanText(session?.metadata?.order_id);
    const referenceOrderId = cleanText(session?.client_reference_id);
    const appStateKey = cleanText(session?.metadata?.app_state_key);
    if (!orderId || !appStateKey) return { ok: false, message: "Stripe session is not linked to an order." };
    if (metadataOrderId && referenceOrderId && metadataOrderId !== referenceOrderId) {
      return { ok: false, message: "Stripe order metadata does not match the checkout reference." };
    }
    if (args.appStateKey && cleanText(args.appStateKey) !== appStateKey) {
      return { ok: false, message: "Stripe session belongs to a different restaurant state." };
    }
    if (session?.payment_status !== "paid") {
      if (cleanText(session?.status).toLowerCase() === "expired") {
        await ctx.runMutation(anyApi.payments.markCheckoutSessionFailed as any, {
          appStateKey,
          checkoutSessionId,
          orderId,
          provider: "Stripe",
          ...(args.providerEventId ? { providerEventId: args.providerEventId } : {}),
          reason: "Stripe checkout expired before payment completed."
        });
        await queueOrderCommunication(ctx, appStateKey, orderId, "order.payment_failed");
      }
      return {
        ok: false,
        message: "Stripe has not marked this checkout as paid yet.",
        checkoutSessionId,
        orderId,
        paymentStatus: cleanText(session?.payment_status),
        terminal: cleanText(session?.status).toLowerCase() === "expired"
      };
    }

    const source: any = await ctx.runQuery(anyApi.payments.getCheckoutOrder as any, { appStateKey, orderId });
    if (!source?.order) return { ok: false, message: "The Stripe order no longer exists." };
    if (cleanText(source.order.stripeCheckoutSessionId || source.order.paymentReference) !== checkoutSessionId) {
      return { ok: false, message: "Stripe session does not match the order's active checkout." };
    }
    if (Math.round(Number(session?.amount_total) || 0) !== source.amountCents || cleanText(session?.currency).toLowerCase() !== source.currency) {
      return { ok: false, message: "Stripe payment amount or currency does not match the order." };
    }

    const paymentIntentId = stripeId(session?.payment_intent);
    const fulfilled = await ctx.runMutation(anyApi.payments.markCheckoutSessionPaid as any, {
      appStateKey,
      checkoutSessionId,
      orderId,
      provider: "Stripe",
      amountCents: source.amountCents,
      currency: source.currency,
      ...(args.providerEventId ? { providerEventId: args.providerEventId } : {}),
      ...(paymentIntentId ? { paymentIntentId } : {})
    });
    if (!fulfilled) return { ok: false, message: "Stripe payment could not be applied to the order." };
    const requiresReconciliation = paymentRequiresReconciliation(fulfilled);
    if (shouldQueuePaymentConfirmation(fulfilled)) {
      await queueOrderCommunication(ctx, appStateKey, orderId, "order.confirmed");
    }

    return {
      ok: true,
      paid: true,
      requiresReconciliation,
      orderId,
      checkoutSessionId,
      ...(requiresReconciliation ? { reconciliationOrder: paymentReconciliationOrderPatch(fulfilled.order) } : {}),
      ...(paymentIntentId ? { paymentIntentId } : {})
    };
  }
});

export const confirmMollieCheckoutPayment = internalActionGeneric({
  args: {
    appStateKey: v.optional(v.string()),
    checkoutSessionId: v.string(),
    providerEventId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const paymentId = cleanText(args.checkoutSessionId);
    if (!paymentId) return { ok: false, message: "Missing Mollie payment id." };

    const result = await mollieRequest(`/payments/${encodeURIComponent(paymentId)}`);
    if (!result.ok) return result;

    const payment = result.payload;
    const orderId = cleanText(payment?.metadata?.order_id);
    const appStateKey = cleanText(payment?.metadata?.app_state_key);
    if (!orderId || !appStateKey) return { ok: false, message: "Mollie payment is not linked to an order." };
    if (args.appStateKey && cleanText(args.appStateKey) !== appStateKey) {
      return { ok: false, message: "Mollie payment belongs to a different restaurant state." };
    }
    if (payment?.status !== "paid") {
      const providerStatus = cleanText(payment?.status).toLowerCase();
      const terminal = ["canceled", "cancelled", "expired", "failed"].includes(providerStatus);
      if (terminal) {
        await ctx.runMutation(anyApi.payments.markCheckoutSessionFailed as any, {
          appStateKey,
          checkoutSessionId: paymentId,
          orderId,
          provider: "Mollie",
          ...(args.providerEventId ? { providerEventId: args.providerEventId } : {}),
          reason: `Mollie payment ${providerStatus}.`
        });
        await queueOrderCommunication(ctx, appStateKey, orderId, "order.payment_failed");
      }
      return {
        ok: false,
        message: "Mollie has not marked this payment as paid yet.",
        checkoutSessionId: paymentId,
        orderId,
        paymentStatus: providerStatus,
        terminal
      };
    }

    const source: any = await ctx.runQuery(anyApi.payments.getCheckoutOrder as any, { appStateKey, orderId });
    if (!source?.order) return { ok: false, message: "The Mollie order no longer exists." };
    if (cleanText(source.order.stripeCheckoutSessionId || source.order.paymentReference) !== paymentId) {
      return { ok: false, message: "Mollie payment does not match the order's active checkout." };
    }
    const paidCents = Math.round((Number(payment?.amount?.value) || 0) * 100);
    if (paidCents !== source.amountCents || cleanText(payment?.amount?.currency).toLowerCase() !== source.currency) {
      return { ok: false, message: "Mollie payment amount or currency does not match the order." };
    }

    const fulfilled = await ctx.runMutation(anyApi.payments.markCheckoutSessionPaid as any, {
      appStateKey,
      checkoutSessionId: paymentId,
      orderId,
      provider: "Mollie",
      amountCents: source.amountCents,
      currency: source.currency,
      ...(args.providerEventId ? { providerEventId: args.providerEventId } : {})
    });
    if (!fulfilled) return { ok: false, message: "Mollie payment could not be applied to the order." };
    const requiresReconciliation = paymentRequiresReconciliation(fulfilled);
    if (shouldQueuePaymentConfirmation(fulfilled)) {
      await queueOrderCommunication(ctx, appStateKey, orderId, "order.confirmed");
    }

    return {
      ok: true,
      provider: "mollie",
      paid: true,
      requiresReconciliation,
      orderId,
      checkoutSessionId: paymentId,
      ...(requiresReconciliation ? { reconciliationOrder: paymentReconciliationOrderPatch(fulfilled.order) } : {})
    };
  }
});

export const confirmOnlineCheckoutSession = actionGeneric({
  args: {
    provider: v.optional(v.string()),
    appStateKey: v.string(),
    checkoutSessionId: v.string()
  },
  handler: async (ctx, args) => {
    const provider = cleanText(args.provider).toLowerCase() === "mollie" ? "mollie" : "stripe";
    const payload = {
      appStateKey: cleanText(args.appStateKey),
      checkoutSessionId: cleanText(args.checkoutSessionId)
    };
    return provider === "mollie"
      ? await ctx.runAction(anyApi.payments.confirmMollieCheckoutPayment as any, payload)
      : await ctx.runAction(anyApi.payments.confirmStripeCheckoutSession as any, payload);
  }
});
