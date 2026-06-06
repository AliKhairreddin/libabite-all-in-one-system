import { calculateOrderTotal } from "../domain/orders.js";
import {
  buildPaymentLedgerRecord,
  normalizePaymentProvider,
  normalizePaymentStatus,
  upsertPaymentLedgerRecord
} from "../domain/payments.js";
import { timeNow } from "../shared/dates.js";
import { state } from "./state.js";

function productById(productId) {
  return state.products.find((product) => product.id === productId);
}

function orderAmountCents(order) {
  return Math.round(calculateOrderTotal(order, productById) * 100);
}

export function getPaymentRecordsForOrder(orderId) {
  return (Array.isArray(state.payments) ? state.payments : [])
    .filter((payment) => payment.orderId === orderId);
}

export function getPaymentRecordsForReservation(reservationId) {
  return (Array.isArray(state.payments) ? state.payments : [])
    .filter((payment) => payment.reservationId === reservationId);
}

export function recordOrderPayment(order, input: any = {}) {
  if (!order?.id) return null;
  const nowMs = Math.max(0, Number(input.nowMs) || Date.now());
  const status = normalizePaymentStatus(input.status || input.paymentStatus || order.paymentStatus || "Paid");
  const record = buildPaymentLedgerRecord({
    id: input.id || `PAY-order-${order.id}`,
    externalId: input.externalId || `order-summary:${order.id}`,
    kind: "order",
    provider: input.provider || order.paymentProcessor || order.externalPlatformId || "",
    status,
    currency: input.currency || "eur",
    amountCents: input.amountCents ?? orderAmountCents(order),
    orderId: order.id,
    paymentMethod: input.paymentMethod || order.paymentMethod,
    providerPaymentId: input.providerPaymentId || order.paymentReference,
    checkoutSessionId: input.checkoutSessionId || order.stripeCheckoutSessionId,
    paymentIntentId: input.paymentIntentId || order.stripePaymentIntentId,
    terminalReaderId: input.terminalReaderId || order.terminalReaderId,
    customerName: input.customerName || order.customerName || order.customer,
    customerEmail: input.customerEmail || order.customerEmail,
    captureMode: input.captureMode || (order.externalPlatformId ? "external_platform" : "staff_recorded"),
    sourceChannel: input.sourceChannel || order.channel,
    paidAt: input.paidAt || order.paidAt,
    paidAtMs: input.paidAtMs || order.paidAtMs,
    note: input.note,
    raw: input.raw || {
      orderId: order.id,
      orderNumber: order.number,
      channel: order.channel,
      externalPlatformId: order.externalPlatformId,
      externalOrderId: order.externalOrderId
    }
  }, { nowMs });

  state.payments = upsertPaymentLedgerRecord(state.payments, record);
  return record;
}

export function applyPaidPaymentToOrder(order, input: any = {}) {
  if (!order?.id) return null;
  const nowMs = Math.max(0, Number(input.nowMs) || Date.now());
  const paidAt = input.paidAt || timeNow();
  order.paymentStatus = "Paid";
  if (input.paymentMethod) order.paymentMethod = input.paymentMethod;
  if (input.paymentReference) order.paymentReference = input.paymentReference;
  if (input.paymentProcessor) order.paymentProcessor = input.paymentProcessor;
  if (input.checkoutSessionId) order.stripeCheckoutSessionId = input.checkoutSessionId;
  if (input.paymentIntentId) order.stripePaymentIntentId = input.paymentIntentId;
  order.paidAt = order.paidAt || paidAt;
  order.paidAtMs = order.paidAtMs || nowMs;
  if (input.paidByUserId !== undefined) order.paidByUserId = input.paidByUserId;
  if (input.paidByName !== undefined) order.paidByName = input.paidByName;

  return recordOrderPayment(order, {
    ...input,
    status: "Paid",
    paidAt: order.paidAt,
    paidAtMs: order.paidAtMs
  });
}

export function recordPendingOnlinePayment(order, input: any = {}) {
  if (!order?.id) return null;
  order.paymentStatus = "Pending";
  if (input.paymentMethod) order.paymentMethod = input.paymentMethod;
  if (input.paymentReference) order.paymentReference = input.paymentReference;
  if (input.paymentProcessor) order.paymentProcessor = input.paymentProcessor;
  if (input.checkoutSessionId) order.stripeCheckoutSessionId = input.checkoutSessionId;
  if (input.paymentIntentId) order.stripePaymentIntentId = input.paymentIntentId;
  return recordOrderPayment(order, {
    ...input,
    status: "Pending",
    captureMode: input.captureMode || "online_checkout"
  });
}

export function recordReservationPayment(reservation, input: any = {}) {
  if (!reservation?.id) return null;
  const nowMs = Math.max(0, Number(input.nowMs) || Date.now());
  const status = normalizePaymentStatus(input.status || input.paymentStatus || reservation.paymentStatus || "Pending");
  const record = buildPaymentLedgerRecord({
    id: input.id || `PAY-reservation-${reservation.id}`,
    externalId: input.externalId || `reservation-deposit:${reservation.id}`,
    kind: input.kind || "reservation_deposit",
    provider: normalizePaymentProvider(input.provider || reservation.paymentProcessor || ""),
    status,
    currency: input.currency || "eur",
    amountCents: input.amountCents ?? Math.round((Number(reservation.depositAmount) || 0) * 100),
    reservationId: reservation.id,
    paymentMethod: input.paymentMethod || reservation.paymentMethod || "Online payment",
    providerPaymentId: input.providerPaymentId || reservation.paymentReference,
    customerName: input.customerName || reservation.name,
    customerEmail: input.customerEmail || reservation.email,
    captureMode: input.captureMode || "online_checkout",
    sourceChannel: input.sourceChannel || reservation.source,
    paidAt: input.paidAt || reservation.paidAt,
    paidAtMs: input.paidAtMs || reservation.paidAtMs,
    note: input.note,
    raw: input.raw || {
      reservationId: reservation.id,
      date: reservation.date,
      time: reservation.time,
      guests: reservation.guests
    }
  }, { nowMs });

  state.payments = upsertPaymentLedgerRecord(state.payments, record);
  return record;
}
