# Language Learning Game — Design

Date: 2026-10-26
Status: Approved 2026-10-26

## 1. Intent

A personal, browser-only game for learning vocabulary and phrases from the user's own spreadsheet. The user already knows flashcard/Leitner systems; this should feel like a *game* (variety, pace, rewards, visible mastery) while still quietly doing spaced repetition underneath.

Calls marked **[builder call]** were made by the designer, not the user, and may be revisited.

## 2. Goals, non-goals, anti-goals

**Goals**
- Load the user's own `.xlsx` or `.csv` and play immediately — no setup.
- Four games in v1: Cloze, Multiple Choice, Pair Match, Daily Word (Wordle-style).
- Reward layer: XP, levels, combos, daily streak, Category Map medals, revenge pile.
- Filter what you play by Date range and Category; flip direction (Source→Target / Target→Source).
- Looks right in dark mode and light mode.

**Non-goals (v1)**
- No backend, accounts, sync, or multi-user features.
- No audio / text-to-speech, no AI grading or translation.
- No editing of the spreadsheet inside the app.
- Later-list games: Falling Words, Scramble, Boss Battles, generated crosswords.

**Anti-goals (failure even if it "works")**
- Cloze constantly blanking filler words ("the", "and", "de", "ve") — the blank must usually be a word worth learning.
- Losing progress because the file was reloaded or edited.
- Rewards that feel grindy or noisy instead of motivating.
- Being wrong about correctness in ways that feel unfair (e.g. rejecting an answer over capitalisation or trailing punctuation).

## 3. Constraints (from the user)

- Fully client-side JavaScript website. No backend. Single user.
- Input: `.xlsx`, `.csv` and tab-separated `.tsv` / `.txt` (TSV added 2026-10-26). Text formats share one path: delimiter sniffing (comma, semicolon, tab) and encoding detection.
- Columns are read **by position, never by header name**:
  1. Text in the language being learned (**Target**) — by default
  2. Its translation (**Source**) — by default
  3. Date (used for filtering)
  4. Category
- **Column mapping** (amended 2026-10-26, user requirement — supersedes the earlier "column 1 = Source, column 2 = Target"): the language being learned can be in either of the first two columns. At each import the user picks "Language I'm learning is in: Column 1 / Column 2" (default Column 1), with a 3-row preview labelled Learning / Translation. The choice is remembered for the next upload. Internally Target always means the language being learned.
- A cell may contain a single word, a multi-word term, or a full sentence.
- Must work well in dark mode.
- **Target is the language being learned.** The direction toggle only swaps prompt and answer in Multiple Choice and Pair Match. Cloze always blanks a word in the Target sentence, and Daily Word always uses Target words. All word analysis (§6, §7) runs on Target only.
- **Languages:** mainly Turkish and Polish, and these must be handled correctly. **Polish is the user's main target language** (added 2026-10-26): Polish comes first in the language lists, is the default target language, and the built-in sample data is English → Polish. It should still work for any language (see §5a).

## 4. Stack

- **User requirement:** the user opens `index.html` by double-clicking it (`file://`) and that's it. No npm, no build step, no server, no install.
- Consequences for the builder:
  - Plain HTML + CSS + JavaScript loaded with **classic `<script>` tags**. ES modules (`type="module"`) are blocked on `file://` in Chrome/Edge, so they are not used. Code is split into several `.js` files sharing one global namespace object (e.g. `window.LG`), loaded in dependency order. **[builder call]**
  - No `fetch()` of local files (also blocked on `file://`). Everything is in the script files, or comes from the file the user picks.
  - **SheetJS** is vendored as a local file (`lib/xlsx.full.min.js`, a pinned version), so the app works offline. No CDN at runtime. **[builder call]**
  - **Tests:** `tests.html` runs the pure-logic tests in the browser with a tiny in-repo test runner and shows pass/fail. You open it the same way as the app. Covers parsing, dates, tokenising, blank selection, answer matching, scheduling and scoring. **[builder call]**
- Persistence: `localStorage` for settings and progress, and IndexedDB for the last loaded dataset. Both work on `file://` in Chrome/Edge. Browser storage on `file://` is less durable than on a website, so progress export (§10a) is the backup.
- Target browsers: current Chrome and Edge on Windows. Firefox is nice to have. **[builder call]**

## 5. Data import

**Reading**
- Use the first sheet of an xlsx. CSV: let SheetJS detect delimiter (comma or semicolon) and read as UTF-8.
- Columns A–D map to Source, Target, Date, Category. Extra columns are ignored.

**Header row** **[builder call]**: if row 1's column-3 value is non-empty and does not parse as a date, treat row 1 as a header and skip it; otherwise it is data.

**CSV encoding**: if the file isn't valid UTF-8 (Excel's default "CSV (Comma delimited)" on Turkish or Polish Windows), decode it as Windows-1254 or Windows-1250, whichever yields more Turkish or Polish letters. The import summary names the encoding used.

**Cleaning**
- Trim all cells; collapse internal whitespace runs to single spaces; Unicode-normalise to NFC.
- Skip rows where Source or Target is empty.
- Empty Category → `Uncategorized`.
- **Multiple categories** (added 2026-10-26, user requirement): a Category cell may hold several categories separated by `|` (e.g. `Food|Travel`). Parts are trimmed, empty parts dropped, and merged case-insensitively. An item belongs to every one of its categories: filters, study sets and the Category Map count it under each; Multiple Choice treats words sharing any category as "same category". Duplicate rows combine their categories.
- Duplicate rows (same Source + Target) are merged into one item.

**Dates** **[builder call]**
- Real Excel dates (date cells or serial numbers) are used as-is.
- Text dates (user's format): **`DD-MM-YYYY`**, e.g. `13-12-2025`. Also accept `DD.MM.YYYY` and `DD/MM/YYYY`, with 1- or 2-digit day and month. Always day-first, never month-first. `YYYY-MM-DD` is also accepted as a safe extra. **[builder call]**
- Dates are shown in the UI as `DD-MM-YYYY`.
- Unparseable/empty date → item has no date; it is included when no date filter is set and excluded when one is.

**Import summary**: after loading, show counts — items loaded, sentence items vs term items, categories found, rows skipped (with reason), dates not understood.

**Item identity**: each item's id is a hash of normalised Source + Target. Reloading the same or an updated file keeps progress for unchanged items; new rows appear as new; removed rows stop appearing (their progress stays stored but unused).

**Persistence of the file**: the parsed dataset is saved to IndexedDB so the next visit opens straight into play. A "Load new file" button replaces it. One dataset at a time.

## 5a. Column languages

- After the first import of a dataset, ask once: "Language of column 1" and "Language of column 2". Each is a dropdown with Turkish (`tr`), Polish (`pl`), English (`en`) and other common languages, plus a free-text BCP-47 code field. The choice is stored with the dataset and can be changed in Settings.
- The language code is passed to every locale-sensitive operation: `toLocaleLowerCase(lang)`, `Intl.Segmenter(lang)` and `localeCompare`. This makes Turkish `İ→i` and `I→ı` correct.

## 6. Words vs sentences

- Text is split into words with the browser's `Intl.Segmenter` (granularity `word`, keep `isWordLike` segments). This handles languages without spaces (Chinese, Japanese, Thai) as well as spaced languages.
- **Sentence item**: Target has **4 or more** word tokens. **[builder call]**
- **Term item**: Target has 1–3 word tokens (covers single words and short phrases like "ice cream").
- Sentence items feed Cloze. Term items feed Multiple Choice, Pair Match and Daily Word. Cloze blanks also count as items for Multiple Choice (see §8.2).

## 7. Choosing the Cloze blank (no NLP)

1. **Rarity table**: across all Target cells in the dataset, count in how many items each lower-cased word appears (document frequency).
2. **Candidates** in a sentence: word-like tokens with length ≥ 4 characters (≥ 2 for CJK/Thai scripts), not purely digits.
3. Rank candidates by rarity (rarest first). If no token passes the length rule, fall back to the longest token.
4. **Rotation**: each time a sentence comes up, pick the next of its 3 rarest candidates in turn, so the same sentence tests different words.
5. **User override**: on any Cloze screen the user can click a word in the full sentence to pin it as "the word" for that item. Pinned words are always used and stored in progress. A pin can be cleared.

## 8. Games (v1)

All games honour the current Date/Category filters and direction. Every game (except Daily Word) can be played in two modes:

- **Review** (default): a round of **10 prompts** chosen by the schedule (§10). **[builder call]**
- **Study set** (user requirement): pick **one Category** or **one Date** (a list of the dates that exist in the data, with item counts) and go through **every item** in it once, ignoring the schedule. Items are shuffled; misses come back again at the end of the set until each item has been answered correctly once. Shows progress (e.g. `23 / 80`), and can be left and resumed until finished. Pair Match runs through the set in boards of 6. Answers still update boxes as usual. Cloze uses only the sentence items in the set, and Multiple Choice and Pair Match use the term items. If the chosen game has no matching items in the set, say so and suggest the game that does.

### 8.1 Cloze (sentence items)
- Show the clue-side sentence in full and the answer-side sentence with one word replaced by a blank sized to the word.
- Player types the missing word.
- **Hint ladder**: first letter → letter count (underscores) → reveal half the letters. Each hint step reduces that prompt's XP.
- After answering, show the full answer sentence with the word highlighted.

### 8.2 Multiple Choice (term items + cloze blanks)
- Prompt in clue language; four options in answer language.
- **Distractors**: from the same Category first, preferring similar length; fall back to other categories if the category has fewer than 4 items.
- Cloze-blank variant: sentence with blank, four candidate words.

### 8.3 Pair Match (term items)
- Board of 6 clue tiles and 6 answer tiles, shuffled. Tap one of each to pair; correct pairs vanish, wrong pairs flash and count as a miss for both items.
- Timed; score from time + misses. One board = one round.
- Needs ≥ 6 term items in the filter; otherwise explain and disable.

### 8.4 Daily Word (Wordle-style)
- One answer-language word per calendar day, chosen deterministically from the **whole dataset** (ignores filters, so it's stable for the day).
- Pool: single-word Term targets plus pinned/top Cloze words, 4–8 letters, letters only.
- 6 guesses of the word's length. Any guess of the right length is accepted (no dictionary). Green = right letter right place, yellow = in word elsewhere, grey = absent. Letters are compared case-insensitively using the Target language, but **exactly** otherwise: `ç` and `c` are different letters. **[builder call]**
- On-screen keyboard: the Latin letters plus every other letter found in the dataset's Target column, colored by guess results. Physical keyboard typing also works.
- After the 3rd wrong guess, reveal the clue-side translation as a hint.
- Completing it (win or lose) counts towards the daily streak; win gives bonus XP.
- Daily Word does **not** change any item's box or due time. It's for fun and streaks only. **[builder call]**

## 9. Answer checking (typed answers)

- Ignore case (`toLocaleLowerCase` with the answer column's language), leading/trailing whitespace and surrounding punctuation.
- Exact match after that → correct.
- Matches only after **letter folding** → **"almost"**: counts as correct for progress, half XP, and shows the correctly accented form. **[builder call]**
  - Folding = NFD, then remove combining marks (covers Turkish ç ş ğ ö ü and Polish ą ę ć ń ó ś ź ż), then a fixed table for letters that don't decompose: `ı→i`, `İ→i`, `ł→l`, `Ł→l`, `ø→o`, `đ→d`, `ß→ss`, `æ→ae`, `œ→oe`.
  - Examples that must pass tests: `kiz`≈`kız`, `cok`≈`çok`, `İSTANBUL`=`İstanbul` (tr), `ISTANBUL`≈`İstanbul` (tr), `lodz`≈`łódź`, `zolw`≈`żółw`.
- **Typing special letters**: Cloze shows a small row of letter buttons under the input with the non-ASCII letters that appear in the dataset's Target column (for example `ç ş ğ ı ö ü` or `ą ę ł ń ó ś ź ż`). Clicking one inserts it at the cursor.
- Otherwise wrong; show the correct answer.

## 10. Progress & scheduling (Leitner underneath)

- Each item has a **box 0–5** and a due time. Intervals: box 0 = now, 1 = 1 day, 2 = 3 days, 3 = 7 days, 4 = 14 days, 5 = 30 days. **[builder call]**
- Correct → up one box. Wrong → box 0. "Almost" → up one box.
- Progress is tracked per item, not per direction. **[builder call]**
- **Round composition**: due items first (lowest box first), then never-seen items, then random others to fill.
- **Revenge pile**: an item enters it when answered wrong. It leaves the pile the next time it's answered correctly (or "almost") in any game. **[builder call]** The pile shows as a count and can be played as its own round in any game.

## 10a. Progress export / import

- Single device, but a quick backup/restore is needed.
- **Export**: one click downloads `language-game-progress-YYYY-MM-DD.json`. It holds a format version, export time, settings (theme, column languages), and for every item its id, box, due time, revenge flag, pinned cloze word and rotation position. It also holds XP, level, streak data and an unfinished study-set position. It does not include the spreadsheet rows, which stay in your Excel file. **[builder call]**
- **Import**: pick a `.json` file, see a summary (date exported, item count, XP), confirm, and it **replaces** the current progress. Unknown format versions are refused with a clear message.
- Both buttons are on Home (small) and in Settings. Home shows "last exported N days ago" as a gentle reminder.

## 11. Reward layer

- **XP**: 10 per correct prompt; hint steps −3 each (min 2); "almost" = half. Pair Match: XP from pairs and time. Daily Word win: +30.
- **Combo**: 5 correct in a row = ×1.5, 10 in a row = ×2; resets on a miss. Show it visibly during play.
- **Level**: `level = floor(sqrt(totalXP / 50)) + 1`; show progress bar to next level.
- **Daily streak**: a day counts if at least one round or the Daily Word is completed. Show current and best streak.
- **Category Map**: a grid of category tiles. Each shows a medal from the share of its items in box ≥ 3: none < 30%, bronze ≥ 30%, silver ≥ 60%, gold ≥ 90%. Clicking a tile filters to that category.
- Keep effects minimal: a short color change for correct or wrong, no confetti or bouncing, no sound.

## 12. Screens

1. **Load** — drop zone / file picker for xlsx/csv; import summary after load. Shown only when no dataset is stored.
2. **Home** — level & XP bar, streak, revenge pile count, Daily Word card, game choice, mode choice (Review / Study set by Category / Study set by Date), filters (date range, category multi-select), direction toggle, "Load new file", export/import progress.
3. **Category Map**.
4. **Game screens** (one per game), with a round summary at the end (XP gained, correct/missed, items that moved boxes).
5. **Settings** — theme (system / light / dark), export/import progress as JSON, reset progress.

Layout must work from phone width up; desktop is the primary use.

## 13. Look & feel

- Theme follows `prefers-color-scheme` by default, with a manual light/dark override stored in settings.
- All colours defined as CSS custom properties with a light and dark set; dark is a first-class theme, not an inverted afterthought (feedback colours — correct, almost, wrong, medal colours, Wordle tiles — must be checked for contrast in both).
- **User requirement: not childish.** It should look like a calm, functional tool, not a kids' app: neutral palette with one accent color, system font stack, plain shapes, no mascots, cartoons or emoji. Game elements (XP, streak, medals) are shown as compact, understated indicators.
- Large readable text for sentences, keyboard-friendly (Enter to submit, number keys 1–4 for Multiple Choice).

## 14. Left to the builder

- Module structure, file layout, CSS approach, exact animations and visual styling within §13.
- Exact hash function for item ids; storage schema and versioning (must line up with the export format version in §10a).
- Shuffle/randomness implementation; deterministic daily-word seeding method.
- Copy/wording of UI text (English).
