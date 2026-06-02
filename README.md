# Libabite All-in-One System

A connected restaurant operations system for Libabite. The full app is still
present: login, orders, kitchen, inventory, procedures, team, settings,
bookings, QR ordering, website ordering, external delivery imports, scanning,
and the underlying domain logic.

The UI is being overhauled with a shadcn-style design system while preserving
the useful parts of the existing app experience.

## Working Preference

When requesting new features, additions, redesigns, or other changes, the user
does not expect old behavior, layout, structure, or implementation details to be
preserved by default. It is okay to rethink or replace existing pieces when that
better serves the new direction.

## Stack

- TypeScript
- Vite
- Tailwind CSS and shadcn/ui dependencies
- shadcn-compatible design tokens and component primitives
- Existing domain/data/shared restaurant modules

## Development

Install dependencies:

```sh
npm install
```

Run the app:

```sh
npm run dev
```

Build the app:

```sh
npm run build
```

Run checks:

```sh
npm run check
```

Run domain tests:

```sh
npm test
```

## Convex Connection

The app now supports Convex-backed state sync while keeping browser storage as
the local fallback. Copy `.env.example` to `.env.local` and fill in:

```sh
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_STATE_KEY=libabite-main
```

Start the Convex backend in one terminal:

```sh
npm run convex:dev
```

Start the Vite app in another terminal:

```sh
npm run dev
```

Until `VITE_CONVEX_URL` is set, the app stays in local browser-storage mode.
When Convex is configured, the topbar status pill shows whether it is
connecting, saving, synced, or in an error state.

The Convex snapshot stores shared restaurant data. Per-browser session fields
like the current login, active view, filters, carts, and in-progress drafts stay
local so one device does not take over another device's workspace.

Convex backend files:

- `convex/schema.ts` defines the shared app snapshot, sync event log, and
  integration config tables.
- `convex/appState.ts` exposes `get`, `bootstrap`, `saveSnapshot`, and
  `logEvent` functions for the browser sync adapter.

## Project Shape

- `index.html` is the Vite entry point for the full restored app.
- `styles.css` contains the current shadcn-style overhaul layer for the existing
  screens.
- `src/main.ts` starts the application.
- `src/app/` contains runtime wiring, actions, state-backed selectors, and event
  binding.
- `src/ui/` contains the current screen renderers.
- `src/domain/`, `src/data/`, and `src/shared/` contain reusable business logic,
  seed data, and utilities.
- `src/components/ui/` and `components.json` provide the shadcn/ui foundation for
  continued React component migration.

New UI work may rethink the existing app behavior and migrate screens into
shadcn-style components incrementally when that fits the requested direction.
