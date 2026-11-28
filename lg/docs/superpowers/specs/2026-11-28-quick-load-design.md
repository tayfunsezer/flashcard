# Quick load: no confirm, sheet button, load a day from the repo folder

Date: 2026-11-28. A small change in `lg/` only (`fc/` untouched). Approved by the learner in chat (design proposal, plus the amendment "both separators for both types").

## Intent and why

The learner loads a new file several times a day. Today "Load new file" asks for confirmation (never wanted: pressing it is always deliberate, and losing the current list is fine), and every load means finding a file by hand. The files follow two patterns: the Google Sheet, and the day files in the local `to-be-repeated-words` clone (marked words and special attention), whose path follows from a date.

The learner's words: "when you press load button, I don't like that it asks me a confirmation window ... I'm okay that it is dropping existing files" and "an interface that would offer me two options: load from Excel with the option of keeping the link ... while we keep to ourselves to not put any link in the code base", plus "a date picker and a drop down that would tell me if I want to load marked words or special attention", read from the local folder only ("don't read anything from GitHub"); "marked words can have hyphen and special attention can have underscore".

## Goals

1. **No confirmation** on Home → "Load new file". It goes straight to the Load screen.
2. **Load my sheet** button on the Load screen: loads the remembered link in one click. The link is asked for only the first time (field shown when none is saved) and stays in the browser (`LG.storage` link), never in the repo. A small "change link" control edits it.
3. **Repeat words** card on the Load screen: date picker (default today), type dropdown (Marked words | Special attention), Load button. It reads the file from the local clone folder and continues into the normal language and preview step.
4. Folder: the existing repeated-words folder handle (`LG.storage.loadDirHandle`, also used by Export a day). Asked once with `showDirectoryPicker`, remembered, permission re-requested on click when needed. No GitHub access of any kind.

## Non-goals / anti-goals

- No network reads from GitHub. No `final-boss` files. No month is excluded: the path is computed for any date, and an error is shown when the computed file does not exist. (March to June 2026 use irregular names, e.g. `marked-words_part1`, so only days whose names follow the pattern load; July onward follow it.)
- Do not remove the existing choose file / drop / paste link / sample data options.
- Do not change the file format or importer.

## Path rule (pure, tested)

Date `YYYY-MM-DD` → month folder `<month>-<year>` (`october-2026`), day without zero padding.
- Type folder and file stem accept **either separator** for both types: folders `marked-words` / `marked_words` and `special-attention` / `special_attention`; files `<stem>-<day>.json` where stem is `marked_words`, `marked-words`, `special-attention`, `special_attention`. First existing candidate wins (the learner's usual spelling first: `marked_words`, `special-attention`).
- Day 1 of marked words may also be the unsuffixed `marked_words.json` / `marked-words.json` (September 2026 has it).
- Not found (any month): an error message names the month folder and the day.

## Approaches

- **A. Reuse the stored folder handle, compute candidates, try each (picked).** Smallest, matches Export a day, no credentials.
- B. GitHub token + API: works on phone, but the learner ruled out reading from GitHub.
- C. File picker with a path hint: more clicks, no gain.

## Design

- `LG.dayexport` (or a sibling in `core`): `repoCandidates(date, type) → string[][]` pure path lists; `findInRepo(rootDir, date, type) → File | null` tries them with `getDirectoryHandle` / `getFileHandle`. Tests with a fake directory handle.
- `home.js`: drop the `confirm` at the Load new file button.
- `load.js`: `quickRow(root)` renders the sheet button and the Repeat words card above the dropzone; uses `readAndShow(root, file, null)` so the rest of the flow is unchanged. Chrome/Edge only: where `showDirectoryPicker` is missing the card says so and the other options remain.
- Tokens only, dark mode, phone width, no emoji in chrome. Update `README.md` and add to the lg notes. Commits carry **no AI attribution** (lg convention).

## Left to the builder

Exact copy and layout of the two cards, whether "change link" is a link or a small button, and where the candidate-path code lives.
