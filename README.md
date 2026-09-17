# macro-tracker

A frontend-only macro tracker: log food per day on a calendar, choose which macros you care about,
set calorie and macro goals, and watch a daily calorie budget deplete in a bar pinned to the bottom
of every screen. There is no backend — everything lives in your browser's `localStorage`.

Live at **https://watchis.github.io/macro-tracker/**

## Using it

Five views, switched from the header — they are app state rather than routes, so GitHub Pages
never has to serve a deep link.

**Calendar** shows the month as a grid. A logged day reports its remaining calories, a depleting
bar and totals for the macros you have switched on; an untouched day stays quiet. Today is circled
in the accent color, and clicking any day opens it. Arrow keys walk the grid, `Home`/`End` jump to
the first and last of the month, and `PageUp`/`PageDown` page between months.

**Day** is the log itself: a table with a column per visible macro, an inline row to add food, and
Edit/Delete on every entry. `Enter` submits a row and `Escape` cancels it; only the name is
required. The footer totals each column against its goal, and `Quick add` logs a food from your
library scaled from its reference weight to the grams you enter. Editing an entry keeps the values
of macros that are currently hidden, so switching a macro off never silently drops data. An optional
**weight** field (lb or kg) records a daily weigh-in for the Graphs page.

**Graphs** charts weight over time (with a trendline and average), daily calorie consumption, and
calorie overages/underages against your goal. Toggle lb/kg and a 30 / 90 / all-time range from the
page header.

**Food library** is a searchable USDA catalog plus your custom foods; Day's quick-add scales
them by grams when you log.

**Settings** covers theme, accent color, weight unit, visible macros, calorie and macro goals, JSON
import/export, local storage usage, and retention for old day logs.

The **budget bar** is pinned to the bottom of every view. It starts full and depletes as the
selected day is logged, showing the calories left plus a chip per visible macro. Past the goal it
turns red, swaps in an "Over budget" badge and refills with how far over you are. Setting the
calorie goal to 0 turns it into a neutral tally of what you logged.

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
| `npm run preview`    | Serve `dist/` locally, also under `/macro-tracker/`   |
| `npm test`           | Run the Vitest suite once                             |
| `npm run test:watch` | Run Vitest in watch mode                              |
| `npm run lint`       | ESLint over the repo plus a Prettier formatting check |
| `npm run format`     | Rewrite files with Prettier                           |

## Project layout

```
src/
  App.tsx              app shell: header, active view, budget bar
  components/          AppHeader, BudgetBar, MacroChip
  components/settings/ settings form controls, accent picker, import/export, data retention
  views/               CalendarView, DayView, GraphsView, FoodLibraryView, SettingsView
  store/               Zustand store, defaults, persistence/migration, selectors
  data/                USDA food catalog (lazy category JSON under starter/)
  lib/                 date keys, macro metadata, totals, weight conversion, chart series
  components/charts/   SVG line and bar charts for the Graphs view
  theme/               data-theme + accent application, color helpers
  index.css            palette custom properties and Tailwind theme mapping
```

The food library includes a large **USDA catalog** (5,000+ common foods from
[USDA FoodData Central](https://fdc.nal.usda.gov/)), split into category JSON files under
`src/data/starter/` and **lazy-loaded** as you browse or search. Custom foods you add in the
Food library view are persisted separately and appear first in quick-add.

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
