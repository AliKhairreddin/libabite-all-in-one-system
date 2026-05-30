# Libabite All-in-One System

A static prototype for a connected restaurant operations system.

Open `index.html` in a browser to run the demo. The TypeScript source lives in
`src/`, and the browser loads the compiled files from `dist/`.

It includes:

- login with seeded role-based users
- Owner/Admin staff user creation
- role-scoped dashboard navigation
- restaurant settings for Libabite in Roermond, Netherlands
- Phase 5 first complete product loop using one seeded product: Kefta Plate linked to Kefta inventory
- sellable product and purchased product management with active/inactive status, kitchen stations, VAT settings, channel availability, purchase costs, and recipe links
- Phase 6 dine-in POS/order entry with table selection, line notes, modifiers, New/Sent/Preparing/Ready/Served/Paid/Cancelled statuses, payment marking, and receipt preview/print
- order type support for dine-in, takeaway, delivery, phone/message, QR table, website, and external delivery app orders
- Phase 7 kitchen display screens for Burger, Cold mezza, Sweets, Drinks, Grill, and Packaging stations
- per-product station routing so mixed orders only show each station its own items
- kitchen ticket actions for accept, preparing, ready, delayed, issue note, and complete task
- manager kitchen progress view across the full order
- kitchen ticket priority, SLA aging, warnings, and escalation
- Phase 8 receipt and payment tracking with cash, card, online, external delivery app, and unpaid/pay later methods
- receipt details for restaurant, order number, date/time, table/order type, item quantities/prices, VAT, total, payment method, and staff member
- inventory deduction from recipe usage
- Phase 9 waste tracking for staff/admin with product, quantity, unit, reason, staff member, date/time, notes, inventory deduction, and waste cost reporting
- low-stock supplier order drafts
- Phase 10 procedures/SOP management with admin-created procedures, multilingual fields, required tools/products, optional media links, assigned roles, frequency, step checklists, and completion tracking
- staff procedure actions for Done, Problem, and Skip with reason
- manager procedure view for completed procedures, missed/due procedures, staff member, completion time, and notes/issues
- Phase 11 guided recipe execution with required ingredients, preparation steps, actual quantities used, actual cost preview, margin impact, and saved batch results
- prepared batch support that deducts raw ingredients, adds finished/prepared stock to inventory, and updates the prepared product unit cost
- Phase 12 QR dine-in ordering with per-table QR codes, a customer menu/cart flow, kitchen ticket creation, table-aware staff order visibility, and recipe inventory deduction
- admin QR management for creating, disabling, regenerating, and assigning QR codes to tables/areas
- QR payment choices for online payment or order-now-pay-later at the counter/table
- staff scheduling and driver status
- reservations

Phase 5 demo flow:

- Purchased product: Kefta, 30kg starting stock, 5kg minimum, stored in Fridge
- Sellable product: Kefta Plate, recipe uses 200g Kefta per plate
- Staff order: 10 Kefta Plates deducts 2kg from Kefta inventory
- Waste example: 0.25kg wasted Kefta deducts from stock and records waste cost at the Kefta purchase price
- Expected stock proof: 30kg to 28kg, with kitchen ticket, low-stock alert logic, and margin tracking visible

Phase 11 demo flow:

- Recipe execution defaults to a 10kg Kefta Mix Batch
- Staff can enter actual raw quantities, such as 8600g minced beef instead of the planned 8500g
- Saving the batch deducts raw stock, adds 10kg Kefta to prepared inventory, updates Kefta unit cost, and recalculates downstream Kefta Plate cost/margin

Phase 12 demo flow:

- Open a seeded table QR URL such as `http://127.0.0.1:4173/?qr=libabite-table-1`
- Customer sees Table 1, adds QR-available menu items to cart, chooses online payment or pay later, and places the order
- The order is sent to kitchen tickets as a QR table order, staff see the table on Orders/Kitchen screens, and recipe inventory is deducted
- Owner/Admin can manage table QR codes in Settings

Demo logins:

- Owner/Admin: `owner@libabite.nl` / `admin123`
- Manager: `manager@libabite.nl` / `demo123`
- Waiter/Cashier: `waiter@libabite.nl` / `demo123`
- Kitchen staff: `kitchen@libabite.nl` / `demo123`
- Driver: `driver@libabite.nl` / `demo123`

The current version is a static MVP using `localStorage` so it can be tested
immediately before choosing a backend stack.

## Development

Install dependencies once:

```sh
npm install
```

Build the TypeScript source:

```sh
npm run build
```

The source split is intentionally conservative:

- `src/main.ts` is the application entry point.
- `src/core.ts` contains the migrated prototype logic and exported initializer.

This keeps the static demo stable while making future splits into domain,
rendering, and persistence modules much easier.
