# Ask Claude: offline file hand-off — design

Date: 2026-11-25. A project-sized change (new core module, new screen, new storage key, new docs). Written from the brainstorm of 2026-11-24/25; approved by the learner for unattended building on a branch.

## Intent

The learner's words: "Ask Claude button can generate some file that Claude can understand. I can then go to Claude and refer that file. Then Claude can generate another file, and then my app can read that file, and we can document all of these formats in my application, so that in the future, if someone else wants to use the same system, they would just then know the format that my website generates, the format that Claude generates." And: "Claude and my website will talk through some agreed formats." No web server, no API key, nothing exposed; the learner runs Claude himself.

Why: batch jobs (example sentences, aspect clean-up) cost tokens once per word instead of per session, and the sheet's notation is too messy for pure code (see the backlog memory).

## Goals

1. An **Ask Claude** screen: choose words and a task, write a **request file**, copy one sentence to hand to Claude.
2. Load Claude's **response file**: validate, preview, accept or reject. Accepted results are kept per item id.
3. A first visible use: Flashcards answer side shows the example sentence and the aspect pair.
4. Both formats documented in `docs/ask-claude-format.md` (field by field, samples, rules), linked from the README.

## Non-goals / anti-goals

- No server, no bridge, no API key, no network call. Never write to the Google Sheet. Never execute anything from a response.
- Not a general chat. Two fixed tasks in v1; the task list is a table so more can be added.
- Not shipped: the branch is not pushed or merged by the builder.

## Approaches considered

1. **Hand-off files** (chosen by the learner): zero setup, works from `file://`, auditable.
2. Local bridge running `claude -p`: live feel, but needs a process, localhost/CORS/permission handling and a security lock-down. Rejected by the learner.
3. Copy-prompt to claude.ai: no file format, no structured import. Kept as a possible later add-on only.

## Design (calls marked "my call" are the builder's)

**Request** (`lg-ask-claude-request`, version 1): `format`, `version`, `requestId` (`r-YYYYMMDD-xxxxxx`, my call), `createdAt` (ISO), `task` (`examples` | `aspect`), `languages` `{ learning, translation }` (codes from Settings), `instructions` (plain text, self-contained so any assistant can answer without the app), `respondWith` `{ fileName, shape }` (suggested response file name and an example of one result), `items` `[{ id, source, target, categories }]`. `id` is the lg item id and is copied back unchanged.

**Response** (`lg-ask-claude-response`, version 1): `format`, `version`, `requestId`, `task`, `results` `{ "<item id>": result }`, optional `note`. Results: `examples` → `{ "sentence": "...", "translation": "..." }` (a sentence in the learning language and its translation; field names are language-neutral, my call); `aspect` → `{ "impf": "...", "pf": "..." }` with at least one non-empty. Items that need no result (not a verb, already a full sentence) are simply omitted.

**Validation** (`LG.claude.parseResponse`): the file must be JSON with the right `format`/`version`/`task`; each result must have the right string fields, trimmed, whitespace-collapsed, at most 200 characters, no control characters; ids not in the loaded file are counted and ignored; invalid results are listed with a reason and not kept; a `requestId` different from the last request produces a warning only (the learner may legitimately load an older answer, my call). File size limit 1 MB.

**Selection** (`LG.claude.selectItems`): the items matching the Home filters; by default skip items that already have notes for that task; `examples` also skips items whose target is already a sentence (`kindOf`); cap 60 per request (my call, about two chunks).

**Storage**: IndexedDB store `dataset`, key `notes` (no DB version change): `{ version: 1, byId: { id: { examples?, aspect? } }, lastRequest: { requestId, task, ids } | null }`. Never inside `lg.state`, so it is not in the progress export (my call: it is regenerable and can be large). Refresh file moves notes along with edited rows (`carryNotes` with the same pairs as progress).

**UI**: Home footer button "Ask Claude". Screen: task choice, scope line ("N words from your current filters; M already have an answer"), checkbox "Skip words that already have one" (on), "Create request file" (download `lg-request-<task>-<YYYY-MM-DD>.json`) and a copy box with the sentence to give Claude; below, "Load Claude's answer" (file picker), a preview table (word, new, current), Accept (N) / Cancel; a line "Notes saved: X words" with Clear. Flashcards answer side adds small muted lines under the answer.

## Left to the builder

Exact wording of instruction texts, CSS, preview table layout.

## Revision 1 (2026-11-25, same night, after the learner's review of the first build)

The learner's words: "I was expecting that you would go with grammar traps ... I would think a UI that would force me to pick the correct case endings ... I expect Claude to generate those bad endings and good ending ... I don't think that we can have a generic file like this, right? We need to have file per use case." Then: "this is a quiz after all, and our marked words file, or JSON import support this kind of format ... 1 question and 4 multi-options and 1 correct answer. I'm not super wary about losing the context. I very much want Claude to generate that question choice format that file load supports." And: "home filter logic is fine ... If I pick a date, let it be the whole date. If I pick a category, let it be the whole category. And don't make any cap, just somehow make it visible in the UI that it is over 50 words ... Also make another additional filter in this Ask Claude UI only that would pick me words one by one, the pairs one by one even."

Changes:
1. **One file format per use case**, each with its own `format` name and its own section in `docs/ask-claude-format.md`; only the code that moves files is shared.
   - `examples` (kept): request `lg-examples-request`, response envelope `lg-examples-response` (notes kept in the app, shown on Flashcards).
   - `endings` (new, the main use case): request `lg-endings-request`; the response is **a plain quiz file**, the same format the Load screen and the fc app read: a JSON array of `{ "question", "options" (exactly 4), "correctIndex" }`. No envelope, no explanation field (the learner does not need one). The question is the sentence with the case-sensitive word replaced by `____`; the options are the correct form and three wrong forms of the same word in other cases.
   - `aspect` is dropped (learner: not useful by itself).
2. **Choosing words for endings:** the Home filters decide the scope (a whole date, a whole category), then Claude decides per row whether it has a case point and skips rows without one (my call: the app does no grammar guessing). Single words: a checkbox "Let Claude write a short sentence for single words" (my call: on by default, since the learner did not answer; off means single words are skipped).
3. **No cap.** The screen shows a visible warning when the selection is over 50 words (`LG.claude.WARN_OVER`); a long answer may be cut off or slow.
4. **Pick myself** (Ask Claude screen only): a second scope mode with a searchable checklist of every word in the file (pair by pair); it starts with the words of the current Home filters ticked.
5. **Endings answer check:** loading the quiz file runs a validator (array or one-array wrapper; exactly 4 distinct non-empty options; `correctIndex` 0-3; text cleaned, at most 300 characters for a question), shows the questions with the correct option marked, lists rejected ones with the reason, and offers **Save quiz file** (downloads the cleaned file, rejected questions removed). The learner then plays it like any quiz: Load screen in this app, or the fc app. Nothing is stored in the app for this use case.
