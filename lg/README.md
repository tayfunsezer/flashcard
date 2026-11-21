# Language Game

A small browser game for learning vocabulary from your own word list. It runs entirely in the browser: no server, no install, no account.

## Use it

1. Double-click `index.html` (Edge or Chrome; Firefox untested).
2. Load your word list (`.xlsx`, `.csv`, `.tsv`, tab-separated `.txt` or a `.json` quiz file). The built-in sample data is Polish with English translations.
3. Check which column is the language you are learning: column 1 by default, and you can switch to column 2 with the mapping control (a preview shows the result). Then choose the two languages. Your column choice is remembered for the next upload; the languages can be changed later in Settings.
4. Play Cloze, Multiple Choice, Pair Match or Flashcards, the Daily Word, or browse the Category Map.

### Flashcards and Leitner boxes

Flashcards show one side of a card; flip it (click, Space or Show answer) and say whether you knew it (1 = Didn't know, 2 = Knew it). They work with every item, words and sentences alike, and the direction toggle decides which side comes first.

Every game shares one Leitner schedule: a right answer moves a card to the next box, a wrong answer sends it back to Box 0. Boxes 0–5 are due again after 0, 1, 3, 7, 14 and 30 days. The Leitner boxes screen (button on Home) shows how many cards sit in each box and how many are due today, using the Home filters. Study due cards runs a Flashcards round of every due card; click a box to study it with any game.

Rounds have no size limit: a Review round takes every word that matches your filters (due words first), a Revenge round the whole revenge pile, and a study set is walked in one go. Every round starts in a fresh random order, so you cannot learn the order by heart. Cloze and Pair Match work with every item, single words and sentences alike: a one-word item is blanked whole with the translation as the clue. Pair Match plays boards of up to six pairs, one after another, and needs only one item.

Marking words: after an answer in Cloze, click words in the answer sentence to mark them; the item then blanks those words every time. The round summary offers to practise the words you missed plus the ones you marked in that round. The Marked words mode on Home plays every marked item (under your filters) in any game, and ☆/★ marks or unmarks an item. ✕ on the pin row clears its pinned words only.

Words you miss come back at the end of the round until you get them right (only your first answer moves the word between boxes). After a round you can practise just the words you missed, in the same game or as Flashcards.

### Ask for, stars and refreshing the file

Ask for (on Home) sets what Cloze and Multiple Choice quiz: One word blanks a single word of a sentence, Whole expression asks for the full item. When typing a Cloze answer, words in brackets are optional (`bać się` is right for `bać się (czegoś)`, and typing them is right too), and commas or symbols like `&` between words can be left out. Words in brackets are never picked as the blank unless you pin them. Star an item with ☆ in any game to keep it; the Marked words mode plays every starred item, Export marked saves them as a `.json` quiz file you can load again, Clear all marks removes every star, and Manage marked (in Marked words mode) opens a list where you tick several words and unmark just those, without playing a game.

Export a day (Home) turns every word of one date in the loaded file into a quiz `.json` file named `marked_words-<day>.json`: the question is the translation and the options are the language you are learning. Choose your repeated-words folder once (Chrome or Edge) and the file is written to `<month>-<year>/marked-words/` inside it, creating the month folder when needed; if that file already exists you pick Overwrite, Download a copy or Cancel. Without folder access the file is downloaded and the screen tells you where to put it.

After editing your word list, click ↻ Refresh file next to the file name on Home (or ↻ in a game header) to re-read it without going through the import again: your progress is kept and a banner shows how many items are new or gone. Edge and Chrome remember the file and only ask for permission to read it again; Safari and Firefox open the file picker, and you pick the same file. Picking a file with a different name starts a normal import.

### Download from a link

On the Load screen you can paste a link to a published table (a `.tsv` or `.csv`, for example a Google Sheets "Publish to the web" link with `output=tsv`) and press Download. It then continues like a picked file: choose the column and languages, check the summary, Start. The link is remembered in this browser (local storage, never in the code or in the progress backup) and shows up in the box next time, so ↻ Refresh downloads the list again with no file picker, which is the easy way to update on a phone.

- The host must allow downloads from a web page. Google Sheets published links do; a sheet's normal `/edit` link does not work.
- Use the app from its web address. When `index.html` is opened as a local file, Google blocks the download and the app says so; pick the file instead.
- Clearing the site data in your browser forgets the link.

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
