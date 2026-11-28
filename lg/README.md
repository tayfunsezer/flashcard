# Language Game

A small browser game for learning vocabulary from your own word list. It runs entirely in the browser: no server, no install, no account.

## Use it

1. Double-click `index.html` (Edge or Chrome; Firefox untested).
2. Load your word list (`.xlsx`, `.csv`, `.tsv`, tab-separated `.txt` or a `.json` quiz file). The built-in sample data is Polish with English translations.
3. Check which column is the language you are learning: column 1 by default, and you can switch to column 2 with the mapping control (a preview shows the result). Then choose the two languages. Your column choice is remembered for the next upload; the languages can be changed later in Settings.
4. Play Cloze, Multiple Choice, Pair Match, Flashcards or Aspect pairs, the Daily Word, or browse the Category Map.

### Flashcards and Leitner boxes

Flashcards show one side of a card; flip it (click, Space or Show answer) and say whether you knew it (1 = Didn't know, 2 = Knew it). They work with every item, words and sentences alike, and the direction toggle decides which side comes first.

Every game shares one Leitner schedule: a right answer moves a card to the next box, a wrong answer sends it back to Box 0. Boxes 0–5 are due again after 0, 1, 3, 7, 14 and 30 days. The Leitner boxes screen (button on Home) shows how many cards sit in each box and how many are due today, using the Home filters. Study due cards runs a Flashcards round of every due card; click a box to study it with any game.

Rounds have no size limit: a Review round takes every word that matches your filters (due words first), a Revenge round the whole revenge pile, and a study set is walked in one go. Every round starts in a fresh random order, so you cannot learn the order by heart. Cloze and Pair Match work with every item, single words and sentences alike: a one-word item is blanked whole with the translation as the clue. Pair Match plays boards of up to six pairs, one after another, and needs only one item.

Aspect pairs: rows written as `verb (impf.) & verb (pf.)` (optionally followed by shared extras such as `pas` or `kogoś`) become a game on Home. You see one verb with its English meaning, and type its partner; after each answer the whole pair is shown. Pick the direction when you start: impf. → pf., pf. → impf., or Random (half each way, and the card shows no aspect label, so you must tell which aspect it is). A fourth start button, Random + guess aspect, also asks which aspect the shown verb has, with a dropdown next to the typing field: a right partner with the wrong aspect counts as Almost, and the reveal says which aspect it was. Missing accents count as Almost, typing the extras after the verb is fine, and a missed pair comes back later in the round. It is practice only: XP, combo and streak count, but the Leitner boxes do not move. ☆ marking works, Home filters apply, and the tile is greyed out when the file has no verb pairs; it is not available in Revenge pile or Study set mode. A Refresh during an Aspect round asks to end the round, like the Daily Word.

Voice and listening: Settings has a Voice card for the language you are learning. "Automatic" uses the best voice on your device (Premium, then Enhanced, then standard voices, and online voices such as Google polski last); pick another one from the list and press Test voice to hear it (it reads the first sentence of your file). The Speed slider sets how fast it speaks, from 0.5× to 1.5× (it starts at 0.85×), and saying the sample after you let go of the slider lets you hear the new speed. The choice is remembered for that language. After you answer, a Listen button in Cloze, Flashcards and Aspect pairs reads the answer aloud, and in Pair Match tapping a tile in the language you are learning reads it (untick "Read tiles aloud" on the Pair Match screen itself to silence it, mid-board, with no trip to Settings). Nothing is ever spoken automatically. Only the language you are learning is spoken. Better macOS voices are free: System Settings, Accessibility, Spoken Content, System Voice, Manage Voices, then restart the browser so it sees them.

Marking words: after an answer in Cloze, click words in the answer sentence to mark them; the item then blanks those words every time. The round summary offers to practise the words you missed plus the ones you marked in that round. The Marked words mode on Home plays every marked item (under your filters) in any game, and ☆/★ marks or unmarks an item. ✕ on the pin row clears its pinned words only.

Filters (below the games on Home) limit Review, Marked words and the Leitner screen by date range and category. Active filters show as chips under the Filters heading even when the panel is closed: ✕ on a chip removes just that filter, each date field has its own Clear, and Reset all clears every filter at once. Picking a Date from while Date to is empty fills Date to with the same day, so its calendar opens on that month and year; changing Date from again moves Date to along with it. The category list follows the date range: set a From and/or To date and it shows only the categories that have words in that range (counts are for that range; a word in several categories counts under each). A category you already ticked stays, shown as (0), until you untick it. The dates never depend on the categories.

Words you miss come back at the end of the round until you get them right (only your first answer moves the word between boxes). After a round you can practise just the words you missed, in the same game or as Flashcards.

In Flashcards and Multiple Choice you can move around without answering: Back and Skip (also the left and right arrow keys) step through the words you have seen, a skipped word comes back later in the round, and ☆ Mark works on any of them. Going back to a word you already answered lets you answer it again; the new answer replaces the old one, so the Leitner box ends up as if you had answered only once, with your latest answer (re-answers give no extra XP).

### Ask for, stars and refreshing the file

Ask for (on Home) sets what Cloze and Multiple Choice quiz: One word blanks a single word of a sentence, Whole expression asks for the full item. When a Cloze answer is wrong, the "You typed" line marks only the words that are wrong (wavy underline), words that are right except for accents (dotted underline), and shows words you left out in ‹brackets›. When typing a Cloze answer, words in brackets are optional (`bać się` is right for `bać się (czegoś)`, and typing them is right too), and commas or symbols like `&` between words can be left out. Words in brackets are never picked as the blank unless you pin them. Star an item with ☆ in any game to keep it; the Marked words mode plays every starred item, Export marked saves them as a `.json` quiz file you can load again, Clear all marks removes every star, and Manage marked (in Marked words mode) opens a list where you tick several words and unmark just those, without playing a game.

Export a day (Home) turns every word of one date in the loaded file into a quiz `.json` file named `marked_words-<day>.json`: the question is the translation and the options are the language you are learning. Choose your repeated-words folder once (Chrome or Edge) and the file is written to `<month>-<year>/marked-words/` inside it, creating the month folder when needed; if that file already exists you pick Overwrite, Download a copy or Cancel. Without folder access the file is downloaded and the screen tells you where to put it.

After editing your word list, click ↻ Refresh file next to the file name on Home (or ↻ in a game header) to re-read it without going through the import again: your progress is kept and a banner shows how many items are new or gone. In Cloze, Multiple Choice, Flashcards and Pair Match the round keeps running where it was (the word on screen is redrawn only if you edited or deleted it; in Pair Match edited tiles change text in place, deleted pairs leave the board, and matches and the timer stay). A row you corrected, where either the translation or the learned text stayed the same, keeps its box and mark instead of counting as a new word; the Daily Word still ends the round. Edge and Chrome remember the file and only ask for permission to read it again; Safari and Firefox open the file picker, and you pick the same file. Picking a file with a different name starts a normal import.

### Quick load

**Load new file** (Home) goes straight to the Load screen with no confirmation; the current list is replaced and progress is kept for words that are also in the new file. At the top of that screen:

- **Load my sheet** appears once you have downloaded a link before: one click downloads it again (the link is kept in this browser only). **Change link** next to it opens the link box below to paste a different one. With no saved link, only the link box and its Download button are shown.
- **Repeat words**: pick a date, choose **Marked words** or **Special attention**, press **Load**. The date is remembered (in this browser) as the last one you picked, so it is still there next time; switching between Marked words and Special attention never changes it. Only the very first time does it start at today. The game works out the file in your repeated-words folder, for example 30 October 2026 gives `october-2026/marked-words/marked_words-30.json` or `october-2026/special-attention/special-attention-30.json`. Hyphen or underscore is accepted in both folder and file names, and the first marked-words file of a month may have no number. If the computed file does not exist, an error says which day and month folder. Choose the top-level `to-be-repeated-words` folder once (Chrome or Edge only); this card remembers its own folder, separate from the one Export a day uses, and **Change folder** changes only this one. It reads your local copy, so `git pull` after you upload files on GitHub. `final-boss` files are not covered.

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

## Offline / install as an app

Opened from its web address (GitHub Pages), the game works without internet after one online visit: `sw.js` keeps a copy of every file. On iPhone, open it in Safari → Share → **Add to Home Screen**; on desktop Chrome/Edge use the install icon in the address bar. When online it always loads the newest files; offline it uses the saved copy. The Home Screen app keeps its own progress, separate from Safari's, so move progress over with the backup below if needed. Downloading a word list from a link still needs internet. From `file://` nothing changes (no service worker there).

## Back up your progress

Progress is stored in the browser. On `file://` pages that storage can be cleared by the browser, so use Export progress on the Home screen regularly and keep the `.json` file. Import progress restores it.

## Tests

- Open `tests.html` in a browser, or
- run `node tests/run-node.js` if Node is installed (no packages needed).

UI checks (development only): `tests/dev/cdp.js` drives headless Edge for screenshots.

## Layout

`index.html` loads plain scripts sharing one `LG` namespace. `js/core/` holds the logic (import, scheduling, scoring, answer checking), `js/store/` the browser storage, `js/ui/` the app shell and screens, `css/app.css` the styles, `lib/` the bundled spreadsheet reader, and `tests/` the test suite.

**Ask Claude (file hand-off).** Home → Ask Claude writes a request file for the words of your Home filters (a whole date, a whole category) or for words you pick one by one, you give it to Claude (Claude Code, claude.ai, any assistant that can read and write files), and you load Claude's answer back. Use case 1, **case endings quiz**: Claude picks the word whose ending matters in each sentence and writes a multiple-choice quiz (4 forms, 1 correct) in the standard quiz file format; the app checks it and saves a cleaned quiz file you load like any quiz. Use case 2, **example sentences**: kept in the app and shown on the Flashcards answer side. No server, no key, no network, one documented file format per use case: `docs/ask-claude-format.md`.
