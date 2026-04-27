# Product Overview

## Project Purpose
Polish-Turkish Flashcard Learner is a browser-based, zero-dependency vocabulary study tool for learning Polish-Turkish word pairs. It runs entirely client-side with no backend or build step required.

## Value Proposition
- Instant setup: open index.html in any browser, no installation needed
- Persistent progress via localStorage with graceful fallback
- Shareable word sets via URL encoding (Base64 JSON)
- Multiple study modes: flashcard review and quiz

## Key Features

### Study Mode
- Flip-card interface showing Polish or Turkish side
- Bidirectional study: Polish→Turkish or Turkish→Polish toggle
- Difficulty marking per card: Easy / Medium / Hard / Unmarked
- Filter cards by difficulty, date range, and group tags
- Shuffle and reset deck controls
- Text-to-speech (Web Speech API) with auto-speak on flip option
- Progress bar and card counter

### Quiz Mode
- Multiple Choice and True/False question types
- Configurable question count and randomization
- Per-question difficulty and group filters with date range
- Score tracking, missed questions review, saved-for-later bookmarking
- Re-quiz missed or saved questions
- External quiz helper: paste arbitrary JSON → generate shareable Base64 URL

### Import Options
- Text Import: paste tab-separated lines directly
- File Import: upload CSV / TSV / TXT files (auto-detects delimiter: tab, comma, semicolon)
- URL Import: encode a JSON word list into a shareable URL; auto-loads on page open

### Data Management
- Export to JSON or CSV
- localStorage persistence with in-memory fallback
- IGNORE column support to skip rows during import

## Target Users
- Language learners studying Polish-Turkish vocabulary
- Teachers creating shareable word-set URLs for students
- Self-study users who want a lightweight, offline-capable tool

## Use Cases
- Daily vocabulary review sessions
- Pre-exam drilling with difficulty-based filtering
- Sharing curated word lists via URL with classmates
- Importing existing vocabulary spreadsheets (CSV/TSV)
