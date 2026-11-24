# Marked words layout and filter resets — design

Date: 2026-11-24. Small change (UI only; no state or file-format change).

## Intent

The learner's requests, verbatim:

> the Mark words tab. Is looking quite packed. So do some arrangements there not only that the buttons are just squeezed together, but also from top and bottom it is also squeezed, and I don't know, it looks a bit messy and clunky.
>
> (asked which screen: "to bot. That's fine. Bot.", i.e. both the Home panel and the Manage marked list)
>
> the filter box is a bit problematic. For example, I need a clean way to just reset all filters, okay? A button or something like that. But also individual filters too.

## Goals

1. **Home, Marked words mode:** the starred-items line is a clear heading; Export marked / Manage marked / Clear all marks sit on their own spaced row; clear space before the game tiles. The duplicate Export marked in the bottom toolbar goes (it stays in this panel).
2. **Manage marked screen:** roomier toolbar and rows; Select all / Select none grouped apart from the primary Unmark selected; the translation readable under each word.
3. **Filters:** a **Reset all** button in the Filters header, visible while the panel is collapsed and only when a filter is active; a row of removable chips for the active filters (`From 01-11-2026 ✕`, `To … ✕`, one per category); a Clear control on each date field. Resetting updates the game counts at once.

## Non-goals

- The Filters panel does not move. No new filter kinds. Study sets still ignore filters.
- No change to the Marked data, export format or the games.

## Anti-goals

- Typing in the category search or opening a date picker must not lose focus or text because something re-rendered.
- Reset all must not touch marks, progress or the study set.

## Approach

One sensible way, so no alternatives were weighed: keep the existing screens and replace the cramped parts. For filters, the header becomes a real row (toggle button, active count, Reset all) instead of a `<details>` summary, because a button inside `<summary>` toggles the panel when clicked. Chips and Reset all re-render only the card; typing/picking inside the panel repaints only the chip row.

Pure helpers in `js/core/words.js`, tested first:
- `LG.words.activeFilters(f)` → `[{ key: 'dateFrom'|'dateTo'|'category', value }]` in that order (categories in their selected order).
- `LG.words.withoutFilter(f, entry)` → a new filters object with that one entry cleared.

## Constraints

Classic scripts, tokens only for colour and spacing (`css/app.css`, CRLF), dark mode and 375 px width checked, no emoji in the chrome (✕ text is the existing chip style). Commits carry no AI attribution (lg convention). README updated.

## Calls I made

Chip dates use `LG.dates.formatDate`. The Filters panel stays collapsed unless a filter is active (as today). On the Manage screen the unmark button stays a primary button, right-aligned.
