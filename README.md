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
