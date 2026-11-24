# End date follows Start; Pair Match keeps its board on Refresh — design

Date: 2026-11-24. Two small changes. Builds on `2026-11-24-end-date-defaults-to-start-design.md` and `2026-11-24-refresh-in-round-navigation-word-diff-design.md`.

## Intent

The learner's request: "it forces me to actually restart whatever mode I'm in ... it would be best if it is technically feasible that I would do the in-place upgrade plus can just continue from where I left off." And: "when I set a date X on from, just set the same on to field. The bug was that I picked 29th of October and it picked 29th correctly, but then I picked 30th of October and it didn't pick the 30th on the end one." Later: "Focus on Cloze, Multiple Choice, Flashcards and Pair Match", and, once the options were laid out, "go with option 1".

## Findings

- Cloze, Multiple Choice and Flashcards already refresh in place (`app.activeRound`). Checked 2026-11-24 in headless Chrome with a local link standing in for the Google Sheet link: no confirm, same screen, round kept, banner "Refreshed … 1 edited, 1 gone". If the live site still restarts them, the browser is running a cached older copy (the service worker falls back to its cache).
- Pair Match had no `activeRound`: Refresh asked "This round ends" and went Home.

## Goals

1. Changing **Date from** always sets **Date to** to the same day (when Date from is not empty).
2. Refresh inside Pair Match keeps the round: edited words change text on their tiles, gone words leave, matched pairs, misses and the timer stay; later boards use the new file.

## Non-goals / calls I made

- Clearing Date from leaves Date to alone. Picking Date to never touches Date from. This reverses the earlier rule "an End already chosen is never overwritten": the learner asked for the opposite.
- Daily and the Leitner board are out of scope (learner's call).
- Progress for the unfinished board is still saved only when it ends (unchanged).

## Approaches (Pair Match)

1. **Patch the live board** (chosen): rename tiles, drop gone pairs, keep timer/matches.
2. Rebuild the board with the unmatched pairs: simpler, but reshuffles under the learner and resets the timer.
3. Apply the refresh between boards: least code, edits invisible until later.

## Design

- `LG.words.withDateFrom(f, value)`: `dateTo = value || f.dateTo`.
- Pure `LG.play.remapBoards(plan, from, map, removed)` returns a new plan where boards at index ≥ `from` have ids renamed through `map` and removed ids dropped, empty boards omitted.
- `match.js` sets `app.activeRound = { screen, onDataset }`. `onDataset` renames the round tallies (`total`), remaps the later boards, and patches the board on screen through a per-board function: renamed tiles keep their position, state (matched, missed, selected) and get the new text; removed tiles disappear (a removed matched pair lowers the count); when no pair is left the board ends like a finished one (saves what is there, then next board or summary); when every remaining pair is matched the board completes. Between boards only the tallies and later boards are remapped.
