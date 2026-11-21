# Manage marked words Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A Manage marked screen to unmark several words at once.

**Architecture:** Pure `LG.marked.markedItems`, existing `LG.play.clearStars`, a new `marked` screen, a Home button.

**Tech Stack:** Classic scripts, in-repo runner (`node tests/run-node.js`).

**Spec:** `docs/superpowers/specs/2026-11-21-manage-marked-design.md`

## Global Constraints

- Classic scripts/IIFE; preserve line endings (`css/app.css`, `tests/play.test.js` are CRLF). No emoji in chrome. Banners via `app.banner`, no `alert`. Mobile: rows ≥ 44px, no horizontal scroll at 360px. No AI attribution in commits; commit only when asked.

## Review Focus

- Unmarking a subset leaves the other marks, pins and Leitner progress untouched.
- Selecting nothing: Unmark button disabled. Select all then unmark: empty-state shown.
- Items with very long text wrap instead of overflowing.

### Task 1: Core
- Files: `js/core/marked.js`, `tests/marked.test.js`, `tests/play.test.js`
- Produces: `LG.marked.markedItems(items, progress) → Item[]` (file order, starred only).
- [ ] Tests: `markedItems` returns only starred, in order; `clearStars` on a subset keeps other stars, pins and `box`/`seen` of the cleared one.
- [ ] Run (fail), implement, run (pass).

### Task 2: Screen and Home button
- Files: `js/ui/screens/marked.js` (new), `index.html` (script after `settings.js`), `js/ui/screens/home.js` (`markedButtons`), `css/app.css`, `README.md`, `CLAUDE.md`
- [ ] Screen per the spec; `app.go('marked')` from Home; Back → Home.
- [ ] Verify in the browser: select subset, unmark, banner, Home count updates; empty state; 360px light/dark; keyboard (Space toggles the checkbox).
