# Polish-Turkish Flashcard App Memory

## Overview
The application is a web-based flashcard system for learning Polish and Turkish vocabulary. It's a single HTML file with embedded CSS and JavaScript, designed to work client-side without a backend server.

## Key Features
- Flashcard study system with flip functionality
- Multiple import methods:
  - Text input (tab-separated)
  - CSV/TSV file import
  - Google Sheets import
  - URL-based sharing (encoded JSON)
- Difficulty marking (Easy, Medium, Hard)
- Filtering options (by difficulty, date, and group)
- Bidirectional learning (Polish→Turkish or Turkish→Polish)
- Dark/light theme toggle
- Data persistence using localStorage
- Export functionality (JSON and CSV)

## Technical Implementation
- Pure vanilla JavaScript without frameworks
- CSS with custom properties for theming
- Responsive design
- Client-side data storage using localStorage with in-memory fallback
- URL-based sharing using base64 encoding

## Code Structure
- HTML structure with tab-based navigation
- CSS styling with light/dark theme variables
- JavaScript organized in an "app" object with methods for different functionality

## Potential Improvements
1. **Code Organization**: Split into separate HTML/CSS/JS files
2. **Accessibility**: Improve keyboard navigation and screen reader support
3. **Mobile Experience**: Enhance touch interactions and responsive design
4. **Learning Algorithm**: Implement spaced repetition system
5. **Data Validation**: Add better error handling for imports
6. **UI Enhancements**: Add animations, progress tracking
7. **Performance**: Optimize for large datasets
8. **Offline Support**: Add service worker for PWA functionality
9. **Additional Features**: Audio pronunciation, example sentences, image associations
10. **Testing**: Add automated tests

## Current Limitations
- All data stored in client browser (localStorage limit ~5MB)
- No user accounts or cloud sync
- Limited error handling for edge cases
- No proper build/bundling system