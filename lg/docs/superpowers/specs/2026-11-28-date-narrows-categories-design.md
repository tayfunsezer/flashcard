# Home filters: the date range narrows the category list

Date: 2026-11-28. A small change in `lg/` only (`fc/` untouched). Approved by the learner in chat.

## Intent

The learner's words: "make that filter work together ... when I pick date, it should just show the categories that belong to that date, and vice versa ... in the Excel, categories are in a row. Categories can be separated with pipe, which means that they belong to multiple categories." Then, after seeing that a calendar cannot grey out days: "There is no reason for me to guess the date most of the time. So I guess category selection shouldn't affect date range at all."

## Goals

1. The Home **Categories** list shows only categories that have at least one word in the chosen date range (From and/or To). Counts are the words in that range. A word with `Food|Travel` counts under both (categories are already split on `|` at import).
2. With no date set, the list is as today (all categories, whole-file counts).
3. A category the learner already ticked stays in the list when the range leaves it with no words, shown as `(0)`, so it can be unticked. Nothing is dropped silently.
4. The list updates as soon as a date changes (also Clear, Reset all, a chip's remove, and End following Start), keeping the search text and focus.

## Non-goals / anti-goals

- **Categories never change the dates**: no calendar limits, no date chips. Dates stay as they are.
- No change to what a round plays (`filterItems` already ANDs date and category), no state change, no other screens.

## Approaches

- **A. Pure `LG.words.categoryOptions(items, filters)` plus `setOptions` on the category picker (picked):** logic is tested; the picker refreshes its list in place so search text and focus survive.
- B. Rebuild the whole picker on each date change: loses typed search text and focus.

## Design

- `words.js`: `categoryOptions(items, { dateFrom, dateTo, categories }) → [{ name, count }]`: `groupOptions(filterItems(items, { dateFrom, dateTo })).categories`, then each ticked category missing from it is appended with `count: 0`, keeping the same name order (sorted by name).
- `catpicker.js`: the root element returned by `multi` gets `setOptions(options)`, which replaces the options and redraws the list.
- `home.js`: keep the picker; after any date or filter change that is not a category pick, call `setOptions(LG.words.categoryOptions(...))`.

## Left to the builder

Where the refresh call sits so Reset all and chip removal (which redraw the card) also show the right list.
