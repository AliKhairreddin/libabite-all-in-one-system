# Libabite All-in-One System

A static prototype for a connected restaurant operations system.

Open `index.html` in a browser to run the demo. The TypeScript source lives in
`src/`, and the browser loads the compiled files from `dist/`.

It includes:

- login with seeded role-based users
- Owner/Admin staff user creation
- role-scoped dashboard navigation
- restaurant settings for Libabite in Roermond, Netherlands
- Phase 2 product system with sellable products, purchased products, active/inactive status, kitchen stations, VAT settings, channel availability, purchase costs, and recipe links
- order capture for POS, QR, website, phone, delivery, and takeaway
- kitchen station routing
- kitchen ticket SLA aging, warnings, and escalation
- inventory deduction from recipe usage
- low-stock supplier order drafts
- recipes and actual production logging
- procedures/checklists
- staff scheduling and driver status
- reservations

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
