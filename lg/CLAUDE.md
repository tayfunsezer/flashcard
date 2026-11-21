# Language Game (`lg/`) — developer introduction

The repo-level overview and the shared quiz-JSON format with the root flashcard app are in `../CLAUDE.md`. User-facing docs: `README.md`. Design history (the reasons behind decisions): `docs/superpowers/specs/2026-10-26-language-game-design.md` (v1) and `2026-11-16-whole-expression-marks-refresh-design.md` (whole expression, ☆ marks, refresh file). Implementation plans are in `docs/superpowers/plans/`.

## Hard constraints
- Must work when `index.html` is double-clicked (`file://`) in Edge/Chrome. Firefox must keep working; Refresh falls back to the file picker there.
- **Classic `<script>` tags only**: no ES modules (blocked on `file://`), no `fetch` of local files, no CDN, no build, no npm. SheetJS is vendored in `lib/xlsx.full.min.js`.
- Each file is an IIFE: `(function (LG) { … LG.name = { … }; })(globalThis.LG = globalThis.LG || {});`.
- **Script order matters.** `index.html` and `tests/manifest.js` must list core files in the same dependency order. `run-node.js` fails the build if they drift. A new core file goes into both, plus its test file into `manifest.tests`.
- Look: calm and "not childish": neutral palette, one accent, no emoji or mascots in UI chrome, minimal effects. Dark mode is first-class. Tokens are in `css/app.css` `:root`, overridden under `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and `:root[data-theme="dark"]`.

- **Line endings are mixed**: many files are CRLF (e.g. `css/app.css`, `answer.js`, `words.js`), some LF, a few both (`tests/words.test.js`). Preserve each file's endings; scripted edits must read/write with `newline=''` (Python) or the diff balloons. Check with `git diff --stat`.

## Layout

```
js/core/      pure logic, no DOM; unit-tested
  text.js        normalizeCell (trim/NFC/collapse), lower(lang), fold (accents + ı/ł/ß… table), tokenize (Intl.Segmenter)
  rng.js         cyrb53 hash, seeded PRNG, shuffle
  dates.js       parseDate (DD-MM-YYYY, DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD, Excel dates), formatDate, todayISO
  importer.js    readFile → rows/json, encoding sniff (UTF-8 / UTF-16 / win-1254 vs win-1250), rowsToDataset, jsonToDataset, itemId
  words.js       kindOf (sentence ≥ 4 tokens, else term), rarity table, cloze candidates/blank picking, pins, hints, filterItems, categories
  answer.js      checkAnswer (one word), checkWhole (token-wise) → 'correct' | 'almost' | 'wrong'
  schedule.js    Leitner boxes 0–5, INTERVAL_DAYS [0,1,3,7,14,30], applyResult, buildReviewRound (due → unseen → rest), revengeIds
  leitner.js     board/dueIds/idsInBox for the Leitner screen (due = by end of local day)
  study.js       study sets (by category/date; misses go back to the queue end)
  round.js       in-round relearning queue (missed item re-asked ≤ MAX_REPEATS=3; only the FIRST answer counts)
  rewards.js     XP per prompt, combo ×1.5/×2, level = floor(sqrt(xp/50))+1, streak, medals
  distractors.js pickDistractors (same category first, closest length)
  daily.js       Wordle-style daily word (deterministic per day, whole dataset)
  state.js       State shape, withDefaults (validation + v1→v2 migration), progress export/import
  play.js        state transitions used by screens: answerPrompt, matchBoard, completeRound, stars/pins, eligibleIds, mcEligibleIds
  marked.js      markedQuiz (starred items → quiz JSON), export file name
  reload.js      reparse/diff/bannerText for Refresh file
js/store/storage.js  localStorage 'lg.state'; IndexedDB db 'lg' store 'dataset' keys 'current' (dataset) and 'handle' (FileSystemFileHandle)
js/ui/dom.js         h(tag, attrs, ...children) element builder, clear, download, pickFile, pickFileWithHandle, withTimeout
js/ui/app.js         LG.app: state holder, router go(name, params), banners, ctx, filters, refreshFile, boot
js/ui/catpicker.js, sample.js (built-in Polish/English sample rows)
js/ui/screens/       load, home, settings, summary, cloze, mc, match, flashcards, daily, map, leitner
tests/               *.test.js (core only), runner.js (T.test/T.eq/T.ok/T.throws), manifest.js, run-node.js
tests/dev/           headless-Edge CDP scripts for screenshots/UI checks (cdp.js hard-codes a Windows Edge path)
```

## Core data

```js
// Dataset (IndexedDB 'current')
{ items: Item[], fileName, importedAt, encoding, learnColumn? }
Item = { id: 'i…' /* cyrb53(normSource \u0001 normTarget) */, source, target, date: 'YYYY-MM-DD'|null, categories: string[], options?: string[] /* JSON imports */ }
// target = the language being learned (column chosen at import); source = its translation

// State (localStorage 'lg.state', VERSION 2)
{ version, settings: { theme: 'system'|'light'|'dark', langSource, langTarget, direction: 's2t'|'t2s', learnColumn: 1|2, ask: 'word'|'whole' },
  progress: { [id]: { box 0-5, due ms, seen, revenge, pin: string[]|null, rot, star? } },
  xp, streak: { current, best, lastDay }, daily: { date, guesses, done, won }, studySet: { by, value, game, queue, done, total }|null, lastExport }
```

`LG.app.ctx` (rebuilt when the dataset, languages or `ask` change) = `{ items, langSource, langTarget, rarity, kinds, itemsById, mcIds }`.

## How things flow
- **Boot** (`app.boot`): load state → load the dataset from IndexedDB → `go('load')` when there is none (or no target language yet) → else `go('home')`. URL params: `?sample=1` (load the sample when empty), `?theme=light|dark`, `?screen=<name>` and `&ids=a,b` (jump straight into a game; used by dev scripts).
- **State updates are immutable**: core functions return a new state, and the screen calls `app.setState(next)`, which saves to localStorage. Never mutate `app.state` in place.
- **Screens**: `LG.screens.<name>.render(root, params)`. A game gets `{ ids, mode }` with mode `review | revenge | study | marked | leitner`. It uses the shared helpers on `LG.screens.cloze` (`gameHeader`, `roundTracker`, `againTag`, `starButton`, `sentence`). At the end it calls `app.go('summary', { game, mode, xp, correct, almost, wrong, moved, missed, marked, seen, again })`. Keyboard handlers attach to `document` and detach themselves once `screen.isConnected` is false.
- **Answer → progress**: `LG.play.answerPrompt(state, id, result, { hints }, now, combo)` applies the Leitner result, XP and combo, and records study-set progress. Only call it when `track.counts(id)` is true, so repeats inside a round don't move boxes.
- **Rounds** have no size cap and always start shuffled (`LG.play.startRound`). Review = every filtered eligible item, due first. MC eligibility comes from `mcIds`.
- **Marks** = `progress[id].star === true`. Pinning a Cloze word also stars. Unstarring keeps pins.
- **Refresh file**: uses the stored FileSystemFileHandle, with permission requested inside the click gesture. Without one, a banner asks the user to pick the file again. The same file name re-parses silently with the stored `learnColumn`; a different name goes through the full load screen. Progress is kept by id, and an edited row counts as one item gone plus one new.
- **Progress backup**: Home/Settings Export progress → `language-game-progress-YYYY-MM-DD.json` (`{ format, version, exportedAt, state }`). Import replaces the state but keeps the current languages when the file has none.

## Working on lg
1. Put logic in `js/core` as pure functions taking `(state, …, nowMs, rand)`; inject time and randomness so tests are deterministic (`LG.rng.seeded(n)`).
2. Write or extend `tests/<module>.test.js` first. Run `tests.html` in the browser or `node tests/run-node.js` (127 passing as of 2026-11-21). On this Mac, Node comes from nvm (`nvm install <major>`), not Homebrew.
3. Wire the UI in `js/ui/screens/*` with `h()`. Use `app.banner(text, kind)` for messages, never `alert`; a `window.confirm` is used only for destructive actions.
4. Changing the State shape: bump `LG.state.VERSION`, then migrate in `withDefaults` (which also covers imported progress files) and add a state test.
5. Changing the import/export JSON: keep it readable by the root app or document the break (see `../CLAUDE.md`). Keep `markedQuiz` → `jsonToDataset` ids round-tripping (`marked.test.js`).
6. **Every feature or revision, even a small one, goes through superpowers** (brainstorming → writing-plans → test-driven-development → verification-before-completion). It leaves a dated spec `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and a plan `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`, which are the history of changes. Quote the user's request in the spec's Intent, write it before the code, and update `README.md` for user-visible behaviour. Existing plans forbid AI attribution in commits (no `Co-Authored-By`); follow that.
