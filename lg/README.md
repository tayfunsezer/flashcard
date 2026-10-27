# Language Game

A small browser game for learning vocabulary from your own word list. It runs entirely in the browser: no server, no install, no account.

## Use it

1. Double-click `index.html` (Edge or Chrome; Firefox untested).
2. Load your word list (`.xlsx`, `.csv`, `.tsv`, tab-separated `.txt` or a `.json` quiz file). The built-in sample data is Polish with English translations.
3. Check which column is the language you are learning: column 1 by default, and you can switch to column 2 with the mapping control (a preview shows the result). Then choose the two languages. Your column choice is remembered for the next upload; the languages can be changed later in Settings.
4. Play Cloze, Multiple Choice, Pair Match or Flashcards, the Daily Word, or browse the Category Map.

### Flashcards and Leitner boxes

Flashcards show one side of a card; flip it (click, Space or Show answer) and say whether you knew it (1 = Didn't know, 2 = Knew it). They work with every item, words and sentences alike, and the direction toggle decides which side comes first.

Every game shares one Leitner schedule: a right answer moves a card to the next box, a wrong answer sends it back to Box 0. Boxes 0–5 are due again after 0, 1, 3, 7, 14 and 30 days. The Leitner boxes screen (button on Home) shows how many cards sit in each box and how many are due today, using the Home filters. Study due cards runs a Flashcards round of up to 20 due cards; click a box to study it with any game.

Words you miss come back at the end of the round until you get them right (only your first answer moves the word between boxes). After a round you can practise just the words you missed.

### File format

Columns are read by position, the header row is ignored:

1. The language you are learning (default; switch to column 2 when you load a file)
2. Its translation
3. Date
4. Category (a line can belong to several categories: separate them with `|`, e.g. `Food|Travel`)

A `.json` quiz file is a list of entries like `{ "question": "it does not bother me", "options": ["...", "...", "...", "..."], "correctIndex": 1 }` (or an object with a single array property such as `{ "items": [...] }`). `question` is the translation and `options[correctIndex]` is the word or sentence you are learning. The file name (without extension) becomes the category, there is no date, and every entry is loaded. The other options are kept and used as the wrong answers in Multiple Choice (Learning to Translation); entries that are not valid are skipped and counted in the import summary.

Dates are written `DD-MM-YYYY`; `DD.MM.YYYY` and `DD/MM/YYYY` also work. CSV/TSV files saved by Excel in a legacy encoding (for example Turkish or Polish Windows code pages) are detected and decoded correctly; the import summary shows the encoding used.

## Back up your progress

Progress is stored in the browser. On `file://` pages that storage can be cleared by the browser, so use Export progress on the Home screen regularly and keep the `.json` file. Import progress restores it.

## Tests

- Open `tests.html` in a browser, or
- run `node tests/run-node.js` if Node is installed (no packages needed).

UI checks (development only): `tests/dev/cdp.js` drives headless Edge for screenshots.

## Layout

`index.html` loads plain scripts sharing one `LG` namespace. `js/core/` holds the logic (import, scheduling, scoring, answer checking), `js/store/` the browser storage, `js/ui/` the app shell and screens, `css/app.css` the styles, `lib/` the bundled spreadsheet reader, and `tests/` the test suite.
