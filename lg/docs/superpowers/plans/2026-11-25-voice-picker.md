# Voice picker and listen buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Speak the learned language with a chosen (or best available) voice: Settings picker, Listen buttons on answer sides, and speech in Pair Match.

**Architecture:** Pure `LG.voice` (rank, filter, pick) tested with fake voices; a thin `LG.speech` wrapper over `speechSynthesis` with a cached voice list and a Listen button; a Settings card; small hooks in four screens.

**Tech Stack:** Classic-script IIFE modules, Web Speech API, in-repo test runner (`node tests/run-node.js`).

**Spec:** `lg/docs/superpowers/specs/2026-11-25-voice-picker-design.md`

## Global Constraints

- **`fc/` is not touched.** Everything is in `lg/`.
- Classic `<script>` tags, IIFE modules, works from `file://`, no build, no npm. New core file listed in `index.html` **and** `tests/manifest.js` (src + tests), same order; `run-node.js` fails on drift. `js/ui/speech.js` goes in `index.html` after `js/ui/dom.js` (before `app.js`); it is a UI file, not in the manifest.
- Preserve line endings: CRLF files include `js/core/play.js`, `js/ui/screens/summary.js`, `css/app.css`, `tests/play.test.js`; check each file with `grep -c $'\r' file` before editing and use Edit/Python with `newline=''`.
- Only the language being learned (`app.ctx.langTarget`) is ever spoken. Speech missing or no voice: buttons hidden, nothing breaks.
- State: `settings.voices` default `{}`; old saved states and progress imports must still load (bump `LG.state.VERSION` only if a migration is needed).
- Calm UI, no emoji in chrome (the button reads "Listen"), tokens only, dark mode and phone width work.
- Commits carry **no AI attribution**. Baseline before starting: 229 passing (`cd lg && node tests/run-node.js`).

## Review Focus

1. The voice list is empty on the first call (Chrome loads it asynchronously): Listen buttons and the Settings card must appear or update once it arrives, never stay dead (Task 2 step: `ready`/`voiceschanged`).
2. A saved voice that is no longer installed (other device, voice deleted): fall back to the best voice and say so in Settings (Task 1 `pick` test, Task 2 message).
3. Language codes differ in shape: `langTarget` is `pl`, voices say `pl-PL` or `pl_PL`; a prefix like `plxx` must not match (Task 1 tests).
4. Rapid taps in Pair Match or repeated Listen clicks must not queue up overlapping speech: each `speak` cancels the previous (Task 2 step; browser check in Task 4).
5. A file with no verbs/text, or text that is only punctuation: `speak` does nothing instead of speaking an empty utterance (Task 2 step).

---

### Task 1: Core `LG.voice` and the `voices` setting

**Files:**
- Create: `lg/js/core/voice.js`, `lg/tests/voice.test.js`
- Modify: `lg/index.html` (script after `js/core/aspect.js`), `lg/tests/manifest.js` (src after `js/core/aspect.js`, tests after `tests/aspect.test.js`), `lg/js/core/state.js` (`defaultState` and `withDefaults`), `lg/tests/state.test.js`

**Interfaces:**
- Produces on `LG.voice`:
  - `rank(voice: { name, lang, localService }) → 0|1|2|3` (3 = name contains "Premium", 2 = "Enhanced", 1 = other `localService`, 0 = online)
  - `forLang(voices: voice[], lang: string) → voice[]` (primary-subtag match, case-insensitive, `-` or `_`; sorted by rank desc, then name)
  - `pick(voices, lang, savedName?: string) → voice | null`
  - `label(voice) → string` (name, plus ` (online)` when `localService` is false)
- Produces: `state.settings.voices: { [lang]: string }`.

- [ ] **Step 1: Write `tests/voice.test.js`** (IIFE, `T.test`, fake voices such as `{ name: 'Ewa (Premium)', lang: 'pl-PL', localService: true }`) with these tests and register the file and `voice.js` in the manifest and `index.html`:
  - `rank orders Premium > Enhanced > plain local > online`: `Ewa (Premium)` 3, `Ewa (Enhanced)` 2, `Zosia` 1, `Google polski` (not local) 0.
  - `forLang matches by primary subtag`: `pl` matches `pl-PL` and `pl_PL`, not `plx-XX`, not `en-US`; `PL` matches too; result ordered Premium, Enhanced, plain, online.
  - `pick prefers the saved voice, falls back to the best, null when none`: saved `Zosia` present → Zosia; saved `Gone` → `Ewa (Premium)`; empty or undefined saved → `Ewa (Premium)`; no Polish voices → `null`; empty list → `null`.
  - `label marks online voices`: `label(googleVoice) === 'Google polski (online)'`, local voice unchanged.
  - In `tests/state.test.js`: `defaultState().settings.voices` deep-equals `{}`; `withDefaults({})` and an old-shape state with no `voices` give `{}`; `withDefaults({ settings: { voices: { pl: 'Ewa (Premium)' } } }).settings.voices` keeps it; malformed (`'x'`, `['a']`, `{ pl: 5 }`) becomes `{}` or drops the bad entry (`{ pl: 5 }` → `{}`).
- [ ] **Step 2: Run `node tests/run-node.js`; expected: the new tests fail (`LG.voice` undefined / `voices` undefined), no manifest drift error**
- [ ] **Step 3: Implement `LG.voice` in `js/core/voice.js` and the `voices` default plus validation in `js/core/state.js`** (keep only string values whose key is a string).
- [ ] **Step 4: Run `node tests/run-node.js`; expected: all pass**
- [ ] **Step 5: Commit** `feat(lg): voice ranking core and voices setting`

### Task 2: `LG.speech` wrapper, Listen button, Settings Voice card

**Files:**
- Create: `lg/js/ui/speech.js`
- Modify: `lg/index.html` (script after `js/ui/dom.js`), `lg/js/ui/app.js` (call `LG.speech.preload()` in `boot`), `lg/js/ui/screens/settings.js` (Voice card after Languages), `lg/css/app.css` (CRLF, only if the card needs a class)

**Interfaces:**
- Consumes: `LG.voice.{forLang, pick, label}`, `app.state.settings.voices`, `app.setSettings({ voices })`, `app.ctx.langTarget`.
- Produces on `LG.speech`:
  - `available() → boolean`
  - `voices() → voice[]` (cached list, `[]` until loaded)
  - `preload() → void` (reads the list now and on every `voiceschanged`)
  - `onVoices(cb: () => void) → () => void` (subscribe to list changes; returns an unsubscribe function)
  - `speak(text: string, lang: string) → void` (cancels current speech; picks the voice with `LG.voice.pick(voices(), lang, state.settings.voices[lang])`; sets `utterance.voice` and `utterance.lang`; does nothing when no voice or when `text` has no letters or digits)
  - `button(getText: () => string) → HTMLButtonElement` (`btn btn-small`, text "Listen", speaks `getText()` in `ctx.langTarget`; hidden while unavailable or no voice for the language and shown when the list arrives)

- [ ] **Step 1: Implement `js/ui/speech.js` per the Interfaces block; `button` subscribes via `onVoices` and unsubscribes when `isConnected` is false on a later call.** There is no unit test (browser API); the logic that matters is in `LG.voice`.
- [ ] **Step 2: Settings → Voice card:** heading "Voice"; a `<select>` whose first option is `Automatic (best available)` (value `''`), then `LG.voice.forLang(LG.speech.voices(), langTarget)` as options labelled by `LG.voice.label`; selecting writes `app.setSettings({ voices: Object.assign({}, settings.voices, { [lang]: name }) })` (empty value removes the key); a **Test voice** button speaking the first item's learned text (fallback sample: the language name) through `LG.speech.speak`; a line "Automatic uses: <label>"; "Saved voice not found, using <label>." when the saved name is missing; "No <lang> voice found on this device." when none. The card redraws on `onVoices`. Hidden when `langTarget` is empty or speech is unavailable.
- [ ] **Step 3: Verify in the browser** (`python3 -m http.server 8791 --directory <repo>` and `http://localhost:8791/lg/index.html`, load a test dataset as in earlier checks): Settings shows Ewa (Premium) as the Automatic line on the learner's Mac, the dropdown lists the Polish voices, Test voice speaks (audible), the choice survives a reload, Google polski is labelled "(online)".
  Expected: no console errors; hard-reload with ⌘⇧R after code changes.
- [ ] **Step 4: Run `node tests/run-node.js`; expected: all pass. Commit** `feat(lg): speech wrapper, Listen button and Voice settings`

### Task 3: Listen on the answer sides (Cloze, Flashcards, Aspect pairs)

**Files:**
- Modify: `lg/js/ui/screens/cloze.js` (LF), `lg/js/ui/screens/flashcards.js` (check endings), `lg/js/ui/screens/aspect.js` (LF)

**Interfaces:**
- Consumes: `LG.speech.button(getText)` (Task 2).

- [ ] **Step 1: Cloze:** in `feedback(...)`, add `LG.speech.button(() => item.target)` to the row with the Mark star.
- [ ] **Step 2: Flashcards:** in `flip()`, append the Listen button under the back side (`getText = () => item.target`); the back side is drawn once per word, so no duplicates when the card is revisited with Back.
- [ ] **Step 3: Aspect pairs:** in `feedback(...)`, add the button with `getText = () => c.impf + ', ' + c.pf + (c.extras ? ' ' + c.extras : '')`.
- [ ] **Step 4: Verify in the browser** in all three games, both flashcard directions (the button speaks the learned text even when the revealed side is the translation); Listen twice quickly does not overlap; with `speechSynthesis` removed via the console (`delete window.speechSynthesis` before load is not possible, so check that `LG.speech.available()` false hides the button by stubbing it) nothing breaks.
  Expected: no console errors. Run `node tests/run-node.js`; all pass. Commit `feat(lg): Listen buttons on Cloze, Flashcards and Aspect pairs answers`

### Task 4: Pair Match speech

**Files:**
- Modify: `lg/js/ui/screens/match.js` (check endings)

- [ ] **Step 1: In `pick(side, id)`**, after the tile is selected (not when deselected and not when the board is locked), call `LG.speech.speak(text(id, side), langT)` when `langOf(side) === langT`.
- [ ] **Step 2: In `resolve()`'s matched branch**, when the last tapped tile's language was not `langT`, speak `app.ctx.itemsById.get(a).target` in `langT` (the learned word is heard once, never twice). Record the last tapped side in a local variable inside `pick`.
- [ ] **Step 3: Verify in the browser**, both directions (Source → Target and Target → Source): tapping a Polish tile speaks it, tapping an English tile is silent, a correct match always ends with the Polish word heard once, a wrong match is silent, tapping fast cancels the previous word.
  Expected: no console errors. Run `node tests/run-node.js`; all pass. Commit `feat(lg): speak the learned word in Pair Match`

### Task 5: Docs and final check

**Files:**
- Modify: `lg/README.md`, `lg/CLAUDE.md`, this plan (tick boxes)

- [ ] **Step 1: README:** a "Voice and listening" paragraph: Settings → Voice (Automatic prefers Premium, then Enhanced, then on-device, then online voices; a choice is remembered per language; how to download better macOS voices: System Settings → Accessibility → Spoken Content → System Voice → Manage Voices…, then restart the browser), the Listen button on answer sides, Pair Match speaking Polish tiles, only the learned language is spoken, no `fc/` changes.
- [ ] **Step 2: `lg/CLAUDE.md`:** add `voice.js` to the core list and `speech.js` to the UI list, add `settings.voices` to the State block, update the test count.
- [ ] **Step 3: Run `node tests/run-node.js` and `tests.html`; both green with the same count. `git diff --stat main...` shows no CRLF churn.**
- [ ] **Step 4: Tick this plan's boxes and commit** `docs(lg): voice picker README, developer notes, plan done`
