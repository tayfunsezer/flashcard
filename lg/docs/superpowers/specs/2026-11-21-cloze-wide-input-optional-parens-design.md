# Cloze: wide answer box, optional brackets, punctuation-free typing — design

Date: 2026-11-21. Amends `2026-10-26-language-game-design.md` §8.1 and §9, and `2026-11-16-whole-expression-marks-refresh-design.md` §1.

Status: implemented 2026-11-21, before this spec was written; this document records the decisions after the fact. Browser check pending.

## Intent

Two revisions requested by the learner ("Language Game Revisions"):

1. "In the Cloze work mode, the textbox that users have to enter the answer is too narrow. When users have to type a long sentence or expression, it is not a good UI experience."
2. "In Cloze work mode, while typing to textbox don't expect me to provide the expressions between parentheses or allow me to skip chars like ampersand or comma (if not already like that)."

What the code did before:
- The Cloze input was a fixed `14rem` and shared one row with Submit, Hint and Show answer.
- Whole-expression mode (`checkWhole`) already compared word tokens only, so `&` and `,` could be skipped. One-word mode with several pinned words used `checkAnswer`, which compares the joined string, so `orać & zaorać` was wrong for the pins `orać zaorać`.
- Parentheses had no special meaning. A whole-mode answer had to include `(czegoś)`, and one-word mode could pick a bracketed word as the blank.

## Goals

- The answer box is wide (the full card width) on desktop and phone.
- Words in `( … )` are optional in a typed whole-expression answer: leaving them out is correct, typing them is also correct.
- Commas, `&` and other symbols between words never matter in a multi-word typed answer, in either Ask-for mode.

## Non-goals

- Multiple Choice, Pair Match, Flashcards and Daily Word are unchanged.
- Other brackets (`[ ]`, `{ }`) and slash alternatives (`a/b`) are not optional. They can be added later if asked.
- A single-word answer keeps `checkAnswer` (edge punctuation stripped, case-insensitive, folding gives "almost").

## Design

### 1. Answer box
- The input moves to its own row (`.cloze-field`) above the button row.
- The box always spans the card (`width: 100%`, `box-sizing: border-box`), in both Ask-for modes and for any answer length. `min-height: 44px` gives a touch-sized target.
- *Revised 2026-11-21 after the learner's check:* the first version sized the box to the answer (`max(14, len + 4)` ch). At 1.125rem, 14ch is ~150px, which is narrower than the old `14rem` (~224px), so short answers and the default One-word mode got a smaller box. The learner reported "I still see textbox small".
- `required` is the text the learner must type: the pinned or blanked words in one-word mode, and the target with brackets removed in whole mode. It drives hints and the blank width, not the box.

### 2. Optional brackets
- `LG.text.parenRanges(s)` returns `[start, end)` of each top-level `( … )` group. Nested groups belong to their outer group. An unclosed `(` is not a group.
- `LG.text.stripParens(s)` removes those groups and normalises spaces: `"(coś) robić (komuś) dobrze"` becomes `"robić dobrze"`.
- `checkWhole(input, expected, lang)` compares the input tokens to both the full target tokens and the bracket-free target tokens, and keeps the best result (correct > almost > wrong). An all-bracket target (`(czegoś)`) compares to the full tokens only.
- Whole-mode hints (`hintText`) and the blank's width use `required`. The note under the box reads "Type the whole expression (words in brackets are optional); commas and symbols like & can be left out". The bracket clause is shown only when the target has brackets.
- Feedback still shows the full target, brackets included.

### 3. Blank choice in one-word mode
- `clozeCandidates` ignores tokens inside brackets. They are used only when every token is bracketed. A learner-pinned bracketed word is still blanked (pins win).

### 4. Punctuation in multi-word one-word mode
- When more than one word is blanked (pins), Cloze checks with `checkWhole` instead of `checkAnswer`. The note reads "Type all N missing words in order; commas and symbols like & can be left out".

## Builder calls

1. **Typed brackets are accepted, not just tolerated.** `bać się czegoś` and `bać się (czegoś)` are both correct for `bać się (czegoś)`. The learner asked not to be *required* to type them, so typing them must not be punished.
2. **One-word mode no longer blanks bracketed words.** The request did not ask for this, but blanking an optional word contradicts "don't expect me to provide" it. Pins override this.
3. **Box width: always the full card width.** This replaced "width follows the answer", which shrank short answers below the old width (see Design §1).

## Constraints

- Classic scripts on `LG`, `file://`, no build (unchanged).
- Core logic is unit-tested in `tests/text.test.js`, `tests/answer.test.js` and `tests/words.test.js`. The UI is checked in a browser.
- Preserve each file's line endings (CRLF in `css/app.css`, `answer.js`, `words.js`; mixed in `tests/words.test.js`).
