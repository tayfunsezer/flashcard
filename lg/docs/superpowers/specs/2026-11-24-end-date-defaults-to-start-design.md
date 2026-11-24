# End date defaults to the start date — design

Date: 2026-11-24. Small change (Filters card only).

## Intent

The learner's request: when a start day is picked, the End date calendar should open on that month and year. Native date pickers cannot open on a month without a value, so the learner chose (after the options were laid out): "do that pre-selecting thing", i.e. picking a Start date also fills End with the same day.

## Goals

- Picking **Date from** while **Date to** is empty sets **Date to** to the same day (the End calendar then opens on that month and year).
- The filter chips, the "(N active)" count and the game counts update as usual.

## Non-goals / calls I made

- Only fills End when it is empty: an End the learner already chose is never overwritten, even if it is earlier than Start.
- Picking End first does not fill Start. Clearing Start leaves End alone.
- No custom calendar (rejected by the learner as unnecessary).

## Design

Pure helper `LG.words.withDateFrom(f, value)` in `js/core/words.js` returns a copy of the filters with `dateFrom = value` and `dateTo = value` when `dateTo` is empty and `value` is not empty. The Date from input's change handler applies it, then updates the End input and its Clear button.
