# Project Structure

## Directory Layout

```
flashcard/
├── index.html          # Single-page app shell; all tabs and UI markup
├── app.js              # Main application object (flashcard study logic)
├── quiz.js             # Quiz module object (quiz logic, Base64 helper)
├── styles.css          # Global styles + utility classes + component styles
├── quiz-styles.css     # Quiz-specific component styles (partially duplicated in styles.css)
├── .amazonq/
│   └── rules/
│       └── memory-bank/   # Amazon Q memory bank documentation
├── .playwright-mcp/    # Playwright MCP configuration (testing/automation)
├── llm/                # LLM-related assets or prompts
├── .copilot-instructions
└── .gitignore
```

## Core Components

### index.html
Single HTML file acting as the app shell. Contains:
- Tab navigation (Study, Quiz, Text Import, File Import, URL Import, Settings)
- All static markup for every tab panel
- Inline `onclick` handlers calling `app.*` and `quiz.*` methods
- Script tags loading quiz.js then app.js (order matters: quiz must be defined first)

### app.js — `app` object
The central application singleton. Responsibilities:
- State: `cards[]`, `filtered[]`, `index`, `direction`, `flipped`, `filters`, `themeMode`
- Lifecycle: `init()` → `initTheme()`, `setupTabs()`, `loadData()`, `loadFromUrl()`, `setupEventListeners()`, `updateUI()`
- Import pipeline: `importText()`, `importExcel()`, `parseCSV()`
- URL sharing: `generateUrl()`, `loadFromUrl()`
- Study controls: `flipCard()`, `nextCard()`, `prevCard()`, `shuffle()`, `markDifficulty()`, `resetProgress()`, `clearAll()`
- Filtering: `applyFilters()`, `resetFilters()`, group multiselect rendering
- Persistence: `saveData()`, `loadData()` via localStorage with `inMemoryStorage` fallback
- Export: `exportJSON()`, `exportCSV()`
- Utilities: `showMessage()`, `switchTab()`, `speakCurrent()`

### quiz.js — `quiz` object
Self-contained quiz module. Responsibilities:
- Quiz state: questions array, current index, score, saved-for-later list
- Setup: reads filter settings from DOM (difficulty checkboxes, group multiselect, date pickers, quiz type, direction, length)
- Question generation: multiple-choice (random distractors from card pool) and true/false
- UI rendering: `renderQuestion()`, `renderResults()`, `renderMissedQuestions()`
- Navigation: next/prev question, reset, retry, re-quiz missed/saved
- External helper: `generateBase64()`, `copyBase64Url()`, `copyExampleJson()`

### styles.css
- CSS custom properties (design tokens) for light and dark themes under `:root` and `html[data-theme="dark"]`
- Component styles: `.flashcard`, `.tab-btn`, `.button` variants, `.filter-bar`, `.stats`, `.section`, `.quiz-*`
- Utility class system (Tailwind-inspired): `.flex`, `.gap-*`, `.mb-*`, `.mt-*`, `.p-*`, `.rounded-*`, `.text-*`, `.font-*`, `.w-full`, etc.
- Group multiselect dropdown component styles

### quiz-styles.css
Subset of quiz component styles. Loaded separately; some rules overlap with styles.css. Kept for modularity.

## Architectural Patterns

- **Single-page app without a framework**: Pure vanilla JS, no npm, no bundler
- **Module-as-object pattern**: `app` and `quiz` are plain object literals with methods, acting as namespaced singletons
- **DOM as source of truth for UI state**: filter checkboxes, select values, and date inputs are read directly from the DOM when needed rather than kept in a separate reactive store
- **localStorage with in-memory fallback**: all persistence goes through a try/catch wrapper; `inMemoryStorage` object mirrors the localStorage API for environments where storage is blocked
- **CSS custom properties for theming**: a single `data-theme="dark"` attribute on `<html>` switches the entire palette via variable overrides
- **Inline event handlers + addEventListener mix**: simple actions use `onclick="app.method()"` in HTML; complex or dynamic listeners use `addEventListener` in JS
