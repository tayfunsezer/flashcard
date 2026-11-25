# Aspect pairs: design

Date: 2026-11-25. A project-sized change (new core module, new screen, one small `play.js` function, a Home tile). Written from the brainstorm of 2026-11-25; the learner picked approach A on 2026-11-25.

## Intent

The learner's words: "Continue the 'Aspect pairs' game for the lg app", and on the data: "every aspect pair in my sheet and in the to-be-repeated-words JSON repo now reads 'verb (impf.) & verb (pf.)'". Earlier, when the idea list was agreed: "1 and 2 look good" (2 = the aspect pair game: show the imperfective or the perfective verb, type the other).

Why: the app trains word-to-translation recall well, but not Polish verb aspect, which is a real gap. Learning a verb together with its partner is the usual way to learn aspect. The game must add that skill without replacing the learner's own routine (no app-chosen words, no ladder).

## Goals

1. A new game, **Aspect pairs**: one verb of a pair is shown, the learner types the partner.
2. Three modes, picked before the round:
   - **impf. → pf.**: the imperfective is shown, type the perfective.
   - **pf. → impf.**: the perfective is shown, type the imperfective.
   - **Random**: shuffled, about half each way. The card shows the bare verb with **no aspect label**, so the learner must work out which aspect it is.
3. The English meaning (the item's source) is always shown, followed by the row's shared extras after the verb (for example `pas`, `kogoś`).
4. After each answer the **whole pair** is revealed (with the extras).
5. **Practice only**: XP, combo and streak count; the Leitner box, due date and "seen" flag do **not** move. ☆ marking works.
6. A pair that was missed returns later in the same round (`LG.round`, at most 3 repeats; only the first answer counts for the tallies).
7. Loading is unchanged. Home filters apply (so one date chunk at a time works).

## Non-goals / anti-goals

- No change to the data format, the Load screen, Refresh, or the sheet. The game only reads what is there.
- No spaced repetition for aspect, no new progress fields, no State version bump.
- Not a way for the app to choose words: the learner chooses the filters, as in every other game.
- No hints (a hint on a whole verb gives the answer away). "Show answer" exists, as in Cloze, and counts as wrong.
- No change to Cloze, Multiple Choice, Pair Match, Flashcards, or Leitner.

## Constraints

- lg hard constraints from `lg/CLAUDE.md`: classic scripts, IIFE modules, works from `file://`, no build, dark mode, preserve each file's line endings.
- A new core file goes in `index.html` **and** `tests/manifest.js` (same order), plus its test file in `manifest.tests`; `run-node.js` fails on drift.
- Tests first for core logic. Commits in lg carry **no AI attribution**.
- Update `README.md` for the user-visible behaviour.

## Approaches considered

- **A. Pure core module plus its own screen (picked).** `js/core/aspect.js` (parse, pair eligibility, cards, directions) tested first; `js/ui/screens/aspect.js` modelled on Cloze, reusing `roundTracker`, `gameHeader`, `starButton`, `navRow`, `LG.answer`, `LG.round`. One small new `LG.play.practiceAnswer`. Costs one new screen file of roughly 200 lines and leaves Cloze alone.
- **B. A variant inside the Cloze screen.** Less new code, but Cloze already carries pins, blanks, whole-expression mode and refresh handling; a variant would add branches to every one of them and risk regressions in the main game.
- **C. A self-contained screen with its own loop.** No coupling, but it duplicates the repeat queue, combo and refresh logic and drifts from the shared behaviour.

## Design

### Data: what counts as a pair

Parsed from the item's **target** (the learned language column) and nothing else. English comes from `item.source`.

```
<verb> (impf.) & <verb> (pf.) [extras]      e.g. zapinać (impf.) & zapiąć (pf.) pas
<verb> (pf.) & <verb> (impf.) [extras]      accepted too (either order), the labels decide the aspect
```

- Match is case-insensitive on the labels `impf.` / `pf.`; whitespace is normalised with `LG.text.normalizeCell`.
- Each verb may be several words (`bać się`); the verb is whatever lies between the start (or `&`) and its label.
- `extras` = the text after the second label (may be empty). Shown after the verb, never required in the answer.
- Everything else is not a pair and is skipped silently: sentences with notes (rows 2737, 3451, 3997), single-aspect rows (4397, 4399), `cieć & cieknąć`, `odmuchać & zdmuchnąć świeczki`, gender or adverb triples, and any row with a missing, repeated or unknown label.

### Core: `js/core/aspect.js` (`LG.aspect`)

Pure, no DOM; randomness is injected.

- `parse(target)` → `{ impf, pf, extras }` or `null`.
- `pairIds(items)` → ids of items whose target parses (the Home tile and the round use it).
- `directions(ids, mode, rand)` → `Map id → 'impf-pf' | 'pf-impf'`. Fixed modes map every id to that direction. Random assigns exactly `ceil(n/2)` one way and `floor(n/2)` the other, shuffled, so it is "about half each way" without streaks of luck.
- `card(item, dir, mode)` → `{ shown, shownAspect, answer, answerAspect, extras, english }`. `shownAspect` is `null` in Random mode (no label), otherwise `'impf.'` or `'pf.'`; the answer's aspect is always known for the reveal.
- `expected(card)` → what must be typed: the partner verb with bracketed parts optional (`LG.text.stripParens`, falling back to the verb itself).

### Core: `LG.play.practiceAnswer(state, result, hints, combo)`

Returns `{ state, xp, combo }`. XP and combo exactly as `answerPrompt` (`LG.rewards.promptXp`, `comboMultiplier`), `state.xp` increases, and **`progress`, `studySet` are returned untouched**. The streak is updated at the end of the round by `LG.play.completeRound`, as in the other games.

### Screen: `js/ui/screens/aspect.js` (`LG.screens.aspect`)

Params: `{ ids, mode: 'review' | 'marked', dir: 'impf-pf' | 'pf-impf' | 'random' }`; a missing `dir` means `random`.

- Header: `gameHeader('Aspect pairs', …)`, Quit with confirm, as in Cloze.
- Card: English in the muted clue line, the shown verb large, extras after it, and (not in Random) the aspect label as a small tag, for example `zapinać (impf.) pas` or just `zapinać pas`. Below: the input (language set to the target language), the special-letters row, Submit and Show answer. Enter submits, then Enter goes on.
- Checking: `LG.answer.checkAnswer` for a one-word verb, `checkWhole` when the verb has several words, so a missing accent is "almost", as in Cloze. The feedback line reuses the typed-versus-expected word diff.
- Reveal: the whole pair, impf. first, plus extras, for example `zapinać (impf.) & zapiąć (pf.) pas`, with the ☆ Mark button.
- Rounds: `roundTracker('review', ids)`; a missed pair returns at the end, same direction (kept with `track.keep`), at most 3 times; only the first answer counts in the tallies.
- Scoring: `LG.play.practiceAnswer` (only when `track.counts(id)`). `round.touched` stays empty, so the summary shows "No items changed box".
- Finish: `completeRound`, then `app.go('summary', { game: 'aspect', … })` with `again` repeating the same `dir`. The summary needs a title for `aspect` (`app.TITLES`), and its "practise missed / marked" buttons must run the Aspect game with the same `dir` (or fall back to Flashcards); the builder makes the smallest change that keeps those buttons working.
- Refresh in a round: v1 sets no `app.activeRound`, so a refresh during an Aspect round behaves like Daily (confirm and end). Cloze, Multiple Choice, Pair Match and Flashcards keep their in-round refresh.

### Home

- `app.ctx.aspectIds` (a Set) is built in `rebuildCtx` from `LG.aspect.pairIds`.
- A tile **Aspect pairs** ("Type the other aspect of a verb.") in the games grid, drawn after the four games. It is **not** added to `app.GAMES` (that list drives revenge, summary and the Leitner screen, none of which apply).
- Count = pairs among the Home-filtered items (in Marked mode: only the starred ones).
- Disabled, with the reason line instead of the count:
  - "No verb pairs in this set" when the file has none;
  - "No verb pairs match the filters" when filters remove them all;
  - "No marked pairs" in Marked mode with none;
  - "Practice only, use Review or Marked" in Revenge pile and Study set modes (the game has no Leitner box to drive them).
- Clicking an enabled tile opens an inline row under the grid with three buttons, **impf. → pf.**, **pf. → impf.**, **Random**; choosing one starts the round at once (shuffled ids, `mode` = the Home mode). No extra screen.

### Tests (first)

- `tests/aspect.test.js`: parse of the clean pattern, both orders, extras, multi-word verbs, reflexive `się`, labels in other case; `null` for every skipped shape listed above; `pairIds`; `directions` (fixed modes, Random balance for even and odd n, determinism with `LG.rng.seeded`); `card` (label hidden in Random, shown otherwise, answer and extras); `expected` with brackets.
- `tests/play.test.js`: `practiceAnswer` adds XP and combo, leaves `progress` and `studySet` identical (same reference), wrong answer gives 0 XP and resets combo.
- Register `js/core/aspect.js` and `tests/aspect.test.js` in `index.html`, `tests/manifest.js` and (for the test page) `tests.html` if it lists files.
- Screen and Home are checked in the browser (both themes, phone width), as for the other screens; `tests/dev` scripts only if they apply without a Windows Edge path.

## Left to the builder

- Exact markup and CSS class names (reuse Cloze's `card`, `clue`, `sentence`, `fb-*` classes; add only what is missing, with dark-mode rules).
- Wording of small labels and the `aspect` summary title.
- How the summary's practice buttons pass `dir` (minimal change).

## My calls (not discussed with the learner, easy to change)

- Either aspect order is accepted by `parse`, although the data is now always impf. first.
- No hints; Show answer counts as wrong.
- Marked mode works for the game; Revenge pile and Study set are disabled for it.
- No in-round Refresh support in v1.
- The tile opens an inline three-button row rather than a separate screen.

## Note on refreshing the edited file

The ~95 rows whose Polish side changed get new item ids. `reload.carryOver` pairs each with its new row by the unchanged English and `carryState` moves the progress and ☆ to the new id; pins are dropped. Rows that would lose their progress: several edited rows sharing one English text, two rows merged into one, rows that became identical (they collapse into one item), and an edited row that now equals an existing row. This game does not depend on any of that: it reads only the current text of each row and writes no progress.
