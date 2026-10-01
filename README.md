# macro-tracker

A frontend-only macro tracker: log food per day on a calendar, choose which macros you care about,
set calorie and macro goals, and watch a daily calorie budget deplete in a bar pinned to the bottom
of every screen. There is no backend — everything lives in your browser's `localStorage`.

Live at **https://watchis.github.io/macro-tracker/**

## Using it

Five header views — they are app state rather than routes, so GitHub Pages never has to serve a
deep link. Opening a day from the calendar is a sixth screen that is not in the nav.

**Home** is the landing dashboard: today and last-7-day snapshots, latest weight, a compact month
calendar (‹ / Today / › to change months; tap a day to select it, tap again to open its log), and
one Trends chart you can switch between weight over time (trend + average), calorie intake, and
calorie overages/underages. Toggle a 30 / 90 / all-time chart range from the page header.

**Calendar** shows the full month as a grid. A logged day reports its remaining calories, a depleting
bar and totals for the macros you have switched on; an untouched day stays quiet. Today is circled
in the accent color. Clicking an inactive day selects it; clicking the active day (or **Today** when
today is already selected) opens its log. Arrow keys walk the grid, `Home`/`End` jump to the first
and last of the month, and `PageUp`/`PageDown` page between months.

**Day** (opened from Home or Calendar, not from the header) is the log itself: a table with a column
per visible macro, an inline row to add food, and Edit/Delete on every entry. `Enter` submits a row
and `Escape` cancels it; only the name is required. The footer totals each column against its goal,
and `Quick add` logs a food from your library scaled from its reference weight to the grams you
enter. An optional **weight** field (lb or kg) records a daily weigh-in for Home's charts.

**Food library** is a searchable whole-foods catalog plus your custom foods. Star any food
to pin it as a favorite; Day's quick-add shows starred foods when the search is empty and
scales them by grams when you log.

**Projection** estimates future weight from a body profile (sex, age, height, activity) and a planned
daily calorie intake, using Mifflin–St Jeor maintenance that shrinks as weight changes. Intake comes
from your calorie goal or a recent logged average. Leave start date blank to enter starting weight
(defaults to the latest weigh-in), or set a start date to use the nearest weigh-in. Leave end date
blank for a 3 mo / 6 mo / 1 yr preset, or set an end date for a custom horizon. It shows a summary,
a weight chart (with hover tooltips and logged weigh-ins overlaid), and a weekly table of weight,
calories used, and calorie deficit — in the spirit of
[LoserTown's calculator](https://www.losertown.org/eats/cal.php).

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
  views/               HomeView, CalendarView, DayView, FoodLibraryView, ProjectionView, SettingsView
  store/               Zustand store, defaults, persistence/migration, selectors
  data/                whole-foods catalog (lazy category JSON under starter/)
  lib/                 date keys, macro metadata, totals, weight conversion, chart series, projection
  components/charts/   SVG line and bar charts for the Home view
  theme/               data-theme + accent application, color helpers
  index.css            palette custom properties and Tailwind theme mapping
```

The food library ships a curated **whole-foods catalog** (about 4,800 foods). Every entry is
looked up from [USDA FoodData Central](https://fdc.nal.usda.gov/), the
[UK Composition of Foods Integrated Dataset](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid),
or the [Canadian Nutrient File](https://food-nutrition.canada.ca/cnf-fce/), and keeps that
row's id (`source` and `sourceRef`). Common foods use everyday names, including Asian staples
such as winged beans (sigarilyas) and mung beans; other whole foods keep the database name
when their macros differ from a similar food. Branded products, fast food, and baby food are
left out. The catalog is split into category JSON files under `src/data/starter/` and
**lazy-loaded** as you browse or search. Search also matches common aliases and
spellings (aubergine, calamari, garbanzo, sigarillias, coke) and ignores accents.
A short list of household brand foods, such as Heinz ketchup, Coca-Cola, Mountain Dew,
and Ferrero Rocher, is included from USDA Branded Foods.
Regenerate with `python3 scripts/build-whole-foods-catalog.py`. Custom foods you add in the Food
library view are persisted separately. Star custom or catalog foods to pin them as favorites for
Day quick-add (favorites appear when the search field is empty; they are not auto-assigned).

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
