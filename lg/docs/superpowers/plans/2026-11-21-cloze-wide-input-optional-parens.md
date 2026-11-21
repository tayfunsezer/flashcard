# Cloze Wide Input and Optional Brackets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-width Cloze answer box on its own row; bracketed words optional in typed whole expressions; punctuation ignored in every multi-word typed answer.

**Architecture:**
- Bracket detection and stripping go in `js/core/text.js`.
- `checkWhole` in `js/core/answer.js` tries the full and the bracket-free target.
- `clozeCandidates` in `js/core/words.js` skips bracketed tokens.
- The Cloze screen uses these for checking, hints, blank width and the input's width. CSS caps the box at the card width.

**Tech Stack:** Plain ES2020 classic scripts on the global `LG` namespace, `Intl.Segmenter`. No build, no network.

**Spec:** `docs/superpowers/specs/2026-11-21-cloze-wide-input-optional-parens-design.md`

**Status (2026-11-21):** Tasks 1–4 done and committed (`node tests/run-node.js`: 131 passed, 0 failed). Open: the learner's browser check (Task 4, Step 5) of the full-width box.

## Global Constraints

- **Runtime:** `file://`, classic scripts, every file `(function (LG) { ... })(globalThis.LG = globalThis.LG || {});`. No new files, so `index.html` and `tests/manifest.js` don't change.
- **Line endings:** keep each file's existing endings. Scripted edits read and write with `newline=''`. `git diff --stat` must show only the intended lines.
- **Copy:**
  - Whole note: "Type the whole expression", plus " (words in brackets are optional)" when the target has brackets, plus "; commas and symbols like & can be left out".
  - Multi note: "Type all N missing words in order; commas and symbols like & can be left out".
- **Tests:** `node tests/run-node.js` ends with `0 failed`.
- **No attribution** in code, comments, docs or commit messages.

## Review Focus

1. **Unbalanced or nested brackets** (`unclosed (x`, `a (b (c)) d`): no crash. Unclosed text stays required; a nested group is one optional group. Owned by Task 1: test `parenRanges and stripParens`.
2. **Target entirely in brackets** (`(czegoś)`): typing `czegoś` is correct, and Cloze can still blank it. Owned by Task 2 (`checkWhole: words in parentheses are optional`) and Task 3 (`clozeCandidates skips words inside parentheses`).
3. **Typing the optional words anyway** (`bać się czegoś`, `bać się (czegoś)`): correct, not wrong. Owned by Task 2.
4. **Only a short word outside the brackets** (`iść (gdzieś daleko)`): the blank is `iść`, never `gdzieś`. Owned by Task 3.
5. **A very long expression on a phone** (320px): the box fills the card without horizontal page scroll. Owned by Task 4, Step 3.

---

### Task 1: Core — bracket ranges and stripping

**Files:**
- Modify: `js/core/text.js`
- Test: `tests/text.test.js`

**Interfaces:**
- Produces:
  - `LG.text.parenRanges(s: string) -> Array<[start: number, end: number]>`: top-level `( … )` groups, end exclusive; unclosed `(` ignored.
  - `LG.text.inParens(index: number, ranges) -> boolean`.
  - `LG.text.stripParens(s: string) -> string`: groups removed, result passed through `normalizeCell`; returns `s` unchanged when there are no groups.

- [x] **Step 1: Write the failing test** `parenRanges and stripParens`:

```js
T.eq(t.parenRanges('bać się (czegoś)'), [[8, 16]]);
T.eq(t.parenRanges('a (b (c)) d (e'), [[2, 9]]);
T.eq(t.parenRanges('no brackets'), []);
T.eq(t.stripParens('bać się (czegoś)'), 'bać się');
T.eq(t.stripParens('(coś) robić (komuś) dobrze'), 'robić dobrze');
T.eq(t.stripParens('a (b (c)) d'), 'a d');
T.eq(t.stripParens('unclosed (x'), 'unclosed (x');
```

- [x] **Step 2: Run** `node tests/run-node.js`. Expected: `FAIL parenRanges and stripParens`.
- [x] **Step 3: Implement** the three functions (a depth counter over the string) and export them on `LG.text`.
- [x] **Step 4: Run** `node tests/run-node.js`. Expected: that test passes.

### Task 2: Core — optional brackets in `checkWhole`

**Files:**
- Modify: `js/core/answer.js`
- Test: `tests/answer.test.js`

**Interfaces:**
- Consumes: `LG.text.stripParens` (Task 1).
- Produces: `LG.answer.checkWhole(input, expected, lang) -> 'correct'|'almost'|'wrong'`, the best of the comparisons with `tokens(expected)` and `tokens(stripParens(expected))`, skipping an empty token list.

- [x] **Step 1: Write the failing tests:**

```js
T.test('checkWhole: words in parentheses are optional', () => {
  T.eq(A.checkWhole('bać się', 'bać się (czegoś)', 'pl'), 'correct');
  T.eq(A.checkWhole('bać się czegoś', 'bać się (czegoś)', 'pl'), 'correct');
  T.eq(A.checkWhole('bać się (czegoś)', 'bać się (czegoś)', 'pl'), 'correct');
  T.eq(A.checkWhole('bac sie', 'bać się (czegoś)', 'pl'), 'almost');
  T.eq(A.checkWhole('robić dobrze', '(komuś) robić, dobrze', 'pl'), 'correct');
  T.eq(A.checkWhole('bać', 'bać się (czegoś)', 'pl'), 'wrong');
  T.eq(A.checkWhole('czegoś', '(czegoś)', 'pl'), 'correct');
});
T.test('checkWhole ignores commas and ampersands in the input too', () => {
  T.eq(A.checkWhole('orać, zaorać', 'orać zaorać', 'pl'), 'correct');
  T.eq(A.checkWhole('orać & zaorać', 'orać zaorać', 'pl'), 'correct');
});
```

- [x] **Step 2: Run.** Expected: the parentheses test fails; the punctuation test already passes (existing behaviour, kept as a guard).
- [x] **Step 3: Implement.** Extract `compareTokens(a, b, lang)` from the old body and rank the results `wrong < almost < correct`.
- [x] **Step 4: Run.** Expected: `0 failed`, including the existing `checkWhole` test.

### Task 3: Core — no blanks inside brackets

**Files:**
- Modify: `js/core/words.js` (`clozeCandidates`)
- Test: `tests/words.test.js`

**Interfaces:**
- Consumes: `LG.text.parenRanges`, `LG.text.inParens` (Task 1).
- Produces: `clozeCandidates(target, rarity, lang)` with the same signature; both the ranked candidates and the longest-token fallback use only non-bracketed tokens, unless every token is bracketed.

- [x] **Step 1: Write the failing test** `clozeCandidates skips words inside parentheses`:
  - `czegoś` and `strasznego` are not candidates of `bać się (czegoś strasznego)`.
  - `iść (gdzieś daleko)` gives exactly `['iść']`.
  - `(czegoś)` gives at least one candidate.
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement** by filtering the token list before the existing ranking.
- [x] **Step 4: Run.** Expected: `0 failed`.
- [x] **Step 5: Commit Tasks 1–3** `feat(cloze): optional bracketed words and no blanks inside brackets`.

### Task 4: Cloze screen — wide box, required text, multi-word check

**Files:**
- Modify: `js/ui/screens/cloze.js` (`prompt`, `submit`), `css/app.css` (`input.cloze-input`, new `.cloze-field`)
- Modify: `README.md` (Cloze paragraph)

**Interfaces:**
- Consumes: `LG.text.stripParens`, `LG.answer.checkWhole` (Tasks 1–2).

- [x] **Step 1: Implement in `prompt()`:**
  - `required = whole ? (stripParens(item.target) || item.target) : expected` and `optionalParts = whole && required !== item.target`.
  - Input inside `h('div', { class: 'cloze-field' }, input)`, placed before the `.btn-row`. No inline width. (The first version set `width:<max(14, len+4)>ch`; the learner's check found it narrower than before for short answers, so it was removed.)
  - `hintText(required, hints)`; whole-mode blank width `min(charLength(required)+1, 40)ch`.
  - Notes use the copy from Global Constraints.
- [x] **Step 2: Implement in `submit()`:** `whole || multi ? checkWhole(...) : checkAnswer(...)`.
- [x] **Step 3: CSS:** `.cloze-field { display: flex; }` and `input.cloze-input { …; width: 100%; max-width: 100%; min-height: 44px; box-sizing: border-box; }`.
- [x] **Step 4: README:** in the Cloze / "Ask for" paragraph, say that words in brackets are optional and commas or `&` can be left out.
- [ ] **Step 5: Browser check** (serve `lg/` on localhost or open `index.html`; Claude in Chrome can't open `file://`). Load a CSV with `bać się (czegoś)`, `orać & zaorać pole`, a 60-character sentence and a one-word item. Check:
  - Whole mode: `bać się` is correct, and the note shows the bracket clause.
  - One-word mode: no bracketed blank.
  - The box spans the card for every item, including `kot`, at 1280px and 375px wide, with no horizontal scroll.
  - Both themes.
- [x] **Step 6: Run** `node tests/run-node.js` (expected `0 failed`), check that `git diff --stat` shows only the intended lines, then commit `feat(cloze): full-width answer box`.
