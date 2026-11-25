# Aspect pairs: "Random + guess aspect" mode, design

Date: 2026-11-25. A small change on top of `2026-11-25-aspect-pairs-design.md`. Approved by the learner in chat after the proposal below ("Yep, go ahead, do it").

## Intent

The learner's words: "when I pick random, we can also add a mode that would ask me to guess whether it is perfective or imperfective, right? But it can be a drop down ... instead of me typing it ... I don't want to specifically have a straight mode that I only pick whether it is perfective or not. I want to do it both."

Why: in Random mode the card hides the aspect label, so telling which aspect the shown verb has is the skill being trained. Asking for it explicitly, next to typing the partner, makes the learner commit to an answer instead of only noticing it on the reveal.

## Design

- A fourth start button next to the existing three on Home: **Random + guess aspect** (`dir = 'random-guess'`). The other modes are unchanged; fixed modes show the label, so a guess would be pointless there.
- Same cards, directions and repeats as Random (half each way, no aspect label on the card).
- The card gets a dropdown (native select) before the input: empty choice **Aspect?**, then **impf.** and **pf.**. It is the aspect of the **shown** verb. Submit needs both the dropdown and the input (Show answer needs neither). Enter submits.
- Scoring (the learner chose Almost for a wrong aspect with a right partner):
  - partner wrong: Wrong, whatever was picked;
  - partner right (or accents only) and aspect right: as today (Correct or Almost);
  - partner right and aspect wrong: **Almost** (half XP, combo continues).
- The reveal adds a line: `Aspect: impf. ✓` or `You picked pf., it is impf.`. Practice only, as before.

## Core changes (`LG.aspect`)

- `card(...)` also returns `shownKind: 'impf.'|'pf.'` (always set); `shownAspect` stays `null` for `'random'` and `'random-guess'`.
- `directions(ids, 'random-guess', rand)` behaves as `'random'`.
- `gradeGuess(typed, picked, card, lang)` → `{ result, aspectOk }`: `result` as `grade`, lowered to `'almost'` when the partner is right but `picked !== card.shownKind`; `'wrong'` stays `'wrong'`.

## Out of scope

No asking the aspect in the fixed modes, no separate aspect-only mode, no new progress data.
