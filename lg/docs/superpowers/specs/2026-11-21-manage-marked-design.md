# Manage marked words screen — design

Date: 2026-11-21. Amends `2026-11-16-whole-expression-marks-refresh-design.md` (marks) with a place to unmark words without playing.

Status: approved by the learner 2026-11-21, implemented the same day.

## Intent

> "I want to be able to manage the marked words lists separately. I have such workflow. I first study whole sets and then later I mark all of those whole sets and store them on the disk. And then afterwards, I unmark all of them. And then this time just mark the exact ones that I want to study again and mark them as special focus points in another JSON file. But ... right now, I don't have a section that allows me to partially remove a marked word without first going through a study mode and come to its halt. So I need a separate screen that would just allow me unmark. ... I don't need to add functionality to this screen. Words will always come from whatever files they are currently coming from. But I need a capability that would allow me to remove marked words. So I can remove multiple at once. I don't need paging because I don't expect to [have] lists 100 of page."

## Goals

- A screen listing every marked word (starred item) of the loaded file; select several, unmark them in one action.
- Reachable from Home, in Marked words mode, next to Export marked and Clear all marks.

## Non-goals

- No adding marks, no export, no filter or search, no paging (learner expects well under 100 rows), no editing words.
- No confirmation before unmarking (re-marking is one tap; Clear all marks keeps its confirm). Revisit on request.

## Design

- `LG.marked.markedItems(items, progress)` (pure, tested): the marked items in file order.
- Unmarking reuses `LG.play.clearStars(state, ids)`: only `star` is cleared, Cloze pins and Leitner progress stay (existing behaviour: "Unstarring keeps pins").
- New screen `LG.screens.marked` (`js/ui/screens/marked.js`): topbar (title with count, Back), a row with Select all / Select none and `Unmark selected (k)` (disabled at 0), then one row per item: a checkbox label spanning the row (touch target ≥ 44px), the learned text first, its translation in muted text under it. Unmarking calls `app.setState`, re-renders the list and shows `app.banner('Unmarked k words.', 'info')`. An empty list shows "No marked words." with Back.
- Home: `Manage marked (N)` button in `markedButtons()` (disabled at 0).
- Mobile: single column, full-width rows, no horizontal scroll at 360px; both themes via existing tokens.

## Approaches

One sensible way: a dedicated screen reusing `clearStars`. Putting checkboxes into the Home mode panel was rejected (Home is already dense, and the learner asked for a separate screen). A per-row ✕ only was rejected (the learner wants many at once).
