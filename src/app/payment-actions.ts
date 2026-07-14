import { anyApi } from "convex/server";
import { getConvexStateKey, getSharedConvexClient, isConvexEnabled } from "./convex-client.js";
import { saveState, state } from "./state.js";
import { timeNow } from "../shared/dates.js";
import { WEBSITE_PAYMENT_PROCESSOR } from "../shared/constants.js";
import { paymentRequiresReconciliation } from "../domain/payments.js";
import { applyPaidPaymentToOrder } from "./payment-ledger.js";
import { enqueueReceiptPrintJob } from "./receipt-printing.js";

export type PaymentReconciliationOrderPatch = {
  id: string;
  status?: string;
  operationalStatus?: string;
  fulfillmentStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  paymentReference?: string;
  paymentProcessor?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  paidAt?: string;
  paidAtMs?: number;
  paidByName?: string;
  needsKitchenDispatch?: boolean;
  paymentReconciliationRequired: true;
  paymentReconciliationReason?: string;
};

export type WebsiteCheckoutSessionResult = {
  ok: boolean;
  message?: string;
  provider?: string;
  checkoutUrl?: string;
  checkoutSessionId?: string;
  paymentIntentId?: string;
  checkoutAttempt?: number;
  paid?: boolean;
  orderId?: string;
  requiresReconciliation?: boolean;
  reconciliationOrder?: PaymentReconciliationOrderPatch | null;
  reused?: boolean;
};

const PAYMENT_RECONCILIATION_MESSAGE = "Payment was received after this order changed. The restaurant must review it and will contact you about fulfillment or a refund.";

export function refreshReconciliationOrderLocally(orderId: string, patch: PaymentReconciliationOrderPatch | null | undefined) {
  if (!patch || patch.id !== orderId) return false;
  const orderIndex = state.orders.findIndex((item) => item.id === orderId);
  if (orderIndex < 0) return false;
  state.orders[orderIndex] = { ...state.orders[orderIndex], ...patch };
  saveState({ syncRemote: false });
  return true;
}

export async function createWebsiteCheckoutSession(
  order: any,
  _amountCents: number,
  provider = "stripe"
): Promise<WebsiteCheckoutSessionResult> {
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
    orderId: order.id
  }) as WebsiteCheckoutSessionResult;
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
    deps.showToast("Payment was not completed. Your order is still saved so you can try again.");
    removePaymentReturnParams();
    deps.render();
    return true;
  }

  const provider = String(params.get("provider") || "stripe").trim().toLowerCase();
  const requestedOrder = state.orders.find((item) => item.id === orderId);
  const checkoutSessionId = String(params.get("session_id") || params.get("sessionId") || requestedOrder?.stripeCheckoutSessionId || requestedOrder?.paymentReference || "").trim();
  if (paymentResult !== "success" || !checkoutSessionId || !orderId) return false;

  const client = getSharedConvexClient();
  if (!isConvexEnabled() || !client) {
    deps.showToast("Convex must be connected before payment can be confirmed.");
    return false;
  }

  const confirmation = await client.action(anyApi.payments.confirmOnlineCheckoutSession as any, {
    provider,
    appStateKey: getConvexStateKey(),
    checkoutSessionId
  });

  if (!confirmation?.ok || !confirmation?.paid) {
    deps.showToast(confirmation?.message || "Stripe has not confirmed the payment yet.");
    return false;
  }

  const confirmedOrderId = String(confirmation.orderId || "").trim();
  if (!confirmedOrderId || confirmedOrderId !== orderId) {
    removePaymentReturnParams();
    deps.render();
    deps.showToast("Payment was verified for a different order than this return link. No local order was changed; contact the restaurant if the paid order is not shown.");
    return true;
  }
  const order = state.orders.find((item) => item.id === confirmedOrderId);
  if (!order) {
    removePaymentReturnParams();
    deps.render();
    deps.showToast("Payment was verified, but this device does not have the matching order yet. Refresh before making another payment.");
    return true;
  }

  if (paymentRequiresReconciliation(confirmation)) {
    refreshReconciliationOrderLocally(confirmedOrderId, confirmation.reconciliationOrder);
    removePaymentReturnParams();
    deps.render();
    deps.showToast(PAYMENT_RECONCILIATION_MESSAGE);
    return true;
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
      paidByName: provider === "mollie" ? "Mollie checkout" : "Stripe checkout",
      captureMode: "online_checkout"
    });
    enqueueReceiptPrintJob(order, "website_payment_paid");
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
