# Ask Claude: file formats (version 1)

The Language Game and Claude (Claude Code, claude.ai or any assistant that can read and write files) trade **two JSON files**. There is no server, no API key and no network call: you carry the files. Anyone can reuse this system by producing or reading these two formats.

```
Home → Ask Claude → Create request file  ──►  lg-request-<task>-<date>.json
                                              you give it to Claude
Home → Ask Claude → Load answer file     ◄──  lg-response-<task>-<date>.json (written by Claude)
```

The app writes the request into your Downloads folder and tells you the one sentence to give Claude, for example: *Read the file lg-request-examples-2026-11-25.json and follow the instructions inside it. Write your answer as JSON to a new file named lg-response-examples-2026-11-25.json in the same folder, and tell me when it is written.*

## Request file (written by the app)

```json
{
  "format": "lg-ask-claude-request",
  "version": 1,
  "requestId": "r-20261125-k3x9qa",
  "createdAt": "2026-11-25T01:00:00.000Z",
  "task": "examples",
  "languages": { "learning": "Polish", "translation": "English" },
  "instructions": "You are helping a learner of Polish ... (self-contained text: what to do and the exact answer shape)",
  "respondWith": {
    "fileName": "lg-response-examples-2026-11-25.json",
    "shape": { "format": "lg-ask-claude-response", "version": 1, "requestId": "r-20261125-k3x9qa", "task": "examples",
               "results": { "<item id>": { "sentence": "<example sentence in the learning language>", "translation": "<the same sentence in the translation language>" } } }
  },
  "items": [
    { "id": "i5f3a9c", "source": "house", "target": "dom", "categories": ["Noun"] }
  ]
}
```

| Field | Meaning |
|---|---|
| `format`, `version` | Always `lg-ask-claude-request` and `1`. |
| `requestId` | `r-YYYYMMDD-xxxxxx`; Claude copies it into the response. |
| `task` | `examples` or `aspect` (see below). |
| `languages` | Names of the learned language (`target` column) and of the translation (`source` column). |
| `instructions` | Plain text for the assistant; it contains everything needed to answer without knowing the app. |
| `respondWith` | The suggested response file name and the exact response shape. |
| `items[]` | The words: `id` (the app's item id, copy it back unchanged), `source` (translation), `target` (the learned text), `categories`. At most 60 per request. |

## Response file (written by Claude)

```json
{
  "format": "lg-ask-claude-response",
  "version": 1,
  "requestId": "r-20261125-k3x9qa",
  "task": "examples",
  "results": {
    "i5f3a9c": { "sentence": "Mój dom jest duży.", "translation": "My house is big." }
  },
  "note": "optional free text shown in the preview"
}
```

Results per task (items that need none are simply left out):

| Task | Result | Rules |
|---|---|---|
| `examples` | `{ "sentence", "translation" }` | Both required. One short A2-level sentence using the word, and its translation. Items whose target is already a sentence are skipped. |
| `aspect` | `{ "impf", "pf" }` | Verbs only; at least one of the two. Infinitives. |

## What the app checks before keeping anything

- The file is at most 1 MB, valid JSON, with `format` = `lg-ask-claude-response`, `version` = 1 and a known `task`; `results` is an object.
- Ids that are not in your loaded word list are counted and ignored.
- Every text is trimmed, whitespace is collapsed, control characters are removed, and it must be at most 200 characters. A result that fails is **rejected** and listed in the preview with a reason; extra fields are dropped.
- A `requestId` different from your latest request only shows a warning (you may load an older answer).
- You always see a preview (word, new text, what is stored now) and press **Save**. Nothing is saved before that, and nothing is ever written to your Google Sheet. Response text is displayed as plain text and never executed.

## Where the answers live

In this browser's IndexedDB (store `dataset`, key `notes`): `{ "version": 1, "byId": { "<item id>": { "examples": {...}, "aspect": {...} } }, "lastRequest": { "requestId", "task", "ids" } }`. They are not part of the progress export. Refresh file moves them along with a corrected row. Ask Claude → **Clear** removes them all. The Flashcards answer side shows the example sentence and the aspect pair.

## Adding a task

A task is an entry in `LG.claude.TASKS` (`js/core/claude.js`: label, instructions, shape) plus its rules in `validateResult` and `formatResult`, with tests in `tests/claude.test.js`.
