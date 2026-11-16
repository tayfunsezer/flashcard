# Whole-expression answers, marked sets, refresh file — design

Date: 2026-11-16. Amends `2026-10-26-language-game-design.md`.

## Intent

Three changes for a single learner who studies mostly Polish from files they edit often.

1. **Whole expression.** Cloze and Multiple Choice sometimes ask for one word of a longer target. The visible rest can give the answer away: with `orać & zaorać pole`, seeing `zaorać` reveals `orać`. The learner wants to be asked for the whole target when they choose to.
2. **Marked set you can take anywhere.** The learner wants to mark items while studying in any game. They want to work only on those items, and to export them as a small quiz JSON file they can load any time instead of reloading the full set, much of which they already know. Example: when a Cloze round ends, they want to play only the items they marked, not the whole set again.
3. **Refresh file.** The learner edits the source file and reloads it often. A "Refresh file" button should re-read the same file without picking it again.

## Goals

- A remembered switch, "Ask for: one word / whole expression", that changes Cloze and Multiple Choice.
- A ☆/★ item mark settable from every game, a mode that plays only marked items, and an export of marked items in the existing quiz JSON format.
- Re-reading the last loaded file with one click, using the same column mapping and languages.

## Non-goals

- No new import screen for marked files. An exported file is loaded like any other file.
- Dates and categories are not carried in the exported file. The quiz JSON format has no place for them.
- No mid-round merge on refresh. A game in progress ends, as the learner allowed.
- Pair Match, Flashcards and Daily Word are not changed by the whole-expression switch. Pair Match and Flashcards already show whole targets; Daily Word uses single words.

## Anti-goals

- Refresh must not lose progress for rows that did not change.
- Marking must not depend on Cloze pins. Marks must be possible from Multiple Choice, Pair Match and Flashcards.

## Approaches (picked: 1A, 2A, plus refresh)

**Whole expression**
- **1A, picked:** a switch on Home, remembered, applying to Cloze and Multiple Choice. It is quick to flip every round.
- 1B: the same switch in Settings. It is harder to reach.
- 1C: automatic (short terms whole, sentences one word). It takes the choice away and fails the `orać & zaorać pole` case.

**Marks**
- **2A, picked:** an item-level star on every game, the "Marked words" mode, and "Export marked" as quiz JSON. Import is loading the file.
- 2B: Cloze pins stay the marks, plus an export. Rejected: marks can't be set from other games.
- 2C: named lists kept in the browser. Rejected: they can't travel "anywhere".

**Refresh (one sensible way)**
- Use the File System Access API: keep a `FileSystemFileHandle` for the loaded file in IndexedDB and re-read it on demand.
- A plain `<input type=file>` `File` cannot be re-read after the file changes on disk (Chromium throws `NotReadableError`), so a handle is needed.
- Checked: headless Edge 157 on `file://` reports `isSecureContext === true`, `showOpenFilePicker` and `DataTransferItem.getAsFileSystemHandle` available.

## Design

### 1. Ask for: one word / whole expression

- **Setting:** `settings.ask: 'word' | 'whole'`, default `'word'`, validated in `withDefaults`.
- **Switch:** a segmented control on Home's Play card, next to the direction toggle. Its label says it applies to Cloze and Multiple Choice.
- **Cloze, whole mode:**
  - The whole target is the answer. The answer line shows the source clue and one wide blank sized to the target, with no target words visible.
  - The input accepts the whole expression. Hints use `hintText` on the whole target.
  - The "Type all N missing words" note becomes "Type the whole expression".
- **Answer checking in whole mode** compares word tokens only:
  - Symbols and punctuation between words (e.g. `&`, `,`, `-`, `/`) are ignored, so `orać zaorać pole` is correct for `orać & zaorać pole`.
  - Case and accent rules stay as today: case-insensitive, folding gives "almost".
- **Whole-mode feedback:**
  - Shows the full target as today. Words stay clickable to pin (pins only matter in one-word mode).
  - Shows the ☆ star.
  - "You typed" stays.
- **Multiple Choice, whole mode:** every item is asked as a term-style question. The prompt is the source; the options are whole targets.
  - **Wrong options:** the item's own `options`, or picked from other items' targets with `pickDistractors` (same category first, closest length).
  - **Eligibility:** any item, as long as the pool has at least 4 distinct targets.
  - **t2s direction** is unchanged; it already shows whole targets.
- **One-word mode** is today's behaviour, unchanged.

### 2. Marks (☆ / ★)

- **Storage:** `progress[id].star === true`. "Marked" now means starred (`isMarked`).
- **Migration:** bump state `version` to 2. When loading a version-1 state, any entry with a non-null `pin` gets `star: true`, so items marked today stay marked. This runs once; later unstarring sticks.
  - Progress import (`parseProgressFile`) applies the same migration to version-1 files.
- **Pins and stars:**
  - Pinning a word in Cloze also stars the item.
  - Unstarring does not clear pins; pins only steer which word is blanked.
  - The ✕ on the pin row clears pins only.
- **Where the star appears** (a toggle button labelled "☆ Mark" / "★ Marked"):
  - Cloze feedback.
  - Multiple Choice feedback.
  - Flashcards once the card is flipped.
  - The round summary, as a collapsible "Words in this round" list with a star on every row. This is how Pair Match items get marked, and a catch-all for every game.
- **Summary actions:**
  - Today's "Practice N words — X missed, Y marked" button stays. Marked now means starred during this round.
  - New button: "Play all marked (N)". It starts the same game in Marked words mode over every starred item in the current filters, shuffled, with no cap. It is hidden when N is 0, and falls back to Flashcards when the game can't run on them (as the practice button does).
- **Home, Marked words mode:**
  - The note reads "Marked words: items you starred — N right now."
  - The empty state reads "No marked words yet. Star items with ☆ in any game."
  - The stats row "Marked N" counts stars.
- **Export marked:**
  - **Button:** "Export marked (N)" on Home, shown in the Marked words mode note area and in the footer next to Export progress. Disabled when N is 0.
  - **What it exports:** every starred item in the loaded file. Filters are ignored.
  - **File:** `marked-<dataset name>-YYYY-MM-DD.json`, where the dataset name is the file name without extension.
  - **Format:** the existing quiz JSON, `[{ question, options, correctIndex }]`, with `question` = item source and the correct option = item target. This is independent of the Home direction toggle, so the item keeps its id when the file is loaded back.
  - **Options:** target plus the item's own `options` if it has any, otherwise up to 3 whole-target distractors from the loaded file (`pickDistractors`). They are shuffled, with `correctIndex` pointing at the target.
- **Clear marks:** a "Clear all marks" button next to Export marked, behind a confirm. It removes `star` from every item in the loaded file.
- **Loading an exported file:**
  - Uses the existing JSON loader. Every item lands in one category named after the file.
  - Progress (boxes, revenge, stars) carries over because ids match.

### 3. Refresh file

- **Getting a handle:** when a file is chosen through "Choose file" or dropped on the load screen, get a handle.
  - Choose file: use `showOpenFilePicker` (accept types from `ACCEPT`) when available; otherwise fall back to today's `<input type=file>`.
  - Drop: `DataTransferItem.getAsFileSystemHandle()`.
- **Storing the handle:** in IndexedDB next to the dataset, in the existing `lg` db (new key or store). Also keep the import choices needed to re-parse without the mapping screen: `learnColumn`, languages (already in settings), and the format.
- **Button:** "↻ Refresh file" in Home's top bar next to the file name, and as a "↻" button in every game header (Cloze, Multiple Choice, Pair Match, Flashcards, Daily Word, Leitner).
- **On click:**
  1. In a game, confirm: "Refresh the file? This round ends; answers so far are kept."
  2. If the handle's permission is not granted, `requestPermission({ mode: 'read' })`; the click is the user gesture.
  3. Re-read the file. Parse it with the same importer path as the original load: `rowsToDataset` with the stored `learnColumn`, or `jsonToDataset` with the same file name.
  4. Save the dataset, `setDataset`, prune the study set as today, and go Home.
  5. Show a banner: "Refreshed <file>: N items (+A new, −R gone)". Here "new" and "gone" are by item id; an edited row counts as one gone and one new.
- **Fallback:** with no handle (Firefox, or a file loaded before this change), or if permission is denied or the read fails, the button opens the file picker. The picked file then goes through the same re-parse path, skipping the mapping screen; it becomes the stored handle when available.
- **Progress:** kept by id, as today. A row whose source or target text was edited gets a new id and starts fresh: box 0, no star. The banner counts make this visible.
- **Sample data:** has no file, so the Refresh button is hidden.

## Builder calls (settled from the builder check)

1. **Leitner and Study sets follow the switch.** It is global. Leitner's Cloze and Multiple Choice sub-games read `settings.ask`. `ctx.mcIds` is computed for the current mode; in whole mode every item is eligible when the file has at least 4 distinct targets.
2. **"Y marked" on the practice button** keeps today's meaning: items unmarked when first seen this round and marked at round end (the existing `round.unmarked` tracking, now reading `star`). "Play all marked (N)" covers everything starred.
3. **Refresh can't parse the file** (invalid JSON, format changed, no rows): show an error banner, stay on the current screen, and offer "Load file…" to go to the load screen and re-map.
4. **Refresh fallback picker:**
   - Same file name as the stored one: re-parse silently with the stored mapping.
   - Different name: go through the normal load screen with mapping, as a fresh load.
5. **Export file name:** strip a leading `marked-` and a trailing `-YYYY-MM-DD` from the dataset name before building `marked-<name>-<date>.json`, so re-exports don't stack. Sample data exports as `marked-sample-<date>.json`.
6. **Whole-mode "almost"** is judged on the whole answer:
   - All word tokens equal (case-insensitive): correct.
   - All equal after accent folding: almost.
   - Otherwise wrong, including a missing or extra word.

## Constraints

- Static site opened from `file://`. Classic scripts on the `LG` namespace, no build, no network.
- Tests: the in-repo runner (`node tests/run-node.js` and `tests.html`). Core logic gets unit tests; the UI is checked with the CDP dev driver.
- Edge and Chrome are the primary browsers. Firefox must keep working, with Refresh falling back to the picker.

## Left to the builder

- Exact placement and styling of the star buttons and the segmented control, within the existing look.
- The IndexedDB layout for the handle.
- Token comparison helper naming and location (`answer.js` is the natural home).
- How to share the summary's word list with existing summary markup.
