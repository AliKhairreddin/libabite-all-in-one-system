import { actionGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";
import { anyApi } from "convex/server";
import { mirrorOperationalTables } from "./operationalSync";

declare const process: {
  env: Record<string, string | undefined>;
};

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const MOLLIE_API_BASE = "https://api.mollie.com/v2";
const STRIPE_NL_PAYMENT_METHOD_TYPES = ["ideal", "card"];

function cleanText(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripeSecretKey() {
  return cleanText(process.env.STRIPE_SECRET_KEY);
}

function mollieApiKey() {
  return cleanText(process.env.MOLLIE_API_KEY);
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

async function stripeRequest(path: string, options: { method?: string; body?: URLSearchParams } = {}) {
  const secretKey = stripeSecretKey();
  if (!secretKey) {
    return {
      ok: false,
      message: "Stripe checkout is missing STRIPE_SECRET_KEY in Convex."
    };
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(options.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body: options.body
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      message: cleanText(payload?.error?.message) || "Stripe rejected the checkout request."
    };
  }

  return { ok: true, payload };
}

async function mollieRequest(path: string, options: { method?: string; body?: Record<string, any> } = {}) {
  const apiKey = mollieApiKey();
  if (!apiKey) {
    return {
      ok: false,
      message: "Mollie checkout is missing MOLLIE_API_KEY in Convex."
    };
  }

  const response = await fetch(`${MOLLIE_API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      message: cleanText(payload?.detail || payload?.title || payload?.message) || "Mollie rejected the payment request."
    };
  }

  return { ok: true, payload };
}

async function patchOrderState(ctx: any, args: {
  appStateKey: string;
  order: any;
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
  const baseOrder = index >= 0 ? state.orders[index] : args.order;
  const nextOrder = {
    ...baseOrder,
    ...args.patch
  };

  if (index >= 0) {
    state.orders[index] = nextOrder;
  } else {
    state.orders.push(nextOrder);
  }
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

export const markCheckoutSessionStarted = mutationGeneric({
  args: {
    appStateKey: v.string(),
    order: v.any(),
    checkoutSessionId: v.string(),
    checkoutUrl: v.string(),
    provider: v.optional(v.string()),
    paymentIntentId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const orderId = cleanText(args.order?.id);
    if (!orderId) return null;

    return await patchOrderState(ctx, {
      appStateKey: args.appStateKey,
      orderId,
      order: args.order,
      eventType: "payment:checkout_started",
      patch: {
        paymentStatus: "Pending",
        paymentMethod: "Online payment",
        paymentReference: args.checkoutSessionId,
        paymentProcessor: cleanText(args.provider) || "Stripe",
        stripeCheckoutSessionId: args.checkoutSessionId,
        stripeCheckoutUrl: args.checkoutUrl,
        ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {})
      }
    });
  }
});

export const markCheckoutSessionPaid = mutationGeneric({
  args: {
    appStateKey: v.string(),
    order: v.optional(v.any()),
    orderId: v.string(),
    checkoutSessionId: v.string(),
    provider: v.optional(v.string()),
    paymentIntentId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    return await patchOrderState(ctx, {
      appStateKey: args.appStateKey,
      orderId: args.orderId,
      order: args.order || { id: args.orderId },
      eventType: "payment:checkout_paid",
      patch: {
        paymentStatus: "Paid",
        paymentMethod: "Online payment",
        paymentReference: args.checkoutSessionId,
        paymentProcessor: cleanText(args.provider) || "Stripe",
        stripeCheckoutSessionId: args.checkoutSessionId,
        ...(args.paymentIntentId ? { stripePaymentIntentId: args.paymentIntentId } : {}),
        paidAt: new Date().toISOString(),
        paidAtMs: Date.now(),
        paidByName: "Stripe checkout"
      }
    });
  }
});

export const createStripeCheckoutSession = actionGeneric({
  args: {
    appStateKey: v.string(),
    order: v.any(),
    amountCents: v.number(),
    currency: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string()
  },
  handler: async (ctx, args) => {
    const orderId = cleanText(args.order?.id);
    const amountCents = Math.max(0, Math.round(args.amountCents));
    const currency = cleanText(args.currency).toLowerCase() || "eur";

    if (!orderId) return { ok: false, message: "The order is missing an id." };
    if (amountCents <= 0) return { ok: false, message: "Add a paid item before checkout." };

    const body = new URLSearchParams();
    body.set("mode", "payment");
    STRIPE_NL_PAYMENT_METHOD_TYPES.forEach((method, index) => {
      body.set(`payment_method_types[${index}]`, method);
    });
    body.set("success_url", appendStripeSessionPlaceholder(args.successUrl));
    body.set("cancel_url", args.cancelUrl);
    body.set("client_reference_id", orderId);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", currency);
    body.set("line_items[0][price_data][unit_amount]", String(amountCents));
    body.set("line_items[0][price_data][product_data][name]", orderLabel(args.order));
    const description = orderDescription(args.order);
    if (description) body.set("line_items[0][price_data][product_data][description]", description);
    const customerEmail = cleanText(args.order?.customerEmail);
    if (customerEmail) body.set("customer_email", customerEmail);
    body.set("metadata[app_state_key]", args.appStateKey);
    body.set("metadata[order_id]", orderId);
    body.set("metadata[order_number]", cleanText(args.order?.number));
    body.set("payment_intent_data[metadata][app_state_key]", args.appStateKey);
    body.set("payment_intent_data[metadata][order_id]", orderId);

    const result = await stripeRequest("/checkout/sessions", { method: "POST", body });
    if (!result.ok) return result;

    const session = result.payload;
    const checkoutSessionId = stripeId(session);
    const checkoutUrl = cleanText(session?.url);
    if (!checkoutSessionId || !checkoutUrl) {
      return { ok: false, message: "Stripe did not return a checkout URL." };
    }

    const paymentIntentId = stripeId(session?.payment_intent);
    await ctx.runMutation(anyApi.payments.markCheckoutSessionStarted as any, {
      appStateKey: args.appStateKey,
      order: args.order,
      checkoutSessionId,
      checkoutUrl,
      provider: "Stripe",
      ...(paymentIntentId ? { paymentIntentId } : {})
    });

    return {
      ok: true,
      checkoutUrl,
      checkoutSessionId,
      ...(paymentIntentId ? { paymentIntentId } : {})
    };
  }
});

export const createMollieCheckoutPayment = actionGeneric({
  args: {
    appStateKey: v.string(),
    order: v.any(),
    amountCents: v.number(),
    currency: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string()
  },
  handler: async (ctx, args) => {
    const orderId = cleanText(args.order?.id);
    const amountCents = Math.max(0, Math.round(args.amountCents));
    const currency = cleanText(args.currency).toUpperCase() || "EUR";

    if (!orderId) return { ok: false, message: "The order is missing an id." };
    if (amountCents <= 0) return { ok: false, message: "Add a paid item before checkout." };

    const result = await mollieRequest("/payments", {
      method: "POST",
      body: {
        amount: {
          currency,
          value: (amountCents / 100).toFixed(2)
        },
        description: orderLabel(args.order),
        redirectUrl: args.successUrl,
        cancelUrl: args.cancelUrl,
        metadata: {
          app_state_key: args.appStateKey,
          order_id: orderId,
          order_number: cleanText(args.order?.number)
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

    await ctx.runMutation(anyApi.payments.markCheckoutSessionStarted as any, {
      appStateKey: args.appStateKey,
      order: args.order,
      checkoutSessionId: paymentId,
      checkoutUrl,
      provider: "Mollie"
    });

    return {
      ok: true,
      provider: "mollie",
      checkoutUrl,
      checkoutSessionId: paymentId
    };
  }
});

export const createOnlineCheckoutSession = actionGeneric({
  args: {
    provider: v.optional(v.string()),
    appStateKey: v.string(),
    order: v.any(),
    amountCents: v.number(),
    currency: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string()
  },
  handler: async (ctx, args) => {
    const provider = cleanText(args.provider).toLowerCase() || "stripe";
    const payload = {
      appStateKey: args.appStateKey,
      order: args.order,
      amountCents: args.amountCents,
      currency: args.currency,
      successUrl: args.successUrl,
      cancelUrl: args.cancelUrl
    };
    if (provider === "mollie") {
      return await ctx.runAction(anyApi.payments.createMollieCheckoutPayment as any, payload);
    }
    return await ctx.runAction(anyApi.payments.createStripeCheckoutSession as any, payload);
  }
});

export const confirmStripeCheckoutSession = actionGeneric({
  args: {
    appStateKey: v.string(),
    checkoutSessionId: v.string(),
    orderId: v.optional(v.string()),
    order: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const checkoutSessionId = cleanText(args.checkoutSessionId);
    if (!checkoutSessionId) return { ok: false, message: "Missing Stripe checkout session." };

    const result = await stripeRequest(`/checkout/sessions/${encodeURIComponent(checkoutSessionId)}`);
    if (!result.ok) return result;

    const session = result.payload;
    const orderId = cleanText(args.orderId || session?.client_reference_id || session?.metadata?.order_id);
    const paid = session?.payment_status === "paid" || session?.status === "complete";
    const paymentIntentId = stripeId(session?.payment_intent);

    if (!orderId) return { ok: false, message: "Stripe session is not linked to an order." };
    if (!paid) {
      return {
        ok: false,
        message: "Stripe has not marked this checkout as paid yet.",
        checkoutSessionId,
        orderId,
        paymentStatus: cleanText(session?.payment_status)
      };
    }

    await ctx.runMutation(anyApi.payments.markCheckoutSessionPaid as any, {
      appStateKey: args.appStateKey,
      checkoutSessionId,
      orderId,
      ...(args.order ? { order: args.order } : {}),
      provider: "Stripe",
      ...(paymentIntentId ? { paymentIntentId } : {})
    });

    return {
      ok: true,
      paid: true,
      orderId,
      checkoutSessionId,
      ...(paymentIntentId ? { paymentIntentId } : {})
    };
  }
});

export const confirmMollieCheckoutPayment = actionGeneric({
  args: {
    appStateKey: v.string(),
    checkoutSessionId: v.string(),
    orderId: v.optional(v.string()),
    order: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const paymentId = cleanText(args.checkoutSessionId);
    if (!paymentId) return { ok: false, message: "Missing Mollie payment id." };

    const result = await mollieRequest(`/payments/${encodeURIComponent(paymentId)}`);
    if (!result.ok) return result;

    const payment = result.payload;
    const orderId = cleanText(args.orderId || payment?.metadata?.order_id);
    const paid = payment?.status === "paid";

    if (!orderId) return { ok: false, message: "Mollie payment is not linked to an order." };
    if (!paid) {
      return {
        ok: false,
        message: "Mollie has not marked this payment as paid yet.",
        checkoutSessionId: paymentId,
        orderId,
        paymentStatus: cleanText(payment?.status)
      };
    }

    await ctx.runMutation(anyApi.payments.markCheckoutSessionPaid as any, {
      appStateKey: args.appStateKey,
      checkoutSessionId: paymentId,
      orderId,
      ...(args.order ? { order: args.order } : {}),
      provider: "Mollie"
    });

    return {
      ok: true,
      provider: "mollie",
      paid: true,
      orderId,
      checkoutSessionId: paymentId
    };
  }
});
