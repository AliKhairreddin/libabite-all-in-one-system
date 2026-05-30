import { DEFAULT_PAID_PAYMENT_METHOD, PAYMENT_METHOD_OPTIONS, UNPAID_PAYMENT_METHOD } from "../shared/constants.js";
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
    if (isPaidPaymentMethod(method))
        return "Paid";
    const normalizedFallback = ["Paid", "Unpaid", "Pay later"].includes(fallbackStatus) ? fallbackStatus : "Unpaid";
    return normalizedFallback === "Paid" ? "Pay later" : normalizedFallback;
}
//# sourceMappingURL=payments.js.map