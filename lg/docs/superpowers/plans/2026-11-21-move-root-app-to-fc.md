# Move the root app into `fc/` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Root flashcard app lives in `fc/`; stale docs deleted; docs updated; pushed to `main`.

**Spec:** `lg/docs/superpowers/specs/2026-11-21-move-root-app-to-fc-design.md`

## Global Constraints

- Use `git mv` (history). No edits inside the moved code files. No AI attribution in commits (`lg/CLAUDE.md`). Delete only `.amazonq/`, `.copilot-instructions`, `wishlist.txt`. Keep `test-push.txt`.

### Task 1: Move and delete

- [ ] `git mv index.html app.js quiz.js styles.css quiz-styles.css fc/` (after `mkdir fc`); `git rm -r .amazonq .copilot-instructions wishlist.txt`.
- [ ] Verify: serve the repo (`python3 -m http.server 8082`), open `/fc/index.html` in Claude in Chrome: 7 tabs render, no console errors, theme toggle works, Quiz tab opens; `cd lg && node tests/run-node.js` still 153 passing.
- [ ] Commit: `refactor: move the flashcard app from the repo root into fc/`.

### Task 2: Docs

- [ ] `CLAUDE.md`: "Root app" → "`fc/`" (table header, entry `/fc/index.html`, section "fc/ app", "Conventions (fc)", compat rules wording), served-statically line, remove the stale-docs/wishlist paragraph, running notes say `fc/index.html`; keep every technical fact.
- [ ] `lg/CLAUDE.md` line 80: "the `fc/` app".
- [ ] Commit: `docs: refer to the flashcard app as fc/, drop stale tool docs`. `git push origin main`; confirm `git status -sb` shows `main...origin/main` in sync.
