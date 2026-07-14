export const COMMUNICATION_TEMPLATE_VERSION = 1;
export const COMMUNICATION_RECORD_TYPES = ["order", "reservation"];
export const COMMUNICATION_EVENT_TYPES = [
    "order.received",
    "order.confirmed",
    "order.ready",
    "order.out_for_delivery",
    "order.delivered",
    "order.cancelled",
    "order.refunded",
    "order.payment_failed",
    "reservation.request_received",
    "reservation.confirmed",
    "reservation.rescheduled",
    "reservation.reminder",
    "reservation.declined",
    "reservation.cancelled"
];
const EVENT_RECORD_TYPES = {
    "order.received": "order",
    "order.confirmed": "order",
    "order.ready": "order",
    "order.out_for_delivery": "order",
    "order.delivered": "order",
    "order.cancelled": "order",
    "order.refunded": "order",
    "order.payment_failed": "order",
    "reservation.request_received": "reservation",
    "reservation.confirmed": "reservation",
    "reservation.rescheduled": "reservation",
    "reservation.reminder": "reservation",
    "reservation.declined": "reservation",
    "reservation.cancelled": "reservation"
};
function cleanText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}
function lowerText(value) {
    return cleanText(value).toLowerCase();
}
function rawRecord(record) {
    return record?.raw && typeof record.raw === "object" ? record.raw : record || {};
}
function recordValue(record, ...keys) {
    const raw = rawRecord(record);
    for (const key of keys) {
        if (record?.[key] !== undefined && record?.[key] !== null && record[key] !== "")
            return record[key];
        if (raw?.[key] !== undefined && raw?.[key] !== null && raw[key] !== "")
            return raw[key];
    }
    return "";
}
function isOneOf(value, choices) {
    return choices.includes(lowerText(value));
}
export function normalizeCommunicationEmail(value) {
    const email = cleanText(value).toLowerCase();
    if (!email || email.length > 254 || /\s/.test(email))
        return "";
    const at = email.indexOf("@");
    if (at <= 0 || at !== email.lastIndexOf("@") || at === email.length - 1)
        return "";
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (local.length > 64 || !domain.includes(".") || domain.startsWith(".") || domain.endsWith("."))
        return "";
    return email;
}
export function isCommunicationRecordType(value) {
    return COMMUNICATION_RECORD_TYPES.includes(value);
}
export function isCommunicationEventType(value) {
    return COMMUNICATION_EVENT_TYPES.includes(value);
}
export function getRecordRecipient(recordType, record) {
    const email = normalizeCommunicationEmail(recordType === "order"
        ? recordValue(record, "customerEmail", "email")
        : recordValue(record, "email", "customerEmail"));
    const name = cleanText(recordType === "order"
        ? recordValue(record, "customerName", "customer", "name")
        : recordValue(record, "name", "customerName"));
    return { email, name };
}
export function hasExplicitMarketingConsent(record) {
    const raw = rawRecord(record);
    return record?.marketingConsent === true || raw?.marketingConsent === true;
}
export function getMarketingConsentEvidence(record) {
    const raw = rawRecord(record);
    const timestampValue = recordValue(record, "marketingConsentAtMs", "marketingConsentedAtMs", "marketingConsentAt", "marketingConsentedAt");
    const numericTimestamp = Number(timestampValue);
    const parsedTimestamp = typeof timestampValue === "string" ? Date.parse(timestampValue) : Number.NaN;
    const consentedAt = Number.isFinite(numericTimestamp) && numericTimestamp > 0
        ? Math.floor(numericTimestamp)
        : Number.isFinite(parsedTimestamp) && parsedTimestamp > 0
            ? Math.floor(parsedTimestamp)
            : undefined;
    const policyVersion = cleanText(record?.marketingConsentPolicyVersion
        ?? raw?.marketingConsentPolicyVersion
        ?? record?.privacyPolicyVersion
        ?? raw?.privacyPolicyVersion);
    return {
        explicit: hasExplicitMarketingConsent(record),
        consentedAt,
        policyVersion
    };
}
export function validateCommunicationEvent(recordType, eventType, record) {
    if (!isCommunicationEventType(eventType)) {
        return { ok: false, reason: "Unsupported communication event." };
    }
    if (EVENT_RECORD_TYPES[eventType] !== recordType) {
        return { ok: false, reason: `${eventType} cannot be used for a ${recordType}.` };
    }
    const status = lowerText(recordValue(record, "status", "operationalStatus"));
    const paymentStatus = lowerText(recordValue(record, "paymentStatus"));
    const fulfillmentStatus = lowerText(recordValue(record, "fulfillmentStatus"));
    const deliveryStatus = lowerText(recordValue(record, "deliveryStatus"));
    let matches = false;
    switch (eventType) {
        case "order.received":
            matches = isOneOf(status, ["new"]);
            break;
        case "order.confirmed":
            matches = paymentStatus === "paid"
                || isOneOf(status, ["accepted", "sent to kitchen", "preparing", "delayed", "ready", "served", "paid", "completed"]);
            break;
        case "order.ready":
            matches = status === "ready" || fulfillmentStatus === "ready";
            break;
        case "order.out_for_delivery":
            matches = fulfillmentStatus === "on the way" || deliveryStatus === "on the way";
            break;
        case "order.delivered":
            matches = fulfillmentStatus === "delivered" || deliveryStatus === "delivered";
            break;
        case "order.cancelled":
            matches = status === "cancelled" || fulfillmentStatus === "cancelled" || paymentStatus === "cancelled";
            break;
        case "order.refunded":
            matches = isOneOf(paymentStatus, ["refunded", "partially refunded"]);
            break;
        case "order.payment_failed":
            matches = paymentStatus === "failed";
            break;
        case "reservation.request_received":
            matches = status === "pending";
            break;
        case "reservation.confirmed":
        case "reservation.rescheduled":
        case "reservation.reminder":
            matches = status === "confirmed";
            break;
        case "reservation.declined":
            matches = status === "declined";
            break;
        case "reservation.cancelled":
            matches = status === "cancelled";
            break;
    }
    if (!matches) {
        return {
            ok: false,
            reason: `${eventType} does not match the stored ${recordType} state.`
        };
    }
    return { ok: true, eventType };
}
export function communicationEventFingerprint(recordType, eventType, record) {
    const recipient = getRecordRecipient(recordType, record);
    const parts = recordType === "order"
        ? [
            eventType,
            recordValue(record, "status", "operationalStatus"),
            recordValue(record, "paymentStatus"),
            recordValue(record, "fulfillmentStatus"),
            recordValue(record, "deliveryStatus"),
            recordValue(record, "requestedTime"),
            recipient.email
        ]
        : [
            eventType,
            recordValue(record, "status"),
            recordValue(record, "date"),
            recordValue(record, "time"),
            recordValue(record, "guests"),
            recipient.email
        ];
    return parts.map((part) => lowerText(part)).join("|");
}
function orderLifecycleIsCancelled(record) {
    return isOneOf(recordValue(record, "status", "operationalStatus"), ["cancelled"])
        || isOneOf(recordValue(record, "fulfillmentStatus"), ["cancelled"]);
}
/**
 * Queue-time validation stays intentionally strict, while delivery-time
 * validation is monotonic for lifecycle events that remain true after normal
 * forward progress. This prevents a paid order moving from New to Preparing
 * from suppressing its confirmation, without sending a failed/cancelled event
 * after the record has recovered or been reinstated.
 */
export function communicationEventRemainsCurrent(recordType, eventType, record, queuedVariables) {
    if (recordType === "reservation") {
        if (!validateCommunicationEvent(recordType, eventType, record).ok)
            return false;
        if (!queuedVariables)
            return true;
        const currentVariables = getCommunicationTemplateVariables(recordType, "", record);
        return cleanText(currentVariables.date) === cleanText(queuedVariables.date)
            && cleanText(currentVariables.time) === cleanText(queuedVariables.time)
            && Number(currentVariables.guests || 0) === Number(queuedVariables.guests || 0);
    }
    const status = lowerText(recordValue(record, "status", "operationalStatus"));
    const paymentStatus = lowerText(recordValue(record, "paymentStatus"));
    const fulfillmentStatus = lowerText(recordValue(record, "fulfillmentStatus"));
    const deliveryStatus = lowerText(recordValue(record, "deliveryStatus"));
    const cancelled = orderLifecycleIsCancelled(record);
    switch (eventType) {
        case "order.received":
            return !cancelled && paymentStatus !== "failed";
        case "order.confirmed":
            return !cancelled
                && recordValue(record, "paymentReconciliationRequired") !== true
                && (paymentStatus === "paid"
                    || isOneOf(status, ["accepted", "sent to kitchen", "preparing", "delayed", "ready", "served", "paid", "completed"]));
        case "order.ready":
            return !cancelled && (isOneOf(status, ["ready", "served", "completed"])
                || isOneOf(fulfillmentStatus, ["ready", "on the way", "delivered"])
                || isOneOf(deliveryStatus, ["on the way", "delivered"]));
        case "order.out_for_delivery":
            return !cancelled
                && (isOneOf(fulfillmentStatus, ["on the way", "delivered"])
                    || isOneOf(deliveryStatus, ["on the way", "delivered"]));
        case "order.delivered":
            return fulfillmentStatus === "delivered" || deliveryStatus === "delivered";
        case "order.cancelled":
            return cancelled || paymentStatus === "cancelled";
        case "order.refunded":
            return isOneOf(paymentStatus, ["refunded", "partially refunded"]);
        case "order.payment_failed":
            return paymentStatus === "failed";
        default:
            return false;
    }
}
function keyPart(value) {
    return encodeURIComponent(cleanText(value));
}
export function notificationDedupeKey(appStateKey, recordType, recordId, eventType, record) {
    return [
        "notification:v1",
        appStateKey,
        recordType,
        recordId,
        communicationEventFingerprint(recordType, eventType, record)
    ].map(keyPart).join(":");
}
export function communicationEventIsCurrent(appStateKey, recordType, recordId, eventType, record, queuedDedupeKey, queuedVariables) {
    if (!communicationEventRemainsCurrent(recordType, eventType, record, queuedVariables))
        return false;
    if (queuedVariables)
        return true;
    // Backward-compatible fallback for callers/jobs that predate persisted
    // template variables. New jobs use the event-specific monotonic check above.
    return notificationDedupeKey(appStateKey, recordType, recordId, eventType, record) === queuedDedupeKey;
}
export function marketingConsentProviderStatusAfterIntegration(currentStatus, providerStatus, explicitMarketingConsent) {
    return explicitMarketingConsent ? cleanText(providerStatus) : cleanText(currentStatus);
}
export function marketingIntegrationDedupeKey(appStateKey, recordType, recordId, email, policyVersion = "", explicitConsent = false) {
    return [
        "mailchimp-contact:v2",
        appStateKey,
        recordType,
        recordId,
        email,
        explicitConsent ? "pending-opt-in" : "transactional",
        policyVersion || "unversioned"
    ]
        .map(keyPart)
        .join(":");
}
export function getCommunicationTemplateVariables(recordType, recordId, record, restaurantName = "Libabite") {
    const guestCount = Number(recordValue(record, "guests"));
    const totalCents = Number(recordValue(record, "totalCents"));
    return {
        restaurantName: cleanText(restaurantName) || "Libabite",
        recordType,
        recordId: cleanText(recordId),
        recordNumber: cleanText(recordValue(record, "number", "externalId", "id")) || cleanText(recordId),
        customerName: getRecordRecipient(recordType, record).name,
        status: cleanText(recordValue(record, "status", "operationalStatus")),
        paymentStatus: cleanText(recordValue(record, "paymentStatus")),
        fulfillment: cleanText(recordValue(record, "fulfillment")),
        fulfillmentStatus: cleanText(recordValue(record, "fulfillmentStatus", "deliveryStatus")),
        date: cleanText(recordValue(record, "date")),
        time: cleanText(recordValue(record, "time", "requestedTime")),
        guests: Number.isFinite(guestCount) && guestCount > 0 ? Math.floor(guestCount) : null,
        totalCents: Number.isFinite(totalCents) && totalCents >= 0 ? Math.floor(totalCents) : null
    };
}
function orderReference(variables) {
    return `order #${variables.recordNumber || variables.recordId}`;
}
function reservationReference(variables) {
    return [variables.date, variables.time].filter(Boolean).join(" at ") || "your requested time";
}
function messageSummary(eventType, variables) {
    const order = orderReference(variables);
    const reservationTime = reservationReference(variables);
    switch (eventType) {
        case "order.received":
            return { subject: `We received ${order}`, lead: `We received ${order}. Payment and restaurant acceptance may still be pending.` };
        case "order.confirmed":
            return { subject: `${order} is confirmed`, lead: `${order} is confirmed and is being handled by the restaurant.` };
        case "order.ready":
            return { subject: `${order} is ready`, lead: `${order} is ready for pickup or service.` };
        case "order.out_for_delivery":
            return { subject: `${order} is on the way`, lead: `${order} has left the restaurant and is on the way.` };
        case "order.delivered":
            return { subject: `${order} was delivered`, lead: `${order} has been marked delivered.` };
        case "order.cancelled":
            return { subject: `${order} was cancelled`, lead: `${order} has been cancelled.` };
        case "order.refunded":
            return { subject: `Refund update for ${order}`, lead: `A refund update was recorded for ${order}.` };
        case "order.payment_failed":
            return { subject: `Payment failed for ${order}`, lead: `Payment for ${order} was not completed.` };
        case "reservation.request_received":
            return {
                subject: "We received your reservation request",
                lead: `We received your reservation request for ${reservationTime}. This is not yet a confirmed reservation.`
            };
        case "reservation.confirmed":
            return { subject: "Your reservation is confirmed", lead: `Your reservation for ${reservationTime} is confirmed.` };
        case "reservation.rescheduled":
            return { subject: "Your reservation was updated", lead: `Your reservation is now scheduled for ${reservationTime}.` };
        case "reservation.reminder":
            return { subject: "Reservation reminder", lead: `This is a reminder for your reservation on ${reservationTime}.` };
        case "reservation.declined":
            return { subject: "Reservation request update", lead: `We cannot confirm your reservation request for ${reservationTime}.` };
        case "reservation.cancelled":
            return { subject: "Your reservation was cancelled", lead: `Your reservation for ${reservationTime} has been cancelled.` };
    }
}
function htmlEscape(value) {
    return cleanText(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function detailLines(variables) {
    if (variables.recordType === "order") {
        return [
            `Order: #${variables.recordNumber || variables.recordId}`,
            variables.fulfillment ? `Fulfillment: ${variables.fulfillment}` : "",
            variables.paymentStatus ? `Payment: ${variables.paymentStatus}` : "",
            variables.time ? `Requested time: ${variables.time}` : ""
        ].filter(Boolean);
    }
    return [
        variables.date ? `Date: ${variables.date}` : "",
        variables.time ? `Time: ${variables.time}` : "",
        variables.guests ? `Guests: ${variables.guests}` : ""
    ].filter(Boolean);
}
export function buildTransactionalMessage(eventType, variables) {
    const summary = messageSummary(eventType, variables);
    const greeting = variables.customerName ? `Hello ${variables.customerName},` : "Hello,";
    const details = detailLines(variables);
    const text = [
        greeting,
        "",
        summary.lead,
        ...(details.length ? ["", ...details] : []),
        "",
        `Thank you,`,
        variables.restaurantName
    ].join("\n");
    const htmlDetails = details.length
        ? `<ul>${details.map((detail) => `<li>${htmlEscape(detail)}</li>`).join("")}</ul>`
        : "";
    const html = [
        `<p>${htmlEscape(greeting)}</p>`,
        `<p>${htmlEscape(summary.lead)}</p>`,
        htmlDetails,
        `<p>Thank you,<br>${htmlEscape(variables.restaurantName)}</p>`
    ].join("");
    return { subject: summary.subject, text, html };
}
//# sourceMappingURL=communications.js.map