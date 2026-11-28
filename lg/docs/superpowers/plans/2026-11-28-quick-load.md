# Quick load Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load a new file without a confirmation, load the remembered sheet in one click, and load a marked-words or special-attention day file from the local repeated-words folder by picking a date.

**Architecture:** Pure path logic and a folder search go into `LG.dayexport` (unit-tested with a fake directory handle). `load.js` gets a quick-load area above the dropzone that feeds the existing `readAndShow`, so language/preview/import are unchanged. The folder handle is the one Export a day already stores (`LG.storage.loadDirHandle` / `saveDirHandle`).

**Tech Stack:** Classic scripts, IIFE modules on `window.LG`, File System Access API (`showDirectoryPicker`), in-repo test runner (`node tests/run-node.js`).

**Spec:** `lg/docs/superpowers/specs/2026-11-28-quick-load-design.md`

## Global Constraints

- `lg/` only; `fc/` untouched. Works from `file://` (no modules, no fetch of local files, no build).
- No GitHub access, no link or token in the code or repo; the sheet link stays in the browser (`LG.storage` link).
- Path rule: month folder `<month>-<year>` (`october-2026`), day not zero-padded; folder and file stem accept either separator for both types; usual spelling first (`marked-words/marked_words-N.json`, `special-attention/special-attention-N.json`); marked day 1 may also be unsuffixed (`marked_words.json`); ignore `final-boss`.
- Calm UI: tokens only, dark mode, phone width, no emoji in chrome. `css/app.css` is CRLF: preserve line endings (check `git diff --stat`).
- Commits carry **no AI attribution**. Update `README.md` and `CLAUDE.md` (layout list: dayexport line, load.js note).
- Node comes from nvm: `source ~/.nvm/nvm.sh` before `node tests/run-node.js`; do not use brew.

## Review Focus

1. Empty or cleared date input: Load is disabled, nothing throws.
2. Day 1 of marked words: finds unsuffixed `marked_words.json` when `marked_words-1.json` is absent.
3. Folder handle saved earlier but moved or permission refused: show a banner and the picker again, do not crash.
4. File found but not valid quiz JSON or empty: the normal "Could not read the file" message on the Load screen.
5. Day with no file (e.g. 31st, or an older month whose names do not follow the pattern): an error banner names the month folder and the day.

---

### Task 1: Repo day lookup in `LG.dayexport`

**Files:**
- Modify: `js/core/dayexport.js`
- Test: `tests/dayexport.test.js` (append; it already has `fakeDir`, extend it)

**Interfaces:**
- Consumes: `fileExists`-style handling of `NotFoundError` already in `dayexport.js`.
- Produces:
  - `LG.dayexport.repoCandidates(date: 'YYYY-MM-DD', type: 'marked'|'special') → string[][]` each `[monthFolder, typeFolder, fileName]`, best guess first.
  - `LG.dayexport.findInRepo(rootDir, date, type) → Promise<{ file: File, parts: string[] } | null>`; `null` when no candidate exists; errors other than `NotFoundError` are rethrown.

- [ ] **Step 1: Write the failing tests** (append to `tests/dayexport.test.js`; give the fake file handle a `getFile()` returning `{ name, text() }`, and a helper that seeds `dir.dirs[...].files[...]`):
  - `repoCandidates marked, day 30`: first entry `['october-2026','marked-words','marked_words-30.json']`; contains `['october-2026','marked_words','marked-words-30.json']`; has no unsuffixed names.
  - `repoCandidates special, day 5`: first entry `['september-2026','special-attention','special-attention-5.json']`; contains `['september-2026','special_attention','special_attention-5.json']`.
  - `repoCandidates marked day 1` includes `['september-2026','marked-words','marked_words.json']` after the suffixed ones; special day 1 does not include an unsuffixed name.
  - `findInRepo` finds `special_attention-12.json` inside `special_attention/` for a type-special lookup, returns `parts` of that path and `file.name === 'special_attention-12.json'`.
  - `findInRepo` returns `null` for a day with no file and for a missing month folder.
  - `findInRepo` rethrows a non-NotFound error (fake `failWith: 'NotAllowedError'`).

- [ ] **Step 2: Run** `node tests/run-node.js`. Expected: the new tests FAIL (`repoCandidates is not a function`).

- [ ] **Step 3: Implement both functions in `js/core/dayexport.js`** and export them on `LG.dayexport`. Candidate order: folder-major over folders × stems (marked: folders `marked-words`, `marked_words`, stems `marked_words`, `marked-words`; special: folders `special-attention`, `special_attention`, stems `special-attention`, `special_attention`), then, for marked day 1 only, `<stem>.json` per folder/stem. Reuse the month-name logic of `relPath`.

- [ ] **Step 4: Run** `node tests/run-node.js`. Expected: all pass, none failing.

- [ ] **Step 5: Commit** `git add js/core/dayexport.js tests/dayexport.test.js && git commit -m "feat(lg): find a day's marked or special-attention file in the repo folder"`

### Task 2: Remove the confirm, add "Load my sheet"

**Files:**
- Modify: `js/ui/screens/home.js` (the Load new file button, ~line 359-363)
- Modify: `js/ui/screens/load.js` (`linkRow`, `renderPick`)

**Interfaces:**
- Consumes: `LG.storage.loadLink()`, `LG.storage.saveLink(url)`, `LG.remote.parseUrl`, `LG.remote.fetchFile`, `readAndShow(root, file, handle, sourceUrl)`.
- Produces: in `load.js`, `downloadLink(root, url, onBusy)` (the body of the current `go` in `linkRow`, shared by the link row and the new button) and `quickRow(root)` returning the element for the quick-load area (this task: sheet button only; Task 3 adds the repo card to it).

- [ ] **Step 1: Home: `onclick: () => app.go('load')`** for "Load new file"; delete the `window.confirm` line.
- [ ] **Step 2: Extract `downloadLink`** from `linkRow.go` (parse → `fetchFile` → `saveLink` → `readAndShow`, errors via `renderPick(root, message, '')`); `linkRow` calls it.
- [ ] **Step 3: `quickRow`**: a card with a primary **Load my sheet** button, shown only when `LG.storage.loadLink()` is set; click → `downloadLink` (button disabled, text "Downloading…" while busy). When no link is saved render nothing here (the existing link row below is the one-time entry and the place to change the link; add the line "Saved in this browser only" to its hint). Insert `quickRow(root)` in `renderPick` above `zone`.
- [ ] **Step 4: Verify** `node tests/run-node.js` still passes (no UI tests); in the browser (Claude in Chrome, serve `python3 -m http.server 8080`, open `/lg/`): with a fake link saved in `localStorage` the button appears; Home → Load new file opens the Load screen with no dialog.
- [ ] **Step 5: Commit** `git commit -am "feat(lg): Load new file without confirmation; one-click Load my sheet"`

### Task 3: Repeat words card (date + type → load from the folder)

**Files:**
- Modify: `js/ui/screens/load.js` (`quickRow`)
- Modify: `css/app.css` (a few rules next to `.link-row`; CRLF)
- Modify: `README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `LG.dayexport.findInRepo(rootDir, date, type)`, `LG.storage.loadDirHandle/saveDirHandle`, `globalThis.showDirectoryPicker({ mode: 'read' })`, `readAndShow(root, file, null)`, `LG.dates.todayISO()`, `LG.dates.formatDate`, `app.banner`.
- Produces: the "Repeat words" card inside `quickRow`.

- [ ] **Step 1: Build the card:** `<input type="date">` (default `LG.dates.todayISO()`), `<select>` with options `marked` "Marked words" and `special` "Special attention", a primary **Load** button disabled while the date is empty. Where `showDirectoryPicker` is missing, the card shows "Needs Chrome or Edge" and the button is disabled. Stored handle loaded on render (`loadDirHandle`, errors ignored); a muted line shows the folder name and a small **Change folder** button.
- [ ] **Step 2: Load click:** if no handle, `showDirectoryPicker({ mode: 'read' })` and `saveDirHandle` (an `AbortError` just stops). Call `handle.requestPermission({ mode: 'read' })` inside the click when available; not granted → banner "Folder access was not allowed." and clear nothing. `findInRepo` → found: `readAndShow(root, found.file, null)`; `null`: banner "No file for <formatted date> in <month>-<year>." (month folder from `parts`-style `relPath(date)[0]`); thrown error: banner with the message and offer **Change folder**.
- [ ] **Step 3: CSS** in `css/app.css` with tokens only, dark mode inherits tokens; phone width: the row wraps to a column under the existing mobile breakpoint.
- [ ] **Step 4: Docs:** `README.md` (new "Load screen" paragraph: sheet button, Repeat words, Chrome/Edge, needs `git pull`, error when the computed file is missing, any month) and `CLAUDE.md` (dayexport line mentions `repoCandidates`/`findInRepo`; load.js `quickRow`).
- [ ] **Step 5: Verify** `node tests/run-node.js` passes. In the browser inject an in-memory fake directory into IndexedDB `repoDir` (or stub `showDirectoryPicker`) holding `october-2026/special-attention/special-attention-30.json` with one valid quiz entry: pick 2026-10-30 + Special attention → the language/preview step appears with that file name; a missing day shows the banner; check light and dark theme and phone width via screenshots. The real folder picker is the learner's check.
- [ ] **Step 6: Commit** `git add -A lg && git commit -m "feat(lg): load a marked-words or special-attention day from the repeated-words folder"`

---

**Self-review:** spec goals 1 → Task 2 step 1; 2 → Task 2; 3 and 4 → Task 3; path rule and both separators → Task 1; non-goals respected (no GitHub, existing options kept, importer untouched). Names consistent: `repoCandidates`, `findInRepo`, `quickRow`, `downloadLink`.
