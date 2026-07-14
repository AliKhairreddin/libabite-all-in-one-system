import { anyApi } from "convex/server";
import { httpAction } from "./_generated/server";
import { verifyStripeWebhookSignature } from "../src/domain/stripe-webhooks.js";

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export const stripeCheckout = httpAction(async (ctx, request) => {
  const webhookSecret = cleanText(process.env.STRIPE_WEBHOOK_SECRET);
  const signature = cleanText(request.headers.get("stripe-signature"));
  if (!webhookSecret) {
    console.error("Stripe webhook is not configured.");
    return jsonResponse(503, { received: false });
  }
  if (!signature) return jsonResponse(400, { received: false });

  let event: any;
  try {
    const rawBody = await request.text();
    const verification = await verifyStripeWebhookSignature(rawBody, signature, webhookSecret);
    if (!verification.ok) throw new Error(verification.reason);
    event = JSON.parse(rawBody);
    if (!event?.id || !event?.type || !event?.data?.object) throw new Error("Malformed Stripe event.");
  } catch (error) {
    console.warn("Rejected Stripe webhook signature.", error instanceof Error ? error.message : "Invalid signature");
    return jsonResponse(400, { received: false });
  }

  const successEvent = ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type);
  const failureEvent = ["checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type);
  if (!successEvent && !failureEvent) {
    return jsonResponse(200, { received: true, ignored: true });
  }

  const session = event.data.object;
  const checkoutSessionId = cleanText(session.id);
  const appStateKey = cleanText(session.metadata?.app_state_key);
  if (!checkoutSessionId || !appStateKey) {
    console.warn("Stripe checkout webhook has no Libabite order metadata.", event.id);
    return jsonResponse(200, { received: true, ignored: true });
  }

  if (failureEvent) {
    const orderId = cleanText(session.metadata?.order_id || session.client_reference_id);
    if (!orderId) return jsonResponse(200, { received: true, ignored: true });
    try {
      const failed = await ctx.runMutation(anyApi.payments.markCheckoutSessionFailed as any, {
        appStateKey,
        orderId,
        checkoutSessionId,
        provider: "Stripe",
        providerEventId: event.id,
        reason: event.type === "checkout.session.expired"
          ? "Stripe checkout expired before payment completed."
          : "Stripe reported that the asynchronous payment failed."
      });
      if (!failed) return jsonResponse(200, { received: true, ignored: true });
      await ctx.runMutation(anyApi.communications.queueRecordEvent as any, {
        appStateKey,
        recordType: "order",
        recordId: orderId,
        eventType: "order.payment_failed"
      });
      return jsonResponse(200, { received: true });
    } catch (error) {
      console.error("Stripe failed-payment webhook processing failed.", event.id, error);
      return jsonResponse(503, { received: false });
    }
  }

  try {
    const result: any = await ctx.runAction(anyApi.payments.confirmStripeCheckoutSession as any, {
      appStateKey,
      checkoutSessionId,
      providerEventId: event.id
    });
    if (!result?.ok && cleanText(result?.paymentStatus).toLowerCase() !== "unpaid") {
      console.error("Stripe payment verification failed.", event.id, cleanText(result?.message));
      return jsonResponse(503, { received: false });
    }
  } catch (error) {
    console.error("Stripe payment webhook processing failed.", event.id, error);
    return jsonResponse(503, { received: false });
  }

  return jsonResponse(200, { received: true });
});

export const mollieCheckout = httpAction(async (ctx, request) => {
  let paymentId = "";
  try {
    const contentType = cleanText(request.headers.get("content-type")).toLowerCase();
    if (contentType.includes("application/json")) {
      const payload = await request.json();
      paymentId = cleanText((payload as any)?.id);
    } else {
      const formData = await request.formData();
      paymentId = cleanText(formData.get("id"));
    }
  } catch {
    return jsonResponse(400, { received: false });
  }
  if (!paymentId) return jsonResponse(400, { received: false });

  try {
    const result: any = await ctx.runAction(anyApi.payments.confirmMollieCheckoutPayment as any, {
      checkoutSessionId: paymentId,
      providerEventId: `mollie:${paymentId}`
    });
    if (!result?.ok && !result?.terminal) {
      console.error("Mollie payment verification failed.", paymentId, cleanText(result?.message));
      return jsonResponse(503, { received: false });
    }
  } catch (error) {
    console.error("Mollie payment webhook processing failed.", paymentId, error);
    return jsonResponse(503, { received: false });
  }

  return jsonResponse(200, { received: true });
});
