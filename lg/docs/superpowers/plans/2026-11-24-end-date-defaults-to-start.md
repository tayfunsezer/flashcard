# End date defaults to the start date — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans or subagent-driven-development.

**Goal:** Picking Date from fills an empty Date to with the same day.
**Spec:** `docs/superpowers/specs/2026-11-24-end-date-defaults-to-start-design.md`
**Constraints:** `js/core/words.js` is CRLF, `tests/words.test.js` check its ending; no AI attribution in commits.

## Task 1

**Interfaces — Produces:** `LG.words.withDateFrom(f, value: string) -> filters` (new object).

- [ ] Tests: empty End + value → both set; existing End kept (even earlier than value); empty value (clearing Start) leaves End unchanged; input object not mutated. Run `node tests/run-node.js` → FAIL.
- [ ] Implement in `words.js`, export on `LG.words`; run → pass.
- [ ] `home.js` `filtersCard`: create both date inputs/Clear buttons before wiring; the Date from handler does `Object.assign(f, LG.words.withDateFrom(f, input.value))`, then sets the End input's value and its Clear button's `hidden`, then `paint(); onchange()`.
- [ ] Browser check: pick Start with End empty → End shows the same date, chips show both, counts update; with End already set it stays; Clear on either works. Tests pass.
- [ ] README Filters paragraph: one sentence. Commit `feat(lg): End date defaults to the picked Start date`.
