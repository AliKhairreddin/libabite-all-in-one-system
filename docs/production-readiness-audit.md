# Libabite production-readiness audit

**Audit date:** 2026-07-14
**Decision:** **NO-GO for production replacement**
**Intended production surfaces:** `libabite-order.thatcanadian.dev` for customers and `libabite-work.thatcanadian.dev` for staff. `thatcanadian.dev`, `app.thatcanadian.dev`, and `libabite.nl` are not deployment targets for this system.

This is a code and architecture readiness assessment, not a claim that every branch, deployed environment, provider account, or existing dataset was inspected. Line references identify the audited tree and may move as the code changes. Legal points are operational guidance, not legal advice; the controller should confirm the final privacy, employment, tax, and consumer-law position with qualified Dutch advisers.

## Executive conclusion

The system has broad restaurant functionality and this implementation round materially improves payment verification, payment-state semantics, historical price integrity, customer communications, and dependency hygiene. Those improvements do **not** make it production-ready yet.

The decisive blockers are architectural:

1. The browser can anonymously read and replace the shared application snapshot, including staff credentials, customer PII, orders, reservations, and operational data.
2. The whole-state, last-writer-wins persistence model can lose concurrent orders, reservations, inventory updates, and staff actions. The supplied `expectedVersion` is recorded but not enforced.
3. A verified provider payment is not yet guaranteed to create the kitchen/fulfilment work without the customer's browser returning successfully.
4. Reservation availability and booking are not one atomic server transaction, so simultaneous requests can double-book.
5. There is no rehearsed migration, reconciliation, rollback, backup, incident-response, or cutover package for replacing the incumbent system.

Until those are closed, only a clearly labelled non-production demo using synthetic data and non-live provider credentials is appropriate.

## Severity model

- **P0 — launch blocker:** can expose or corrupt data, lose/duplicate orders or money, double-book, strand a paid order, or prevent a safe migration. Any open P0 means NO-GO.
- **P1 — required for incumbent replacement:** important operational, privacy, financial, reliability, or recovery work. A P1 may be deferred only if the affected feature is disabled and the owner explicitly accepts the reduced launch scope.
- **P2 — quality and scale:** accessibility, clarity, localization, maintainability, and workflow improvements that should be closed before broad rollout or have a dated owner-approved plan.

## What this implementation round changes

| Workstream | Current code state | What it fixes | What still prevents production sign-off |
|---|---|---|---|
| Provider-verified online payments and webhooks | Implemented and locally type/build tested. Stripe verifies the raw request body/signature and handles paid, asynchronous failure, and expiry events (`convex/paymentWebhooks.ts`); Mollie webhooks re-fetch provider state (`convex/paymentWebhooks.ts`). Provider confirmation validates status, order reference, active session, amount, and currency; the browser applies a return only to the server-confirmed order ID. Checkout uses server-derived totals and monotonic idempotency attempts; a terminal session is recorded failed before replacement, and a newly created session that cannot be recorded is expired/cancelled where the provider permits it (`convex/payments.ts`; `src/app/payment-actions.ts`). | A success URL, edited return URL, or caller-supplied total no longer proves payment or selects the local order. Paid and terminal-failure updates are idempotent, and an expired attempt no longer blocks its replacement. Failed/expired events can queue customer communication. | `STRIPE_WEBHOOK_SECRET` and `MOLLIE_API_KEY` were absent from the inspected production configuration, and there is no live/sandbox delivery, replay, or end-to-end evidence. Durable kitchen dispatch, refunds, disputes, event-ledger dedupe, and reconciliation remain. |
| Explicit payment semantics | Implemented with focused tests. Payment method is descriptive; only normalized explicit status is authoritative (`src/domain/payments.ts:39-65`, `src/app/order-selectors.ts:151-153`). Ledger derivation nets successful charges against refunds and can require an expected amount (`src/domain/payments.ts:105-145`; tests at `tests/domain.test.mjs:72-115`). | Selecting Cash, Card, External, or Online no longer silently means “Paid.” Partial and full refunds no longer count as a paid method shortcut. | Staff/provider status changes must move to authenticated server commands and an append-only ledger. Reporting must reconcile explicit status to verified ledger balance. |
| Immutable accepted-order price and routing snapshots | Implemented with focused tests. Accepted lines snapshot product name, unit cents, VAT setting/rate, line total, and kitchen station; totals use a validated snapshot with a legacy product-price fallback (`src/domain/orders.ts`). Customer and staff creation call the snapshot helper. Orders and tickets remain readable after product deletion, and a provider-paid website order is still dispatched if menu availability changes while payment is pending (`src/app/customer-ordering.ts`; `src/app/staff-orders.ts`; `src/data/normalize.ts`; `src/ui/kitchen.ts`; `src/ui/team.ts`). | Historical receipts, revenue, VAT, product names, and kitchen routing no longer have to change when the menu item is renamed, repriced, disabled, or deleted. | Backfill/reconciliation for legacy orders, historical recipe/cost snapshots, every import/external-order path, modifier/discount/fee/tip snapshots, and server-side price validation still need proof. Legacy fallback should be retired after migration. |
| Transactional communications and Mailchimp | Foundation implemented. Separate notification/integration outboxes and consent evidence exist (`convex/schema.ts`); server-derived, deduplicated jobs use leases, event-specific lifecycle freshness, recipient checks, and retries (`convex/communications.ts`; `convex/communicationsWorker.ts`). Mailchimp Transactional and Marketing adapters exist (`convex/mailchimpAdapters.ts`). Orders and reservations persist strict Boolean consent plus timestamp, policy version, and source; consent is not transferred between email addresses, and a transactional contact sync cannot downgrade a pending/subscribed marketing state. | Provider-verified payment confirmation/failure can safely queue internal messages. Normal forward lifecycle progress no longer suppresses a valid queued message, while contradictory/stale events are discarded. Marketing sync is separate from operational mail; explicit consent advances only to pending/double opt-in, while repeat records do not continually restart that flow. | Browser snapshot writes are intentionally blocked from the internal queue to avoid an open email relay. Order-received and reservation lifecycle messages/contact sync require the future authenticated, atomic server commands. Delivery is at least once: a provider acceptance followed by an ambiguous timeout can still produce a duplicate retry. Provider credentials, DNS, live delivery, bounce/complaint/unsubscribe webhooks, consent withdrawal, dashboards/alerts, and auth remain unverified. |
| Public reservation policy and recovery UX | Implemented on the current client architecture. Defaults and validation use the configured restaurant timezone, opening hours, lead time, horizon, party limit, and absolute cross-date intervals for overnight services/DST (`src/domain/reservations.ts`). Availability refreshes in place when date/time/party changes, unavailable tables remain keyboard-explainable, form values survive validation, and request copy is explicit (`src/ui/public-ordering.ts`; `src/ui/table-map.ts`). | Removes a public booking disclosure, blocks invalid requests, catches adjacent-date overlaps after midnight, reduces stale table selection, and preserves guest input during recovery. | These checks still execute against the anonymously downloaded snapshot. Booking insertion is not an atomic server command, pending holds do not expire, and cancellation/recovery tokens, abuse controls, and contention tests remain absent. |
| Dependency audit | Completed for runtime dependencies. `convex` is `1.42.1` and locked `ws` is `8.21.0`; the webhook uses runtime-compatible Web Crypto rather than a Node-only Stripe SDK (`src/domain/stripe-webhooks.ts`; `convex/paymentWebhooks.ts`). The current-round `npm audit --omit=dev` result is zero known vulnerabilities. | Removes the vulnerabilities reported in the earlier runtime dependency set and keeps the Convex HTTP action compatible with its default runtime. | Keep automated lockfile scanning, review advisories, pin/approve upgrades, and rerun build/tests in CI. Zero known CVEs is not an application-security review. |

Local checks establish only that the current code compiles/builds and its focused tests pass. They do not prove deployed authorization, provider configuration, deliverability, concurrency safety, recovery, or real-world staff workflows.

## P0 — production blockers

### P0.1 Anonymous data plane, plaintext credentials, and client-only authorization

**Evidence**

- `appState.get`, `bootstrap`, `saveSnapshot`, and `logEvent` are public functions with no identity or authorization check (`convex/appState.ts:30-150`).
- The browser creates an anonymous Convex client (`src/app/convex-client.ts:24-32`), subscribes to the shared document, and sends full shared snapshots (`src/app/convex-sync.ts:169-176,197-220,253-258,334-337`).
- Full state is also stored as JSON in browser `localStorage` (`src/data/storage.ts:1-15`, `src/app/state.ts:19-24`).
- Staff login compares a plaintext password from the downloaded state (`src/app/session-actions.ts:11-25`), and active seed users still have plaintext passwords (`src/data/seed.ts:37-100`). This round removed the visible prefilled/demo-login shortcuts, but that does not change the underlying credential exposure or make client-only login an authorization boundary.
- Role checks such as `can()` and `canView()` are client helpers (`src/app/permissions.ts:22-40,89-97`), not a server security boundary.

**Risk:** anyone who can reach the deployment and knows or discovers the shared state key can read customer/staff data, impersonate staff, replace operational state, forge audit metadata, or destroy data. Hiding buttons does not authorize mutations. Convex's own guidance expects every public request to authenticate and authorize the caller: [Convex authentication and authorization](https://docs.convex.dev/auth/overview).

**Acceptance criteria**

- Staff use a production identity provider/session system with MFA for owner/manager roles; there are no application passwords in state, HTML, local storage, logs, or client bundles.
- Every public Convex query, mutation, action, and HTTP action has an explicit actor/tenant/role or narrowly scoped public policy; provider callbacks verify signatures or re-fetch provider state. Privileged implementation functions are internal.
- Customer endpoints expose only public menu/availability data and scoped opaque order/reservation capabilities, never the staff snapshot.
- Negative integration tests prove anonymous customers, staff from another role, and another tenant cannot read or mutate protected data.
- All demo credentials are removed from production builds and all possibly exposed credentials/secrets are rotated before real use.

### P0.2 Whole-snapshot persistence can lose concurrent work

**Evidence**

- `saveSnapshot` accepts `expectedVersion` but never compares it with the stored version before replacing `state`; it only records the value in an event (`convex/appState.ts:76-130`).
- A client with queued local changes ignores a remote update and later writes its own full snapshot (`src/app/convex-sync.ts:197-220,233-295`).
- Orders, payments, reservations, inventory, customers, and other operational tables are mirrors rebuilt from that snapshot, not independent sources of truth (`convex/appState.ts:104,128`; `convex/operationalSync.ts:215-290`).

**Risk:** two cashiers, a customer checkout, a reservation request, and a kitchen update can overwrite one another. A payment mutation can be correct and still be erased by a later stale browser snapshot. Mirroring does not restore the lost command.

**Acceptance criteria**

- Canonical Convex tables, not `appStates.state`, are the source of truth for users, menu, orders/lines, reservations, payments/refunds, inventory movements, tickets, shifts, customers, consent, and outboxes.
- Each business command is a bounded Convex mutation that reads current records, validates invariants, and atomically patches/inserts only affected documents. External calls happen in actions with durable command/outbox records.
- Commands have stable idempotency keys; status transitions are validated; immutable financial/history records cannot be silently rewritten.
- The browser never receives or writes the whole database. Local storage contains only non-sensitive UI preferences and resumable opaque tokens.
- Automated contention tests with simultaneous devices demonstrate zero lost orders, duplicate numbers, negative stock caused by races, or double bookings. Convex mutations provide atomic transactions when the invariant is kept inside the mutation: [Convex mutations](https://docs.convex.dev/functions/mutation-functions) and [OCC/atomicity](https://docs.convex.dev/database/advanced/occ).

### P0.3 Verified payment is not yet a durable fulfilment command

**Evidence**

- Checkout now creates a pending order first so the server can derive and validate the amount. If initial sync/session creation fails, the attempt remains auditable as Cancelled/Failed, its number is not reused, and the cart plus complete checkout draft are restored; the cart clears only after a provider session exists (`src/app/customer-ordering.ts`; `src/domain/checkout-draft.ts`). Provider-issued retry attempt numbers are preserved monotonically so an expired session does not reuse its idempotency key. This is a sounder checkout pattern, but the pending order and retry identity still live inside the shared-snapshot architecture.
- A verified webhook marks the order paid and sets `needsKitchenDispatch: true`, but no backend worker consumes that flag. The browser return path still calls `sendOrderToKitchen`. That client path now treats the paid order as an accepted commitment and uses its product/station snapshots, so a menu disable/delete during checkout does not itself strand the order; it still depends on the browser returning.
- Same-browser retry is implemented (`src/app/customer-ordering.ts:496-558`; `src/ui/public-ordering.ts:907-937`), but durable cross-device recovery still depends on an opaque customer capability/email link that does not yet exist.

**Risk:** a customer can pay and close the browser, lose connectivity, or block the redirect; payment becomes Paid but no kitchen tickets/inventory/receipt work is guaranteed. Abandoned pending orders can also accumulate until an explicit expiry/cleanup policy is implemented.

**Acceptance criteria**

- Provider-confirmed payment and creation of a durable `dispatch_order` workflow/outbox entry commit together. A backend worker idempotently creates kitchen tickets, reserves/deducts stock at the approved point, queues the receipt, and records completion.
- The browser return page is a status display/recovery surface, never the source of truth for payment or fulfilment.
- Customers can resume/retry a pending checkout through an opaque, expiring order capability; duplicate attempts cannot create duplicate charges or kitchen work.
- Pending checkout expiry/cancellation releases reservations and stock; failed, asynchronous, refunded, disputed, and out-of-order events have defined transitions.
- Provider sandbox tests cover invalid signatures, wrong session/order/amount/currency, duplicate and replayed events, browser-never-returns, delayed iDEAL success, failures, refunds, and provider outage. Stripe recommends webhook-based fulfilment, signature verification using the raw body, and pre-live webhook testing: [Stripe fulfilment](https://docs.stripe.com/checkout/fulfillment), [webhooks](https://docs.stripe.com/webhooks), and [signature verification](https://docs.stripe.com/webhooks/signature).

### P0.4 Reservations are neither atomic nor operationally complete

**Evidence**

- Policy, availability, blocks, capacity, and conflict validation are now coherent and reactive in the browser (`src/domain/reservations.ts:70-188,443-518`; `src/ui/public-ordering.ts:672-879`; `src/app/events.ts:432-456`). Unavailable public table controls are disabled (`src/ui/table-map.ts:56-109`) and validation errors keep the guest's form values (`src/app/reservation-actions.ts:205-250`).
- Those improvements still read the anonymously downloaded reservation/table snapshot, after which the browser appends a reservation to the shared array. There is no server transaction that rechecks and inserts the slot atomically (`src/app/reservation-actions.ts:205-250`).
- Pending requests immediately consume table availability through the active-status model, but have no server-owned hold expiry, cleanup job, guest cancellation/recovery capability, or authenticated staff/customer boundary.
- The UI makes phone and email individually optional while validation requires at least one. Contact format, rate limiting, bot protection, holiday/service-specific hours, and an explicit last-seating rule remain incomplete.

**Risk:** simultaneous requests can allocate the same table; guests can request closed or past times; the map can show stale availability and submit a different table than expected.

**Acceptance criteria**

- A single server mutation validates business timezone (`Europe/Amsterdam` unless the owner chooses otherwise), hours, lead time, horizon, blocks, capacity, table joins, turnover, current conflicts, and contact rules, then creates a request/hold atomically.
- Define whether public booking is an immediate confirmed reservation or a request awaiting staff approval; UI, email, capacity hold, expiry, and statuses must follow that one model.
- Availability refreshes when date/time/party changes; invalid tables are disabled and explained; failures preserve all entered values and focus the error.
- A confirmation/cancellation token lets a guest safely view or cancel only their own booking.
- Simultaneous-booking tests prove capacity and table invariants. Focused domain tests now cover timezone/DST and adjacent-date midnight overlap; past time, blocked period, joined tables, no-show, reschedule, cancellation release, and true concurrent insertion still require complete integration coverage.

### P0.5 No rehearsed migration, reconciliation, and rollback plan

The target is to replace the real incumbent system, but the repository does not define a complete source inventory, mapping, trial import, delta cutover, financial reconciliation, rollback, or ownership plan. `libabite.nl` should be treated as a migration source/parallel reference only, not the deployment target.

**Acceptance criteria**

- Inventory every incumbent entity and integration: products/modifiers/VAT, tables, customers/consents, open and historical orders, reservations/deposits, payments/refunds, gift/loyalty data if used, suppliers, stock/movements, recipes/yields, staff/roles/shifts, procedures, printers/terminals, and accounting/export identifiers.
- Approve field mappings, status mappings, immutable IDs, timezone/currency/VAT rounding, dedupe rules, retention, rejected-record handling, and ownership for each exception.
- Run at least two production-like migration rehearsals using sanitized data. Reconcile source/target counts, money/VAT totals, stock balances, future reservations, open orders, and sampled customer histories with signed results.
- Run a time-boxed parallel operation and a final delta migration. Define the exact write freeze, cutover, health checks, support staffing, and rollback triggers.
- Take verified source and target backups immediately before cutover. Rollback is rehearsed and restores service without duplicating charges, messages, or order numbers.

## P1 — required before replacing the incumbent

| Area | Remaining gap | Required outcome |
|---|---|---|
| Payment lifecycle and reconciliation | Paid, asynchronous-failure, and expiry handling now exist (`convex/paymentWebhooks.ts:38-95`; `convex/payments.ts:559-709`), but refunds/partial refunds, disputes, cash/terminal settlement, a durable provider-event ledger, end-of-day reconciliation, and provider-vs-ledger drift are not end-to-end workflows. | Append-only charge/refund ledger; authenticated approval rules; provider event log/dedupe; scheduled reconciliation; exception queue; refund receipt/customer notice; daily totals tied to POS/accounting. |
| Communications delivery and consent lifecycle | Outboxes end at provider “accepted”; no delivery/bounce/complaint webhook, suppression list, unsubscribe/withdrawal flow, or operator retry dashboard. Paid/failure messages are queued by backend payment actions, but browser-originated order/reservation hooks intentionally return `trusted_server_command_required` (`src/app/communication-actions.ts`) until those records have trusted server-owned commands. | Authenticated order/reservation commands queue their lifecycle events atomically; provider webhooks update delivery state; permanent failures suppress; staff can inspect/retry safely; consent can be withdrawn as easily as given; unsubscribe reaches local source of truth; retention and deletion are defined. Transactional messages remain separate from campaigns. |
| Online order policy | Website orders have no requested slot (`src/app/customer-ordering.ts:350-409`), delivery zone/minimum/fee, hours/holiday closure, lead time/cutoff, kitchen capacity, throttling, or server-side stock/price validation. | Server quote and accept commands enforce menu version, price, stock reservation, hours, zones, fees/minimums, capacity, fulfilment slot, tax/rounding, and idempotency; the customer sees the same accepted promise and total. |
| Durable customer recovery | Latest order/reservation IDs are deliberately local-only (`src/app/convex-sync.ts:29-50`), and confirmations depend on those local IDs (`src/ui/public-ordering.ts:915-940,1051-1061`). | Opaque expiring lookup capability plus email link; status/retry/cancel/receipt survives browser/device loss without exposing sequential IDs or other customers. |
| Historical pricing completion | Core line snapshots exist, but modifiers, discounts, fees, tips, delivery charges, external commissions, refunds, and imported legacy lines are not one immutable financial model. | Accepted quote/order stores every money component in integer cents, currency, VAT basis/rate/amount, promotion identity, and rounding result; receipts and reports never consult today's catalog. |
| Privacy governance | No public privacy notice, retention schedule, data-subject request workflow, processor/subprocessor register, or deletion/anonymization process was found. Full PII is copied to browser storage and raw mirror fields. | Approved lawful-basis/retention matrix, clear notice, vendor DPAs/transfer review, minimised schemas/logs, access/export/correction/deletion workflows, and documented legal holds. EU guidance requires purpose limitation, minimisation, storage limitation, and security: [European Commission GDPR principles](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/principles-gdpr/overview-principles/what-data-can-we-process-and-under-which-conditions_en). |
| Staff time and payroll safety | Running shifts and open breaks now stop accruing at a planned-end grace limit and hard safety cap; late punches are retained and marked `Needs review` instead of silently inflating actual/break hours (`src/domain/scheduling.ts`; `src/app/scheduling-actions.ts`). | Add manager correction with mandatory reason/audit, restaurant-timezone and DST policy, approved break rules, locked payroll periods, export reconciliation, alerts, and employment-law review. |
| External delivery, terminals, printers, and maps | Several adapters and screens are readiness scaffolding/static demonstrations rather than provider-certified integrations. Receipt printing relies on a local agent. The driver map in `index.html:1237-1253` is static. | Explicitly disable unverified providers/features, or complete credentials, signed/provider-verified webhooks, health checks, retry/idempotency, certification, offline behavior, and operator runbooks for each. |
| Security headers and secrets operations | Baseline HSTS, nosniff, frame denial, referrer, permissions, and opener headers are now configured for Pages (`public/_headers`) and edge responses (`worker/libabite-edge.ts`). A CSP and documented secret rotation/access policy are still absent. | Test and deploy a CSP compatible with required map/image/provider origins; use least-privilege deploy keys, separate staging/live secrets, a rotation schedule, secret inventory/owner, audit logging, and no secrets in `VITE_*` variables or bundles. |
| Backup, observability, and support | No repository runbook demonstrates scheduled backups, restore drills, alerting, or incident ownership. | Implement the checklists below, assign primary/backup on-call owners, and complete a production-like game day. |

## P2 — quality, accessibility, and maintainability

- Run full keyboard/screen-reader regression coverage for the new skip link, active-navigation semantics, pressed-state fulfilment controls, and Escape/focus-trapped upsell dialog.
- Reduced-motion behavior is now present. Keep the document language synchronized if localization is activated, and test WCAG 2.2 AA behavior at 200% zoom with keyboard and screen readers.
- The shared PWA now uses neutral restaurant branding and a square local icon, but customer/staff installation scope, offline checkout policy, and a purpose-built maskable icon still need explicit product decisions and device tests.
- Add search/filtering to the large menu and show “allergen information not verified” rather than silently rendering nothing when metadata is absent (`src/ui/public-ordering.ts:596-615,900-950`).
- Remove production demo/reset controls, “Phase” implementation labels, prefilled admin/import values, and sample credentials (`index.html:1189-1253,1383-1535`).
- Reconcile role capabilities with reachable views (`src/shared/constants.ts`), and replace English text mislabeled as `nl/ar/tr` (`src/data/seed.ts`). Zero-delivery success now renders as “N/A.”
- Establish component, state, error, and design-system conventions before expanding the mixed legacy DOM/React surface.

## Product-scope decisions required before replacement

These are not automatically defects; the owner must either accept and test them as in-scope or explicitly disable/document them at launch:

- Dine-in courses, seat/table transfers, split bills, tips, discounts/comps/voids, cash drawer close, terminal reconciliation, refunds, and manager approvals.
- Legally compliant receipt/invoice numbering, VAT treatment, accounting export, day close, and immutable financial audit history.
- Reservation deposits, waitlist, no-show policy, table joins, events/large parties, cancellation windows, and walk-ins.
- Pickup/delivery zones, fees/minimums, fulfilment slots, courier handoff, proof of delivery, and customer support/refunds.
- Kitchen display/printer failover, offline behavior, duplicate-ticket prevention, device enrollment, and paper fallback.
- Inventory units/conversions, recipe yield, waste, purchasing, stocktake, negative-stock policy, and historical cost.
- Loyalty, gift cards, campaigns, customer segmentation, and any external marketplace integrations.

Each enabled capability needs an owner, written invariant, acceptance test, failure mode, dashboard, and support procedure.

## Industry-standard migration sequence

### 0. Contain and preserve

1. Keep real data and live credentials out of the current anonymous snapshot deployment.
2. If real data was used, follow the incident procedure below before deleting or rotating evidence.
3. Export and verify current source/target backups; record versions, environment configuration names, provider webhook settings, and domain/DNS state.

**Exit:** exposure is contained, evidence is preserved, secrets/credentials have an owner, and a written incident determination exists.

### 1. Establish isolated environments and release controls

1. Create separate development, staging, and production Convex deployments and separate Stripe/Mollie/Mailchimp test/live configurations.
2. Add CI gates for type check, build, tests, dependency audit, secret scan, and migration validation. Production deploys require approval and a rollback artifact.
3. Configure only the two active hostnames; do not route this project to the apex or former `app` hostname.

**Exit:** staging is production-shaped but uses synthetic data/test providers; no developer frontend points at production by default; rollback is documented.

### 2. Build the identity and authorization boundary

1. Add staff identity, server sessions, MFA for privileged roles, tenant/restaurant membership, and server-side RBAC.
2. Split public customer reads/commands from staff operations. Convert implementation helpers to internal functions.
3. Remove all password fields/demo users from domain state and browser storage; rotate possible exposures.

**Exit:** the P0.1 criteria and an independent authorization/tenant-isolation test pass.

### 3. Migrate from snapshots to canonical transactional records

1. Define schemas and state machines for order, order line, quote, reservation/hold, payment/refund, inventory movement, ticket, shift, customer, consent, and outbox.
2. Implement idempotent command mutations and immutable history/audit events. Use indexed, scoped queries and pagination.
3. Run a temporary dual-read comparison if necessary, but never dual-write without a single authoritative write path and reconciliation.

**Exit:** no production feature depends on `appStates.state`; contention tests and invariants pass; operational mirrors are removed or explicitly read-only projections.

### 4. Make ordering and reservation acceptance authoritative

1. Server creates a quote from current menu, VAT, modifiers, fees, stock, hours, zone, and capacity, then accepts an immutable order with a stable idempotency key.
2. Server atomically creates reservation request/hold after rechecking all capacity and policy rules.
3. Add opaque public recovery links, expiry, cancellation/retry, and staff exception queues.

**Exit:** all P0.4 criteria pass; concurrent order/booking/load tests show no lost update, overbooking, duplicate number, or unjustified oversell.

### 5. Complete payment-to-fulfilment orchestration

1. Keep current server-created provider sessions and provider verification.
2. Add durable paid-to-dispatch workflow, full event lifecycle, append-only ledger, reconciliation, and authenticated refund controls.
3. Register/test live HTTPS endpoints and alerts; run replay and chaos tests.

**Exit:** all P0.3 criteria pass in provider sandbox and a controlled live low-value transaction/refund; a paid order reaches kitchen without any browser return.

### 6. Complete communications and privacy controls

1. Move the now-captured order/reservation consent evidence into the canonical authenticated data model and provide withdrawal/unsubscribe.
2. Finish delivery/bounce/complaint webhooks, suppression, operator dashboard, templates, localization, retention, and data-subject workflows.
3. Verify Mailchimp sending domain/DNS and ensure marketing uses confirmed/pending opt-in, while contract/service messages remain transactional.

**Exit:** transactional and marketing paths pass provider tests; a non-consenting customer never receives a campaign; unsubscribe/withdrawal suppresses future marketing promptly; retries do not duplicate messages.

### 7. Rehearse migration and parallel operations

1. Execute the P0.5 mapping, rehearsal, reconciliation, exception, and rollback plan.
2. Train each role on normal and failure workflows; run full service simulations with kitchen, floor, reservation, delivery, payment, and support staff.
3. Run the incumbent and new system in the approved parallel mode, reconcile daily, and resolve every unexplained difference.

**Exit:** signed business, finance, security/privacy, and operations acceptance; zero unexplained financial/future-booking variances; support and rollback teams are ready.

### 8. Controlled cutover and stabilization

1. Take final backups, freeze source writes, apply/reconcile delta, then enable traffic gradually.
2. Use explicit go/no-go checks below. Monitor a staffed stabilization window and keep the incumbent rollback path intact.
3. Retire the incumbent only after the agreed reconciliation and retention period, not immediately after first successful orders.

**Exit:** post-cutover SLOs hold, no P0 incident is open, reconciliation is signed, and rollback is no longer required.

## Required environment and configuration checklist

Never place a secret in a `VITE_*` variable; those values are embedded in browser assets.

### Public build / Cloudflare

- [ ] `VITE_CONVEX_URL` points to the intended environment.
- [ ] `VITE_CONVEX_DISABLED=false` only where the authenticated backend is ready.
- [ ] Replace the global `VITE_CONVEX_STATE_KEY` security assumption; a public state key is an identifier, not authorization.
- [ ] `VITE_CUSTOMER_SITE_URL=https://libabite-order.thatcanadian.dev`.
- [ ] `VITE_STAFF_APP_URL=https://libabite-work.thatcanadian.dev`.
- [ ] `VITE_ONLINE_PAYMENT_PROVIDERS` lists only provider keys that are configured and tested in the matching Convex environment (default: `stripe`).
- [ ] Cloudflare routes/certificates cover only intended hosts; redirects are canonical; preview deployments cannot access production data.
- [ ] CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame protection, cache policy, source maps, and error pages are reviewed.
- [ ] Service worker/cache versioning cannot serve stale checkout/auth code after a release.

### Convex and identity

- [ ] Separate production deployment, deploy key, team membership, least privilege, dashboard edit confirmation, log streaming, and exception integration.
- [ ] Production auth provider/issuer/audience and any server-only auth secrets; allowed origins exactly match the two active domains.
- [ ] `CUSTOMER_SITE_URL=https://libabite-order.thatcanadian.dev`.
- [ ] `CONVEX_SITE_URL` is the production Convex HTTP-action origin used to build the Mollie webhook URL.
- [ ] Retention/config values: restaurant timezone, currency, VAT rules, opening/holiday hours, lead/horizon, delivery zones/fees/minimums, checkout/hold expiry, and policy versions.

### Payments

- [ ] `STRIPE_SECRET_KEY` in Convex production environment.
- [ ] `STRIPE_WEBHOOK_SECRET` for the exact production endpoint; never reuse a Stripe CLI signing secret.
- [ ] Stripe endpoint: `<CONVEX_SITE_URL>/payments/stripe/webhook`; approved event list includes the full implemented lifecycle, not success only.
- [ ] `MOLLIE_API_KEY` and Mollie profile/webhook configuration; test and live keys are separated.
- [ ] Return/cancel URLs resolve to the customer domain; amount/currency/VAT and iDEAL/card configuration are approved.
- [ ] Idempotency, webhook replay, refund/dispute permissions, reconciliation owner, and provider dashboard alerts are configured.

### Mailchimp and email

- [ ] `TRANSACTIONAL_EMAIL_PROVIDER=mailchimp_transactional`.
- [ ] `MAILCHIMP_TRANSACTIONAL_API_KEY`.
- [ ] `MAILCHIMP_TRANSACTIONAL_FROM_EMAIL` and optional `MAILCHIMP_TRANSACTIONAL_FROM_NAME` / `MAILCHIMP_TRANSACTIONAL_REPLY_TO`.
- [ ] `MAILCHIMP_MARKETING_API_KEY`, `MAILCHIMP_MARKETING_AUDIENCE_ID`, `MAILCHIMP_MARKETING_STORE_ID`, and `MAILCHIMP_MARKETING_SERVER_PREFIX` (or a valid key suffix).
- [ ] Sending domain ownership, SPF as applicable, DKIM, DMARC, reply mailbox, templates, branding, and provider webhooks are verified. Mailchimp requires domain authentication for Transactional sending: [Mailchimp authentication and delivery](https://mailchimp.com/developer/transactional/docs/authentication-delivery/).
- [ ] Audience defaults, double opt-in flow, unsubscribe/suppression, privacy notice, consent policy version/text, processor terms, and data location/transfer review are approved.

### Devices and operations

- [ ] Printer agent enrollment, queue authentication, allowed printers, retry/paper fallback, and health alert.
- [ ] Payment terminals, cash drawers, receipt numbering, tax/accounting exports, and day-close owners.
- [ ] Staff role membership, MFA recovery, device loss/revocation, shared-device sign-out, and support contacts.

## Monitoring checklist

- [ ] Structured correlation IDs connect order/reservation command, provider session/event, ledger entry, dispatch job, kitchen tickets, receipt, and communication jobs.
- [ ] Logs redact passwords, secrets, addresses, phone/email where unnecessary, provider payload details, and payment metadata; production logs are not streamed to clients.
- [ ] Dashboards: order acceptance, checkout start, paid, dispatch, ready/delivered; reservation requests/conflicts; inventory shortages; outbox depth/age/status; printer health; stale shifts; provider and Convex errors.
- [ ] Alerts: authorization denials/anomalies, invalid webhook signatures, webhook/action errors, amount mismatch, stale Pending/Paid-not-dispatched orders, duplicate command attempts, reservation conflicts, negative stock, outbox retries/failures, bounce/complaint spike, stale open shift, backup failure.
- [ ] Approved SLOs and thresholds for customer order success, payment-to-dispatch latency, reservation acceptance, email acceptance/delivery, staff app availability, and support response.
- [ ] Daily automated financial reconciliation compares provider captures/refunds, application ledger, paid orders, receipts, and accounting/day-close totals.
- [ ] On-call primary/backup, escalation paths, provider status links, customer-support scripts, and incident severity definitions are published and tested.

## Backup and recovery checklist

- [ ] Scheduled Convex production backups include all canonical tables/file storage, plus a pre-deploy/pre-migration manual backup. Convex documents that backups exclude code, environment variables, and pending scheduled functions, so those require separate versioned recovery material: [Convex Backup & Restore](https://docs.convex.dev/database/backup-restore).
- [ ] Periodic off-platform export is encrypted, access-controlled, retention-limited, and restore-tested; backup access is audited.
- [ ] Versioned source, lockfile, schema/migrations, provider endpoint configuration, DNS/Cloudflare configuration, environment-variable **names and recovery procedure** (not secret values), and device configuration are recoverable.
- [ ] Business approves RPO/RTO for ordering, payments, reservations, inventory, and staff operations; manual fallback procedures cover the full RTO.
- [ ] Quarterly restore drill into an isolated deployment verifies record counts, financial totals, future reservations, files, indexes, auth, outbox behavior, and application startup.
- [ ] Restore/replay rules prevent duplicate provider charges, emails, kitchen tickets, receipt numbers, stock movements, and order numbers.
- [ ] Recovery runbook covers bad deploy, bad data migration, compromised credential, provider outage, Convex outage, Cloudflare outage, printer/terminal failure, and lost staff device.

## Testing checklist

- [ ] Unit/property tests for money in integer cents, VAT/rounding, immutable snapshots, status machines, timezones/DST, capacity, inventory conversion, and permissions.
- [ ] Convex integration tests for authenticated commands, tenant/role isolation, indexes, transactions, outbox leases/retries, idempotency, and migration/backfill.
- [ ] Concurrency tests with multiple cashiers/customers/kitchen devices for order numbers, stock, reservation slots, payments, shifts, and state transitions.
- [ ] Browser E2E on customer and staff domains for pickup/delivery/QR, cancellation/retry, device/browser loss, public recovery, reservation/reschedule/cancel, and every staff role.
- [ ] Payment provider sandbox plus controlled live tests for success, asynchronous success, failure, cancellation, expiry, duplicate/replayed/out-of-order webhook, bad signature, mismatch, partial/full refund, dispute, and outage.
- [ ] Mailchimp tests for transactional acceptance/delivery/bounce, optional consent, pending double opt-in, already-unsubscribed contact, withdrawal, duplicate event, retry, rate limit, bad credentials, and provider outage.
- [ ] Security tests for anonymous access, horizontal/vertical authorization, tenant isolation, ID enumeration, CSRF/session fixation as applicable, XSS/template escaping, rate limiting/abuse, secret leakage, CSP, dependency and supply-chain risk.
- [ ] Accessibility test to WCAG 2.2 AA target with keyboard, screen reader, focus, zoom, contrast, reduced motion, errors, dialogs, and language metadata.
- [ ] Load/soak tests at peak ordering and booking bursts; monitor Convex limits, OCC conflicts, provider rate limits, outbox backlog, and UI latency.
- [ ] Migration reconciliation, backup restore, rollback, outage/game-day, printer/terminal fallback, and staff UAT are signed by named owners.

## Security incident guidance if real data was used

The audit does **not** establish that a breach occurred. However, if real customer, staff, payment-reference, reservation, inventory, or payroll data was ever loaded into a publicly reachable deployment with the current anonymous `appState` functions, treat it as a **potential exposure until investigated**.

1. **Contain without destroying evidence.** Restrict public traffic/functions or place the service in maintenance mode. If necessary, pause the affected deployment after considering operational impact. Preserve Cloudflare, Convex, identity, Stripe, Mollie, Mailchimp, browser/report, and deployment logs; record UTC times and responders.
2. **Snapshot evidence and scope.** Take a protected backup/export before remediation. Establish deployments, state keys, dates, IPs/request IDs where available, data categories/subjects, reads/writes, modifications/deletions, and whether data was copied to client storage or logs.
3. **Assume exposed credentials are compromised.** Remove demo credentials, force staff password resets, invalidate sessions, and warn users not to reuse those passwords. Rotate affected Convex deploy keys, identity secrets, Cloudflare tokens, Stripe/Mollie keys and webhook secrets, Mailchimp keys, printer credentials, and any shared operational credentials. Do not rotate blindly before preserving evidence and dependencies.
4. **Protect operations and money.** Compare provider transactions to orders/ledger, freeze suspicious refunds/admin actions, reconcile future reservations and inventory, and restore altered records only through an auditable plan.
5. **Escalate privacy/legal review immediately.** Notify the controller, security lead, DPO/privacy counsel, insurers, and relevant processors. Under GDPR, a supervisory-authority notification can be required without undue delay and at the latest 72 hours after awareness when the breach is likely to risk people's rights and freedoms; high-risk cases can also require notice to affected people: [European Commission breach guidance](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/obligations/what-data-breach-and-what-do-we-have-do-case-data-breach_en). Document the decision even when notification is not required.
6. **Eradicate and validate.** Deploy the authenticated, transactional boundary; test from an unauthenticated network/client; confirm old endpoints, tokens, browser caches, backups, and credentials cannot reopen access.
7. **Recover gradually and learn.** Restore only reconciled data, monitor closely, communicate accurately, complete a blameless root-cause/post-incident report, and track every corrective action to closure.

## Email/marketing compliance baseline

- Operational receipts, order status, payment failure/refund, and reservation messages must be driven by the customer's transaction/service and must not contain unrelated promotion.
- Marketing consent must be optional, unticked, specific, informed, provable, versioned, and as easy to withdraw as to give. EU guidance describes valid consent and withdrawal: [European Commission — when consent is valid](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/legal-grounds-processing-data/grounds-processing/when-consent-valid_en).
- The Netherlands ACM says electronic advertising generally requires prior consent, clear sender identity, and a quick/free unsubscribe; its existing-customer exception is limited to related products/services. The proposed implementation intentionally uses the safer explicit-consent plus pending/double-opt-in route: [ACM spam guidance](https://www.acm.nl/nl/verkoop-aan-consumenten/reclame-en-verleiden/spam-voorkomen-uw-reclame) and [Dutch government business guidance](https://business.gov.nl/regulations/advertising/).
- Mailchimp documents Transactional as appropriate for one-to-one order confirmations and says the application remains the contact source of truth: [Mailchimp Transactional fundamentals](https://mailchimp.com/developer/transactional/docs/). Its e-commerce guidance documents creating a transactional contact first and then setting `pending` for double opt-in: [Mailchimp e-commerce API guidance](https://mailchimp.com/developer/marketing/docs/e-commerce/).
- Never re-subscribe an unsubscribed/cleaned contact automatically. Keep local consent/suppression state authoritative, process provider updates, and preserve evidence for the approved retention period.

## Explicit production go/no-go gate

### Security and data

- [ ] P0.1 authentication/authorization criteria pass, demo credentials are absent, and possible exposures are resolved.
- [ ] P0.2 canonical transactional migration is complete; no production path reads/writes the whole shared snapshot.
- [ ] Independent security review and negative authorization/tenant tests pass with no critical/high unresolved finding.

### Orders, reservations, and money

- [ ] P0.3 paid-to-fulfilment criteria pass without browser return.
- [ ] P0.4 atomic reservation criteria pass under contention and timezone/DST tests.
- [ ] Prices/VAT/fees/modifiers/discounts/refunds are immutable and reconciled; finance signs receipts, reports, provider totals, and accounting export.
- [ ] Provider live configuration and controlled transaction/refund evidence are attached.

### Communications and privacy

- [ ] Transactional email, marketing opt-in, unsubscribe/withdrawal, suppression, and provider failure paths pass.
- [ ] Privacy notice, lawful-basis/retention matrix, processor agreements/transfer review, data-subject process, and incident plan are approved.

### Migration and operations

- [ ] P0.5 rehearsals, reconciliation, parallel run, backup, restore, and rollback pass with named sign-off.
- [ ] Monitoring/alerts, SLOs, support/on-call, device/printer/terminal fallback, staff training, and game day pass.
- [ ] No open P0; every enabled P1 has passed or has an explicit owner-approved feature disablement and fallback.

**Decision rule:** if any box above is unchecked, any P0 is open, or the evidence is only a local compile/test rather than a production-like verification, the answer is **NO-GO**. As of this audit, multiple P0 gates are open, so the current decision is **NO-GO**.

## Authoritative references

- Stripe: [webhook security and testing](https://docs.stripe.com/webhooks), [signature verification/raw body](https://docs.stripe.com/webhooks/signature), [Checkout fulfilment](https://docs.stripe.com/checkout/fulfillment), [idempotent requests](https://docs.stripe.com/api/idempotent_requests).
- Mailchimp: [Transactional fundamentals](https://mailchimp.com/developer/transactional/docs/), [sending-domain authentication](https://mailchimp.com/developer/transactional/docs/authentication-delivery/), [Marketing audience status](https://mailchimp.com/developer/marketing/guides/create-your-first-audience/), [e-commerce opt-in/double-opt-in](https://mailchimp.com/developer/marketing/docs/e-commerce/).
- Convex: [authentication/authorization](https://docs.convex.dev/auth/overview), [transactional mutations](https://docs.convex.dev/functions/mutation-functions), [OCC and atomicity](https://docs.convex.dev/database/advanced/occ), [production deployments](https://docs.convex.dev/production/overview), [Backup & Restore](https://docs.convex.dev/database/backup-restore).
- EU/GDPR: [processing principles](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/principles-gdpr/overview-principles/what-data-can-we-process-and-under-which-conditions_en), [valid consent](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/legal-grounds-processing-data/grounds-processing/when-consent-valid_en), [personal-data breach response](https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/obligations/what-data-breach-and-what-do-we-have-do-case-data-breach_en), [ePrivacy Directive](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32002L0058).
- Netherlands: [ACM electronic-advertising/spam rules](https://www.acm.nl/nl/verkoop-aan-consumenten/reclame-en-verleiden/spam-voorkomen-uw-reclame), [Business.gov.nl advertising rules](https://business.gov.nl/regulations/advertising/).
