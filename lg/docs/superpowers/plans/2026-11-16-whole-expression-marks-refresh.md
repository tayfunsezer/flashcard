# Whole Expression, Marks, Refresh File — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An "Ask for: one word / whole expression" switch for Cloze and Multiple Choice; item stars (☆/★) settable from every game with export of starred items as quiz JSON; a one-click "Refresh file" that re-reads the loaded file.

**Architecture:**
- Pure logic goes in `js/core` and is unit-tested with the in-repo runner: whole-answer check, star helpers, state v2 migration, marked-quiz export, refresh diff and re-parse.
- UI changes sit in the existing screens.
- File handles use the File System Access API and are kept in IndexedDB beside the dataset, falling back to the file picker.

**Tech Stack:** Plain ES2020 classic scripts on the global `LG` namespace, SheetJS (vendored), IndexedDB, localStorage. No build, no network.

**Spec:** `docs/superpowers/specs/2026-11-16-whole-expression-marks-refresh-design.md`

## Global Constraints

- **Runtime:** opened from `file://` by double-clicking `index.html`. No npm, no build, no fetch, no ES modules. Every file is `(function (LG) { ... })(globalThis.LG = globalThis.LG || {});`.
- **New core files** go in both `tests/manifest.js` (`src`, plus their test in `tests`) and `index.html` in the same order. `node tests/run-node.js` checks the order.
- **Tests:** `node tests/run-node.js` must end with `0 failed`. Never copy files from the user's Downloads folder into the repo; synthetic test files go under `.tmp/`.
- **No attribution:** no "Claude" or "Claude Code" attribution in code, comments, docs or commit messages, and no `Co-Authored-By` trailer.
- **Copy:**
  - Switch label: "Ask for:" with options "One word" / "Whole expression".
  - Star button: "☆ Mark" / "★ Marked".
  - Whole-mode Cloze note: "Type the whole expression".
  - Refresh button: "↻ Refresh file".
  - Refresh confirm in a game: "Refresh the file? This round ends; answers so far are kept."
  - Refresh banner: "Refreshed <file>: N items (+A new, −R gone)".
  - Marked note: "Marked words: items you starred — N right now."
  - Marked empty state: "No marked words yet. Star items with ☆ in any game."
- **Settings:** `settings.ask` is `'word' | 'whole'`, default `'word'`. State `VERSION` becomes `2`.
- **Browsers:** Edge and Chrome are primary. Firefox and Safari must work, with Refresh falling back to the picker.

## Review Focus

1. **Exported file round-trip:** an exported marked file loaded back must give the same item ids, so progress and stars carry over. Owned by Task 4: test `markedQuiz round-trips through jsonToDataset with the same ids`.
2. **Tiny sets:** a dataset with fewer than 4 items still exports valid entries (fewer options, `correctIndex` in range), and whole-mode MC is disabled with a reason, not crashing. Owned by Task 4 (`markedQuiz with one item`) and Task 2 (`mcEligibleIds whole needs 4 distinct targets`).
3. **Refresh against a broken file:** a file that now has no valid rows, or bad JSON, must leave the current dataset and progress untouched and show an error. Owned by Task 5: test `reparse returns ok:false and no dataset for an empty table / invalid JSON`.
4. **Migration runs once:** a v1 state with a pin becomes starred. A v2 state with a pin and no star stays unstarred, so unstarring sticks across reloads. Owned by Task 1: test `withDefaults v1 pin → star; v2 keeps unstarred`.
5. **Whole answers with inner punctuation and extra spaces:** `orać  zaorać pole` and `Orać & zaorać pole.` are correct for `orać & zaorać pole`; a missing word is wrong. Owned by Task 1: test `checkWhole`.

---

### Task 1: Core — whole-answer check, `ask` setting, stars and state v2

**Files:**
- Modify: `js/core/answer.js`, `js/core/state.js`, `js/core/play.js`
- Test: `tests/answer.test.js`, `tests/state.test.js`, `tests/play.test.js`

**Interfaces:**
- Produces:
  - `LG.answer.checkWhole(input: string, expected: string, lang?: string) -> 'correct'|'almost'|'wrong'`. Compares the word-token sequences from `LG.text.tokenize`, lower-cased with `lang`. Equal sequences are correct, equal after `LG.text.fold` per token are almost, anything else (including empty input or a different token count) is wrong.
  - `settings.ask` validated by `withDefaults`: `oneOf(['word','whole'], se.ask, 'word')`.
  - `LG.state.VERSION === 2`. `withDefaults(obj)`: when `obj.version` is missing or `< 2`, any progress entry with a non-null `pin` gets `star: true`. Output always has `version: 2`. A `star` that isn't `true` is dropped.
  - `LG.play.isMarked(entry) -> boolean`, now `!!entry && entry.star === true`.
  - `LG.play.toggleStar(state, itemId) -> state` and `LG.play.setStar(state, itemId, on: boolean) -> state`, both via `patchEntry`. Unstarring deletes the key or sets it to false; never touch `pin`.
  - `LG.play.togglePinWord`: when the result adds a word, also set `star: true`; removing a word leaves the star.
  - `LG.play.clearStars(state, ids: string[]) -> state` removes the star from each id.

- [ ] **Step 1: Write failing tests**

```js
T.test('checkWhole', () => {
  const A = LG.answer;
  T.eq(A.checkWhole('orać zaorać pole', 'orać & zaorać pole', 'pl'), 'correct');
  T.eq(A.checkWhole('  Orać & zaorać   pole. ', 'orać & zaorać pole', 'pl'), 'correct');
  T.eq(A.checkWhole('orac zaorac pole', 'orać & zaorać pole', 'pl'), 'almost');
  T.eq(A.checkWhole('zaorać pole', 'orać & zaorać pole', 'pl'), 'wrong');
  T.eq(A.checkWhole('orać zaorać pole pole', 'orać & zaorać pole', 'pl'), 'wrong');
  T.eq(A.checkWhole('', 'boję się', 'pl'), 'wrong');
  T.eq(A.checkWhole('İstanbul', 'istanbul', 'tr'), 'correct');
});
T.test('withDefaults v1 pin → star; v2 keeps unstarred', () => {
  const v1 = S.withDefaults({ version: 1, progress: { a: { pin: ['się'] }, b: { pin: null } } });
  T.eq([v1.version, v1.progress.a.star, !!v1.progress.b.star], [2, true, false]);
  const v2 = S.withDefaults({ version: 2, progress: { a: { pin: ['się'] } } });
  T.eq(!!v2.progress.a.star, false);
  T.eq(S.withDefaults({}).settings.ask, 'word');
  T.eq(S.withDefaults({ settings: { ask: 'whole' } }).settings.ask, 'whole');
  T.eq(S.withDefaults({ settings: { ask: 'bogus' } }).settings.ask, 'word');
});
T.test('stars', () => {
  let st = S.defaultState();
  st = LG.play.toggleStar(st, 'a');
  T.ok(LG.play.isMarked(st.progress.a));
  st = LG.play.setPin(st, 'a', ['się']);
  st = LG.play.toggleStar(st, 'a');
  T.ok(!LG.play.isMarked(st.progress.a));
  T.eq(st.progress.a.pin, ['się']);
  const toks = LG.text.tokenize('boję się', 'pl');
  st = LG.play.togglePinWord(S.defaultState(), 'b', 'boję', toks, 'pl');
  T.ok(LG.play.isMarked(st.progress.b));
  st = LG.play.clearStars(st, ['b']);
  T.ok(!LG.play.isMarked(st.progress.b));
});
```

Update the existing `parseProgressFile errors` test so the "newer version" case uses `version: 3` and expects `(v3)`. Update the existing `isMarked` test at `tests/play.test.js:113` to build its fixtures with `star: true` rather than pins.

- [ ] **Step 2: Run `node tests/run-node.js`.** Expected: the new tests FAIL (`checkWhole is not a function`, etc.).
- [ ] **Step 3: Implement the interfaces above** in `answer.js`, `state.js` and `play.js`.
- [ ] **Step 4: Run `node tests/run-node.js`.** Expected: `0 failed`.
- [ ] **Step 5: Commit** `feat: whole-answer check, ask setting, item stars (state v2)`.

---

### Task 2: Whole-expression mode in Cloze, Multiple Choice and Home

**Files:**
- Modify: `js/core/play.js` (`mcEligibleIds`), `js/ui/app.js` (`rebuildCtx`, `setState`), `js/ui/screens/home.js` (switch), `js/ui/screens/cloze.js`, `js/ui/screens/mc.js`, `css/app.css`
- Test: `tests/play.test.js`

**Interfaces:**
- Consumes: `LG.answer.checkWhole` and `settings.ask` (Task 1).
- Produces:
  - `LG.play.mcEligibleIds(items, rarity, lang, ask = 'word') -> string[]`. With `'whole'`: every item id when the items have at least `MC_OPTIONS` (4) distinct lower-cased targets; otherwise only items with their own `options`. `'word'` keeps today's behaviour.
  - `app.ctx.mcIds` is built with `app.state.settings.ask`.
  - `setState` calls `rebuildCtx()` when `settings.ask` changes.

- [ ] **Step 1: Write a failing test** `mcEligibleIds whole needs 4 distinct targets`:
  - Three items plus one with a target equal to an existing one (case-insensitive), in whole mode, → `[]`.
  - Four distinct sentence-length targets in whole mode → all 4 ids, even though `'word'` mode would need cloze candidates.
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement `mcEligibleIds` with `ask`, and the `rebuildCtx`/`setState` wiring.**
- [ ] **Step 4: Run tests.** Expected: `0 failed`.
- [ ] **Step 5: Home switch.**
  - Add a segmented control "Ask for:" [One word | Whole expression] to the Play card header, next to `directionToggle()`, with `aria-label` "Ask for (Cloze and Multiple Choice)".
  - Clicking sets `settings.ask` via `app.setSettings` and calls `app.refresh()`.
- [ ] **Step 6: Cloze whole mode.** In `prompt()`, when `app.state.settings.ask === 'whole'`:
  - `expected = item.target`, and checking uses `LG.answer.checkWhole`.
  - The answer line is a single `.blank` span sized `min(charLength(target)+1, 40)` ch, with `aria-label` "blank, whole expression".
  - The multi-word note is "Type the whole expression", shown when the target has more than one token.
  - `pickBlanks` is not called; items are never skipped for lacking a blank.
  - Rotation is not advanced.
  - Feedback (full sentence, clickable pin words, "You typed") stays as it is.
- [ ] **Step 7: MC whole mode.** In `build()`, take the sentence branch only when `ask === 'word'`. In the term branch, use as the pool every other item when `ask === 'whole'`; in word mode keep non-sentence items only. `advanceRotation` runs only for `q.sentence`, as today.
- [ ] **Step 8: Check it in the browser** with a dev script `tests/dev/whole-check.js` run via `node tests/dev/cdp.js .tmp/prof-whole 1280x900 tests/dev/whole-check.js`. Starting from `?sample=1`, the script:
  1. Sets `ask = 'whole'`.
  2. Opens Cloze and asserts that `.sentence .blank` count is 1 and no target words are visible.
  3. Types the target without punctuation and asserts `.fb-text-correct`.
  4. Opens MC and asserts that 4 `.choice` buttons exist and the correct option text equals the item's whole target.
  5. Prints `OK` lines.

  Expected: all `OK`, no `EXCEPTION`.
- [ ] **Step 9: Run tests, then commit** `feat: whole-expression mode for Cloze and Multiple Choice`.

---

### Task 3: Star buttons, summary word list, "Play all marked", Home copy

**Files:**
- Modify: `js/ui/screens/cloze.js` (export `starButton`), `js/ui/screens/mc.js`, `js/ui/screens/flashcards.js`, `js/ui/screens/match.js`, `js/ui/screens/summary.js`, `js/ui/screens/home.js`, `css/app.css`

**Interfaces:**
- Consumes: `LG.play.toggleStar`, `isMarked`, `markedIds` (Task 1).
- Produces:
  - `LG.screens.cloze.starButton(id: string) -> HTMLButtonElement`. It shows "☆ Mark" or "★ Marked" with `aria-pressed`. A click calls `app.setState(LG.play.toggleStar(app.state, id))`, updates its own label, and calls an optional `onToggle(id, nowMarked)` passed as a second argument.
  - Summary params gain `seen: string[]`: every id shown in the round, in order of first showing.

- [ ] **Step 1: Cloze feedback.** Add `starButton(id)` to the pin row. Its `onToggle` adds `id` to `round.unmarked` when the item was unmarked before (same rule as `noteUnmarked`). Cloze `finish()` passes `seen` and keeps `marked`.
- [ ] **Step 2: MC feedback.** Add `starButton(id)` beside Next. Track `unmarked` and `seen` as Cloze does, and pass `marked: LG.play.markedIds([...unmarked], progress)` and `seen` to the summary.
- [ ] **Step 3: Flashcards.** After `flip()`, add `starButton(id)` to the controls row. The star must not trigger the card's click-to-flip or the 1/2 grading keys. Pass `marked` and `seen` the same way.
- [ ] **Step 4: Match.** Pass `seen` (every id on every board played) and `marked: []`.
- [ ] **Step 5: Summary.**
  - **Word list:** add a `<details>` card "Words in this round (N)", closed by default, listing every `seen` id as source → target with a `starButton`.
  - **"Play all marked (N)" button:** N = `LG.play.markedIds(eligible ids of the current filters for p.game, progress)`. It starts `app.go(game, { ids: LG.play.startRound(those), mode: 'marked' })`, using Flashcards when `playable(p.game, …)` is false (same rule as practice). It's hidden when N is 0, sits after the practice buttons, and N updates when stars are toggled in the word list.
- [ ] **Step 6: Home copy.**
  - Marked mode note: "Marked words: items you starred — N right now."
  - Empty state: "No marked words yet. Star items with ☆ in any game."
  - Availability reason: "No marked items for this game".
  - The stats row "Marked N" now counts stars (via `markedIds`).
- [ ] **Step 7: Check it in the browser** with `tests/dev/star-check.js` (CDP driver, fresh profile), starting from `?sample=1`:
  1. In MC, answer one, click `☆ Mark`, and assert its label becomes `★ Marked`.
  2. Finish the round via Quit or by answering all, and assert the summary shows "Play all marked (1)".
  3. Click it and assert the screen is `mc` with 1 prompt.
  4. On Home in Marked mode, assert the note says "— 1 right now".

  Expected: all `OK`, no `EXCEPTION`.
- [ ] **Step 8: Run `node tests/run-node.js`, then commit** `feat: star items in every game; play all marked`.

---

### Task 4: Export marked as quiz JSON; clear marks

**Files:**
- Create: `js/core/marked.js`, `tests/marked.test.js`
- Modify: `tests/manifest.js` (src after `js/core/play.js`; test after `tests/play.test.js`), `index.html` (script after `play.js`), `js/ui/screens/home.js`

**Interfaces:**
- Consumes: `LG.play.isMarked`, `LG.distractors.pickDistractors`, `LG.importer.jsonToDataset` (tests only).
- Produces:
  - `LG.marked.markedQuiz(items, progress, lang, rand) -> Array<{ question: string, options: string[], correctIndex: number }>`. It covers starred items in `items` order. `question` = `item.source`. Options = `[item.target]` plus `item.options`, or, without own options, up to 3 `pickDistractors(item.target, pool of other items' targets with categories, item.categories, lang, rand, 3)`, all shuffled with `rand`. `correctIndex` points at `item.target`.
  - `LG.marked.exportFileName(datasetName: string, iso: string) -> string`:
    - Strip the extension, a leading `marked-` and a trailing `-YYYY-MM-DD`, then build `'marked-' + name + '-' + iso + '.json'`.
    - Empty name or `'Sample data'` gives `marked-sample-<iso>.json`.

- [ ] **Step 1: Write failing tests**

```js
T.test('markedQuiz round-trips through jsonToDataset with the same ids', () => {
  const items = LG.importer.rowsToDataset([['boję się', 'I am afraid'], ['dom', 'house'], ['kot', 'cat'], ['pies', 'dog'], ['orać & zaorać pole', 'plough the field']], { learnColumn: 1 }).items;
  const progress = { [items[0].id]: { star: true }, [items[4].id]: { star: true } };
  const quiz = LG.marked.markedQuiz(items, progress, 'pl', LG.rng.seeded(3));
  T.eq(quiz.length, 2);
  for (const q of quiz) T.ok(q.options.length === 4 && q.correctIndex >= 0 && q.correctIndex < 4);
  const back = LG.importer.jsonToDataset(JSON.stringify(quiz), 'marked-x.json').items.map((it) => it.id);
  T.eq(back, [items[0].id, items[4].id]);
});
T.test('markedQuiz with one item and own options', () => {
  const one = [{ id: 'a', source: 'cat', target: 'kot', date: null, categories: ['x'] }];
  T.eq(LG.marked.markedQuiz(one, { a: { star: true } }, 'pl', LG.rng.seeded(1)), [{ question: 'cat', options: ['kot'], correctIndex: 0 }]);
  const own = [{ id: 'b', source: 'q', target: 'A', date: null, categories: ['x'], options: ['B', 'C'] }];
  const q = LG.marked.markedQuiz(own, { b: { star: true } }, 'en', LG.rng.seeded(1))[0];
  T.eq([q.options.slice().sort(), q.options[q.correctIndex]], [['A', 'B', 'C'], 'A']);
});
T.test('exportFileName', () => {
  T.eq(LG.marked.exportFileName('polish.xlsx', '2026-11-16'), 'marked-polish-2026-11-16.json');
  T.eq(LG.marked.exportFileName('marked-polish-2026-11-10.json', '2026-11-16'), 'marked-polish-2026-11-16.json');
  T.eq(LG.marked.exportFileName('Sample data', '2026-11-16'), 'marked-sample-2026-11-16.json');
});
```

- [ ] **Step 2: Run tests.** Expected: FAIL (`LG.marked` undefined).
- [ ] **Step 3: Implement `js/core/marked.js`** and register it in the manifest and `index.html`.
- [ ] **Step 4: Run tests.** Expected: `0 failed`.
- [ ] **Step 5: Home buttons.**
  - **"Export marked (N)":** N = starred items in the whole loaded file. Show it in the Marked mode note area and in the footer next to Export progress, disabled when N is 0. It runs `LG.dom.download(LG.marked.exportFileName(app.dataset.fileName, LG.dates.todayISO()), JSON.stringify(markedQuiz(app.ctx.items, app.state.progress, app.ctx.langTarget, Math.random), null, 2))`.
  - **"Clear all marks":** next to Export marked, behind `confirm('Remove the star from all N marked items?')`. It runs `clearStars` over all item ids, then `app.refresh()`.
- [ ] **Step 6: Check it in the browser** with `tests/dev/export-check.js`. It stars 2 items via `LG.play.toggleStar` in `b.eval`, then intercepts `LG.dom.download` by overriding it in `b.eval` to capture the arguments. After clicking Export marked, it asserts the file name matches `/^marked-sample-\d{4}-\d{2}-\d{2}\.json$/` and the JSON has 2 entries. Expected: `OK`.
- [ ] **Step 7: Commit** `feat: export marked items as quiz JSON; clear marks`.

---

### Task 5: Refresh file

**Files:**
- Create: `js/core/reload.js`, `tests/reload.test.js`
- Modify: `tests/manifest.js`, `index.html` (`reload.js` after `marked.js`), `js/store/storage.js`, `js/ui/dom.js`, `js/ui/screens/load.js`, `js/ui/app.js`, `js/ui/screens/home.js`, `js/ui/screens/cloze.js` (`gameHeader`), `js/ui/screens/match.js`, `js/ui/screens/daily.js`, `js/ui/screens/leitner.js`

**Interfaces:**
- Consumes: `LG.importer.readFile`, `rowsToDataset`, `jsonToDataset`.
- Produces:
  - `LG.reload.reparse(read: { rows?, json?, encoding }, fileName: string, learnColumn: 1|2) -> { ok: true, dataset: { items, fileName, importedAt, encoding } } | { ok: false, error: string }`. Errors: invalid JSON → the importer's message; no items → `'No rows with both a Source and a Target were found.'` (table) or `'No valid quiz entries were found.'` (JSON).
  - `LG.reload.diff(oldItems, newItems) -> { total: number, added: number, removed: number }`, counted by id.
  - `LG.reload.bannerText(fileName, d) -> string`, giving `'Refreshed ' + fileName + ': ' + total + ' items (+' + added + ' new, −' + removed + ' gone)'`.
  - `LG.storage.saveHandle(handle|null)` and `LG.storage.loadHandle() -> handle|null`, stored in the existing `dataset` store under key `'handle'` (no db version bump).
  - `LG.dom.pickFileWithHandle(accept) -> Promise<{ file, handle|null } | null>`. Uses `showOpenFilePicker` with types built from `LG.importer.ACCEPT` when available; otherwise falls back to `pickFile` with `handle: null`.
  - `app.refreshFile({ inGame: boolean }) -> Promise<void>`. Ids of the visible `"↻ Refresh file"` buttons are not needed; the call is wired directly.

- [ ] **Step 1: Write failing tests**

```js
T.test('reparse table and json', () => {
  const t = LG.reload.reparse({ rows: [['dom', 'house']], encoding: 'utf-8' }, 'a.csv', 1);
  T.eq([t.ok, t.dataset.items[0].target, t.dataset.fileName], [true, 'dom', 'a.csv']);
  const j = LG.reload.reparse({ json: '[{"question":"cat","options":["kot"],"correctIndex":0}]', encoding: 'utf-8' }, 'q.json', 2);
  T.eq([j.ok, j.dataset.items[0].target], [true, 'kot']);
});
T.test('reparse returns ok:false and no dataset for an empty table / invalid JSON', () => {
  const e = LG.reload.reparse({ rows: [], encoding: 'utf-8' }, 'a.csv', 1);
  T.eq([e.ok, e.dataset, e.error], [false, undefined, 'No rows with both a Source and a Target were found.']);
  const bad = LG.reload.reparse({ json: '{nope', encoding: 'utf-8' }, 'q.json', 1);
  T.eq([bad.ok, bad.error], [false, 'This file is not valid JSON.']);
});
T.test('diff and bannerText', () => {
  const d = LG.reload.diff([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }, { id: 'd' }]);
  T.eq(d, { total: 3, added: 2, removed: 1 });
  T.eq(LG.reload.bannerText('pl.xlsx', d), 'Refreshed pl.xlsx: 3 items (+2 new, −1 gone)');
});
```

- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement `js/core/reload.js`** and register it; implement `saveHandle`/`loadHandle` in `storage.js` and `pickFileWithHandle` in `dom.js`.
- [ ] **Step 4: Run tests.** Expected: `0 failed`.
- [ ] **Step 5: Capture handles on load.**
  - "Choose file" uses `pickFileWithHandle`.
  - Drop uses `e.dataTransfer.items[0].getAsFileSystemHandle()` when it exists; the file still comes from `dataTransfer.files[0]`.
    - Call `getAsFileSystemHandle()` synchronously inside the drop handler, before any `await`; the data transfer items empty after the event.
  - Keep the handle on the pending import and, on Start, `saveHandle(handle)` for a real file. The sample sets `saveHandle(null)`.
- [ ] **Step 6: Implement `app.refreshFile({ inGame })`.**
  1. If `inGame`, return when `!confirm('Refresh the file? This round ends; answers so far are kept.')`.
  2. Get a handle with `loadHandle()`. If the handle exists and `queryPermission({mode:'read'})` is not `'granted'`, call `requestPermission({mode:'read'})`. On a grant, read `await handle.getFile()`.
  3. If there is no handle, permission is denied, or `getFile` throws, use `pickFileWithHandle(ACCEPT)`.
     - The user cancels: return.
     - The picked file's name differs from `app.dataset.fileName`: `app.go('load')` and hand the file to the load screen as a fresh import (expose `LG.screens.load.importFile(root, file, handle)`, or pass `{ file, handle }` via params).
     - Otherwise, use it and `saveHandle` the new handle if there is one.
  4. Run `reparse(await LG.importer.readFile(file), file.name, settings.learnColumn)`. If `!ok`, banner `'Could not refresh: ' + error` (error kind) with a "Load file…" button that calls `app.go('load')`, and return without touching the dataset.
  5. Compute `diff`, `saveDataset`, and `setDataset`, then `go('home')` and show `bannerText` (info).
- [ ] **Step 7: Add buttons.**
  - Home top bar: `"↻ Refresh file"` next to the file name, hidden when `app.dataset.fileName === 'Sample data'`.
  - Game headers (Cloze, Multiple Choice, Flashcards via `gameHeader`, Pair Match, Daily Word, Leitner): a small `↻` button with `title` and `aria-label` "Refresh file" that calls `app.refreshFile({ inGame: true })`. Leitner and Daily Word count as in-game for the confirm, and the button is hidden for sample data there too.
- [ ] **Step 8: Check it in the browser** with `tests/dev/refresh-check.js`. The handle permission prompt can't be driven headlessly, so test the fallback path:
  1. Write `.tmp/refresh.csv` with 3 rows.
  2. Load it via the file chooser interception (`b.nextFile`).
  3. Rewrite it with 1 row changed and 1 added.
  4. Click `↻ Refresh file`, which falls back to the picker and gets the same name via `b.nextFile`.
  5. Assert the banner text is `Refreshed refresh.csv: 4 items (+2 new, −1 gone)` and Home shows `4 items`.
  6. Write invalid content (header only), refresh, and assert the error banner and that the item count is still 4.

  Expected: all `OK`.
- [ ] **Step 9: Update `README.md`** with one short section on "Ask for", stars and Export marked, and Refresh file (including that Safari and Firefox re-pick the file).
- [ ] **Step 10: Run `node tests/run-node.js`, then commit** `feat: refresh the loaded file in place`.
