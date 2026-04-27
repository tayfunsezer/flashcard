# Development Guidelines

## Code Quality Standards

### Object Literal Module Pattern
Both modules are plain object literals assigned to `const` globals. This is the canonical pattern for this codebase — do not introduce classes, ES modules (`import`/`export`), or IIFE wrappers.

```js
// Correct
const app = {
    state: ...,
    init() { ... },
    helperMethod() { ... }
};

// Wrong — do not use
class App { ... }
export default { ... }
```

### Method Definition Style
- `app` uses ES6 shorthand methods: `init() { }`, `flipCard() { }`
- `quiz` uses ES5 function expressions: `init: function() { }`, `startQuiz: function() { }`
- When extending either module, match the existing style of that file

### State Ownership
- `app` owns the card data: `app.cards`, `app.filtered`, `app.index`, `app.direction`, `app.flipped`, `app.filters`
- `quiz` owns quiz runtime state under `quiz.state.*` (nested object)
- `quiz` reads `app.cards` directly — this cross-module dependency is intentional and expected
- Never duplicate card data into quiz state; always reference `app.cards`

### Private Helper Naming
Internal helpers that should not be called from HTML are prefixed with `_`:
```js
_getCheckedGroups(listId) { ... }
_updateGroupSummary(listId, summaryId) { ... }
_getCheckedQuizGroups() { ... }
_updateQuizGroupSummary() { ... }
```
Follow this convention for any new internal helpers.

---

## Structural Conventions

### DOM Access Pattern
Read DOM values at the moment they are needed (lazy reads), not cached at init time:
```js
// Correct — read at call time
startQuiz: function() {
    this.state.settings.type = document.getElementById('quizType').value;
    this.state.settings.length = document.getElementById('quizLength').value;
}

// Avoid — caching DOM refs at init
this.quizTypeEl = document.getElementById('quizType'); // not done here
```

### Event Listener Registration
- Complex/dynamic listeners: registered in `setupEventListeners()` or `init()` via `addEventListener`
- Simple one-off actions in HTML: `onclick="app.method()"` or `onclick="quiz.method()"` inline attributes
- Always use `this.method.bind(this)` when passing quiz methods as callbacks to `addEventListener`

```js
document.getElementById('startQuizBtn').addEventListener('click', this.startQuiz.bind(this));
```

### localStorage Access
Always wrap localStorage in try/catch. Fall back to `app.inMemoryStorage`:
```js
try {
    localStorage.setItem('flashcard-data', json);
} catch (e) {
    this.inMemoryStorage.data = json;
}
```

### Async Pattern
Use `async/await` with try/catch for file operations:
```js
async importExcel() {
    try {
        const buffer = await file.arrayBuffer();
        // ...
    } catch (error) {
        console.error('CSV import error:', error);
        this.showMessage('excelMsg', 'Error: ' + error.message, 'error');
    }
}
```

---

## Naming Conventions

| Context | Convention | Example |
|---|---|---|
| Methods | camelCase verbs | `flipCard`, `applyFilters`, `generateUrl` |
| Private helpers | `_` prefix + camelCase | `_getCheckedGroups`, `_updateGroupSummary` |
| State properties | camelCase nouns | `currentQuestionIndex`, `quizInProgress` |
| DOM element IDs | camelCase | `filterDateFromPicker`, `quizFilterGroupList` |
| CSS classes | kebab-case | `quiz-option`, `group-multiselect`, `btn-primary` |
| CSS utility classes | pattern-value | `gap-8`, `mb-15`, `rounded-4`, `text-sm` |

---

## UI & Feedback Patterns

### User Messages
Use `app.showMessage(elementId, message, type)` for all user-facing feedback. Auto-clears after 3 seconds. Types: `'success'`, `'error'`, `'info'`.
```js
this.showMessage('textMsg', `✓ Imported ${pairs.length} pairs`, 'success');
this.showMessage('excelMsg', 'No file selected', 'error');
```

### Show/Hide Sections
Toggle visibility with `.style.display`:
```js
document.getElementById('quizSetup').style.display = 'none';
document.getElementById('quizQuestion').style.display = 'block';
```
Do not use CSS class toggling for section visibility — inline style is the established pattern.

### Progress Bars
Update both the text counter and the fill width together:
```js
document.getElementById('cardCounter').textContent = `Card ${current} / ${total}`;
document.getElementById('progressFill').style.width = total > 0 ? (current / total * 100) + '%' : '0%';
```

### Tab Switching
Use `app.switchTab(tabName)` to programmatically switch tabs. After import operations, always redirect to `'study'` tab:
```js
this.switchTab('study');
```

---

## Data Patterns

### Card Object Schema
Always construct card objects with this exact shape:
```js
const card = { pol: '...', tur: '...', difficulty: 'unmarked' };
if (date) card.date = date;           // optional, DD-MM-YYYY or YYYY-MM-DD
if (groups) card.groups = ['...'];    // optional, array of strings
```
Never add extra properties to card objects.

### Date Parsing
Use `app.parseDate(dateStr)` for all date comparisons. It handles both `YYYY-MM-DD` (HTML date input) and `DD-MM-YYYY` (import format):
```js
const cardDate = card.date ? app.parseDate(card.date) : null;
const filterFrom = filterDateFromStr ? app.parseDate(filterDateFromStr) : null;
if (filterFrom && cardDate < filterFrom) return false;
```

### Group Handling
Cards may have `groups` (array) or legacy `group` (string). Always normalize when reading:
```js
const cardGroups = card.groups || (card.group ? [card.group] : []);
```

### IGNORE Column
During import, skip rows where the IGNORE column value (case-insensitive) is `'OK'` or `'YES'`:
```js
const ignoreVal = cells[ignoreIdx].trim().toUpperCase();
if (ignoreVal === 'OK' || ignoreVal === 'YES') continue;
```

### Fisher-Yates Shuffle
Use this exact implementation for all shuffle operations (used in both `app.shuffle()` and `quiz.shuffleArray()`):
```js
for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
}
```

---

## Inter-Module Communication

### app → quiz
`app.updateUI()` dispatches a custom event after card data changes:
```js
document.dispatchEvent(new CustomEvent('flashcardsUpdated'));
```
`quiz.init()` listens for this event to refresh its group filter and reset state.

### quiz → app
`quiz` calls `app.updateCardDifficulty()` after answering a question (if the method exists):
```js
if (app.updateCardDifficulty && typeof app.updateCardDifficulty === 'function') {
    app.updateCardDifficulty(currentQuestion.originalCard, isCorrect ? 'easy' : 'hard');
}
```
Always guard cross-module calls with existence checks.

### Initialization Order
`quiz.js` is loaded before `app.js` in the HTML. `quiz.init()` is called inside a `DOMContentLoaded` + `setTimeout` wrapper that waits for `app` to be defined:
```js
setTimeout(() => {
    if (typeof app !== 'undefined' && app) {
        quiz.init();
    }
}, 100);
```
`app.init()` is called directly in `DOMContentLoaded` without delay.

---

## URL Encoding Patterns

### Flashcard word list (app)
Encodes JSON via `TextEncoder` → `btoa`, stored in URL fragment `#words=`:
```js
const encoded = btoa(binary);
const url = window.location.origin + window.location.pathname + '#words=' + encodeURIComponent(encoded);
```

### External quiz data (quiz)
Uses `btoa(unescape(encodeURIComponent(json)))` for Unicode safety. Prefers fragment `#qData=` for large payloads (>1.5KB), falls back to query param `?qCont=`:
```js
const base64 = btoa(unescape(encodeURIComponent(jsonInput)));
```

---

## CSS Conventions

### Design Tokens
All colors, backgrounds, and borders use CSS custom properties. Never hardcode color values:
```css
/* Correct */
border-color: var(--primary);
background: var(--surface);

/* Wrong */
border-color: #3b82f6;
```

### Dark Mode
Apply dark-mode overrides only via `html[data-theme="dark"]` selector. Toggle is set by `app.applyTheme()` using `document.documentElement.setAttribute('data-theme', 'dark')`.

### Utility Classes
The project has a Tailwind-inspired utility class system in `styles.css`. Use existing utilities before writing new component styles:
- Spacing: `.mb-*`, `.mt-*`, `.p-*`, `.gap-*`
- Layout: `.flex`, `.flex-wrap`, `.items-center`, `.w-full`
- Typography: `.text-sm`, `.text-xs`, `.font-semibold`, `.font-mono`
- Borders: `.border`, `.rounded-4`, `.rounded-8`

### Component Styles
New component styles go in `styles.css`. `quiz-styles.css` is a legacy file; prefer adding quiz-related styles to `styles.css` to avoid duplication.
