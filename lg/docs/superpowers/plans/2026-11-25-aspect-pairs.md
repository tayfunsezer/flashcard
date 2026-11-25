# Aspect pairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a practice-only "Aspect pairs" game: one verb of an `X (impf.) & Y (pf.)` row is shown, the learner types the partner.

**Architecture:** A pure core module `LG.aspect` (parse, pair ids, directions, cards, grading) built test-first; one practice-only scoring function in `LG.play`; a Cloze-modelled screen `LG.screens.aspect` that reuses `roundTracker`, `gameHeader`, `starButton`; an extra Home tile outside `app.GAMES`.

**Tech Stack:** Classic-script IIFE modules, vanilla DOM via `LG.dom.h`, the in-repo test runner (`node tests/run-node.js`, `tests.html`).

**Spec:** `lg/docs/superpowers/specs/2026-11-25-aspect-pairs-design.md`

## Global Constraints

- Classic `<script>` tags only, IIFE `(function (LG) { … LG.name = { … }; })(globalThis.LG = globalThis.LG || {});`, works from `file://`, no build, no npm.
- A new core file is listed in `index.html` **and** `tests/manifest.js` in the same order, its test file in `manifest.tests`; `run-node.js` fails on drift.
- Preserve each file's line endings. CRLF: `js/core/play.js`, `tests/play.test.js`, `js/ui/screens/summary.js`, `css/app.css`. LF: `js/ui/app.js`, `js/ui/screens/home.js`, `js/ui/screens/cloze.js`, `index.html`, `tests/manifest.js`, `README.md`, `CLAUDE.md`. Use Edit (not scripted rewrites) on CRLF files and check `git diff --stat` stays small. New files are LF.
- State shape unchanged, no `LG.state.VERSION` bump. Practice only: `progress`, `studySet` untouched by this game (stars via `starButton` excepted).
- Calm look, no emoji in UI chrome (☆/★ on the existing star button are fine), colours from CSS tokens only, every new colour rule also correct in dark mode.
- Messages through `app.banner`, never `alert`. Dark mode and phone width must work.
- Commits in lg carry **no AI attribution** (no `Co-Authored-By`, no "Generated with").
- Run tests with `cd lg && node tests/run-node.js` (Node via nvm on this Mac). Baseline before starting: record the passing count.

## Review Focus

1. A target with the labels twice, missing, or unknown (`(impf.) & (impf.)`, `(impf.)` alone, `(ipf.)`) must not become a pair (Task 1 test).
2. Typing the verb followed by the row's extras (`zapiąć pas`) should be right, since extras are shown as part of the card (Task 1 test).
3. A one-card Random round and odd counts must still pick a direction without crashing, and Random must not leak the aspect label (Task 1 tests).
4. Wrong-aspect answer: typing the shown verb back (or the other-direction verb) is `wrong`, not `almost` (Task 1 test).
5. Ids in a round that no longer exist after a Refresh (or the file loads with no pairs) must not crash the screen: filtered out, Home tile disabled (Task 3 and Task 4 steps).

---

### Task 1: Core module `LG.aspect`

**Files:**
- Create: `lg/js/core/aspect.js`, `lg/tests/aspect.test.js`
- Modify: `lg/index.html` (script after `js/core/claude.js`), `lg/tests/manifest.js` (`src` after `js/core/claude.js`; `tests` after `tests/claude.test.js`)

**Interfaces:**
- Produces (all on `LG.aspect`):
  - `parse(target: string) → { impf: string, pf: string, extras: string } | null`
  - `pairIds(items: Item[]) → string[]` (ids, in item order)
  - `directions(ids: string[], mode: 'impf-pf'|'pf-impf'|'random', rand: () => number) → Map<string, 'impf-pf'|'pf-impf'>`
  - `card(item: Item, dir: 'impf-pf'|'pf-impf', mode: 'impf-pf'|'pf-impf'|'random') → { impf, pf, extras, english, dir, shown, shownAspect: 'impf.'|'pf.'|null, answer, answerAspect: 'impf.'|'pf.' } | null` (`null` when the target is not a pair; `english` = `item.source`; `shownAspect` is `null` when `mode === 'random'`)
  - `answers(card) → string[]` (`[answer]`, plus `answer + ' ' + extras` when extras exist)
  - `grade(typed: string, card, lang: string) → 'correct'|'almost'|'wrong'` (best result of `LG.answer.checkWhole` over `answers(card)`; empty input is `'wrong'`)
  - `reveal(card) → string` (`'impf (impf.) & pf (pf.) extras'`, extras omitted when empty)
- Consumes: `LG.text.normalizeCell`, `LG.rng.shuffle`, `LG.answer.checkWhole`.

- [ ] **Step 1: Write `tests/aspect.test.js` (IIFE, `T.test`/`T.eq`/`T.ok`, like `tests/round.test.js`) with these tests, then add it and `aspect.js` to the manifest and `index.html`**
  - `parse reads the clean pattern`: `parse('zapinać (impf.) & zapiąć (pf.) pas')` → `{ impf: 'zapinać', pf: 'zapiąć', extras: 'pas' }`; with no extras → `extras: ''`.
  - `parse accepts either order and any label case`: `parse('zrobić (pf.) & robić (impf.)')` → `{ impf: 'robić', pf: 'zrobić', extras: '' }`; `'(IMPF.)'`/`'(Pf.)'` parse.
  - `parse keeps multi-word verbs and several extras`: `'bać się (impf.) & zlękną się (pf.) kogoś, czegoś'` gives `impf: 'bać się'`, `pf: 'zlękną się'`, `extras: 'kogoś, czegoś'`.
  - `parse normalises whitespace`: double spaces and a non-breaking space around `&` and the labels give the same result as the single-spaced row.
  - `parse returns null for non-pairs`: `'Cenić sobie coś (impf.)'`, `'Uczestniczyć (impf.)'`, `'cieć & cieknąć'`, `'odmuchać & zdmuchnąć świeczki'`, `'a (impf.) & b (impf.)'`, `'a (pf.) & b (pf.)'`, `'a (ipf.) & b (pf.)'`, `''`, and a plain sentence such as `'Zapnij pas, proszę'`.
  - `pairIds picks only pair items, in item order`.
  - `directions: fixed modes map every id one way`.
  - `directions random is balanced`: for n = 6 and n = 7, with `LG.rng.seeded(1)`, counts are 3/3 and 4/3 (either way round); same seed gives the same Map; n = 1 and n = 0 do not throw.
  - `card shows the label except in random`: for `dir 'impf-pf'`, `mode 'impf-pf'` → `shown: 'zapinać'`, `shownAspect: 'impf.'`, `answer: 'zapiąć'`, `answerAspect: 'pf.'`, `english` = source; same item with `mode 'random'` → `shownAspect: null`; `dir 'pf-impf'` swaps shown and answer; `card` of a non-pair item is `null`.
  - `grade: right, accent slip, wrong, shown verb, extras`: against `zapiąć` (extras `pas`): `'zapiąć'` and `'Zapiąć'` correct; `'zapiac'` almost; `'zapinać'` (the shown verb) wrong; `'zapiąć pas'` correct; `''` wrong. For a multi-word answer `bać się`, `'bac sie'` is almost.
  - `reveal`: `'zapinać (impf.) & zapiąć (pf.) pas'`; without extras no trailing space.
- [ ] **Step 2: Run `node tests/run-node.js`; expected: the new tests fail (`LG.aspect` undefined) and no manifest drift error**
- [ ] **Step 3: Implement `LG.aspect` in `js/core/aspect.js` per the Interfaces block.** `parse`: `normalizeCell` first, then one regex over the two labelled verbs in either order (`^(.+?) \((impf|pf)\.\) & (.+?) \((impf|pf)\.\)(?: (.*))?$`, case-insensitive), require the two labels to differ, extras = the rest trimmed. `directions` random: build `ceil(n/2)` of one direction and `floor(n/2)` of the other, `LG.rng.shuffle` them with `rand`, zip with `ids`.
- [ ] **Step 4: Run `node tests/run-node.js`; expected: all pass (baseline + new), no drift error**
- [ ] **Step 5: Commit**

```bash
cd /Users/tayfunsezer/Desktop/github/flashcard
git add lg/docs/superpowers/specs/2026-11-25-aspect-pairs-design.md lg/docs/superpowers/plans/2026-11-25-aspect-pairs.md lg/js/core/aspect.js lg/tests/aspect.test.js lg/index.html lg/tests/manifest.js
git commit -m "feat(lg): aspect pair core (parse, directions, cards, grading) with spec and plan"
```

### Task 2: Practice-only scoring and eligibility in `LG.play`

**Files:**
- Modify: `lg/js/core/play.js` (CRLF), `lg/tests/play.test.js` (CRLF)

**Interfaces:**
- Produces:
  - `LG.play.practiceAnswer(state, result: 'correct'|'almost'|'wrong', combo: number) → { state, xp, combo }`: XP and combo exactly as `answerPrompt` with `hints: 0`; `state.xp` grows by `xp`; `state.progress` and `state.studySet` are the **same references** as the input.
  - `LG.play.eligibleIds(items, game, lang, mcIds, aspectIds?)`: new optional 5th parameter; when `game === 'aspect'` and `aspectIds` is a Set, only items whose id is in it are returned; every other call is unchanged.

- [ ] **Step 1: Add tests to `tests/play.test.js`**
  - `practiceAnswer: xp and combo like answerPrompt, progress untouched`: from `S.defaultState()` with `progress.a = { box: 2, due: 5, seen: true }`, `practiceAnswer(st, 'correct', 4)` → `combo 5`, `xp 15`, `state.xp 15`, `state.progress === st.progress`, `state.studySet === st.studySet`; `'wrong'` → xp 0, combo 0, progress still the same reference; `'almost'` pays `Math.floor(10/2)` = 5 (× multiplier 1).
  - `eligibleIds aspect filter`: items a, b, c with `aspectIds = new Set(['b'])` → `['b']` for `'aspect'`; the same call for `'cloze'` returns all three.
- [ ] **Step 2: Run `node tests/run-node.js`; expected: these tests fail**
- [ ] **Step 3: Implement both in `js/core/play.js` and export `practiceAnswer`** (reuse `LG.rewards.promptXp` / `comboMultiplier`; keep CRLF).
- [ ] **Step 4: Run `node tests/run-node.js`; expected: all pass**
- [ ] **Step 5: Commit**

```bash
git add lg/js/core/play.js lg/tests/play.test.js
git commit -m "feat(lg): practice-only scoring and aspect eligibility in play"
```

### Task 3: Wiring: ctx, titles, round ids, summary

**Files:**
- Modify: `lg/js/ui/app.js` (LF: `TITLES`, `rebuildCtx`, `roundIds`), `lg/js/ui/screens/summary.js` (CRLF)

**Interfaces:**
- Produces:
  - `app.ctx.aspectIds: Set<string>` (from `LG.aspect.pairIds(items)`).
  - `app.TITLES.aspect = 'Aspect pairs'`.
  - `app.roundIds('aspect', mode)` returns only pair ids (Review/Marked behave like other games; Revenge and Study are not used for this game).
  - Summary accepts an optional `p.extra` object merged into the params of the Practice buttons and of `Play all marked`, so the Aspect game keeps its `dir`.
- Consumes: `LG.aspect.pairIds`, `LG.play.eligibleIds(..., aspectIds)` from Task 2.

- [ ] **Step 1: In `app.js`, add `aspect: 'Aspect pairs'` to `TITLES`, build `aspectIds` in `rebuildCtx` and put it on `app.ctx`, and pass `app.ctx.aspectIds` as 5th argument in `roundIds`.** `GAMES` stays unchanged (it drives revenge, Leitner and `?screen=` boot; spec says the tile is outside it).
- [ ] **Step 2: In `summary.js`, pass `app.ctx.aspectIds` as 5th argument to every `LG.play.eligibleIds` call (`playable`, `eligibleMarked`), and merge `p.extra` into the `app.go` params of `practice(...)` and the marked button.** Leave Flashcards fallback as is (it ignores `extra`: call it without `extra`).
- [ ] **Step 3: Run `node tests/run-node.js` (no regression) and open `index.html?sample=1` in the browser: Home and a Cloze round still work and the summary still shows**
  Expected: tests pass; no console errors; `git diff --stat` for `summary.js` shows a handful of lines (no whole-file CRLF churn).
- [ ] **Step 4: Commit**

```bash
git add lg/js/ui/app.js lg/js/ui/screens/summary.js
git commit -m "feat(lg): aspect ids in ctx, title, and summary hooks"
```

### Task 4: The Aspect pairs screen

**Files:**
- Create: `lg/js/ui/screens/aspect.js`
- Modify: `lg/index.html` (script after `js/ui/screens/cloze.js`), `lg/css/app.css` (CRLF, only if a class is missing; dark mode covered by tokens)

**Interfaces:**
- Produces: `LG.screens.aspect.render(root, { ids, mode: 'review'|'marked', dir?: 'impf-pf'|'pf-impf'|'random' })`; missing `dir` means `'random'`.
- Consumes: `LG.screens.cloze.{ gameHeader, roundTracker, againTag, starButton }`, `LG.aspect.*` (Task 1), `LG.play.practiceAnswer`, `LG.play.completeRound`, `LG.answer.diffWords`, `app.ctx.aspectIds`.

- [ ] **Step 1: Implement `render` as described in the spec's Screen section.** Specifics the spec leaves to the code:
  - Keep only ids that are in `app.ctx.itemsById` **and** `app.ctx.aspectIds`; if none remain, `app.banner('Nothing to play in this round.', 'info')` and `app.go('home')` (as Cloze does).
  - `dirs = LG.aspect.directions(ids, params.dir || 'random', Math.random)`, computed once; `card = LG.aspect.card(item, dirs.get(id), params.dir || 'random')`, kept per id with `track.keep` so a repeat shows the same card.
  - `roundTracker('review', ids)`; score only when `track.counts(id)` via `LG.play.practiceAnswer(app.state, result, round.combo)`; tallies `correct/almost/wrong`, `round.xp`, `round.combo`, `round.seen`, `round.unmarked` as Cloze does; no `round.touched`/`from`.
  - Markup reuses `card fb cloze`, `clue muted` (English), `sentence` (shown verb + extras, with a small `muted` aspect tag when `shownAspect` is not null), `cloze-input`, `letters` row from `LG.words.specialLetters`, Submit, Show answer (counts as wrong), no Hint button. Input has `lang` = target language.
  - Feedback: message `Correct` / `Almost — mind the accents: ` / `Answer: ` + `LG.aspect.reveal(card)`; the `You typed:` line from `LG.answer.diffWords(typed, card.answer, lang)` as in Cloze; ☆ Mark via `starButton`; Next. Enter submits then continues (same `onEnter` pattern, keydown detaches when `screen.isConnected` is false).
  - On finish: `app.setState(LG.play.completeRound(app.state, LG.dates.todayISO()))`, then `app.go('summary', { game: 'aspect', mode, xp, correct, almost, wrong, moved: [], missed, marked, seen, extra: { dir }, again: () => app.go('aspect', { ids: LG.play.startRound(app.roundIds('aspect', mode)), mode, dir }) })` (`dir` = `params.dir || 'random'`).
  - No `app.activeRound` (a Refresh during the round confirms and ends it, as Daily does).
- [ ] **Step 2: Add the script tag to `index.html`, then verify in the browser** with a small test file loaded through the Load screen (a CSV with rows such as `to fasten (a belt)` / `zapinać (impf.) & zapiąć (pf.) pas`, `to do` / `robić (impf.) & zrobić (pf.)`, plus one non-pair row) and `?screen=aspect&ids=…` is not available (not in `GAMES`), so use the Home tile after Task 5, or temporarily call `LG.app.go('aspect', { ids, mode: 'review', dir: 'random' })` from the console.
  Expected: Random shows no label, fixed modes show it; correct, accent-only (`zapiac`, almost), wrong, Show answer all behave; a missed pair returns at most 3 times; ☆ toggles; the summary shows XP and "No items changed box"; `localStorage` `lg.state` progress entries for the played ids show **no change in box/due/seen**; light and dark theme and phone width look right.
- [ ] **Step 3: Commit**

```bash
git add lg/js/ui/screens/aspect.js lg/index.html lg/css/app.css
git commit -m "feat(lg): Aspect pairs screen"
```

### Task 5: Home tile

**Files:**
- Modify: `lg/js/ui/screens/home.js` (LF), `lg/css/app.css` (CRLF, only if the inline row needs a class)

**Interfaces:**
- Consumes: `app.ctx.aspectIds`, `LG.play.markedIds`, existing `ui.mode`, `filteredItems()`, `LG.play.startRound`.
- Produces: an enabled/disabled "Aspect pairs" tile after the four games in the `grid games`, and an inline three-button row.

- [ ] **Step 1: Add a small pure helper in `home.js`, `aspectAvailability(pool)` → `{ ids, reason }`, and use it for the tile.** `ids` = pool items whose id is in `ctx.aspectIds` (in Marked mode only the starred ones, via `LG.play.markedIds`). Reasons, in this order: `ctx.aspectIds.size === 0` → `No verb pairs in this set`; mode `revenge` or `study` → `Practice only, use Review or Marked`; no ids from the pool → `No verb pairs match the filters` (Marked mode: `No marked pairs`). Tile text: name `Aspect pairs`, description `Type the other aspect of a verb.`, count `N pair(s)` or the reason, `disabled` when there is a reason.
- [ ] **Step 2: Clicking the enabled tile toggles an inline row under the grid** (session-only flag in the `ui` object) with three buttons `impf. → pf.`, `pf. → impf.`, `Random`; each starts `app.go('aspect', { ids: LG.play.startRound(ids), mode: ui.mode, dir })` with `dir` = `'impf-pf'`, `'pf-impf'`, `'random'`. The row closes when the mode or filters change (redraw).
- [ ] **Step 3: Verify in the browser:** the tile is greyed with "No verb pairs in this set" on `?sample=1`; with the test file from Task 4 it shows the pair count, respects the date filters, is disabled in Revenge pile and Study set, counts only starred pairs in Marked mode, and each of the three buttons starts the right mode.
- [ ] **Step 4: Run `node tests/run-node.js`; expected: all pass.** Commit:

```bash
git add lg/js/ui/screens/home.js lg/css/app.css
git commit -m "feat(lg): Aspect pairs tile on Home"
```

### Task 6: Docs and final verification

**Files:**
- Modify: `lg/README.md`, `lg/CLAUDE.md`, `lg/docs/superpowers/plans/2026-11-25-aspect-pairs.md` (tick the boxes)

- [ ] **Step 1: README:** add a short "Aspect pairs" paragraph near the Cloze/Marking paragraphs: the data pattern `verb (impf.) & verb (pf.) extras`, the three modes, Random shows no label, practice only (XP and streak count, boxes do not move), ☆ works, Home filters apply, disabled in Revenge/Study, a Refresh during the round ends it. Update the games list line ("Play Cloze, Multiple Choice, Pair Match or Flashcards…") to mention it.
- [ ] **Step 2: `lg/CLAUDE.md`:** add `aspect.js` to the `js/core/` layout list (one line: parse/pairIds/directions/card/grade/reveal), `aspect` to the `js/ui/screens/` list, note that `aspect` is **not** in `app.GAMES` and why, and update the test count line to the new `node tests/run-node.js` total.
- [ ] **Step 3: Run `node tests/run-node.js` and open `tests.html`; both all-green with the same count. `git diff --stat main...` shows no CRLF churn in `play.js`, `play.test.js`, `summary.js`, `app.css`.**
- [ ] **Step 4: Tick the plan's checkboxes, commit**

```bash
git add lg/README.md lg/CLAUDE.md lg/docs/superpowers/plans/2026-11-25-aspect-pairs.md
git commit -m "docs(lg): Aspect pairs README, developer notes, plan done"
```
