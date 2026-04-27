# Technology Stack

## Languages
- HTML5 — app shell and markup
- CSS3 — styling, custom properties, animations
- JavaScript (ES2017+) — application logic; uses async/await, optional chaining (`?.`), spread, destructuring, arrow functions

## Runtime Environment
- Browser-only; no Node.js runtime required
- No build step, no bundler, no transpiler
- Tested in modern browsers (Chrome, Firefox, Safari, Edge)

## Dependencies
- None. Zero external libraries or frameworks.
- Web APIs used:
  - `localStorage` — persistence (with try/catch fallback)
  - `TextDecoder` — UTF-8 decoding of uploaded file buffers
  - `FileReader` / `ArrayBuffer` — file upload handling
  - `SpeechSynthesisUtterance` / `window.speechSynthesis` — text-to-speech
  - `btoa` / `atob` — Base64 encoding/decoding for URL sharing
  - `URLSearchParams` / `window.location` — URL parameter reading
  - `document.execCommand('copy')` — clipboard copy (legacy fallback)

## File Serving
- Can be opened directly as a local file (`file://`) or served from any static HTTP server
- No CORS requirements; all assets are local

## Development Commands
- No build commands needed
- Open `index.html` in a browser to run
- For local HTTP serving (optional):
  ```bash
  # Python
  python3 -m http.server 8080

  # Node.js (npx)
  npx serve .
  ```

## Testing / Automation
- `.playwright-mcp/` directory present — Playwright MCP integration available for browser automation and end-to-end testing

## Browser Compatibility Requirements
- ES2017+ (async/await) — excludes IE11
- CSS custom properties — excludes IE11
- `TextDecoder` API — excludes IE11
- `SpeechSynthesis` API — optional feature, degrades gracefully if unavailable

## Data Format
Card object schema:
```json
{
  "pol": "string",
  "tur": "string",
  "difficulty": "unmarked | easy | medium | hard",
  "date": "DD-MM-YYYY (optional)",
  "groups": ["string"] 
}
```

localStorage key: `flashcard-data` (JSON array of cards), `flashcard-theme` (string).
