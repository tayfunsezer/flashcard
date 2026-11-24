# In-round refresh, free navigation, mistyped-word highlight — design

Date: 2026-11-24. Amends `2026-11-16-whole-expression-marks-refresh-design.md` (which said "no mid-round merge on refresh").

## Intent

The learner's request, verbatim:

> 1. When I work on any mode sometimes I stumble upon a typo in the question and I immediately fix it on the source file (whatever that is). But I always then need to quit and reload the file to be able to work with the fixed file but this causes losing the progress or restart what I already studied in that session. How we can fix this
>
> 2. In Flashcard and multiple option mode I want to be able to navigate between questions without answering them. I want to go back or move next multiple items. I should be able to also use any functionality (like marking unmarking etc all)
>
> 3. In cloze mode sometimes I just make mistake on one or two words so in such cases highlight the words that I typed mistake on this and I wouldn't suffer and try to understand what is my problem.

Answers given in conversation:
- Going back to an already answered question must let the learner **answer it again**. XP does not matter much. **Leitner boxes must reflect the truth**: wrong first, right later means the word was learned after all. The learner will not cheat.
- Chosen approach for re-answers: **A, last answer wins** (below).

## Goals

1. **Refresh without leaving the round.** The ↻ button in a game reloads the file, keeps the current round (queue, position, tallies, history), keeps progress, and **moves progress from an edited row to its corrected version** instead of treating it as one item gone plus one new.
2. **Free navigation** in Flashcards and Multiple Choice: Back, Next/Skip, arrow keys, across already seen and skipped questions. Mark/unmark and the other per-word actions work on any question. A question already answered can be answered again.
3. **Cloze mistake highlight:** after a wrong or "almost" answer, the typed words that are wrong are coloured, and expected words that were left out are shown, so the learner sees at a glance which one or two words were the problem.

## Non-goals

- No change to the file format, dataset shape, or the State shape (no `VERSION` bump).
- Navigation is not added to Cloze, Pair Match or the Leitner board screen.
- In-place refresh is for Cloze, Multiple Choice and Flashcards (the queue-based games). Pair Match keeps today's behaviour (round ends, Home).
- No character-level highlighting inside a single mistyped word (a one-word answer is simply shown wrong). Only word-level.
- No automatic watching of the file for changes. Refresh stays a click.

## Anti-goals

- A re-answer must never leave a Leitner box that disagrees with the latest answer.
- Refresh must never lose progress for rows that did not change, and must never silently apply progress to the wrong item (ambiguous matches carry nothing).
- Back/Next must not change anything on its own. Only an answer or a mark changes state.

## Approaches considered

**Re-answer semantics (picked A)**
- **A, picked: last answer wins.** The first answer to a word snapshots its progress entry from before. A re-answer restores that snapshot and applies the new result. Round tallies and the missed list follow the latest answer. Re-answers award no XP and leave the combo alone.
- B: each re-answer stacks on the current box. Simpler, but the box depends on history (wrong, right, wrong goes down, up, down) and rewards re-answering with the answer just seen. Rejected.
- C: lock answered questions. Rejected by the learner.

**Refresh matching of edited rows**: (picked) match a gone row to a new row when exactly one side (source or target) is unchanged and that value is unique among gone rows and among new rows. Alternatives: match by row position (breaks when rows are inserted or sorted), or only exact ids (today, loses progress on every typo fix). Rejected.

Size: a project of three independent parts; implement and verify in the order 3, 2, 1 (cheapest and most self-contained first; refresh touches the most files).

## Design

### 3. Mistyped-word highlight (Cloze)

New pure function in `js/core/answer.js`:

`diffWords(input, expected, lang)` → `{ typed: [{ text, status }], missing: string[] }`

- Tokenise both exactly as `checkWhole` does (word tokens, case-folded with `LG.text.lower`; punctuation ignored). For whole-expression answers with optional bracketed words, diff against whichever of the two expected variants (with or without the bracketed words) matches best.
- Align typed tokens to expected tokens by edit distance on tokens, so one inserted, dropped or changed word does not mark every later word wrong.
- `status`: `'ok'` (equal), `'almost'` (equal after `LG.text.fold`, i.e. accents only), `'wrong'` (no counterpart). `missing` = expected words with no typed counterpart, in order.
- Display texts are the learner's own typed words; `missing` uses the expected spelling.
- One-word blanks go through the same function; the result is one word, wrong or almost.

UI (`cloze.js`, the existing "You typed" line, shown for `wrong` and `almost`, not for Show answer): render each typed word as a span with class `typed-ok` (plain), `typed-almost` or `typed-wrong` (the classes `typed-almost`/`typed-wrong` already exist for the whole-line colouring; reuse their colours), followed by a `missing` marker for each left-out word, e.g. `You typed: boję się ⟨czegoś missing⟩`. Colour is never the only cue: wrong words get an underline style, missing words are in a labelled chip. Works in both themes (tokens only).

### 2. Free navigation (Flashcards, Multiple Choice)

Per screen, keep a `history` array of ids shown and an index `pos` into it.

- **Next without answering**: if `pos` is not at the end, move forward in `history`. At the end, the current word goes to the end of the round queue unanswered (round modes) or is added to the local `skipped` set (study mode, where the queue lives in state and must not be altered by a skip), and the next queue word is shown and appended to `history`.
- **Back**: `pos - 1`; disabled at the start.
- Controls: `← Back` and `Skip →` / `Next →` buttons in the game area, `ArrowLeft` / `ArrowRight` keys (not while typing in an input; existing key handlers are kept). Header progress keeps its meaning ("done" = answered, per round state).
- A revisited word that was answered shows its previous result (Multiple Choice: the same options in the same order with the right and wrong colours; Flashcards: flipped with the earlier grade shown) **and stays answerable**: the option buttons / grade buttons stay enabled, the learner can pick again. Mark/★ and the other actions are present exactly as on first view.
- A revisited unanswered word is shown fresh.

Re-answer (approach A), pure helpers in `js/core/round.js` and `js/core/play.js`, written test-first:

- `round.first[id]` is the answer that counts for the word. A *re-answer* (answering a word again after reaching it through Back/Next, as opposed to the automatic "Again" repeat from the queue, which still does not count) overwrites `first[id]` with the new result, so `missed()` and the summary follow it.
- `LG.round.reanswer(r, id, result)`: sets `first[id] = result`; if the result is right, remove `id` from the queue; if wrong and `repeats[id] < MAX_REPEATS`, make sure it is in the queue (at the end, once).
- Progress: on a word's first counted answer the screen stores `before[id]` = `{ entry: progress[id], ... }`. For a re-answer, `LG.play.reanswerPrompt(state, id, before, result, now)` restores that entry, applies `LG.schedule.applyResult` with the new result, awards no XP, and returns the new state. Study sets: the study-set progress for the word follows the latest answer too (the builder decides the exact mechanism, since `studySet` is shared state: it must end as if only the latest answer had happened).
- Screen tallies (`round.correct` / `round.wrong`, `round.from` / `round.touched`) follow the latest answer; the "moved boxes" summary compares the box from before the first answer to the final box, as now.
- If the result of the latest answer equals the previous one, nothing changes.

Multiple Choice only: a revisit keeps the same four options and order (stored per id in the screen), so the learner sees the same question.

### 1. Refresh in place

Pure in `js/core/reload.js`, test-first:

`carryOver(oldItems, newItems)` → `Map<oldId, newId>` for edited rows:
- Candidates are old ids not in the new list and new ids not in the old list.
- Pair a gone item with a new item when their normalised **source** are equal, or their normalised **target** are equal, and that value is unique among the gone items and among the new items (one to one). Anything ambiguous carries nothing.
- Normalisation is `LG.text.normalizeCell`.

`app.refreshFile`/`finishRefresh`:
- When called from a game of Cloze, Multiple Choice or Flashcards (`inGame`): no confirm dialog and no `go('home')`. Reparse as today, compute `carryOver`, rewrite ids, rebuild ctx, then tell the running game screen.
- **Rewrite**: move `progress[oldId]` to `progress[newId]` (stars and box carry; `pin` is cleared when the target changed, since pins are words of the old sentence; `rot` carried). Also remap ids in `studySet` (`queue`, `done`). If `progress[newId]` already exists, keep the existing one.
- **Notify the game**: `LG.app` calls a hook the active screen registered (`app.onDataset(map, removedIds)`), where the screen remaps its round queue / `first` / `repeats` / history / snapshots / skipped via a pure `LG.round.remap(r, map, removedIds)`, drops words that no longer exist, and re-renders the current prompt only if its word changed (a Cloze answer being typed is kept when the word is unchanged). Words that are gone leave the round; `total` is adjusted so the header stays correct.
- The banner text is the existing "Refreshed … (+N new, −M gone)", plus "(K edited, progress kept)" when `carryOver` found matches.
- **Failures** (cannot read, permission, pick again, etc.) keep today's banners and leave the round running.
- Outside a game (Home) behaviour is unchanged, except progress is now also carried across edited rows.

Home-initiated refresh and the `sourceUrl` download path both go through `finishRefresh`, so both get `carryOver`.

## Constraints

- Classic scripts, IIFE modules, no build; `file://` must work (`../CLAUDE.md`, `CLAUDE.md`).
- New core code is pure and tested first (`tests/answer.test.js`, `round.test.js`, `play.test.js`, `reload.test.js`). No new core files are planned, so `index.html` / `tests/manifest.js` stay unchanged.
- Preserve each file's line endings (many are CRLF). Check with `git diff --stat`.
- Dark mode and phone width checked in the browser. No emoji or mascots in the chrome (arrows as text are fine).
- README updated for the user-visible behaviour. A plan goes to `docs/superpowers/plans/2026-11-24-…md`.
- Commits carry no AI attribution (project convention in `lg/CLAUDE.md`).

## Calls I made (for you to check)

1. In-place refresh covers Cloze, Multiple Choice and Flashcards only; Pair Match still ends the round.
2. Edited-row matching is "one side unchanged and unique"; rows where both source and target changed are treated as new items (nothing can safely link them).
3. Pins are dropped when an item's target changed.
4. Re-answers give no XP and do not touch the combo.
5. Cloze highlighting is word-level only. A single mistyped word is shown as wrong without marking letters.
6. The Skip button moves an unanswered word to the end of the round (or into the local skipped set in study mode) rather than dropping it from the round.
7. Navigation is not added to Cloze, since the request names Flashcards and Multiple Choice only.

## Left to the builder

Exact button placement and styling, the screen hook name, how the study-set progress is replayed on a re-answer, and the edit-distance details of the token alignment.
