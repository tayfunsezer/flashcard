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
