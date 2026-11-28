# Date narrows categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** The Home category list follows the date range.
**Architecture:** Pure `LG.words.categoryOptions`, a `setOptions` on the picker element, one refresh hook in `home.js`.
**Tech Stack:** Classic scripts, in-repo runner (`node tests/run-node.js`).
**Spec:** `lg/docs/superpowers/specs/2026-11-28-date-narrows-categories-design.md`

## Global Constraints
- `lg/` only; no state change; `words.js` and `catpicker.js` are CRLF (preserve; scripted edits with newline=''); commits carry no AI attribution; update README.md.

## Review Focus
1. Item with `A|B` in range counts under both A and B; outside the range under neither.
2. Items without a date disappear from the list as soon as any date bound is set (same as `filterItems`).
3. A ticked category with no words in the range stays, count 0, and can be unticked.
4. Only From set, only To set, and Start-fills-End all update the list.
5. Reset all / chip ✕ / Clear return the full list.

### Task 1: `LG.words.categoryOptions`
**Files:** Modify `js/core/words.js`; Test `tests/words.test.js`.
**Produces:** `categoryOptions(items, { dateFrom, dateTo, categories }) → [{ name, count }]`.
- [ ] Write failing tests (multi-category item counted under both; out-of-range excluded; no date bounds = `groupOptions` result; undated items excluded when a bound is set; ticked category with no words kept with count 0 in name order). Run `node tests/run-node.js`: they fail (not a function).
- [ ] Implement and export it; run the suite: green. Commit `feat(lg): categories available in a date range`.

### Task 2: Live category list on Home
**Files:** Modify `js/ui/catpicker.js` (`setOptions` on the root), `js/ui/screens/home.js` (`filtersCard`), `README.md`.
**Consumes:** `LG.words.categoryOptions`.
- [ ] `build` root gets `root.setOptions = (opts) => { cfg.options = opts; renderList(); }`.
- [ ] `home.js`: build the picker with `categoryOptions(app.ctx.items, f)`; after a date input change, Clear, and in `paint`-time paths that change dates, call `picker.setOptions(...)`; Reset all and chip removal already redraw the card (fresh list).
- [ ] Verify in the browser with sample data: pick a date, the list narrows; type in the category search, change the date, the search text stays; tick a category then pick a date without it: it stays as `(0)`; Reset all shows everything. Suite green. Commit `feat(lg): Home category list follows the date range`.
