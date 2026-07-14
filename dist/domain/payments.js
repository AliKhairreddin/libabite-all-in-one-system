import { DEFAULT_PAID_PAYMENT_METHOD, DEFAULT_ONLINE_PAYMENT_PROVIDER, DEFAULT_TERMINAL_PAYMENT_PROVIDER, IN_PERSON_PAYMENT_PROVIDER_OPTIONS, ONLINE_PAYMENT_PROVIDER_OPTIONS, PAYMENT_LEDGER_KINDS, PAYMENT_METHOD_OPTIONS, PAYMENT_PROVIDERS, PAYMENT_STATUSES, UNPAID_PAYMENT_METHOD } from "../shared/constants.js";
function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}
function roundCents(value) {
    return Math.max(0, Math.round(Number(value) || 0));
}
function currencyCode(value = "eur") {
    const currency = cleanText(value).toLowerCase();
    return /^[a-z]{3}$/.test(currency) ? currency : "eur";
}
export function isPaidPaymentMethod(method) {
    return PAYMENT_METHOD_OPTIONS.some((option) => option.value === method && option.paid);
}
export function normalizePaymentMethod(method, paymentStatus = "") {
    const candidate = String(method || "").trim();
    if (PAYMENT_METHOD_OPTIONS.some((option) => option.value === candidate))
        return candidate;
    if (["Unpaid", "Pay later"].includes(candidate))
        return UNPAID_PAYMENT_METHOD;
    if (candidate === "Paid" || paymentStatus === "Paid")
        return DEFAULT_PAID_PAYMENT_METHOD;
    return UNPAID_PAYMENT_METHOD;
}
export function getPaymentStatusForMethod(method, fallbackStatus = "") {
    void method;
    return normalizePaymentStatus(fallbackStatus);
}
export function normalizePaymentStatus(status, fallback = "Unpaid") {
    const legacyMap = {
        "pay_later": "Pay later",
        "pay later": "Pay later",
        "pending": "Pending",
        "paid": "Paid",
        "unpaid": "Unpaid",
        "failed": "Failed",
        "cancelled": "Cancelled",
        "canceled": "Cancelled",
        "refunded": "Refunded",
        "partially_refunded": "Partially refunded",
        "authorized": "Authorized"
    };
    const candidate = cleanText(status);
    const mapped = legacyMap[candidate.toLowerCase()] || candidate;
    if (PAYMENT_STATUSES.includes(mapped))
        return mapped;
    return PAYMENT_STATUSES.includes(fallback) ? fallback : "Unpaid";
}
export function isPaidPaymentStatus(status) {
    return normalizePaymentStatus(status) === "Paid";
}
export function normalizePaymentProvider(provider, fallback = "manual") {
    const key = cleanText(provider).toLowerCase();
    const byId = PAYMENT_PROVIDERS.find((item) => item.id === key);
    if (byId)
        return byId.id;
    const byLabel = PAYMENT_PROVIDERS.find((item) => item.label.toLowerCase() === key);
    if (byLabel)
        return byLabel.id;
    return PAYMENT_PROVIDERS.some((item) => item.id === fallback) ? fallback : "manual";
}
export function paymentProviderLabel(provider) {
    return PAYMENT_PROVIDERS.find((item) => item.id === normalizePaymentProvider(provider))?.label || "Manual / recorded by staff";
}
export function normalizePaymentKind(kind, fallback = "order") {
    const candidate = cleanText(kind);
    return PAYMENT_LEDGER_KINDS.includes(candidate) ? candidate : fallback;
}
export function defaultProviderForPaymentMethod(method) {
    const normalizedMethod = normalizePaymentMethod(method);
    if (normalizedMethod === "Cash")
        return "cash";
    if (normalizedMethod === "Card")
        return DEFAULT_TERMINAL_PAYMENT_PROVIDER;
    if (normalizedMethod === "Online payment")
        return DEFAULT_ONLINE_PAYMENT_PROVIDER;
    if (normalizedMethod === "External delivery app payment")
        return "manual";
    return "manual";
}
export function providerSupportsOnlineCheckout(provider) {
    const id = normalizePaymentProvider(provider, DEFAULT_ONLINE_PAYMENT_PROVIDER);
    return ONLINE_PAYMENT_PROVIDER_OPTIONS.includes(id);
}
export function providerSupportsInPersonPayment(provider) {
    const id = normalizePaymentProvider(provider, DEFAULT_TERMINAL_PAYMENT_PROVIDER);
    return IN_PERSON_PAYMENT_PROVIDER_OPTIONS.includes(id);
}
export function applyPendingCheckoutToOrder(order, input = {}) {
    if (!order || typeof order !== "object")
        return null;
    order.paymentStatus = "Pending";
    if (input.paymentMethod)
        order.paymentMethod = input.paymentMethod;
    if (input.paymentReference)
        order.paymentReference = input.paymentReference;
    if (input.paymentProcessor)
        order.paymentProcessor = input.paymentProcessor;
    if (input.checkoutSessionId)
        order.stripeCheckoutSessionId = input.checkoutSessionId;
    if (input.paymentIntentId)
        order.stripePaymentIntentId = input.paymentIntentId;
    const currentAttempt = Math.max(0, Math.floor(Number(order.checkoutAttempt) || 0));
    const serverAttempt = Math.max(0, Math.floor(Number(input.checkoutAttempt) || 0));
    if (serverAttempt > 0)
        order.checkoutAttempt = Math.max(currentAttempt, serverAttempt);
    return order;
}
export function paymentRequiresReconciliation(result) {
    return result?.requiresReconciliation === true
        || result?.order?.paymentReconciliationRequired === true;
}
export function shouldQueuePaymentConfirmation(result) {
    return Boolean(result)
        && result.duplicate !== true
        && !paymentRequiresReconciliation(result);
}
function paymentRecordAmountCents(record) {
    if (!record || typeof record !== "object")
        return 0;
    if (record.amountCents !== undefined && record.amountCents !== null && record.amountCents !== "") {
        return roundCents(record.amountCents);
    }
    return roundCents((Number(record.amount) || 0) * 100);
}
function optionalExpectedAmountCents(value) {
    const candidate = value && typeof value === "object" ? value.expectedAmountCents : value;
    if (candidate === undefined || candidate === null || candidate === "")
        return null;
    const amount = Number(candidate);
    return Number.isFinite(amount) && amount >= 0 ? roundCents(amount) : null;
}
export function orderPaymentStatusFromLedger(records = [], fallbackStatus = "Unpaid", expectedAmountCents = undefined) {
    const ledger = (Array.isArray(records) ? records : []).filter((record) => record && typeof record === "object");
    const orderCharges = ledger.filter((record) => normalizePaymentKind(record.kind) === "order");
    const refunds = ledger.filter((record) => normalizePaymentKind(record.kind) === "refund");
    const successfulCharges = orderCharges.filter((record) => isPaidPaymentStatus(record.status));
    const successfulRefunds = refunds.filter((record) => ["Paid", "Refunded", "Partially refunded"].includes(normalizePaymentStatus(record.status)));
    const capturedCents = successfulCharges.reduce((sum, record) => sum + paymentRecordAmountCents(record), 0);
    const refundedCents = successfulRefunds.reduce((sum, record) => sum + paymentRecordAmountCents(record), 0);
    const netCapturedCents = Math.max(0, capturedCents - refundedCents);
    const expectedCents = optionalExpectedAmountCents(expectedAmountCents);
    const hasRefundedCharge = orderCharges.some((record) => normalizePaymentStatus(record.status) === "Refunded");
    const hasPartiallyRefundedCharge = orderCharges.some((record) => normalizePaymentStatus(record.status) === "Partially refunded");
    if (expectedCents !== null && netCapturedCents >= expectedCents)
        return "Paid";
    if (refundedCents > 0 || hasRefundedCharge || hasPartiallyRefundedCharge) {
        if (hasRefundedCharge || (capturedCents > 0 && refundedCents >= capturedCents))
            return "Refunded";
        return "Partially refunded";
    }
    if (expectedCents === null && netCapturedCents > 0)
        return "Paid";
    if (orderCharges.some((record) => normalizePaymentStatus(record.status) === "Pending"))
        return "Pending";
    if (orderCharges.some((record) => normalizePaymentStatus(record.status) === "Authorized"))
        return "Authorized";
    if (orderCharges.some((record) => normalizePaymentStatus(record.status) === "Failed"))
        return "Failed";
    const fallback = normalizePaymentStatus(fallbackStatus);
    return expectedCents !== null && fallback === "Paid" ? "Unpaid" : fallback;
}
export function buildPaymentLedgerRecord(input = {}, options = {}) {
    const nowMs = Math.max(0, Number(options.nowMs ?? input.createdAtMs) || Date.now());
    const nowIso = options.nowIso || new Date(nowMs).toISOString();
    const orderId = cleanText(input.orderId);
    const reservationId = cleanText(input.reservationId);
    const kind = normalizePaymentKind(input.kind || (reservationId ? "reservation_deposit" : "order"));
    const provider = normalizePaymentProvider(input.provider || input.paymentProcessor || defaultProviderForPaymentMethod(input.paymentMethod));
    const paymentMethod = normalizePaymentMethod(input.paymentMethod, input.status);
    const status = normalizePaymentStatus(input.status || input.paymentStatus || getPaymentStatusForMethod(paymentMethod));
    const amountCents = roundCents(input.amountCents ?? ((Number(input.amount) || 0) * 100));
    const providerPaymentId = cleanText(input.providerPaymentId || input.paymentReference);
    const checkoutSessionId = cleanText(input.checkoutSessionId || input.stripeCheckoutSessionId);
    const paymentIntentId = cleanText(input.paymentIntentId || input.stripePaymentIntentId);
    const externalId = cleanText(input.externalId)
        || providerPaymentId
        || checkoutSessionId
        || paymentIntentId
        || [kind, orderId || reservationId || "unlinked", nowMs].join(":");
    return {
        id: cleanText(input.id) || `PAY-${externalId}`.replace(/[^A-Za-z0-9:_-]+/g, "-"),
        externalId,
        kind,
        provider,
        providerLabel: paymentProviderLabel(provider),
        status,
        currency: currencyCode(input.currency || "eur"),
        amountCents,
        amount: Number((amountCents / 100).toFixed(2)),
        orderId,
        reservationId,
        paymentMethod,
        providerPaymentId,
        checkoutSessionId,
        paymentIntentId,
        terminalReaderId: cleanText(input.terminalReaderId),
        customerName: cleanText(input.customerName),
        customerEmail: cleanText(input.customerEmail),
        captureMode: cleanText(input.captureMode),
        sourceChannel: cleanText(input.sourceChannel),
        raw: input.raw || null,
        createdAt: cleanText(input.createdAt) || nowIso,
        createdAtMs: nowMs,
        updatedAt: cleanText(input.updatedAt) || nowIso,
        updatedAtMs: Math.max(0, Number(input.updatedAtMs) || nowMs),
        paidAt: status === "Paid" ? cleanText(input.paidAt) || nowIso : cleanText(input.paidAt),
        paidAtMs: status === "Paid" ? Math.max(0, Number(input.paidAtMs) || nowMs) : Math.max(0, Number(input.paidAtMs) || 0),
        failedAt: status === "Failed" ? cleanText(input.failedAt) || nowIso : cleanText(input.failedAt),
        failedAtMs: status === "Failed" ? Math.max(0, Number(input.failedAtMs) || nowMs) : Math.max(0, Number(input.failedAtMs) || 0),
        refundedAt: status === "Refunded" || status === "Partially refunded" ? cleanText(input.refundedAt) || nowIso : cleanText(input.refundedAt),
        refundedAtMs: status === "Refunded" || status === "Partially refunded" ? Math.max(0, Number(input.refundedAtMs) || nowMs) : Math.max(0, Number(input.refundedAtMs) || 0),
        note: cleanText(input.note || input.notes)
    };
}
export function upsertPaymentLedgerRecord(records = [], nextRecord) {
    const nextRecords = Array.isArray(records) ? [...records] : [];
    const record = buildPaymentLedgerRecord(nextRecord);
    const index = nextRecords.findIndex((item) => {
        if (record.id && item.id === record.id)
            return true;
        if (record.externalId && item.externalId === record.externalId)
            return true;
        if (record.checkoutSessionId && item.checkoutSessionId === record.checkoutSessionId)
            return true;
        if (record.paymentIntentId && item.paymentIntentId === record.paymentIntentId)
            return true;
        return false;
    });
    if (index >= 0)
        nextRecords[index] = { ...nextRecords[index], ...record };
    else
        nextRecords.push(record);
    return nextRecords;
}
//# sourceMappingURL=payments.js.map