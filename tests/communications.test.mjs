import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTransactionalMessage,
  communicationEventIsCurrent,
  communicationEventRemainsCurrent,
  communicationEventFingerprint,
  getCommunicationTemplateVariables,
  getRecordRecipient,
  hasExplicitMarketingConsent,
  marketingConsentProviderStatusAfterIntegration,
  marketingIntegrationDedupeKey,
  normalizeCommunicationEmail,
  notificationDedupeKey,
  validateCommunicationEvent
} from "../dist/domain/communications.js";

test("communication events must match the stored record type and lifecycle state", () => {
  const paidOrder = {
    status: "New",
    paymentStatus: "Paid",
    raw: { customerEmail: "Guest@Example.com", customerName: "Guest" }
  };
  assert.equal(validateCommunicationEvent("order", "order.confirmed", paidOrder).ok, true);
  assert.equal(validateCommunicationEvent("order", "order.ready", paidOrder).ok, false);
  assert.equal(validateCommunicationEvent("order", "reservation.confirmed", paidOrder).ok, false);

  const pendingReservation = { status: "Pending", email: "guest@example.com" };
  assert.equal(validateCommunicationEvent("reservation", "reservation.request_received", pendingReservation).ok, true);
  assert.equal(validateCommunicationEvent("reservation", "reservation.confirmed", pendingReservation).ok, false);
});

test("recipient extraction normalizes email and marketing consent is strict", () => {
  const record = {
    raw: {
      customerEmail: "  GUEST@Example.COM ",
      customerName: "Guest",
      marketingConsent: true
    }
  };
  assert.deepEqual(getRecordRecipient("order", record), { email: "guest@example.com", name: "Guest" });
  assert.equal(normalizeCommunicationEmail("not-an-email"), "");
  assert.equal(hasExplicitMarketingConsent(record), true);
  assert.equal(hasExplicitMarketingConsent({ raw: { marketingConsent: "true" } }), false);
  assert.equal(hasExplicitMarketingConsent({ raw: { marketingConsent: 1 } }), false);
});

test("notification and integration keys are stable and state-derived", () => {
  const first = { status: "Confirmed", date: "2026-08-20", time: "19:00", guests: 2, email: "g@example.com" };
  const changed = { ...first, time: "20:00" };
  const key = notificationDedupeKey("restaurant", "reservation", "RES-1", "reservation.confirmed", first);
  assert.equal(key, notificationDedupeKey("restaurant", "reservation", "RES-1", "reservation.confirmed", { ...first }));
  assert.notEqual(key, notificationDedupeKey("restaurant", "reservation", "RES-1", "reservation.confirmed", changed));
  assert.notEqual(
    communicationEventFingerprint("reservation", "reservation.confirmed", first),
    communicationEventFingerprint("reservation", "reservation.confirmed", changed)
  );
  assert.equal(
    communicationEventIsCurrent("restaurant", "reservation", "RES-1", "reservation.confirmed", first, key),
    true
  );
  assert.equal(
    communicationEventIsCurrent("restaurant", "reservation", "RES-1", "reservation.confirmed", changed, key),
    false
  );
  assert.equal(
    communicationEventIsCurrent(
      "restaurant",
      "reservation",
      "RES-1",
      "reservation.confirmed",
      { ...first, status: "Cancelled" },
      key
    ),
    false
  );
  assert.equal(
    marketingIntegrationDedupeKey("restaurant", "reservation", "RES-1", "g@example.com", "2026-01"),
    marketingIntegrationDedupeKey("restaurant", "reservation", "RES-1", "g@example.com", "2026-01")
  );
  assert.notEqual(
    marketingIntegrationDedupeKey("restaurant", "reservation", "RES-1", "g@example.com", "", false),
    marketingIntegrationDedupeKey("restaurant", "reservation", "RES-1", "g@example.com", "", true)
  );
});

test("order communication freshness allows forward progress but suppresses contradictory state", () => {
  const queuedConfirmed = {
    status: "New",
    paymentStatus: "Paid",
    fulfillmentStatus: "Not started",
    customerEmail: "guest@example.com"
  };
  const queuedVariables = getCommunicationTemplateVariables("order", "ORD-1", queuedConfirmed);
  const key = notificationDedupeKey("restaurant", "order", "ORD-1", "order.confirmed", queuedConfirmed);

  assert.equal(communicationEventIsCurrent(
    "restaurant",
    "order",
    "ORD-1",
    "order.confirmed",
    { ...queuedConfirmed, status: "Preparing", fulfillmentStatus: "Preparing" },
    key,
    queuedVariables
  ), true);
  assert.equal(communicationEventRemainsCurrent(
    "order",
    "order.out_for_delivery",
    { status: "Completed", fulfillmentStatus: "Delivered", deliveryStatus: "Delivered" }
  ), true);
  assert.equal(communicationEventIsCurrent(
    "restaurant",
    "order",
    "ORD-1",
    "order.confirmed",
    { ...queuedConfirmed, status: "Cancelled", fulfillmentStatus: "Cancelled" },
    key,
    queuedVariables
  ), false);
  assert.equal(communicationEventRemainsCurrent(
    "order",
    "order.payment_failed",
    { status: "New", paymentStatus: "Paid" }
  ), false);
});

test("reservation communication freshness rejects changed booking details", () => {
  const queued = { status: "Confirmed", date: "2026-08-20", time: "19:00", guests: 2, email: "g@example.com" };
  const variables = getCommunicationTemplateVariables("reservation", "RES-1", queued);
  assert.equal(communicationEventRemainsCurrent("reservation", "reservation.confirmed", queued, variables), true);
  assert.equal(communicationEventRemainsCurrent(
    "reservation",
    "reservation.confirmed",
    { ...queued, time: "20:00" },
    variables
  ), false);
  assert.equal(communicationEventRemainsCurrent(
    "reservation",
    "reservation.confirmed",
    { ...queued, status: "Cancelled" },
    variables
  ), false);
});

test("transactional contact completion never downgrades marketing consent status", () => {
  assert.equal(marketingConsentProviderStatusAfterIntegration("subscribed", "transactional", false), "subscribed");
  assert.equal(marketingConsentProviderStatusAfterIntegration("pending", "transactional", false), "pending");
  assert.equal(marketingConsentProviderStatusAfterIntegration("transactional", "pending", true), "pending");
});

test("transactional templates distinguish a request from confirmation and escape HTML", () => {
  const variables = getCommunicationTemplateVariables("reservation", "RES-1", {
    status: "Pending",
    date: "2026-08-20",
    time: "19:00",
    guests: 2,
    name: "<script>alert(1)</script>",
    email: "guest@example.com"
  });
  const message = buildTransactionalMessage("reservation.request_received", variables);
  assert.match(message.text, /not yet a confirmed reservation/i);
  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /&lt;script&gt;/);
});
