import { anyApi } from "convex/server";
import { getConvexStateKey, getSharedConvexClient, isConvexEnabled } from "./convex-client.js";
import { saveState, state } from "./state.js";
import { timeNow } from "../shared/dates.js";
import { WEBSITE_PAYMENT_PROCESSOR } from "../shared/constants.js";
import { applyPaidPaymentToOrder } from "./payment-ledger.js";

function paymentReturnUrl(orderId: string, result: "success" | "cancelled", provider = "stripe") {
  const url = new URL(window.location.href);
  url.searchParams.set("order", "website");
  url.searchParams.set("payment", result);
  url.searchParams.set("orderId", orderId);
  url.searchParams.set("provider", provider);
  return url.toString();
}

export async function createWebsiteCheckoutSession(order: any, amountCents: number, provider = "stripe") {
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

  return await client.action(anyApi.payments.createOnlineCheckoutSession as any, {
    provider,
    appStateKey: getConvexStateKey(),
    order,
    amountCents,
    currency: "eur",
    successUrl: paymentReturnUrl(order.id, "success", provider),
    cancelUrl: paymentReturnUrl(order.id, "cancelled", provider)
  });
}

function removePaymentReturnParams() {
  const url = new URL(window.location.href);
  ["payment", "orderId", "provider", "session_id", "sessionId"].forEach((key) => url.searchParams.delete(key));
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

  const provider = String(params.get("provider") || "stripe").trim().toLowerCase();
  const order = state.orders.find((item) => item.id === orderId);
  const checkoutSessionId = String(params.get("session_id") || params.get("sessionId") || order?.stripeCheckoutSessionId || order?.paymentReference || "").trim();
  if (paymentResult !== "success" || !checkoutSessionId || !orderId) return false;

  const client = getSharedConvexClient();
  if (!isConvexEnabled() || !client) {
    deps.showToast("Convex must be connected before payment can be confirmed.");
    return false;
  }

  const confirmationAction = provider === "mollie"
    ? anyApi.payments.confirmMollieCheckoutPayment
    : anyApi.payments.confirmStripeCheckoutSession;
  const confirmation = await client.action(confirmationAction as any, {
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
    const paidAtMs = Date.now();
    applyPaidPaymentToOrder(order, {
      provider: provider === "mollie" ? "mollie" : "stripe",
      paymentMethod: "Online payment",
      paymentReference: confirmation.checkoutSessionId || checkoutSessionId,
      paymentProcessor: provider === "mollie" ? "Mollie" : WEBSITE_PAYMENT_PROCESSOR,
      checkoutSessionId: confirmation.checkoutSessionId || checkoutSessionId,
      paymentIntentId: confirmation.paymentIntentId,
      paidAt: order.paidAt || timeNow(),
      paidAtMs,
      paidByUserId: "",
      paidByName: "Stripe checkout",
      captureMode: "online_checkout"
    });
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
