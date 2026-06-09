# Marked Words Feature Plan

## Overview
Add a "mark word" button across all 3 study modes. Marked words accumulate in a shared set (persisted in localStorage), visible and exportable from anywhere.

## Export Format (canonical quiz JSON)
```json
[
  {
    "question": "Polish word",
    "options": ["Turkish answer", "Turkish answer", "Turkish answer", "Turkish answer"],
    "correctIndex": 0
  }
]
```
When no distractors are available, the correct answer fills all 4 option slots.

---

## Step 1 — Core infrastructure + Leitner mark button

**Files: `app.js`, `index.html`**

### app.js
- Add `markedWords: new Set()` (stores card keys `pol::tur`) to `app`
- Add `app._markKey(card)` — returns `card.pol + '::' + card.tur`
- Add `app.saveMarked()` — persists to `localStorage('flashcard-marked')`
- Add `app.loadMarked()` — loads on init; stale keys (cards no longer in deck) are harmless, they just never match
- Add `app.toggleMark(card)` — adds/removes from set, calls `saveMarked()`
- Add `app.isMarked(card)` — returns bool
- Call `loadMarked()` inside `app.init()`
- `clearAll()`: add `this.markedWords.clear()` + `this.saveMarked()` — `localStorage.clear()` already wipes storage but the in-memory set must also be cleared

### index.html
- In **Leitner session card area**: add a 🏷️ Mark button in the `button-group` alongside End Session
- `leitner._renderCard()`: update mark button text — `🔖 Marked` when marked, `🏷️ Mark` when not

---

## Step 2 — Marked Words panel + export

**Files: `index.html`, `app.js`**

### app.js
- Add `app.renderMarkedList()` — rebuilds the panel list from `markedWords` set, matching keys back to `app.cards` for display
- Add `app.exportMarked()` — builds canonical JSON (4 options, fill with correct answer if no distractors) and triggers download
- Add `app.clearMarked()` — clears set, saves, re-renders list
- Call `renderMarkedList()` from `toggleMark()` and from `loadMarked()` on init

### index.html
- Add a `<div class="section">` inside the **Settings tab** titled "🔖 Marked Words"
- Shows: `<span id="markedCount">0</span> words`, scrollable word list `<div id="markedList">`, Export button → `app.exportMarked()`, Clear button → `app.clearMarked()`

### Testable after this step
Full loop: mark in Leitner → see count + list in Settings → export JSON

---

## Step 3 — Quiz mark button

**Files: `quiz.js`, `index.html`**

### index.html
- Add a `🏷️ Mark` button (`id="quizMarkBtn"`) in the quiz question `button-group`, near Save for Later

### quiz.js
- In `showQuestion()`: show/hide and update text of `quizMarkBtn` based on `app.isMarked(currentQuestion.originalCard)`; hide entirely if `originalCard` is null (external quiz)
- In `restoreFeedback()`: same mark button state update — this runs instead of the normal path when navigating back to an already-answered question
- Add click handler in `init()`: `app.toggleMark(currentQuestion.originalCard)`, then update button text, then `app.renderMarkedList()`

---

## Step 4 — Flashcard mark button

**Files: `app.js`, `index.html`**

### index.html
- Add a `🏷️ Mark` button (`id="flashcardMarkBtn"`) in the flashcard `button-group` (alongside Shuffle / Reset / Clear)

### app.js
- Add click listener in `setupEventListeners()`: `app.toggleMark(app.filtered[app.index])`, update button, call `renderMarkedList()`
- In `updateCardDisplay()`: update `flashcardMarkBtn` text to reflect `isMarked(app.filtered[app.index])`

---

## Notes
- Card identity key: `card.pol + '::' + card.tur`
- `clearAll()` clears marked words (in-memory set + localStorage + re-render panel)
- Stale keys in `markedWords` (cards deleted from deck) are harmless — they just never match `isMarked()`
- Mark button visual: `🔖 Marked` when marked, `🏷️ Mark` when not — intentionally different from quiz's "Save for Later" (also 🔖) to avoid confusion
- `exportMarked()` always produces valid 4-option JSON: fills all slots with the correct answer when no distractors exist
- `renderMarkedList()` is called from: `toggleMark()`, `loadMarked()` (init), `clearMarked()`, and after each mode's mark button click
