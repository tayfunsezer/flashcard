# Export a day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new "Export a day" screen in `lg/` that exports every word of a chosen date as a quiz JSON into `<repo>/<month>-<year>/marked-words/marked_words-<DD>.json`, writing straight into a remembered folder when the browser allows it and downloading otherwise.

**Architecture:** A pure core module `LG.dayexport` (dates, path, quiz entries, a folder writer that works against the File System Access interface so tests use fake handles), a tiny storage addition for the folder handle, and one new screen reached from Home. Quiz entries come from the same builder as `markedQuiz`, so the file format stays identical.

**Tech Stack:** classic `<script>` IIFE modules on `window.LG`, no build, in-repo test runner (`node tests/run-node.js`), File System Access API with download fallback.

**Spec:** `lg/docs/superpowers/specs/2026-11-21-export-day-design.md`

## Global Constraints

- Classic scripts only: no ES modules, no CDN, no npm, must work from `file://` in Edge/Chrome and keep working in Firefox (`lg/CLAUDE.md`).
- New core file goes into **both** `index.html` and `tests/manifest.js` in dependency order (after `js/core/marked.js`); its test file into `manifest.tests`. `run-node.js` fails on drift.
- Output path `<month>-<year>/marked-words/marked_words-<DD>.json`: lowercase English month, `<DD>` day of month **without zero padding**, year 4 digits (`october-2026`, `marked_words-5.json`).
- File content = `[{ question, options, correctIndex }]`: `question` = `item.source`, answer = `item.target`, same distractor rules as `LG.marked.markedQuiz`, distractor pool = every item's target (whole file).
- Direction is not an option: it follows the loaded file (`source` → `target`).
- Never create or overwrite the file when it already exists unless the learner chose Overwrite; nothing is ever deleted.
- Messages via `app.banner(text, kind)`; no `alert`. `window.confirm` is not used here.
- Preserve line endings: `README.md` is CRLF, the other touched files are LF (`git diff --stat` must stay small).
- Commits carry **no** `Co-Authored-By` / AI attribution (`lg/CLAUDE.md`).
- UI style: existing tokens and classes (`screen`, `topbar`, `card`, `btn`, `btn-small`, `btn-row`, `muted small`), both themes, no horizontal scroll at 360px.

## Review Focus

- Single-digit day: `relPath('2026-10-05')` ends in `marked_words-5.json`, not `-05`.
- Words without a date are not offered and the screen says how many were skipped.
- A day with one word, or fewer than 4 distinct Polish words in the whole file: fewer options, no crash (same as `markedQuiz`).
- Existing target file: `writeToRepo(..., false)` returns `'exists'` and writes nothing; Cancel leaves it untouched; Overwrite replaces it.
- Folder permission denied, folder deleted or write error: the screen shows the reason and offers Download instead of failing silently.
- JSON-imported items that carry their own `options` keep using them as distractors (shared builder).

---

### Task 1: Core `dayexport.js`: dates, path, day quiz

**Files:**
- Create: `lg/js/core/dayexport.js`
- Modify: `lg/js/core/marked.js` (extract the entry builder; `markedQuiz` behaviour unchanged)
- Modify: `lg/index.html`, `lg/tests/manifest.js` (register `js/core/dayexport.js` after `js/core/marked.js`, and the test file)
- Test: `lg/tests/dayexport.test.js`

**Interfaces:**
- Produces in `LG.marked`: `quizEntries(items, selected, lang, rand) → [{ question, options, correctIndex }]` where `selected` is the subset to turn into entries and the distractor pool is built from `items` (the whole list). `markedQuiz` becomes `quizEntries(items, items.filter(starred), …)`.
- Produces in `LG.dayexport`:
  - `datesIn(items) → [{ date: 'YYYY-MM-DD', count: number }]`, newest first, dated items only.
  - `relPath(date: 'YYYY-MM-DD') → ['october-2026', 'marked-words', 'marked_words-26.json']`.
  - `dayQuiz(items, date, lang, rand) → entries` for items whose `date === date`, in file order.

- [ ] **Step 1: Write the failing tests** in `tests/dayexport.test.js` (IIFE using `T.test`, same style as `marked.test.js`):
  - `datesIn counts per date, newest first, skips undated`: rows with dates 2026-10-26 ×2, 2026-10-05 ×1, one undated → `[{date:'2026-10-26',count:2},{date:'2026-10-05',count:1}]`.
  - `relPath builds month folder and unpadded day`: `'2026-10-26'` → `['october-2026','marked-words','marked_words-26.json']`; `'2026-09-05'` → `[... 'september-2026', 'marked-words', 'marked_words-5.json']`; `'2026-01-31'` → `january-2026`, `-31`; all 12 month names covered by a loop over `2026-MM-01`.
  - `dayQuiz returns only that day, question=source, answer=target`: two dated days plus enough other rows to give distractors; assert length, `q.question`, `q.options[q.correctIndex]`, 4 options each.
  - `dayQuiz with one word and own options`: mirrors the two `markedQuiz` tests (`[{question:'cat',options:['kot'],correctIndex:0}]`; JSON item with `options` uses them).
  - `dayQuiz round-trips through jsonToDataset with the same ids`.
  - In `tests/marked.test.js`, existing tests must still pass unchanged (proves the refactor).

- [ ] **Step 2: Run to verify failure:** `cd lg && node tests/run-node.js` → new tests FAIL (module missing; manifest check may also fail until registered).

- [ ] **Step 3: Implement** `LG.marked.quizEntries` (move the body of `markedQuiz`, same `pickDistractors(it.target, pool, it.categories, lang, rand, 3)` call) and `LG.dayexport.{datesIn, relPath, dayQuiz}` in `js/core/dayexport.js` as an IIFE; register in `index.html` and `tests/manifest.js`. Month names: a constant array of the 12 lowercase English names.

- [ ] **Step 4: Run tests:** `cd lg && node tests/run-node.js` → all pass (143 existing + new), no drift error.

- [ ] **Step 5: Commit**
```bash
git add lg/js/core/dayexport.js lg/js/core/marked.js lg/index.html lg/tests/manifest.js lg/tests/dayexport.test.js
git commit -m "feat(lg): dayexport core, dates, month path and day quiz entries"
```

---

### Task 2: `writeToRepo`: check first, then write

**Files:**
- Modify: `lg/js/core/dayexport.js`
- Test: `lg/tests/dayexport.test.js`

**Interfaces:**
- Consumes: `relPath` from Task 1.
- Produces: `async writeToRepo(rootDir, parts, text, overwrite) → 'written' | 'exists'`. `rootDir` is a `FileSystemDirectoryHandle`; `parts` is the `relPath` array (last element = file name). Uses only `getDirectoryHandle(name, { create })`, `getFileHandle(name, { create })`, `createWritable()` → `{ write(text), close() }`. Missing directory = a thrown error whose `name === 'NotFoundError'`; any other error propagates.

- [ ] **Step 1: Write the failing tests** with a small in-memory fake directory handle defined in the test file (nested maps; `getDirectoryHandle`/`getFileHandle` throw `{name:'NotFoundError'}` unless `create`; `createWritable` records the written text), `async` tests:
  - `writes into new month folders` → `'written'`, tree has `october-2026/marked-words/marked_words-26.json` with the exact text.
  - `reports exists and writes nothing when the file is there` → returns `'exists'`, stored text unchanged.
  - `overwrite replaces the existing file` → `'written'`, text replaced.
  - `other errors propagate` (fake throws `{name:'NotAllowedError'}`) → rejects.
  - `does not create folders when the file exists` (the tree's directory count is unchanged).

- [ ] **Step 2: Run to verify failure:** `cd lg && node tests/run-node.js` → the five new tests FAIL.

- [ ] **Step 3: Implement `writeToRepo`:** first walk `parts` without `create` to see whether the file exists (treat `NotFoundError` at any level as "does not exist"); return `'exists'` when it does and `overwrite` is false; otherwise walk again with `create: true`, `createWritable`, `write(text)`, `close()`.

- [ ] **Step 4: Run tests:** `cd lg && node tests/run-node.js` → all pass.

- [ ] **Step 5: Commit**
```bash
git add lg/js/core/dayexport.js lg/tests/dayexport.test.js
git commit -m "feat(lg): writeToRepo checks the path before writing and never overwrites silently"
```

---

### Task 3: Folder handle storage, Export a day screen, Home button, README

**Files:**
- Modify: `lg/js/store/storage.js` (add `saveDirHandle(handle)`, `loadDirHandle() → handle | null`, key `'repoDir'` in the existing store; export both on `LG.storage`)
- Create: `lg/js/ui/screens/exportday.js` (`LG.screens.exportday.render(root)`)
- Modify: `lg/index.html` (script tag after `screens/marked.js`)
- Modify: `lg/js/ui/screens/home.js` (button **Export a day** in the bottom `btn-row` next to Leitner boxes / Settings / Load new file, `onclick: () => app.go('exportday')`, `disabled` when `LG.dayexport.datesIn(app.ctx.items).length === 0`)
- Modify: `lg/README.md` (CRLF; one short paragraph next to the Manage marked text)

**Interfaces:**
- Consumes: `LG.dayexport.{datesIn, relPath, dayQuiz, writeToRepo}`, `LG.dates.formatDate`, `LG.dom.{h, clear, download}`, `app.ctx.{items, langTarget}`, `app.banner`, `app.go`.
- Produces: screen name `'exportday'` (router looks up `LG.screens[name]`).

- [ ] **Step 1: Implement storage helpers** (`put`/`get`/`delete` like `saveHandle`/`loadHandle`).

- [ ] **Step 2: Implement the screen.** Topbar "Export a day" + Back. Card with: date `<select>` (`DD-MM-YYYY (N words)`, newest first, preselect the newest); a skipped-words line (`k words have no date and are skipped`, hidden when 0); path preview `october-2026/marked-words/marked_words-26.json` that updates with the date; folder row (shown only when `typeof showDirectoryPicker === 'function'`): shows the stored folder name or "No folder chosen", `Choose folder`/`Change` runs `showDirectoryPicker({ mode: 'readwrite' })` inside the click and saves the handle; `Export` button. Export click: build `dayQuiz(...)` JSON text (2-space indent); if a folder is stored, `requestPermission({ mode: 'readwrite' })` inside the click, then `writeToRepo(root, relPath(date), text, false)`: `'written'` → banner `Saved <path>` (success); `'exists'` → inline prompt `<path> already exists.` with **Overwrite** (`writeToRepo(..., true)`), **Download a copy** (`LG.dom.download(fileName, text)`), **Cancel** (hide prompt, nothing written). No folder, API missing, permission not granted, or any thrown error → banner with the reason and `LG.dom.download(fileName, text)`, banner text names the folder path to put it in (`Put it in <month>-<year>/marked-words/`).

- [ ] **Step 3: Wire Home, index.html, README** as listed above.

- [ ] **Step 4: Run tests:** `cd lg && node tests/run-node.js` → all pass (no core change in this task; confirms nothing drifted).

- [ ] **Step 5: Verify in the browser** (serve `lg/` with `python3 -m http.server 8081`, Claude in Chrome, new tab, load `~/Downloads/csv/*.tsv` with column 1 = Polish): Home → Export a day lists the file's dates; picking `13-12-2025` previews `december-2025/marked-words/marked_words-13.json`; with no folder chosen, Export downloads that file and the banner names the folder; in both themes and at phone width the screen has no horizontal scroll. Read the downloaded JSON: array length equals the date's word count, every `options[correctIndex]` is Polish text, `question` is the other language.

- [ ] **Step 6: Learner check of the folder path** (cannot be automated: the folder picker needs a click and a real folder). Open `lg/index.html` by double-click in Edge/Chrome, `Choose folder` → `to-be-repeated-words`, export a date into a month that exists, then export the same date again and confirm the Overwrite / Download a copy / Cancel prompt appears and Cancel leaves the file unchanged. Report whether `showDirectoryPicker` works from `file://`; if it does not, the screen already falls back to download and no change is needed.

- [ ] **Step 7: Commit**
```bash
git add lg/js/store/storage.js lg/js/ui/screens/exportday.js lg/js/ui/screens/home.js lg/index.html lg/README.md
git commit -m "feat(lg): Export a day screen writes the day's quiz into the repeated-words folder"
```

---

### Task 4: Final verification

**Files:** none.

- [ ] **Step 1:** Run `superpowers:verification-before-completion`: `cd lg && node tests/run-node.js` (state the passing count), `git status` and `git diff --stat` (line-ending sanity), and report the browser checks from Task 3 with what was actually observed.
- [ ] **Step 2:** Update `lg/CLAUDE.md` layout lines (`dayexport.js` in the core list, `exportday` in the screens list, `repoDir` in the IndexedDB keys, test count) and the root `CLAUDE.md` only if the exchange format changed (it did not).

---

## Self-review notes

- Spec coverage: date list + counts + skipped undated (Tasks 1, 3), derived path with creation (Tasks 1, 2), check-before-write with Overwrite / Download a copy / Cancel (Tasks 2, 3), download fallback naming the path (Task 3), remembered folder (Task 3 storage), same file format via the shared builder (Task 1), README (Task 3), `file://` risk handled by feature detection plus the learner check (Task 3 step 6).
- Spec said the folder row is hidden when unsupported; the plan shows it only when `showDirectoryPicker` exists, and falls back to download when the picker throws on `file://`.
