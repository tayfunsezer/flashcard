# Pair Match audio toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Move the "read tiles aloud" switch from Settings to the Pair Match screen.
**Architecture:** UI wiring only; `settings.speakMatch` and `app.setSettings` are unchanged.
**Tech Stack:** Classic scripts, `h()` element builder.
**Spec:** `lg/docs/superpowers/specs/2026-11-28-pair-audio-toggle-design.md`

## Global Constraints
- `lg/` only; no state shape change; tokens-only CSS; commits carry no AI attribution; update README.md and CLAUDE.md.

## Review Focus
1. Toggle off mid-board: the next tile tap is silent without leaving the board.
2. A later board of the same round shows the current value, not the value at round start.
3. Settings still renders (no dangling reference) with the checkbox removed.

### Task 1: Move the checkbox
**Files:** Modify `js/ui/screens/match.js` (`playBoard`), `js/ui/screens/settings.js` (Voice card), `README.md`, `CLAUDE.md`.
- [ ] **Step 1:** In `playBoard`, put a `label.choice` checkbox bound to `settings.speakMatch` next to the instruction paragraph.
- [ ] **Step 2:** Remove the checkbox label from the Settings Voice card.
- [ ] **Step 3:** Update the README Voice paragraph and the CLAUDE.md state note.
- [ ] **Step 4:** Verify: `node tests/run-node.js` stays green (UI-only; no core test applies); in the browser, play Pair Match, untick, tap a learned-language tile (no speech call), start the next board (value kept), open Settings (no checkbox, no error).
- [ ] **Step 5:** Commit `feat(lg): Pair Match audio toggle on the game screen`.
