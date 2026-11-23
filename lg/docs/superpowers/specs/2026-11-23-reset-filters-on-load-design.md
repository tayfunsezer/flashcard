# Reset Home filters when a new file is loaded — design (2026-11-23)

## Intent
> "Whenever a file is loaded, just get rid of the filters. I mean, reset them."

Date/category filters from a previous session hid the words of a newly loaded file (e.g. a JSON with no dates), so the user had to clear them by hand.

## Goals
- Loading a new word list (file, link, sample) resets `app.filters` to `{ dateFrom: '', dateTo: '', categories: [] }`.

## Non-goals
- Refresh file, app boot, and re-choosing languages on the existing list keep the filters (same data; the user's choice stands).
- Filters are not persisted today, so nothing in storage changes.

## Approaches
1. Reset in the load screen's `fresh` import path, via `app.resetFilters()` (chosen: precise, one line).
2. Reset inside `app.setDataset` (rejected: also fires on boot and Refresh file, which should keep filters).

## Design
- `app.resetFilters()` in `js/ui/app.js` mutates `app.filters` in place (screens hold the reference) and is exported.
- `js/ui/screens/load.js` calls it before `app.setDataset(ds)` when `fresh`.
- `home.js` "Clear filters" reuses it.

## Verification
Headless/browser check: set a date filter, load a dateless JSON, Home shows no active filter and all words playable.
