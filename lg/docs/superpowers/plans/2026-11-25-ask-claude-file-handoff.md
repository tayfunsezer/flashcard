# Ask Claude: offline file hand-off — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans or subagent-driven-development.

**Goal:** request/response file hand-off between the lg app and Claude, with preview, storage and a first consumer.
**Spec:** `docs/superpowers/specs/2026-11-25-ask-claude-file-handoff-design.md`
**Constraints:** classic IIFE scripts, no network, `index.html` and `tests/manifest.js` list files in the same order (new `js/core/claude.js` after `reload.js`, test after `reload.test.js`); line endings preserved; branch `ask-claude-file-handoff`, no push; commits without AI attribution lines.

## Task 1 — core `LG.claude` (tests first)
- [x] `tests/claude.test.js`: `selectItems` (filters, skip with notes, examples skip sentences, cap), `buildRequest` (fields, ids, respondWith, instructions text present), `requestFileName`, `parseResponse` (valid; wrong format/task/version; bad JSON; unknown ids counted; invalid results rejected with reason; length/control-char cleaning; requestId mismatch warning), `mergeNotes`, `carryNotes`, `handoffSentence`. Run `node tests/run-node.js` → FAIL.
- [x] Implement `js/core/claude.js`; register in `index.html` and `tests/manifest.js`; run → pass.

## Task 2 — storage + app wiring
- [x] `storage.js`: `saveNotes`/`loadNotes` (IndexedDB key `notes`), tolerant of a missing key. Test with the in-memory fake if one exists, else covered by the browser check.
- [x] `app.js`: `app.notes` loaded at boot, `app.setNotes(next)` saves; `finishRefresh` calls `carryNotes` with the pairs.

## Task 3 — screen
- [x] `js/ui/screens/askclaude.js` + script tag; Home footer button; CSS in `css/app.css` (tokens only, dark mode via existing variables).

## Task 4 — first consumer
- [x] Flashcards answer side: example and aspect lines from `app.notes`.

## Task 5 — docs and checks
- [x] `docs/ask-claude-format.md` (formats, samples, rules) + README paragraph + `lg/CLAUDE.md` layout lines.
- [x] Browser check in headless Chrome (local server): build a request, hand-write a response, load, preview, accept, see the note on a flashcard; reject paths (bad file, unknown ids); dark and light.
- [x] Final `node tests/run-node.js`; update memory `ask-claude-branch-status` to DONE or FAILED with details.
