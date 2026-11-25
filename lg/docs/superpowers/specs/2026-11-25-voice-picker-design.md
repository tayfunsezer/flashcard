# Voice picker and listen buttons: design

Date: 2026-11-25. A project-sized change in `lg/` only (new core module, new UI module, a Settings card, buttons in four screens). Approved by the learner in chat ("Yep") after the proposal below. **`fc/` is not touched** (the learner asked for this explicitly).

## Intent

From the idea backlog, the learner's request: "Voice picker for TTS. The user dislikes Chrome's built-in Google Polish voice ... Let the user pick the voice; prefer better macOS voices ... and remember the choice." In this session: "also in pair mode. On top of what you've set." and "all of these changes are exclusive to LG ... Don't do anything for FC."

Why: lg has no audio. Hearing the words is a real gap (see the backlog memory), and the learner dislikes the default online voice. Verified 2026-11-25 on the learner's Mac: after downloading voices in System Settings, Chrome lists Polish voices Ewa (Premium), Ewa (Enhanced), Krzysztof (Enhanced), Zosia (Enhanced), the standard ones, and the online "Google polski".

## Goals

1. Speak text in the **language being learned** (`ctx.langTarget`) with a chosen voice. Never speak the translation language.
2. **Automatic voice** by default: the best Polish voice available (Premium, then Enhanced, then standard on-device, then online voices such as Google polski). A choice saved by the learner overrides it while that voice still exists.
3. **Settings → Voice** card: a dropdown (`Automatic (best available)` first, then every voice for the learning language, online ones marked) and a **Test voice** button. The choice is remembered per language.
4. A **Listen** button (text label, no emoji) on the answer side of Cloze, Flashcards and Aspect pairs.
5. **Pair Match**: tapping a tile in the learned language speaks it. Tiles in the translation language are silent. (Revised while building: a match always involves tapping the learned-language tile, which already speaks it, so speaking again on a match would only repeat the word; it was dropped.)

5b. (Added at the learner's request, after the first build.) A Settings checkbox **Read <language> tiles aloud in Pair Match** (`settings.speakMatch`, default on) turns the Pair Match speech off. Nothing else in the app speaks unless the learner presses Listen or Test voice.

5c. (Added at the learner's request.) A **Speed** slider in the Voice card (`settings.speechRate`, 0.5 to 1.5, default 0.85, clamped on load); every spoken text uses it, and releasing the slider speaks the sample. **Test voice** speaks the file's first sentence (`LG.voice.sampleText`) instead of its first item, which may be a single word.

## Non-goals / anti-goals

- No `fc/` changes. No auto-speak on reveal (maybe later). No pitch control (speed was added later, see 5c), no recording, no pre-recorded cloud audio, no network calls of our own.
- Never speak English (the translation side), and never block a game when speech is missing.

## Constraints

- lg hard constraints (classic scripts, IIFE, works from `file://`, no build). New core file in `index.html` **and** `tests/manifest.js` (src + tests). State change: `settings.voices` gets a default in `defaultState` and validation in `withDefaults`, so old saved states and imported progress files load; bump `VERSION` only if a migration is needed (a test proves old states load).
- Calm UI, no emoji in chrome, tokens only, dark mode, phone width. Commits carry **no AI attribution**. Update `README.md`.

## Approaches considered

- **A. Pure core ranking module plus a thin browser wrapper (picked).** `LG.voice` (rank, filter by language, pick) is unit-tested with fake voice lists; `LG.speech` wraps `speechSynthesis` and the button.
- **B. Pre-recorded cloud audio** (one-time batch, files in the repo): heavier, and unneeded now that good local voices work. Kept as the fallback.
- **C. Copy `fc/`'s speak code**: it never picks a voice (the cause of the complaint) and the learner ruled out touching `fc/`.

## Design

### Core: `js/core/voice.js` (`LG.voice`)

Pure; a "voice" is any object with `{ name, lang, localService }`.
- `rank(voice) → 0..3`: Premium in the name = 3, Enhanced = 2, other on-device (`localService`) = 1, online = 0.
- `forLang(voices, lang) → voice[]`: voices whose language matches `lang` by primary subtag, case-insensitive, `-` or `_` accepted (`pl` matches `pl-PL`, `pl_PL`); sorted by rank (high first), then name.
- `pick(voices, lang, savedName) → voice | null`: the saved voice if it is among `forLang`, else the first of `forLang`, else `null`.
- `label(voice) → string`: the name, with ` (online)` appended when `localService` is false.

### State

`settings.voices: { [lang]: voiceName }`, default `{}`, validated in `withDefaults` (an object of strings; anything else becomes `{}`).

### UI wrapper: `js/ui/speech.js` (`LG.speech`)

- `available() → boolean` (`speechSynthesis` exists); `voices() → voice[]` (cached; filled at boot by `preload()` and on `voiceschanged`, because Chrome loads the list asynchronously); `ready(cb)` for screens that draw before the list is there.
- `speak(text, lang)`: cancels any current speech, builds the utterance with `LG.voice.pick(voices, lang, state.settings.voices[lang])`, sets `utterance.voice` and `utterance.lang` from the picked voice; does nothing when there is no voice or no text.
- `button(getText) → element`: a `btn btn-small` labelled **Listen** that speaks `getText()` in `ctx.langTarget`; hidden when speech is unavailable or no voice exists for the language.

### Screens

- **Settings:** a Voice card (below Languages): dropdown, Test voice (speaks the first item's learned text, or a fixed short sample when the file is empty), a line saying which voice Automatic resolves to, and "Saved voice not found, using <name>" when a saved voice is gone. No voice for the language: "No <language> voice found on this device."
- **Cloze:** Listen in the feedback state, speaking the whole `item.target`.
- **Flashcards:** Listen after the flip, speaking `item.target` (whichever side shows it).
- **Aspect pairs:** Listen in the reveal, speaking the pair: `impf, pf extras` (the two verbs, then the extras, no labels).
- **Pair Match:** the rule in Goal 5, speaking via `LG.speech.speak`; rapid taps cancel the previous utterance.

### Tests (first)

- `tests/voice.test.js`: rank order (Premium > Enhanced > plain local > online); `forLang` matches `pl`, `pl-PL`, `pl_PL`, ignores `plxx`/other languages, ordering; `pick` with a saved voice present, saved voice missing (falls back to best), no voices (`null`), empty `savedName`; `label` marks online voices.
- `tests/state.test.js`: `defaultState().settings.voices` is `{}`; an old state without `voices` loads with `{}`; a malformed `voices` (string, array, non-string values) is cleaned; a valid one survives.
- Screens and the wrapper are checked in the browser (real voices on the learner's Mac), both themes, phone width.

## Left to the builder

Exact markup and wording of small labels, CSS for the Voice card, the sample text for Test voice, how screens redraw when the voice list arrives late.

## Open risks

- Chrome exposes voices only after startup, and the first `speak` needs a user gesture; the Listen and tap buttons are gestures, so this is fine, but auto-speak (non-goal) would need care.
- Voice names are per machine: a choice saved here means nothing on another device; `pick` falls back automatically.
