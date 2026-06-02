import { anyApi } from "convex/server";
import { getConvexStateKey, getSharedConvexClient, isConvexEnabled } from "./convex-client.js";
import { saveState, state } from "./state.js";
import { timeNow } from "../shared/dates.js";
import { WEBSITE_PAYMENT_PROCESSOR } from "../shared/constants.js";

function paymentReturnUrl(orderId: string, result: "success" | "cancelled") {
  const url = new URL(window.location.href);
  url.searchParams.set("order", "website");
  url.searchParams.set("payment", result);
  url.searchParams.set("orderId", orderId);
  return url.toString();
}

export async function createWebsiteCheckoutSession(order: any, amountCents: number) {
  if (!isConvexEnabled()) {
    return {
      ok: false,
      message: "Convex must be connected before live online checkout can start."
    };
  }

  const client = getSharedConvexClient();
  if (!client) {
    return {
      ok: false,
      message: "Convex is not connected yet. Try again once the sync status is ready."
    };
  }

  return await client.action(anyApi.payments.createStripeCheckoutSession as any, {
    appStateKey: getConvexStateKey(),
    order,
    amountCents,
    currency: "eur",
    successUrl: paymentReturnUrl(order.id, "success"),
    cancelUrl: paymentReturnUrl(order.id, "cancelled")
  });
}

function removePaymentReturnParams() {
  const url = new URL(window.location.href);
  ["payment", "orderId", "session_id", "sessionId"].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, "", url.toString());
}

export async function handleWebsitePaymentReturn(deps: {
  render: () => void;
  sendOrderToKitchen: (orderId: string, options?: any) => boolean;
  showToast: (message: string) => void;
}) {
  const params = new URLSearchParams(window.location.search);
  if (String(params.get("order") || "").toLowerCase() !== "website") return false;

  const paymentResult = String(params.get("payment") || "").toLowerCase();
  if (!paymentResult) return false;

  const orderId = String(params.get("orderId") || state.websiteLastOrderId || "").trim();
  if (paymentResult === "cancelled") {
    deps.showToast("Payment cancelled. Your order is still saved.");
    removePaymentReturnParams();
    deps.render();
    return true;
  }

  const checkoutSessionId = String(params.get("session_id") || params.get("sessionId") || "").trim();
  if (paymentResult !== "success" || !checkoutSessionId || !orderId) return false;

  const order = state.orders.find((item) => item.id === orderId);
  const client = getSharedConvexClient();
  if (!isConvexEnabled() || !client) {
    deps.showToast("Convex must be connected before payment can be confirmed.");
    return false;
  }

  const confirmation = await client.action(anyApi.payments.confirmStripeCheckoutSession as any, {
    appStateKey: getConvexStateKey(),
    checkoutSessionId,
    orderId,
    ...(order ? { order } : {})
  });

  if (!confirmation?.ok || !confirmation?.paid) {
    deps.showToast(confirmation?.message || "Stripe has not confirmed the payment yet.");
    return false;
  }

  if (order) {
    order.paymentStatus = "Paid";
    order.paymentMethod = "Online payment";
    order.paymentReference = confirmation.checkoutSessionId || checkoutSessionId;
    order.paymentProcessor = WEBSITE_PAYMENT_PROCESSOR;
    order.stripeCheckoutSessionId = confirmation.checkoutSessionId || checkoutSessionId;
    if (confirmation.paymentIntentId) order.stripePaymentIntentId = confirmation.paymentIntentId;
    order.paidAt = order.paidAt || timeNow();
    order.paidAtMs = order.paidAtMs || Date.now();
    order.paidByUserId = "";
    order.paidByName = "Stripe checkout";
    state.websiteLastOrderId = order.id;
    state.receiptOrderId = order.id;

    if (order.status === "New") {
      deps.sendOrderToKitchen(order.id, { silent: true, skipPermission: true });
    } else {
      saveState();
      deps.render();
    }
  }

  removePaymentReturnParams();
  deps.showToast(`Payment confirmed${order?.number ? ` for order #${order.number}` : ""}.`);
  return true;
}
