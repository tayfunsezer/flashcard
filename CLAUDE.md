# Repository introduction (read first)

Two independent, static, client-side vocabulary apps live in this repo. Neither has a build step, a backend or npm dependencies. They do not import each other's code. They **complement each other through one shared file format: the quiz JSON** (see "How the two apps connect").

| | `fc/`: **Polish–Turkish Flashcard** | `lg/`: **Language Game** |
|---|---|---|
| Entry | `/fc/index.html` (this file's "fc/ app" section) | `/lg/index.html` (own guide: `lg/CLAUDE.md`) |
| Style | 2 big singleton objects (`app`, `quiz`), DOM-as-state, inline `onclick` | ~20 small IIFE modules on `window.LG`, pure core + rendered screens |
| Data | Polish ⇄ Turkish card list, hard-wired labels | Any language pair, column 1/2 = learned language |
| Storage | `localStorage` only | `localStorage` (`lg.state`) + IndexedDB (dataset, file handle) |
| Tests | none | in-repo runner: `lg/tests.html`, `node lg/tests/run-node.js` |
| Strength | quizzes, mid-quiz export, shareable quiz URLs, Dialog reader, TTS | games, spaced repetition, XP/streaks, cloze, refresh-file |

Git history: commits are mostly "Add files via upload" (GitHub web uploads). The repo is served statically (`/fc/` = flashcard app, `/lg/` = game; the repo root has no `index.html`). `lg/` is also designed to run from `file://`.

**Offline / PWA (both apps):** each of `fc/` and `lg/` has its own `manifest.webmanifest`, `icons/` (made by `python3 tools/icons.py`), `pwa.js` (registers the worker; skipped on `file://`) and `sw.js` scoped to its folder. `sw.js` is network-first with a 4 s timeout and a cache fallback, and on install caches `index.html` plus every local `src=`/`href=` it references, so **no version bump or file list to maintain**: new scripts added to `index.html` are picked up automatically and online visits always get the latest upload. Verified offline (reload and `?query` URLs) in headless Chromium 2026-11-23.

---

## How the two apps connect: the quiz JSON format

```json
[{ "question": "it does not bother me", "options": ["a", "b", "c", "d"], "correctIndex": 1 }]
```

| Producer → consumer | Where |
|---|---|
| fc quiz → file | `quiz.exportQuestions` (Missed / Saved buttons on Quiz Results), `app.exportMarked` (Settings → Marked Words) |
| File → fc | JSON Import tab (`app.importQuizJSON`, multi-file, replace or append), Quiz tab's External Quiz Helper (`quiz.generateBase64` → `?qCont=` / `#qData=` URL that opens a quiz-only view) |
| lg → file | Home → Marked words → "Export marked (N)" (`LG.marked.markedQuiz`, file `marked-<name>-YYYY-MM-DD.json`) |
| File → lg | Load screen or Refresh file (`LG.importer.jsonToDataset`) |

Compatibility rules (check these before changing either side):

1. **Meaning of the fields differs.**
   - lg: `question` = the translation (source); `options[correctIndex]` = the language being learned (target, normally Polish).
   - fc JSON Import: `question` → `card.pol`, `options[correctIndex]` → `card.tur`.
   - fc quiz export: `question`/answer follow the quiz direction (`pol-tur`: question is Polish). Marked-word export outside a quiz uses `question = card.pol`.
   - Result: an fc quiz exported in `pol-tur` direction makes lg treat **Turkish** as the learned language. Export in `tur-pol` to make Polish the lg target. An lg export loaded into fc puts Polish into the `tur` field (labels swapped).
2. **Option count.** The fc URL helper (`quiz.validateExternalData`) requires exactly 4 non-empty options and `correctIndex` 0–3. fc JSON Import reads only `question` and the correct option. lg accepts any number of options (deduped; the extra ones become MC wrong answers), and a wrapper object with one array property (`{ "items": [...] }`). lg's marked export can emit fewer than 4 options when the file has fewer than 4 distinct targets. fc pads with `option2`, `option3`… placeholders.
3. **No date or category** travels in this format. lg puts every entry into one category named after the file name. fc cards from JSON get neither.
4. **Identity.** lg item id = hash of normalised source+target (`LG.importer.itemId`), so progress survives export → re-import. fc identifies cards by `pol + '::' + tur` (marks) or by `pol`/`tur` equality.

---

## fc/ app (Polish–Turkish Flashcard)

Files (all in `fc/`): `index.html` (all markup, 7 tabs), `app.js` (~1340 lines), `quiz.js` (~1150 lines), `styles.css` (tokens, components, utility classes). `quiz-styles.css` exists but **is not linked** from `index.html`, so add styles to `styles.css`. Script order: `quiz.js`, then `app.js`. `app.init()` runs on DOMContentLoaded; `quiz.init()` runs 100 ms later.

### Tabs → code

| Tab (`data-tab`) | Code |
|---|---|
| Study (`study`) | Filters, flashcards (`flipCard`, `nextCard`, `markDifficulty`, `shuffle`, `speakCurrent`), Leitner session (`app.leitner.*`) |
| Quiz (`quiz`) | `quiz.*`: setup + filters + Exclude Words + External Quiz Helper → question view → results |
| Text Import (`import-text`) | `app.importText`: tab-separated `pol, tur, date, groups, ignore` |
| File Import (`import-excel`) | `app.importExcel` → `parseCSV` (CSV/TSV/TXT, UTF-8 only; header names POL/TUR/DATE/GROUP/IGNORE, otherwise columns 0/1/2) |
| JSON Import (`import-quiz-json`) | `app.previewQuizFiles`, `app.importQuizJSON` |
| Dialog (`dialog`) | `app.dialog.*`: cards grouped by group (= topic) and date, revealed line by line, per-line notes |
| Settings (`settings`) | counts, theme, Export JSON/CSV, Marked Words list/export/clear, Leitner progress reset |

### Data model

```js
// app.cards[] (localStorage 'flashcard-data')
{ pol, tur, difficulty: 'unmarked'|'easy'|'medium'|'hard', date?: 'DD-MM-YYYY', groups?: string[], group?: string /* legacy */, box?: 1..5 /* Leitner */ }
// quiz.state.questions[]
{ question, correctAnswer, options[], userAnswer, isCorrect, originalCard /* null for external */, shownAnswer?, tfCorrect? /* true-false */ }
```

localStorage keys: `flashcard-data`, `flashcard-theme`, `flashcard-marked` (Set of `pol::tur`), `flashcard-marked-queue` (key → captured quiz entry), `leitner-session` (session counter), `dlg-note:<first 40 chars of pol>` (Dialog notes).

### Key mechanics
- **Filters**: difficulty checkboxes, date range (picking "From" auto-fills "To" with that month's end), "No date only", "No group only", group multiselect (`<details class="group-multiselect">` with search). Study filters live in `app.applyFilters`. Quiz filters are re-read from the DOM in `quiz.startQuiz` and applied in `quiz.generateQuestions`.
- **Quiz**: multiple choice (3 random distractors from all cards) or true/false (wrong pair from the same group when possible). Prev/next navigation, "Change answer", Save for Later, Mark, End early (= `showResults`), re-quiz missed/saved, export missed/saved.
- **fc Leitner** (different from lg's): boxes 1–5. A card is due when `sessionCount % {1:1,2:2,3:4,4:8,5:16}[box] === 0`, computed over `app.filtered`. Right → box+1, wrong → box 1.
- **Marks**: `app.toggleMark(card)` captures the current quiz question's options when marked during a quiz, so the export reuses them.
- **Cross-module**: `app.updateUI()` dispatches `flashcardsUpdated`. The quiz listens, then calls `checkForCards`, `populateGroupFilter` and `resetQuiz`. The quiz reads `app.cards` directly.
- **External quiz URL**: `quiz.init` reads `#qData=` (preferred) or `?qCont=` (Base64 of UTF-8 JSON), hides every tab except Quiz and starts.
- **Theme**: `html[data-theme="dark"]` (default dark), toggled by `#themeBtn`.

### Known bugs found while reading (verified in code, not fixed)
1. `quiz.resetQuiz()` calls `localStorage.removeItem('flashcard-data')`, and it runs on every `flashcardsUpdated`. After any import, the saved cards are deleted again until something else calls `saveData` (e.g. `markDifficulty`, Leitner start/end). A reload can then lose the import.
2. `app.clearAll()` sets `document.getElementById('jsonInput').value`, but `#jsonInput` no longer exists. This throws, so the quiz reset and `localStorage.clear()` after it never run. `generateUrl`/`copyUrl` also reference removed elements (`#jsonInput`, `#urlOutput`); `loadFromUrl` (`#words=` / `?words=`) still works.
3. `quiz.showFeedback` calls `app.updateCardDifficulty`, which does not exist, so quiz answers never change difficulty.
4. Quiz "Unmarked" filter tests `!card.difficulty`, but cards store `'unmarked'`, so unchecking it excludes nothing.
5. `excludeFileInput` gets its `change` listener twice (harmless: words go into a Set).
6. fc Leitner `answer()` changes `card.box` in memory and saves only at session start/end.

### Conventions (fc)
Keep the object-literal module pattern. Use no classes or ES modules. `app` uses shorthand methods; `quiz` uses `name: function () {}`, so match the file. Prefix private helpers with `_`. Read DOM values lazily. Wrap `localStorage` in try/catch. User feedback goes through `app.showMessage(id, text, 'success'|'error'|'info')`. Show and hide sections with `style.display`. Colours come from CSS variables only. Every new dark-mode rule goes under `html[data-theme="dark"]`.

### Running / checking
Open `fc/index.html` or serve the repo (`python3 -m http.server 8080`, then `/fc/`). There are no automated tests for the fc app. Check in the browser (Claude in Chrome), in both themes and at phone width.

---

## Where to start for a new feature
- **Touches the exchange format?** Re-read "How the two apps connect" and change both sides together: fc `quiz.exportQuestions` / `app.exportMarked` / `app.importQuizJSON` / `quiz.validateExternalData`, and lg `LG.marked.markedQuiz` / `LG.importer.jsonToDataset` (+ `lg/tests/marked.test.js`, `importer.test.js`).
- **lg feature?** Follow `lg/CLAUDE.md`: pure logic in `lg/js/core` with tests first, the UI in `lg/js/ui/screens`, and design notes in `lg/docs/superpowers/specs/`.
- **fc feature?** Edit `fc/index.html` markup, then the `app` or `quiz` object, then `styles.css`.
