# Marked words layout and filter resets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Tidy the Home Marked words area and the Manage marked list, and add Reset all plus per-filter clearing to the Filters card.

**Architecture:** Two pure helpers in `words.js` (tested), then UI changes in `home.js`, `marked.js` and `css/app.css`.

**Tech Stack:** Plain classic-script JS; `node tests/run-node.js`.

**Spec:** `docs/superpowers/specs/2026-11-24-home-marked-layout-and-filter-resets-design.md`

## Global Constraints

- Classic scripts, IIFE modules; immutable helpers; colours/spacing from CSS tokens; `css/app.css` and `js/core/words.js` are CRLF (check others with `file`); no AI attribution in commits.

## Review Focus

1. Clearing one filter must leave the others (a category chip ✕ removes only that category) (Task 1 test).
2. Reset all with nothing active: button hidden, no error (Task 2 browser check).
3. Typing in the category search, or picking a date, keeps focus/text (Task 2 browser check).

---

### Task 1: Filter helpers

**Files:** Modify `js/core/words.js`, `tests/words.test.js` (mixed endings: match the end of file).

**Interfaces — Produces:**
- `LG.words.activeFilters(f: { dateFrom: string, dateTo: string, categories: string[] }) -> { key: 'dateFrom'|'dateTo'|'category', value: string }[]`
- `LG.words.withoutFilter(f, entry) -> filters` (new object; for `category` removes only `entry.value`)

- [ ] **Step 1: Tests** (`activeFilters` of empty filters is `[]`; of `{dateFrom:'2026-11-01', dateTo:'', categories:['a','b']}` is `[dateFrom, category a, category b]` in that order; `withoutFilter` for `category b` keeps `a` and the dates; for `dateFrom` blanks only it; input object unchanged).
- [ ] **Step 2: Run** `node tests/run-node.js` → new tests FAIL.
- [ ] **Step 3: Implement** both in `words.js` and export on `LG.words`.
- [ ] **Step 4: Run** → all pass. **Step 5: Commit** `feat(lg): filter helpers for chips and single resets`.

### Task 2: Filters card

**Files:** Modify `js/ui/screens/home.js` (`filtersCard`), `css/app.css`.

- [ ] **Step 1:** Rebuild `filtersCard(onchange)` as a wrapper `div` with a `draw()` that renders the card: header row (`.spread`) = toggle button `Filters ▸/▾` (`aria-expanded`) + muted `(N active)` + **Reset all** button (`btn btn-small`, hidden unless something is active); below it a `.filter-chips` row built from `LG.words.activeFilters` (chips reuse `.chip`/`.chip-x`; labels `From <formatDate>`, `To <formatDate>`, category name; ✕ calls `withoutFilter`, assigns into `app.filters`, then `draw()` + `onchange()`); the body (dates + categories) only when open. Open state kept in a closure variable, initially "any filter active".
- [ ] **Step 2:** Each date field gets a small Clear button (`hidden` while the input is empty, toggled on `change` without re-rendering). Picking a date or a category repaints only the chip row/header count and calls `onchange()`; Reset all and chip ✕ do a full `draw()` + `onchange()`. Remove the old bottom "Clear filters" button.
- [ ] **Step 3: CSS** (`.filters-head`, `.filter-chips` with `gap: 8px; margin-top: 10px`, `.field-clear`), tokens only.
- [ ] **Step 4: Browser check** (serve `lg/`, sample or CSV with dates and categories): set two categories + a date → chips and "(3 active)" show with panel collapsed; ✕ on one chip removes only it and game counts change; Reset all clears all and hides itself; typing in category search keeps text while picking; dark mode, 375 px. `node tests/run-node.js` passes.
- [ ] **Step 5: Commit** `feat(lg): Reset all, filter chips and per-filter clear`.

### Task 3: Marked words layout

**Files:** Modify `js/ui/screens/home.js` (Play card marked section, `footer`), `js/ui/screens/marked.js`, `css/app.css`.

- [ ] **Step 1: Home:** in the Mode fieldset give `.mode-note` a heading look for the marked/revenge/study notes (margin above 12px, below 8px), put the marked buttons in `.marked-actions` (gap 10px, margin 4px 0 16px), add top margin (16px) to `.games` and `.empty-pile`, and `margin: 16px 0` to the fieldset instead of inline `12px 0`. Remove the footer's Export marked button.
- [ ] **Step 2: Manage screen:** toolbar `.mm-toolbar` (flex, `justify-content: space-between`, gap 12px, padding-bottom 12px, bottom border): Select all / Select none on the left, Unmark selected on the right; `.mm-row` padding 12px 8px and min-height 52px; translation line `margin-top: 2px; font-size: 0.9375rem`.
- [ ] **Step 3: Browser check:** Home with Marked words mode (some and zero marked), Manage screen with several rows, light and dark, 375 px width (no horizontal scroll, buttons wrap cleanly). `node tests/run-node.js` passes.
- [ ] **Step 4: Commit** `style(lg): roomier Marked words panel and Manage list`.

### Task 4: Docs

- [ ] README: Filters paragraph (Reset all, chips, per-filter clear). `lg/CLAUDE.md` words.js line mentions the two helpers and the test count. Commit `docs(lg): filter resets and marked layout`.
