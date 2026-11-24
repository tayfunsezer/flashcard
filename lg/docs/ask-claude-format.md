# Ask Claude: file formats (version 1)

The Language Game and Claude (Claude Code, claude.ai or any assistant that can read and write files) trade files. There is no server, no API key and no network call: you carry the files. **Each use case has its own formats**, described below; anyone can reuse the system by producing or reading them.

```
Home → Ask Claude → Create request file  ──►  lg-request-<use case>-<date>.json
                                              you give it to Claude
Home → Ask Claude → Load answer file     ◄──  the answer file Claude writes
```

The app writes the request into your Downloads folder and shows the one sentence to give Claude, for example: *Read the file lg-request-endings-2026-11-25.json and follow the instructions inside it. Write your answer as JSON to a new file named lg-endings-quiz-2026-11-25.json in the same folder, and tell me when it is written.* Every request file is self-contained: its `instructions` text says what to do and the exact answer shape.

**Choosing the words.** Words come from the Home filters (a whole date, a whole category) or from the **Pick myself** list in the Ask Claude screen (search, tick pair by pair; it starts with the words of the current filters ticked). There is no cap. Over 50 words the screen shows a warning, because a long answer may be cut off.

---

## Use case 1: case endings quiz (`endings`)

Claude picks, per row, the word whose case ending matters and makes a multiple-choice question from it. The answer is **a plain quiz file**, the same format the Load screen of this app and the quiz of the fc app read. Nothing is stored in the app for this use case.

### Request: `lg-endings-request`

```json
{
  "format": "lg-endings-request",
  "version": 1,
  "requestId": "r-20261125-k3x9qa",
  "createdAt": "2026-11-25T01:00:00.000Z",
  "task": "endings",
  "languages": { "learning": "Polish", "translation": "English" },
  "options": { "singleWords": true },
  "instructions": "... (self-contained text for the assistant)",
  "respondWith": {
    "fileName": "lg-endings-quiz-2026-11-25.json",
    "shape": [ { "question": "Idę do ____ .", "options": ["basen", "basenu", "basenie", "basenem"], "correctIndex": 1 } ]
  },
  "items": [ { "id": "i5f3a9c", "source": "I am going to the swimming pool", "target": "Idę do basenu", "categories": ["Expressions|DynamicVsStatic"] } ]
}
```

`options.singleWords`: `true` lets Claude write a short sentence of its own for single words (the Ask Claude screen checkbox); `false` sends only rows that are already sentences (4+ words).

### Answer: a quiz file (no envelope)

```json
[
  { "question": "Idę do ____ .", "options": ["basen", "basenu", "basenie", "basenem"], "correctIndex": 1 },
  { "question": "Mieszkam w ____ .", "options": ["Polska", "Polski", "Polsce", "Polskę"], "correctIndex": 2 }
]
```

- `question`: the sentence with the case-sensitive word replaced by `____` (four underscores).
- `options`: exactly 4 different forms of the same word (the correct form and three wrong cases).
- `correctIndex`: 0 to 3.

### What the app checks

At most 1 MB; valid JSON; an array, or an object with exactly one array property. Per question: text is trimmed, whitespace collapsed, control characters removed; question at most 300 characters, options at most 200; exactly 4 options, non-empty and different (ignoring case); `correctIndex` a whole number 0 to 3. Bad questions are **rejected with a reason** and listed; extra fields are dropped. You see every question with the correct option marked, then **Save quiz file** downloads the cleaned quiz (rejected questions removed). Play it like any quiz: Load it in this app, or in the fc app (its quiz link needs exactly 4 options per question, which this format guarantees).

---

## Use case 2: example sentences (`examples`)

Claude writes one short A2 example sentence per word with its translation. The answers are kept in the app and shown under the answer on a flashcard.

### Request: `lg-examples-request`

Same envelope as above with `"format": "lg-examples-request"`, `"task": "examples"`, no `options`, and `respondWith.fileName` `lg-response-examples-<date>.json`. Rows whose target is already a sentence are not sent; by default rows that already have an example are skipped too.

### Answer: `lg-examples-response`

```json
{
  "format": "lg-examples-response",
  "version": 1,
  "requestId": "r-20261125-k3x9qa",
  "task": "examples",
  "results": { "i5f3a9c": { "sentence": "Mój dom jest duży.", "translation": "My house is big." } },
  "note": "optional free text shown in the preview"
}
```

`id` keys are the item ids from the request, copied unchanged; items that need no result are left out. Checks: `format`, `version` 1 and `task` must match; ids not in your loaded word list are counted and ignored; both texts are required, cleaned as above and at most 200 characters (a failing result is rejected with a reason); extra fields are dropped; a `requestId` different from your latest request only shows a warning. You always see a preview (word, new text, what is stored now) and press **Save**. Answers are stored in this browser's IndexedDB (store `dataset`, key `notes`), outside the progress export; Refresh file moves them along with a corrected row; **Clear** removes them all.

---

## Safety rules (all use cases)

Nothing is ever written to your Google Sheet. Answer text is shown as plain text and never executed. Nothing is saved before you press the button in the preview.

## Adding a use case

An entry in `LG.claude.TASKS` (`js/core/claude.js`) with its instructions and shape, its own `format` names (`lg-<task>-request`, and `lg-<task>-response` when it has an envelope), a validator with tests in `tests/claude.test.js`, and a section here.
