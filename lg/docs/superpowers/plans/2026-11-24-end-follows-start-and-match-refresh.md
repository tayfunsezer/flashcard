# End follows Start; Pair Match keeps its board on Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans or subagent-driven-development.

**Goal:** (1) Date to always follows a changed Date from. (2) Refresh inside Pair Match keeps the round.
**Spec:** `docs/superpowers/specs/2026-11-24-end-follows-start-and-match-refresh-design.md`
**Constraints:** `words.js`, `play.js` are CRLF; `tests/words.test.js`, `tests/play.test.js` have mixed endings: edit with `newline=''`. No commits unless the learner asks.

## Task 1 — End follows Start
- [ ] Update `tests/words.test.js` withDateFrom tests: a second pick overwrites an existing End (29 Oct → 30 Oct); an earlier End is overwritten; clearing Start leaves End; input not mutated. Run `node tests/run-node.js` → FAIL.
- [ ] `words.js`: `dateTo: value ? value : f.dateTo`. Run → pass.
- [ ] `home.js` comment fix. README sentence updated.

## Task 2 — remapBoards (core)
- [ ] `tests/play.test.js`: renames and drops removed ids only from index `from`; earlier boards untouched; empty boards omitted; input not mutated. → FAIL.
- [ ] Implement `LG.play.remapBoards` in `play.js`; run → pass.

## Task 3 — Pair Match screen
- [ ] `match.js`: `live` per-board patch, `app.activeRound`, tally remap, empty-board handling in `boardDone`.
- [ ] Browser check (headless Chrome, local link as source): edit one word and delete one in the source, press ↻ mid-board and between boards: no confirm, same screen, timer and matched pairs kept, tile text updated, count correct; remove all words of the board → moves on.
- [ ] README: Refresh keeps Pair Match too. `lg/CLAUDE.md`: Pair Match now has an activeRound; test count. Final `node tests/run-node.js`.
