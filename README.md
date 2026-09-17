# macro-tracker

A frontend-only macro tracker: log food per day on a calendar, choose which macros you care about,
set calorie and macro goals, and watch a daily calorie budget deplete in a bar pinned to the bottom
of every screen. There is no backend — everything lives in your browser's `localStorage`.

Live at **https://watchis.github.io/macro-tracker/**

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite`), themed through CSS custom properties
- Zustand with the `persist` middleware (`localStorage` key `macro-tracker/v1`)
- Vitest + React Testing Library, ESLint + Prettier

## Local development

Requires Node 20.19+ or 22+.

```bash
npm install
npm run dev      # dev server on http://localhost:5173/macro-tracker/
```

The dev server serves the app under `/macro-tracker/` because `vite.config.ts` sets
`base: '/macro-tracker/'` to match the GitHub Pages project path.

## Scripts

| Command              | What it does                                          |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | Start the dev server with hot reload                  |
| `npm run build`      | Type-check with `tsc -b`, then build to `dist/`       |
| `npm run preview`    | Serve the production build locally                    |
| `npm test`           | Run the Vitest suite once                             |
| `npm run test:watch` | Run Vitest in watch mode                              |
| `npm run lint`       | ESLint over the repo plus a Prettier formatting check |
| `npm run format`     | Rewrite files with Prettier                           |

## Project layout

```
src/
  App.tsx              app shell: header, active view, budget bar
  components/          AppHeader, BudgetBar, MacroChip
  components/settings/ settings form controls, accent picker, food library, data export/import
  views/               CalendarView, DayView, SettingsView
  store/               Zustand store, defaults, persistence/migration, selectors
  lib/                 date keys, macro metadata, totals and budget math
  theme/               data-theme + accent application, color helpers
  index.css            palette custom properties and Tailwind theme mapping
```

## Theming

`<html>` carries `data-theme="light" | "dark"`, which selects a neutral gray/white palette defined
as CSS custom properties in `src/index.css`. A single accent hex (`settings.accent`) is written to
`--accent`, and every accent shade — soft, muted, strong, border, ring — derives from it with
`color-mix()`, so one color drives the whole scale. `settings.themeMode` may be `light`, `dark` or
`system`; `system` follows `prefers-color-scheme` and updates live.

## Data and storage

State is persisted under the `localStorage` key `macro-tracker/v1` and carries a `version` field.
Rehydration and JSON import both run through `parsePersistedState`, which repairs or drops anything
invalid, so a stale or hand-edited payload cannot break the app. Settings offers JSON export, import
and a full reset.

## Deployment

`.github/workflows/deploy.yml` lints, tests and builds on every push to `main`, then publishes
`dist/` with `actions/configure-pages`, `actions/upload-pages-artifact` and `actions/deploy-pages`.
It can also be run manually from the Actions tab.

One-time repository setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Without it, the first deploy job fails.
