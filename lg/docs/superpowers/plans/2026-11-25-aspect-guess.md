# Aspect pairs: guess-aspect mode Implementation Plan

> Small plan, executed inline. Spec: `docs/superpowers/specs/2026-11-25-aspect-guess-design.md`. Commits carry no AI attribution.

**Goal:** a "Random + guess aspect" start mode where a dropdown asks the aspect of the shown verb.

## Global Constraints
Classic scripts, preserve line endings (`css/app.css` is CRLF; `home.js`, `aspect.js`, `README.md`, tests are LF), tests first, `node tests/run-node.js` green.

### Task 1: Core (`js/core/aspect.js`, `tests/aspect.test.js`)
- [x] Tests: `card` has `shownKind` in every mode and `shownAspect === null` for `'random-guess'`; `directions(..., 'random-guess', ...)` is balanced like random; `gradeGuess` → right partner + right aspect = `{ result: 'correct', aspectOk: true }`; right partner + wrong aspect = `{ result: 'almost', aspectOk: false }`; accent slip + right aspect = almost, aspectOk true; wrong partner + right aspect = wrong, aspectOk true; wrong partner + wrong aspect = wrong, aspectOk false.
- [x] Implement; run tests; commit.

### Task 2: Screen and Home
- [x] `aspect.js` screen: `random-guess` shows the select, requires it before Submit (not for Show answer), grades with `gradeGuess`, adds the aspect line to the feedback.
- [x] `home.js`: fourth button `Random + guess aspect`; `css/app.css`: four columns, two on phones.
- [x] Browser check (guess right/wrong, Submit blocked without a pick, Show answer, summary) and commit.

### Task 3: Docs
- [x] README sentence; this plan ticked; commit.
