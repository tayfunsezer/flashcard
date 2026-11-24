# Refresh in round, free navigation, mistyped-word highlight — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Highlight mistyped words in Cloze, let Flashcards and Multiple Choice move Back/Skip with re-answering (last answer wins), and make ↻ Refresh keep the running round and carry progress to edited rows.

**Architecture:** Pure, tested logic goes in `js/core` (`answer.diffWords`, `round.defer/reanswer/remap`, `study.rerecord/remap`, `play.reanswerPrompt`, new `trail.js`, `reload.carryOver/carryState`). Screens share helpers added to `LG.screens.cloze` (`answerWord`, `navRow`, `remapMap`, tracker additions). The running game registers `app.activeRound` so `finishRefresh` can update it in place.

**Tech Stack:** Plain classic-script JavaScript, no build; core tests via `node tests/run-node.js` (Node from nvm) or `tests.html`.

**Spec:** `docs/superpowers/specs/2026-11-24-refresh-in-round-navigation-word-diff-design.md` (read it first; this plan follows its order of work: highlight, navigation, refresh).

## Global Constraints

- Classic `<script>` tags only; each file an IIFE on `globalThis.LG`; must work from `file://`. No new dependencies.
- Core functions are pure and immutable; state changes go through `app.setState(next)`. Never mutate `app.state`.
- Tests first for every core function (`T.test`, `T.eq`, `T.ok` from `tests/runner.js`).
- A new core file goes in **both** `index.html` and `tests/manifest.js` (same order), and its test file in `manifest.tests`.
- **Line endings are mixed.** CRLF files in this plan: `js/core/round.js`, `js/core/answer.js`, `js/core/play.js`, `js/ui/screens/mc.js`, `js/ui/screens/flashcards.js`, `css/app.css`, `tests/round.test.js`. Check every other file with `file <path>` before editing. Edit with Python using `newline=''`, or with the Edit tool, then confirm `git diff --stat` shows only the intended lines.
- No XP for re-answers, combo untouched. The Leitner box must follow the latest answer (spec approach A).
- Colour is never the only cue. Tokens/variables only; works in light and dark and at phone width. No emoji.
- Commits: **no `Co-Authored-By` or other AI attribution** (project convention). Update `README.md` for user-visible behaviour and `lg/CLAUDE.md` layout lines for new files.

## Review Focus

1. Typed answer with an extra word, a missing word, or empty input: only the wrong word is marked, later words are not all marked wrong, empty input marks nothing (Task 1).
2. Back at the first question, Skip when only one word is left in the round: buttons disabled, no loop, no state change (Tasks 2, 3).
3. Re-answering a word that had no progress entry yet (`before` is `undefined`), or answering the same result again: box ends exactly as one answer of the latest result would leave it; nothing changes if the result is equal (Task 2).
4. Refresh when the current or last queued word was deleted from the file, or the file now has duplicate sources (ambiguous match): round continues or finishes cleanly, and nothing is carried to a wrong item (Tasks 4, 5).
5. Refresh while Cloze has text typed and the word is unchanged: the text stays (Task 5).

---

### Task 1: Mistyped-word highlight in Cloze

**Files:**
- Modify: `js/core/answer.js` (CRLF), `tests/answer.test.js` (check endings), `js/ui/screens/cloze.js` (the `typedLine` in `feedback`), `css/app.css` (CRLF)

**Interfaces:**
- Produces: `LG.answer.diffWords(input: string, expected: string, lang: string) -> { typed: { text: string, status: 'ok'|'almost'|'wrong' }[], missing: string[] }`

- [ ] **Step 1: Write failing tests in `tests/answer.test.js`** (names and assertions; `d = LG.answer.diffWords`, `st = (r) => r.typed.map((t) => t.status)`):
  - `'diffWords: left-out word is missing, typed words ok'`: `d('boję się', 'boję się czegoś', 'pl')` → statuses `['ok','ok']`, `missing` `['czegoś']`.
  - `'diffWords: accent-only slips are almost'`: `d('bac sie czegos', 'bać się czegoś', 'pl')` → `['almost','almost','almost']`, `missing` `[]`.
  - `'diffWords: one wrong word does not mark the rest'`: `d('ala ma psa', 'ala ma kota', 'pl')` → `['ok','ok','wrong']`, `missing` `[]`; typed texts stay as typed (`'psa'`).
  - `'diffWords: an extra typed word is the only wrong one'`: `d('ala ma bardzo kota', 'ala ma kota', 'pl')` → `['ok','ok','wrong','ok']`.
  - `'diffWords: optional bracketed words'`: `d('bać się', 'bać się (czegoś)', 'pl')` → `['ok','ok']`, `missing` `[]`; and `d('bać się czegoś', 'bać się (czegoś)', 'pl')` → all ok.
  - `'diffWords: empty input'`: `d('', 'kot', 'pl')` → `typed` `[]`, `missing` `['kot']`.
- [ ] **Step 2: Run** `node tests/run-node.js` → the six new tests FAIL (`diffWords` not a function).
- [ ] **Step 3: Implement `diffWords` in `js/core/answer.js`** and export it on `LG.answer`. Tokenise like `checkWhole` (word tokens via `LG.text.tokenize(LG.text.normalizeCell(x), lang)`, compared lower-cased). Compute the alignment against both expected variants (full and `LG.text.stripParens(...)`) and return the one with the fewest wrong + missing, ties to the full variant. Alignment: token edit distance with cost 0 for equal, 0.5 for equal after `LG.text.fold` (status `almost`), 1 for substitution (typed word `wrong`, the substituted expected word is not reported missing), 1 for an extra typed word (`wrong`), 1 for an expected word with no typed counterpart (`missing`). Ties prefer substitution. Typed `text` is the learner's own token text; `missing` uses the expected spelling.
- [ ] **Step 4: Run** `node tests/run-node.js` → all pass.
- [ ] **Step 5: Wire the UI** in `js/ui/screens/cloze.js` `feedback()`: when `typed && result !== 'correct'`, build the "You typed:" line from `LG.answer.diffWords(typed, expected, lang)`: each typed word a `span` with class `typed-ok` / `typed-almost` / `typed-wrong`, separated by spaces, then one `span.typed-missing` per missing word with visible text `‹word›` and `title="missing word"`. In `css/app.css` replace the whole-line `.typed-wrong` strike-through with: `.typed-wrong` underline wavy `var(--bad)`, `.typed-almost` underline dotted `var(--almost)`, `.typed-missing` bordered chip with `var(--border)` and `var(--muted)` text. Keep the line absent for Show answer.
- [ ] **Step 6: Verify in the browser** (serve repo with `python3 -m http.server 8080`, open `/lg/index.html?sample=1`, play Cloze with Ask for "whole expression"): type one wrong word of a multi-word target, one accent-only slip, one missing word; check light + dark and 375 px width. Expected: only those words are styled; correct words plain.
- [ ] **Step 7: Commit** `feat(lg): highlight mistyped words in Cloze feedback`.

---

### Task 2: Core support for navigation and re-answers

**Files:**
- Create: `js/core/trail.js`, `tests/trail.test.js` (LF)
- Modify: `js/core/round.js` (CRLF), `js/core/study.js` (LF), `js/core/play.js` (CRLF), `tests/round.test.js` (CRLF), `tests/study.test.js`, `tests/play.test.js` (check), `index.html`, `tests/manifest.js`

**Interfaces (all pure, return new objects):**
- `LG.trail.create() -> { ids: string[], pos: number }` (`pos` -1 when empty)
- `LG.trail.push(t, id)` appends `id` and moves `pos` to it; `current(t) -> string|null`; `back(t)` / `forward(t)` return a moved trail, or `null` when impossible; `canBack(t)`, `canForward(t)` booleans (`canForward` false at the end).
- `LG.round.defer(r, id)`: `id` goes to the end of `queue` (no change when not queued). `LG.round.canDefer(r) -> boolean` (`queue.length > 1`).
- `LG.round.reanswer(r, id, result)`: sets `first[id] = result`; right result (`correct`/`almost`) removes `id` from `queue`; `wrong` with `repeats[id] < MAX_REPEATS` ensures `id` is in `queue` exactly once, at the end, incrementing `repeats[id]` only when it was not already queued.
- `LG.study.rerecord(set, id, ok)`: `ok` → `id` out of `queue`, in `done` once; not ok → out of `done`, in `queue` once at the end.
- `LG.play.reanswerPrompt(state, id, before, result, nowMs) -> state` where `before` is the progress entry (possibly `undefined`) from before the word's first counted answer: new `box/due/revenge/seen` come from `LG.schedule.applyResult(before, result, nowMs)`; every other field (`star`, `pin`, `rot`) keeps its current value. XP and streak untouched; `studySet` updated with `study.rerecord` when the id is in its `queue` or `done`.

- [ ] **Step 1: Write failing tests.**
  - `trail.test.js`: empty trail has `current` null and cannot go back/forward; after `push a, push b, push c`: `current` is `c`, `back` → `b`, `back` again → `a`, `back` at `a` is `null`; from `a`, `forward` → `b`; `canForward` is false at `c`; immutable (original unchanged).
  - `round.test.js`: `defer(create(['a','b','c']),'a').queue` is `['b','c','a']`; `canDefer` false for `['a']`, true for two; `reanswer` after a missed first answer: `record(r,'a','wrong')` then `reanswer(r,'a','correct')` → `first.a === 'correct'`, `a` not in queue, `missed(r)` `[]`; `reanswer(…,'wrong')` on a word not queued → queued once at the end, `repeats.a` +1; at `repeats.a === 3` a wrong re-answer does not queue it.
  - `study.test.js`: `rerecord` right→wrong moves the id from `done` to the queue end without duplicates; wrong→right the reverse; calling twice with the same value changes nothing.
  - `play.test.js`: **(Review Focus 3)** with `before` undefined and `reanswerPrompt(state,'i1','correct')` → `progress.i1.box === 1` and `xp` unchanged; wrong first (`answerPrompt` wrong → box 0) then `reanswerPrompt(state, id, before, 'correct')` → box 1 (not 2); right first then re-answer wrong → box 0; a `star: true` set after the first answer survives; the same result twice gives the same state values.
- [ ] **Step 2: Run** `node tests/run-node.js` → new tests fail.
- [ ] **Step 3: Implement** the functions above. `trail.js` is a new core file: add it after `round.js` in both `index.html` and `tests/manifest.js` (`tests/trail.test.js` after `round.test.js` in `manifest.tests`). Remember `index.html` and the manifest must stay in the same order (`run-node.js` checks it).
- [ ] **Step 4: Run** `node tests/run-node.js` → all pass, no order-drift error.
- [ ] **Step 5: Commit** `feat(lg): core helpers for navigation trail and last-answer-wins re-answers`.

---

### Task 3: Navigation and re-answering in Multiple Choice and Flashcards

**Files:**
- Modify: `js/ui/screens/cloze.js` (shared helpers), `js/ui/screens/mc.js` (CRLF), `js/ui/screens/flashcards.js` (CRLF), `css/app.css` (CRLF)

**Interfaces:**
- Consumes: Task 2 functions.
- Produces on `LG.screens.cloze`:
  - `roundTracker` gains `defer(id)`, `canDefer()`, `counted(id) -> result|undefined`, `reanswer(id, result) -> void` (round modes: `LG.round.reanswer`; study mode: `studyFirst.set` plus `LG.app.setState` of `study.rerecord` is done in `answerWord`, not here), and `studyNext(set, exclude: Set) -> id|null` (first `set.queue` id not in `exclude` and not locally deferred; when every id is deferred, clears the deferrals and returns `set.queue[0]`). In study mode `defer` records the id locally and `canDefer` is true when more than one id is left in `set.queue`.
  - `answerWord({ id, result, revisit, round, track }) -> { xp, left }`: if `track.counts(id)` → today's counted path (store `before[id] = app.state.progress[id]` in `round.before`, a `Map` added to the `round` object, then `answerPrompt`, tallies, combo); else if `revisit` and `round.before.has(id)` and `track.counted(id)` differs in right/wrong from `result` → `LG.play.reanswerPrompt`, move one tally from the old result to the new (`round.correct`/`round.wrong`), `track.reanswer`, no XP, `left` false; else (automatic "Again" repeat, or same result) → only `track.record`. Always `app.setState`. `left` is `track.record(...)`'s return in the counted/repeat paths.
  - `navRow({ canBack, onBack, canForward, forwardLabel, onForward }) -> Element`: a `.btn-row.nav-row` with `← Back` and `<forwardLabel> →` buttons (`btn btn-small`, disabled per flags, accessible names).

- [ ] **Step 1: Add the shared helpers** in `cloze.js` and export them on `LG.screens.cloze`.
- [ ] **Step 2: Rework `mc.js`** around `show(id, { revisit })` (replacing the prompt loop) with a `LG.trail` and a `views` Map per id (`{ options, correctIdx, picked }`). Behaviour:
  - Next/Skip (button, `ArrowRight`): if `trail.canForward` → forward and `show(id, { revisit: true })`; else if the current word is unanswered → `track.defer(id)` (button label **Skip**, disabled when `!track.canDefer()`); then take `nextId()` (study mode: `track.studyNext(set, skipped)`), `trail.push`, `show`. After an answer the label is **Next** and it just advances. No next id → `finish()`.
  - Back (button, `ArrowLeft`): `trail.back` → `show(id, { revisit: true })`.
  - A word shown before reuses its stored `options`/order from `views`; an answered one shows its feedback (right/wrong colours, solved sentence, "Answer: …") **with the option buttons enabled**; picking one calls `answerWord({ revisit: true })`, redraws the feedback and disables the buttons again until the learner navigates away and back. Right after a first answer buttons stay disabled as today.
  - Mark/★ and Next/Back are present in both unanswered and answered states (the ★ button already exists in feedback; add it to the unanswered view too).
  - Only a revisited, *never-answered* word counts as a first answer (`track.counts` true).
  - Header progress still uses `track.label()` / study label.
- [ ] **Step 3: Rework `flashcards.js` the same way** with `views` = `{ flipped, grade }`: a revisited answered card shows front + back with the earlier grade button `aria-pressed="true"`; grade buttons stay enabled, a re-grade calls `answerWord({ revisit: true })` then moves forward like a first grade; `Space` flips an unflipped card as today; `ArrowLeft/ArrowRight` navigate (ignored while an input is focused); Skip/Next/Back via `navRow`, ★ available on the front too.
- [ ] **Step 4: CSS** in `css/app.css`: `.nav-row` spacing under the card (`margin-top: 12px; justify-content: space-between`), reuse existing tokens, and `.fc-grade[aria-pressed="true"]` with an `outline: 2px solid var(--accent)`.
- [ ] **Step 5: Verify in the browser** (sample data, both games, review and Study mode, both themes, 375 px): answer 2 wrong, Skip 1, Back twice, re-answer a wrong one right → header done count and the Summary's "moved" box and missed list reflect the latest answer; Back disabled on the first word; Skip disabled when one word is left; ★ works on an unanswered word; arrow keys work; no console errors. Run `node tests/run-node.js` → all pass.
- [ ] **Step 6: Commit** `feat(lg): Back and Skip in Multiple Choice and Flashcards, re-answers keep the latest result`.

---

### Task 4: Carry progress to edited rows (core)

**Files:**
- Modify: `js/core/reload.js` (LF), `js/core/round.js` (CRLF), `js/core/study.js`, `js/core/trail.js`, and their tests (`tests/reload.test.js`, `tests/round.test.js`, `tests/study.test.js`, `tests/trail.test.js`)

**Interfaces:**
- `LG.reload.carryOver(oldItems, newItems) -> { from: string, to: string, targetChanged: boolean }[]`: candidates are old ids absent from the new list and new ids absent from the old list. Pair one gone item with one new item when their `LG.text.normalizeCell` **source** are equal or their normalised **target** are equal. A pair is made only when that value is unique among the gone items and among the new items and the new item has no second candidate; otherwise none. `targetChanged` is true when the targets differ.
- `LG.reload.carryState(state, pairs) -> state`: moves `progress[from]` to `progress[to]` (deleting `from`; keeps an existing `progress[to]`); clears `pin` when `targetChanged`; remaps `studySet` ids with `LG.study.remap`.
- `LG.reload.bannerText(fileName, d, edited = 0)`: with `edited > 0` the text is `Refreshed <file>: <total> items (+<added-edited> new, −<removed-edited> gone, <edited> edited)`; unchanged output when `edited` is 0.
- `LG.study.remap(set, map: Map) -> set` (ids renamed in `queue` and `done`).
- `LG.round.remap(r, map: Map, removed: Set) -> r`: renames ids in `queue`, `first`, `repeats`; drops removed ids from `queue`; `total` reduced by the number of removed ids that were in `queue` or `first`.
- `LG.trail.remap(t, map: Map, removed: Set) -> t`: renamed ids; removed entries dropped, `pos` kept on the same entry (or clamped).

- [ ] **Step 1: Write failing tests.** `reload.test.js`: edited target (`house/dmo` → `house/dom`) gives one pair with `targetChanged: true`; edited source gives `targetChanged: false`; both sides changed → `[]`; **(Review Focus 4)** two gone items with the same source and one new item with that source → `[]`; unchanged items never paired; whitespace/NFC differences only (`'dom '` vs `'dom'`) still count as equal; `carryState` moves a starred, box-3 entry and clears its `pin` only when `targetChanged`, keeps an existing destination entry, and remaps `studySet`; `bannerText` with and without `edited`. `round.test.js`: `remap` renames queue/first/repeats, removing a queued id reduces `total` by one and `progress` stays consistent, removing the last queued id makes `isDone` true. `study.test.js`: `remap`. `trail.test.js`: `remap` keeps `current` on the same entry and drops removed ids.
- [ ] **Step 2: Run** `node tests/run-node.js` → fail.
- [ ] **Step 3: Implement** the five functions.
- [ ] **Step 4: Run** `node tests/run-node.js` → all pass.
- [ ] **Step 5: Commit** `feat(lg): carry progress from edited rows on refresh (core)`.

---

### Task 5: Refresh in place, wired into the games

**Files:**
- Modify: `js/ui/app.js` (LF; `refreshFile`, `finishRefresh`, `pickAndRefresh`), `js/ui/screens/cloze.js`, `mc.js` (CRLF), `flashcards.js` (CRLF)

**Interfaces:**
- Consumes: Task 4 functions.
- Produces: `LG.app.activeRound = { screen: Element, onDataset(map: Map, removed: Set) }`, set by Cloze, Multiple Choice and Flashcards when they render (cleared when the screen is gone; `app` ignores it when `!screen.isConnected`). `LG.screens.cloze.remapMap(m: Map, map, removed, move: boolean) -> Map`: with `move` true re-keys edited ids and drops removed; with false drops both edited and removed ids (for per-word views/blanks that no longer match). `roundTracker` gains `remap(map, removed)` that applies `LG.round.remap` (and re-keys `studyFirst`, drops edited/removed ids from `kept`).

- [ ] **Step 1: `app.js`**: in `refreshFile`, ask the confirm only when the game has no `activeRound` (Pair Match, Daily). In `finishRefresh`: after `reparse` and the `diff`, compute `pairs = LG.reload.carryOver(app.dataset.items, res.dataset.items)`, `map = new Map(pairs.map(p => [p.from, p.to]))`, `removed` = old ids not in the new list and not in `map`; `setState(LG.reload.carryState(app.state, pairs))`; save the dataset and `setDataset` as today; then if a live `activeRound` exists call `activeRound.onDataset(map, removed)` and **do not** `go('home')`, else `go('home')` as today. Banner uses `bannerText(file.name, d, pairs.length)`. Error and pick-again banners are unchanged and do not touch the round. Works for the `sourceUrl` path too (it already goes through `finishRefresh`).
- [ ] **Step 2: Games.** Each of the three screens sets `app.activeRound` on render and implements `onDataset(map, removed)`: `track.remap`, remap its own per-id Maps (`round.before`, per-id counts with `move: true`; `views`, `kept`/blanks and `skipped` with `move: false` or by dropping), `LG.trail.remap` where there is a trail, then: if the displayed word was edited or removed **and is still unanswered**, show the same slot again with the new item (Cloze: `prompt()`); if it is answered, leave the feedback on screen (Next uses the remapped queue); if the round has nothing left, `finish()`. Cloze with an unchanged word touches nothing, so typed text stays (**Review Focus 5**).
- [ ] **Step 3: Verify in the browser.** Load a small CSV from disk with a copy kept in a folder (Chrome keeps the handle), start Multiple Choice and Cloze, answer some, edit one row's target and one row's source in the file, press ↻ in the game: the round stays on the same position with the same queue; the edited rows keep their box/★ (check Marked words and the Leitner screen); banner reads `… 1 edited`; delete the word currently shown → the next word appears; delete the last queued word → Summary appears; typed Cloze text survives a refresh that changed another row; Pair Match still asks for confirmation and ends; failures (rename the file) show today's banner and the round continues. Run `node tests/run-node.js` → all pass.
- [ ] **Step 4: Commit** `feat(lg): refresh keeps the running round and progress on edited rows`.

---

### Task 6: Docs and final verification

**Files:**
- Modify: `README.md`, `CLAUDE.md` (lg; add `trail.js` to the layout, update the Refresh file and round paragraphs and the test count), `docs/superpowers/specs/…-design.md` (note "Implemented 2026-11-24" under the date line only if all tasks shipped)

- [ ] **Step 1: README**: under "Ask for, stars and refreshing the file" describe in-round ↻ and edited-row carry-over; under Flashcards/Multiple Choice describe Back/Skip, arrow keys and re-answering (latest answer sets the box, no extra XP); under Cloze describe the highlight. Update `lg/CLAUDE.md` as listed.
- [ ] **Step 2: Full verification**: `node tests/run-node.js` all passing (report the count), `tests.html` in the browser, one full pass of Tasks 1, 3 and 5 browser checks in both themes at desktop and 375 px width, zero console errors, `git diff --stat` shows no line-ending churn.
- [ ] **Step 3: Commit** `docs(lg): document in-round refresh, navigation and word highlight`.
