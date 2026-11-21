# Export a day as a quiz file — design

Date: 2026-11-21. Status: draft, awaiting the learner's approval.

## Intent

> "A skill that opens Chrome ... forget that. I want this to be a functionality of the language game application rather than a skill, because this is a total deterministic process. We don't need to burn any kind of token." / "If I study 26th of October, then it becomes marked_words-26.json" / "Calculate the full path based on the picked date" / "If a file already exists in that path, just tell me, and then it is something I need to pick."

Workflow: the learner studies one lesson day from the TSV and keeps that day's words as a quiz JSON in `to-be-repeated-words/<month>-<year>/marked-words/marked_words-<DD>.json` (`<DD>` = day of month, no zero padding). They always load the file with **Polish as the language being learned**, so the file has `question` = their other language and `options` = Polish, exactly what `LG.marked.markedQuiz` writes. Direction is not an export option: it follows the loaded file's mapping.

## Goals

- Pick a date present in the loaded file and export every word of that date as quiz JSON, with no marks needed.
- Choose the `to-be-repeated-words` folder once; the app derives `<month>-<year>/marked-words/marked_words-<DD>.json` from the date (lowercase English month, e.g. `october-2026`), creating missing folders.
- Before writing, check the path. If the file exists, stop and let the learner pick: Overwrite, Download a copy, or Cancel.
- Where folder access is missing (browser without `showDirectoryPicker`, no folder chosen, permission denied), download the same file name and say which path to put it in.

## Non-goals

- No export-only direction switch (follows `learnColumn`), no both-directions export, no `special-attention` files, no git actions, no browser automation, no skill.
- Words without a date are not exported (the screen says how many were skipped).

## Design

- New pure module `js/core/dayexport.js` (`LG.dayexport`), tested first in `tests/dayexport.test.js`; added to `index.html`, `tests/manifest.js` (core order and tests):
  - `datesIn(items) → [{ date: 'YYYY-MM-DD', count }]`, newest first, dated items only.
  - `dayQuiz(items, date, lang, rand) → [{ question, options, correctIndex }]`: items of that date in file order, built like `markedQuiz` (same distractor rules, pool = every item's target); `markedQuiz` and `dayQuiz` share one entry builder.
  - `relPath(date) → ['october-2026', 'marked-words', 'marked_words-26.json']`.
  - `async writeToRepo(rootDir, parts, text, overwrite) → 'written' | 'exists'` against the File System Access interface (`getDirectoryHandle({create})`, `getFileHandle`, `createWritable`), so tests use fake handles. It looks for the file **before** creating anything; it never creates the file when it exists and `overwrite` is false.
- `js/store/storage.js`: `saveDirHandle(h)` / `loadDirHandle()` in the existing IndexedDB store, key `repoDir`.
- New screen `LG.screens.exportday` (`js/ui/screens/exportday.js`), reached by an **Export a day** button on Home next to Manage marked (disabled when the file has no dated words). Layout: topbar with Back; date select (`26-10-2026 (41 words)`); a path preview line; a folder row (`Choose folder` / current folder name + `Change`); `Export`. If the file exists an inline prompt shows the path with **Overwrite / Download a copy / Cancel**. Messages use `app.banner`, never `alert`.
- Export click order: ask permission (`requestPermission`) inside the click, then `writeToRepo`. On permission denial, a removed folder or any write error: banner with the reason and offer Download.
- Download fallback uses `LG.dom.download('marked_words-<DD>.json', …)` and the banner names the folder path to move it to.
- README: one short section for the new screen.

## Approaches

- **A. Write into the repo folder, download as fallback (chosen).** Removes the manual move.
- B. Download only. Works everywhere but leaves the move to the learner. Kept as the fallback.
- C. External Node script. Rejected: the learner wants it inside the app.

## Risks and builder calls (mine)

- `showDirectoryPicker` from `file://` is **unverified**. Verify first in the learner's Edge/Chrome with a throwaway page; if it fails the screen simply uses the Download path and the folder row is hidden.
- Folder permission may need re-confirming after a browser restart; handled by `requestPermission` at export time.
- Overwrite prompt appears only when the exact path exists; nothing is ever deleted.
- The distractor pool is the whole file, not just that day, so options are never limited to the day's words.
