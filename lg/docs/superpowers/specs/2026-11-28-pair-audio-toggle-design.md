# Pair Match: audio toggle on the game screen

Date: 2026-11-28. A small change in `lg/` only (`fc/` untouched). Approved by the learner in chat after asking for it.

## Intent

The learner's words: "the play audio in pair mode settings being in the settings file is a bit annoying, because I need to quit that mode and go back to disable it. So would it be possible for you to move that settings directly into pair mode screen?"

## Goals

1. A checkbox **Read tiles aloud** on the Pair Match screen (every board, including study-set boards) switches `settings.speakMatch` on and off at once; the next tile tap obeys it, no restart of the board.
2. The checkbox always shows the current value (it is redrawn with each board).
3. The checkbox is **removed from Settings → Voice** (moved, not duplicated). Voice choice, Test voice and Speed stay in Settings.

## Non-goals

- No change to the `speakMatch` state field, its default (on) or its validation, so saved progress and imports are unaffected. No toggles added to other games. Tiles in the translation language stay silent.

## Approaches

- **A. Checkbox beside the instruction line, writing through `app.setSettings` (picked):** reuses the existing setting and the `choice` checkbox style; the click handler already reads the setting lazily.
- B. Keep it in both places: the learner said "move", and two places for one switch invite confusion.

## Design

`match.js` `playBoard`: below the header, a row holding the existing instruction text and `label.choice > input[type=checkbox]` bound to `app.state.settings.speakMatch` with `onchange: (e) => app.setSettings({ speakMatch: e.target.checked })`. `settings.js`: delete that label. README and CLAUDE.md wording updated (the README sentence that tells the learner to untick the option in the Voice card).

## Left to the builder

Exact placement and wrapping on phone width.
