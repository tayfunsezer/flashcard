/**
 * Quiz Module for Polish-Turkish Flashcard App
 * Handles quiz generation, scoring, and user interaction
 */

const quiz = {
    // Quiz state
    state: {
        questions: [],
        currentQuestionIndex: 0,
        score: 0,
        selectedOption: null,
        quizInProgress: false,
        missedQuestions: [],
        savedForLater: [],
        excludedWords: new Set(),
        settings: {
            type: 'multiple-choice',
            direction: 'pol-tur',
            length: 10,
            filters: {
                easy: true,
                medium: true,
                hard: true,
                unmarked: true,
                noDateOnly: false,
                noGroupOnly: false,
                group: '',
                groups: [],
                dateFrom: '',
                dateTo: ''
            }
        }
    },

    // Initialize the quiz module
    init: function() {
        console.log("Quiz module initializing...");
        
        // Set up event listeners (always, even for external data)
        document.getElementById('startQuizBtn').addEventListener('click', this.startQuiz.bind(this));
        document.getElementById('nextQuestionBtn').addEventListener('click', this.nextQuestion.bind(this));
        document.getElementById('prevQuestionBtn').addEventListener('click', this.prevQuestion.bind(this));
        document.getElementById('retryQuizBtn').addEventListener('click', this.retryQuiz.bind(this));
        document.getElementById('requizMissedBtn').addEventListener('click', this.requizMissed.bind(this));
        document.getElementById('requizSavedBtn').addEventListener('click', this.requizSaved.bind(this));
        document.getElementById('newQuizBtn').addEventListener('click', this.resetQuiz.bind(this));
        document.getElementById('resetQuizBtn').addEventListener('click', this.resetQuiz.bind(this));
        document.getElementById('endQuizEarlyBtn')?.addEventListener('click', this.showResults.bind(this));
        document.getElementById('exportMissedBtn')?.addEventListener('click', this.exportMissed.bind(this));
        document.getElementById('exportSavedBtn')?.addEventListener('click', this.exportSaved.bind(this));
        document.getElementById('saveForLaterBtn').addEventListener('click', this.saveForLater.bind(this));
        document.getElementById('excludeFileBtn')?.addEventListener('click', () => document.getElementById('excludeFileInput').click());
        document.getElementById('excludeFileInput')?.addEventListener('change', (e) => this.loadExcludeFile(e));
        document.getElementById('excludeFileInput')?.addEventListener('change', (e) => this.loadExcludeFile(e));
        document.getElementById('excludeApplyBtn')?.addEventListener('click', () => this.applyExcludeText());
        let _excludeDebounce;
        document.getElementById('excludeTextInput')?.addEventListener('input', () => {
            clearTimeout(_excludeDebounce);
            _excludeDebounce = setTimeout(() => this.applyExcludeText(), 600);
        });
        document.getElementById('excludeClearBtn')?.addEventListener('click', () => this.clearExcluded());
        
        // Add tab switching handler for the quiz tab
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                if (e.target.getAttribute('data-tab') === 'quiz') {
                    // When switching to quiz tab, check for cards
                    setTimeout(() => this.checkForCards(), 100);
                }
            });
        });
        
        // Check for external quiz data in URL fragment identifier (preferred) or query parameter
        let jsonData = null;
        
        // First try the fragment identifier (larger data support)
        const fragmentHash = window.location.hash;
        if (fragmentHash && fragmentHash.startsWith('#qData=')) {
            const fragmentData = fragmentHash.substring('#qData='.length);
            if (fragmentData) {
                try {
                    // Decode Base64 with Unicode support
                    const jsonString = decodeURIComponent(escape(atob(fragmentData)));
                    jsonData = JSON.parse(jsonString);
                    console.log("Found quiz data in URL fragment");
                } catch (e) {
                    console.error("Error parsing fragment identifier quiz data:", e);
                    alert("Error parsing quiz data from URL fragment. Trying query parameter or proceeding with normal quiz.");
                }
            }
        }
        
        // If fragment didn't work, try the query parameter (backward compatibility)
        if (!jsonData) {
            const urlParams = new URLSearchParams(window.location.search);
            const dataParam = urlParams.get('qCont');
            if (dataParam) {
                try {
                    // Decode Base64 with Unicode support
                    const jsonString = decodeURIComponent(escape(atob(dataParam)));
                    jsonData = JSON.parse(jsonString);
                    console.log("Found quiz data in URL query parameter");
                } catch (e) {
                    console.error("Error parsing query parameter quiz data:", e);
                    alert("Error parsing quiz data from URL. Proceeding with normal quiz.");
                }
            }
        }
        
        // If we have valid data from either source, start external quiz
        if (jsonData && this.validateExternalData(jsonData)) {
            this.setExternalQuestions(jsonData);
            this.startQuizFromExternal();
            return; // Skip normal initialization
        } else if (jsonData) {
            // We had data but it was invalid
            console.warn("Invalid external quiz data");
            alert("Invalid quiz data in URL. Proceeding with normal quiz.");
        }
        
        // Initialize the quiz filter group dropdown with available groups
        this.populateGroupFilter();
        
        // Check if we have cards to enable the quiz
        this.checkForCards();
        
        // Listen for changes in the flashcards data
        document.addEventListener('flashcardsUpdated', () => {
            console.log("Flashcards updated, updating quiz...");
            this.checkForCards();
            this.populateGroupFilter();
            // Reset quiz when flashcards are updated
            this.resetQuiz();
        });
        
        console.log("Quiz module initialized");
    },

    // Validate external quiz data structure
    validateExternalData: function(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return false;
        }
        for (const item of data) {
            if (typeof item.question !== 'string' || item.question.trim() === '') {
                return false;
            }
            if (!Array.isArray(item.options) || item.options.length !== 4) {
                return false;
            }
            for (const option of item.options) {
                if (typeof option !== 'string' || option.trim() === '') {
                    return false;
                }
            }
            if (typeof item.correctIndex !== 'number' || item.correctIndex < 0 || item.correctIndex > 3) {
                return false;
            }
        }
        return true;
    },

    // Set questions from external data
    setExternalQuestions: function(data) {
        this.state.questions = data.map(item => ({
            question: item.question,
            correctAnswer: item.options[item.correctIndex],
            options: [...item.options], // copy array
            userAnswer: null,
            isCorrect: null,
            originalCard: null // no original card for external
        }));
        console.log("Set external questions:", this.state.questions.length);
    },

    // Set tab visibility - if externalOnly is true, hide all tabs except Quiz
    setTabsVisibility: function(externalOnly) {
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        tabButtons.forEach(button => {
            const isQuizTab = button.getAttribute('data-tab') === 'quiz';
            if (externalOnly) {
                button.style.display = isQuizTab ? 'block' : 'none';
            } else {
                button.style.display = 'block';
            }
        });
    },


    // Start quiz from external data
    startQuizFromExternal: function() {
        console.log("Starting quiz from external data...");
        
        // Reset quiz state
        this.state.currentQuestionIndex = 0;
        this.state.score = 0;
        this.state.selectedOption = null;
        this.state.quizInProgress = true;
        this.state.missedQuestions = [];
        
        // Hide other tabs, show only Quiz
        this.setTabsVisibility(true);
        
        // Click Quiz tab to activate it
        const quizTab = document.querySelector('[data-tab="quiz"]');
        if (quizTab) {
            quizTab.click();
        }
        
        // Check for cards to show quiz content (even if no flashcards)
        this.checkForCards();
        
        // Show the first question
        this.showQuestion();
        
        // Hide setup, show question
        document.getElementById('quizSetup').style.display = 'none';
        document.getElementById('quizQuestion').style.display = 'block';
        document.getElementById('quizResults').style.display = 'none';
    },

    // Check if there are cards available for quiz
    checkForCards: function() {
        console.log("Checking for cards...");
        console.log("App cards:", app.cards);
        console.log("Quiz in progress:", this.state.quizInProgress);
        
        const hasCards = app && app.cards && app.cards.length > 0;
        const quizActive = this.state.quizInProgress || this.state.questions.length > 0;
        
        console.log("Has cards:", hasCards);
        console.log("Quiz active:", quizActive);
        
        const quizContent = document.getElementById('quizContent');
        const emptyMessage = document.getElementById('emptyQuizMessage');
        
        if (quizContent) {
            // Always show quizContent so the helper is always accessible
            quizContent.style.display = 'block';
            
            // Show/hide the empty message based on whether there are cards
            if (emptyMessage) {
                emptyMessage.style.display = hasCards ? 'none' : 'block';
            }
        } else {
            console.error("Quiz elements not found in DOM");
        }
    },

    // Populate the group filter dropdown
    populateGroupFilter: function() {
        if (!app || !app.cards || app.cards.length === 0) return;
        
        const list = document.getElementById('quizFilterGroupList');
        if (!list) return;
        
        const groups = [...new Set(app.cards
            .flatMap(card => {
                if (card.groups && Array.isArray(card.groups)) return card.groups;
                if (card.group && card.group.trim()) return [card.group.trim()];
                return [];
            }))].sort((a, b) => a.localeCompare(b));
        
        const checked = Array.from(list.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
        list.innerHTML = '<input class="group-multiselect-search" placeholder="Search..." type="text"><div class="group-multiselect-items" id="quizFilterGroupItems"></div>';
        const search = list.querySelector('.group-multiselect-search');
        const items = list.querySelector('.group-multiselect-items');
        search.addEventListener('input', () => {
            const q = search.value.toLowerCase();
            items.querySelectorAll('label').forEach(lbl => {
                lbl.style.display = lbl.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        });
        search.addEventListener('click', e => e.stopPropagation());
        search.addEventListener('keydown', e => e.stopPropagation());
        groups.forEach(group => {
            const lbl = document.createElement('label');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = group;
            cb.checked = checked.includes(group);
            cb.addEventListener('change', () => this._updateQuizGroupSummary());
            lbl.appendChild(cb);
            lbl.appendChild(document.createTextNode(group));
            items.appendChild(lbl);
        });
        this._updateQuizGroupSummary();
    },

    _getCheckedQuizGroups: function() {
        const list = document.getElementById('quizFilterGroupList');
        if (!list) return [];
        return Array.from(list.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
    },

    _updateQuizGroupSummary: function() {
        const selected = this._getCheckedQuizGroups();
        const summary = document.getElementById('quizFilterGroupSummary');
        if (summary) summary.textContent = selected.length === 0 ? '-- All --' : selected.join(', ');
    },

    // Start a new quiz
    startQuiz: function() {
        console.log("Starting quiz...");
        
        // Get quiz settings
        this.state.settings.type = document.getElementById('quizType').value;
        this.state.settings.direction = document.getElementById('quizDirection').value;
        this.state.settings.length = document.getElementById('quizLength').value;
        this.state.settings.randomize = document.getElementById('quizRandomize').checked;
        
        // Get filters
        const filterDateFromStr = document.getElementById('quizFilterDateFromPicker').value.trim();
        const filterDateToStr = document.getElementById('quizFilterDateToPicker').value.trim();
        this.state.settings.filters = {
            easy: document.getElementById('quizChkEasy').checked,
            medium: document.getElementById('quizChkMedium').checked,
            hard: document.getElementById('quizChkHard').checked,
            unmarked: document.getElementById('quizChkUnmarked').checked,
            noDateOnly: document.getElementById('quizFilterNoDateOnly').checked,
            noGroupOnly: document.getElementById('quizFilterNoGroupOnly').checked,
            groups: this._getCheckedQuizGroups(),
            dateFrom: filterDateFromStr,
            dateTo: filterDateToStr
        };
        
        console.log("Quiz settings:", this.state.settings);
        
        // Generate questions
        this.generateQuestions();
        
        if (this.state.questions.length === 0) {
            alert('No cards match your filter criteria. Please adjust your filters and try again.');
            return;
        }
        
        // Reset quiz state
        this.state.currentQuestionIndex = 0;
        this.state.score = 0;
        this.state.selectedOption = null;
        this.state.quizInProgress = true;
        this.state.missedQuestions = [];
        
        // Show the first question
        this.showQuestion();
        
        // Hide setup, show question
        document.getElementById('quizSetup').style.display = 'none';
        document.getElementById('quizQuestion').style.display = 'block';
        document.getElementById('quizResults').style.display = 'none';
    },

    // Parse and apply excluded words from text (pipe-separated or JSON)
    applyExcludeText: function() {
        const raw = document.getElementById('excludeTextInput').value.trim();
        if (!raw) return;
        this._parseAndAddExclusions(raw);
    },

    loadExcludeFile: function(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        let pending = files.length;
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                this._parseAndAddExclusions(ev.target.result.trim());
                if (--pending === 0) e.target.value = '';
            };
            reader.readAsText(file);
        });
    },

    _parseAndAddExclusions: function(raw) {
        let words = [];
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                parsed.forEach(item => {
                    if (typeof item === 'string') words.push(item);
                    else if (item.question) words.push(item.question);
                });
            }
        } catch (e) {
            words = raw.split('|').map(w => w.trim()).filter(w => w);
        }
        words.forEach(w => this.state.excludedWords.add(w.toLowerCase().trim()));
        this._updateExcludeStatus();
    },

    clearExcluded: function() {
        this.state.excludedWords.clear();
        document.getElementById('excludeTextInput').value = '';
        this._updateExcludeStatus();
    },

    _updateExcludeStatus: function() {
        const count = this.state.excludedWords.size;
        const el = document.getElementById('excludeStatus');
        if (el) el.textContent = count > 0 ? `${count} word${count !== 1 ? 's' : ''} excluded` : '';
    },

    // Generate quiz questions based on settings
    generateQuestions: function() {
        console.log("Generating quiz questions...");
        
        // Filter cards based on settings
        let filteredCards = app.cards.filter(card => {
            // Filter by difficulty
            if (card.difficulty === 'easy' && !this.state.settings.filters.easy) return false;
            if (card.difficulty === 'medium' && !this.state.settings.filters.medium) return false;
            if (card.difficulty === 'hard' && !this.state.settings.filters.hard) return false;
            if (!card.difficulty && !this.state.settings.filters.unmarked) return false;
            
            // Filter by group if specified
            if (this.state.settings.filters.groups && this.state.settings.filters.groups.length > 0) {
                const cardGroups = card.groups || (card.group ? [card.group] : []);
                if (!this.state.settings.filters.groups.some(g => cardGroups.includes(g))) {
                    return false;
                }
            }
            
            // Filter by date criteria
            if (this.state.settings.filters.noDateOnly) {
                if (card.date) return false;
            } else if (this.state.settings.filters.dateFrom || this.state.settings.filters.dateTo) {
                const cardDate = card.date ? app.parseDate(card.date) : null;
                if (!cardDate) return false;
                const filterDateFrom = this.state.settings.filters.dateFrom ? app.parseDate(this.state.settings.filters.dateFrom) : null;
                const filterDateTo = this.state.settings.filters.dateTo ? app.parseDate(this.state.settings.filters.dateTo) : null;
                if (filterDateFrom && cardDate < filterDateFrom) return false;
                if (filterDateTo && cardDate > filterDateTo) return false;
            }

            if (this.state.settings.filters.noGroupOnly) {
                const cardGroups = card.groups || (card.group ? [card.group.trim()] : []);
                if (cardGroups.length > 0) return false;
            }

            // Filter excluded words — match only the question-side field based on direction
            if (this.state.excludedWords.size > 0) {
                const isPolToTur = this.state.settings.direction === 'pol-tur';
                const questionField = (isPolToTur ? (card.pol || '') : (card.tur || '')).toLowerCase().trim();
                if (this.state.excludedWords.has(questionField)) return false;
            }
            
            return true;
        });
        
        console.log("Filtered cards:", filteredCards.length);
        
        // Shuffle the cards if randomize is enabled
        if (this.state.settings.randomize !== false) {
            filteredCards = this.shuffleArray([...filteredCards]);
        }
        
        // Limit to specified length
        const quizLength = Math.min(parseInt(this.state.settings.length) || filteredCards.length, filteredCards.length);
        
        filteredCards = filteredCards.slice(0, quizLength);
        
        // Create questions
        const isPolToTur = this.state.settings.direction === 'pol-tur';
        const isTrueFalse = this.state.settings.type === 'true-false';

        this.state.questions = filteredCards.map(card => {
            const question = isPolToTur ? card.pol : card.tur;
            const correctAnswer = isPolToTur ? card.tur : card.pol;

            if (isTrueFalse) {
                const showCorrect = Math.random() < 0.5;
                let shownAnswer = correctAnswer;
                if (!showCorrect) {
                    const cardGroups = card.groups || (card.group ? [card.group] : []);
                    const sameGroupCards = app.cards.filter(c => {
                        if (c === card) return false;
                        const cGroups = c.groups || (c.group ? [c.group] : []);
                        return cardGroups.length > 0 && cardGroups.some(g => cGroups.includes(g));
                    });
                    const pool = sameGroupCards.length > 0 ? sameGroupCards : app.cards.filter(c => c !== card);
                    const randomCard = pool[Math.floor(Math.random() * pool.length)];
                    shownAnswer = randomCard ? (isPolToTur ? randomCard.tur : randomCard.pol) : correctAnswer;
                }
                return {
                    question,
                    correctAnswer,
                    shownAnswer,
                    tfCorrect: showCorrect || shownAnswer === correctAnswer,
                    options: ['True', 'False'],
                    userAnswer: null,
                    isCorrect: null,
                    originalCard: card
                };
            }

            let options = [correctAnswer];
            const otherCards = app.cards.filter(c => c !== card);
            const shuffledOtherCards = this.shuffleArray([...otherCards]);
            for (let i = 0; i < Math.min(3, shuffledOtherCards.length); i++) {
                const distractor = isPolToTur ? shuffledOtherCards[i].tur : shuffledOtherCards[i].pol;
                if (!options.includes(distractor)) options.push(distractor);
            }
            options = this.shuffleArray(options);

            return {
                question,
                correctAnswer,
                options,
                userAnswer: null,
                isCorrect: null,
                originalCard: card
            };
        });
        
        console.log("Generated questions:", this.state.questions.length);
    },

    // Recalculate score from scratch based on answered questions
    recalcScore: function() {
        this.state.score = this.state.questions.filter(q => q.isCorrect === true).length;
        this.state.missedQuestions = this.state.questions.filter(q => q.isCorrect === false);
    },

    // Show the current question
    showQuestion: function() {
        const currentQuestion = this.state.questions[this.state.currentQuestionIndex];
        const isTrueFalse = this.state.settings.type === 'true-false';
        const flag = this.state.settings.direction === 'pol-tur' ? '🇵🇱' : '🇹🇷';

        // Update progress
        document.getElementById('quizProgress').textContent =
            `Question ${this.state.currentQuestionIndex + 1} / ${this.state.questions.length}`;
        document.getElementById('quizProgressFill').style.width =
            `${((this.state.currentQuestionIndex + 1) / this.state.questions.length) * 100}%`;
        document.getElementById('quizScore').textContent = this.state.score;

        // Set question text
        if (isTrueFalse) {
            document.getElementById('quizQuestionText').textContent = 'Is this correct?';
            const pairEl = document.getElementById('quizTrueFalsePair');
            pairEl.textContent = `${flag} ${currentQuestion.question}  →  ${currentQuestion.shownAnswer}`;
            pairEl.style.display = 'block';
        } else {
            document.getElementById('quizQuestionText').textContent = `${flag} ${currentQuestion.question}`;
            document.getElementById('quizTrueFalsePair').style.display = 'none';
        }

        // Build options
        const optionsContainer = document.getElementById('quizOptions');
        optionsContainer.innerHTML = '';
        currentQuestion.options.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'quiz-option';
            optionElement.dataset.index = index;

            const optionLetter = document.createElement('span');
            optionLetter.className = 'quiz-option-letter';
            optionLetter.textContent = isTrueFalse ? (option === 'True' ? '✓' : '✗') : String.fromCharCode(65 + index);

            const optionText = document.createElement('span');
            optionText.textContent = option;

            optionElement.appendChild(optionLetter);
            optionElement.appendChild(optionText);
            optionElement.addEventListener('click', () => this.selectOption(index));
            optionsContainer.appendChild(optionElement);
        });

        // Prev button
        document.getElementById('prevQuestionBtn').style.display =
            this.state.currentQuestionIndex > 0 ? 'inline-block' : 'none';

        // Save for Later button state
        const alreadySaved = this.state.savedForLater.some(q => q === currentQuestion);
        const saveBtn = document.getElementById('saveForLaterBtn');
        saveBtn.style.display = 'inline-block';
        saveBtn.textContent = alreadySaved ? '🔖 Saved!' : '🔖 Save for Later';
        saveBtn.disabled = alreadySaved;

        // If already answered, restore feedback state
        if (currentQuestion.userAnswer !== null) {
            this.state.selectedOption = currentQuestion.options.indexOf(currentQuestion.userAnswer);
            this.restoreFeedback(currentQuestion);
        } else {
            this.state.selectedOption = null;
            document.getElementById('quizFeedback').style.display = 'none';
            document.getElementById('nextQuestionBtn').style.display = 'none';
        }
    },

    // Restore feedback for an already-answered question
    restoreFeedback: function(currentQuestion) {
        const isTrueFalse = this.state.settings.type === 'true-false';
        const options = document.querySelectorAll('.quiz-option');
        const isCorrect = currentQuestion.isCorrect;

        options.forEach((option, index) => {
            const isSelectedOption = currentQuestion.options[index] === currentQuestion.userAnswer;
            const isCorrectOption = currentQuestion.options[index] === currentQuestion.correctAnswer;
            if (isCorrectOption) option.classList.add('correct');
            else if (isSelectedOption) option.classList.add('incorrect');
        });

        const feedbackElement = document.getElementById('quizFeedback');
        const correctAnswerText = isTrueFalse
            ? `The pair is ${currentQuestion.tfCorrect ? 'correct ✓' : 'incorrect ✗'}. Correct answer: ${currentQuestion.question} → ${currentQuestion.correctAnswer}`
            : currentQuestion.correctAnswer;
        feedbackElement.innerHTML = isCorrect
            ? `<strong>Correct!</strong> Great job! &nbsp;✅ ${currentQuestion.question} → ${currentQuestion.correctAnswer}`
            : `<strong>Incorrect.</strong> The correct answer is: ${correctAnswerText}`;
        feedbackElement.innerHTML += ` &nbsp;<button class="button btn-secondary" style="font-size:13px;padding:4px 10px;" onclick="quiz.changeAnswer()">✏️ Change Answer</button>`;
        feedbackElement.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
        feedbackElement.style.display = 'block';

        const isLast = this.state.currentQuestionIndex === this.state.questions.length - 1;
        document.getElementById('nextQuestionBtn').style.display = 'inline-block';
        document.getElementById('nextQuestionBtn').textContent = isLast ? 'Finish Quiz' : 'Next →';
    },

    // Allow user to change their answer
    changeAnswer: function() {
        const currentQuestion = this.state.questions[this.state.currentQuestionIndex];
        // Undo previous answer from score
        currentQuestion.userAnswer = null;
        currentQuestion.isCorrect = null;
        this.recalcScore();
        document.getElementById('quizScore').textContent = this.state.score;

        // Reset option styles
        document.querySelectorAll('.quiz-option').forEach(o => {
            o.classList.remove('correct', 'incorrect', 'selected');
        });
        document.getElementById('quizFeedback').style.display = 'none';
        document.getElementById('nextQuestionBtn').style.display = 'none';

        const alreadySaved = this.state.savedForLater.some(q => q === currentQuestion);
        const saveBtn = document.getElementById('saveForLaterBtn');
        saveBtn.style.display = 'inline-block';
        saveBtn.textContent = alreadySaved ? '🔖 Saved!' : '🔖 Save for Later';
        saveBtn.disabled = alreadySaved;

        this.state.selectedOption = null;
    },

    // Handle option selection
    selectOption: function(index) {
        if (this.state.selectedOption !== null) return;

        const currentQuestion = this.state.questions[this.state.currentQuestionIndex];
        const selectedOption = currentQuestion.options[index];
        this.state.selectedOption = index;

        const options = document.querySelectorAll('.quiz-option');
        options.forEach(option => option.classList.remove('selected'));
        options[index].classList.add('selected');

        const isTrueFalse = this.state.settings.type === 'true-false';
        const isCorrect = isTrueFalse
            ? (selectedOption === 'True') === currentQuestion.tfCorrect
            : selectedOption === currentQuestion.correctAnswer;
        currentQuestion.userAnswer = selectedOption;
        currentQuestion.isCorrect = isCorrect;

        this.recalcScore();

        setTimeout(() => this.showFeedback(isCorrect), 300);
    },

    // Show feedback after answering
    showFeedback: function(isCorrect) {
        const currentQuestion = this.state.questions[this.state.currentQuestionIndex];
        const options = document.querySelectorAll('.quiz-option');
        const feedbackElement = document.getElementById('quizFeedback');
        
        // Mark correct and incorrect options
        options.forEach((option, index) => {
            const isSelectedOption = index === this.state.selectedOption;
            const isCorrectOption = currentQuestion.options[index] === currentQuestion.correctAnswer;
            
            if (isCorrectOption) {
                option.classList.add('correct');
            } else if (isSelectedOption) {
                option.classList.add('incorrect');
            }
        });
        
        // Show feedback message
        const isTrueFalse = this.state.settings.type === 'true-false';
        const correctAnswerText = isTrueFalse
            ? `The pair is ${currentQuestion.tfCorrect ? 'correct ✓' : 'incorrect ✗'}. Correct answer: ${currentQuestion.question} → ${currentQuestion.correctAnswer}`
            : currentQuestion.correctAnswer;
        feedbackElement.innerHTML = isCorrect ?
            `<strong>Correct!</strong> Great job! &nbsp;✅ ${currentQuestion.question} → ${currentQuestion.correctAnswer}` :
            `<strong>Incorrect.</strong> The correct answer is: ${correctAnswerText}`;
        
        feedbackElement.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
        feedbackElement.innerHTML += ` &nbsp;<button class="button btn-secondary" style="font-size:13px;padding:4px 10px;" onclick="quiz.changeAnswer()">✏️ Change Answer</button>`;
        feedbackElement.style.display = 'block';

        const isLast = this.state.currentQuestionIndex === this.state.questions.length - 1;
        document.getElementById('nextQuestionBtn').style.display = 'inline-block';
        document.getElementById('nextQuestionBtn').textContent = isLast ? 'Finish Quiz' : 'Next →';
        document.getElementById('saveForLaterBtn').style.display = 'none';
        document.getElementById('quizScore').textContent = this.state.score;

        if (app.updateCardDifficulty && typeof app.updateCardDifficulty === 'function') {
            app.updateCardDifficulty(currentQuestion.originalCard, isCorrect ? 'easy' : 'hard');
        }
    },

    // Move to the next question
    nextQuestion: function() {
        if (this.state.currentQuestionIndex >= this.state.questions.length - 1) {
            this.showResults();
            return;
        }
        this.state.currentQuestionIndex++;
        this.showQuestion();
    },

    // Move to the previous question
    prevQuestion: function() {
        if (this.state.currentQuestionIndex <= 0) return;
        this.state.currentQuestionIndex--;
        this.showQuestion();
    },

    // Show quiz results
    showResults: function() {
        console.log("Showing quiz results");
        
        // Hide question, show results
        document.getElementById('quizQuestion').style.display = 'none';
        document.getElementById('quizResults').style.display = 'block';
        
        // Calculate score percentage
        const scorePercent = Math.round((this.state.score / this.state.questions.length) * 100);
        
        // Update results
        document.getElementById('finalScore').textContent = `${scorePercent}%`;
        document.getElementById('correctAnswers').textContent = this.state.score;
        document.getElementById('incorrectAnswers').textContent = this.state.questions.length - this.state.score;
        document.getElementById('totalQuestions').textContent = this.state.questions.length;
        
        // Style the score circle based on performance
        const scoreCircle = document.querySelector('.quiz-score-circle');
        if (scorePercent >= 80) {
            scoreCircle.style.borderColor = 'var(--success)';
            scoreCircle.style.color = 'var(--success)';
        } else if (scorePercent >= 60) {
            scoreCircle.style.borderColor = 'var(--warning)';
            scoreCircle.style.color = 'var(--warning)';
        } else {
            scoreCircle.style.borderColor = 'var(--danger)';
            scoreCircle.style.color = 'var(--danger)';
        }
        
        // Show missed questions
        const missedContainer = document.getElementById('missedQuestions');
        missedContainer.innerHTML = '';
        
        if (this.state.missedQuestions.length === 0) {
            missedContainer.innerHTML = '<p>Perfect score! You didn\'t miss any questions.</p>';
        } else {
            this.state.missedQuestions.forEach((question, index) => {
                const missedItem = document.createElement('div');
                missedItem.className = 'quiz-missed-item';
                
                const questionText = document.createElement('div');
                questionText.className = 'quiz-missed-question';
                questionText.textContent = `${index + 1}. ${question.question}`;
                
                const yourAnswer = document.createElement('div');
                yourAnswer.className = 'quiz-missed-answer';
                yourAnswer.textContent = `Your answer: ${question.userAnswer}`;
                
                const correctAnswer = document.createElement('div');
                correctAnswer.className = 'quiz-missed-correct';
                correctAnswer.textContent = `Correct answer: ${question.correctAnswer}`;
                
                missedItem.appendChild(questionText);
                missedItem.appendChild(yourAnswer);
                missedItem.appendChild(correctAnswer);
                missedContainer.appendChild(missedItem);
            });
        }
        
        // Show/hide Re-quiz Missed button
        document.getElementById('requizMissedBtn').style.display =
            this.state.missedQuestions.length > 0 ? 'inline-block' : 'none';

        // Show/hide Re-quiz Saved button
        document.getElementById('requizSavedBtn').style.display =
            this.state.savedForLater.length > 0 ? 'inline-block' : 'none';

        // Show/hide Export buttons
        if (document.getElementById('exportMissedBtn'))
            document.getElementById('exportMissedBtn').style.display = this.state.missedQuestions.length > 0 ? 'inline-block' : 'none';
        if (document.getElementById('exportSavedBtn'))
            document.getElementById('exportSavedBtn').style.display = this.state.savedForLater.length > 0 ? 'inline-block' : 'none';

        // Show saved for later list
        const savedContainer = document.getElementById('savedForLaterList');
        savedContainer.innerHTML = '';
        if (this.state.savedForLater.length === 0) {
            savedContainer.innerHTML = '<p>No saved questions.</p>';
        } else {
            this.state.savedForLater.forEach((question, index) => {
                const item = document.createElement('div');
                item.className = 'quiz-missed-item';
                item.innerHTML = `<div class="quiz-missed-question">${index + 1}. ${question.question}</div>
                    <div class="quiz-saved-answer">Answer: ${question.correctAnswer}</div>`;
                savedContainer.appendChild(item);
            });
        }

        // Quiz is no longer in progress
        this.state.quizInProgress = false;
    },

    // Save current question for later
    saveForLater: function() {
        const currentQuestion = this.state.questions[this.state.currentQuestionIndex];
        const alreadySaved = this.state.savedForLater.some(q => q.question === currentQuestion.question);
        if (!alreadySaved) {
            this.state.savedForLater.push(currentQuestion);
        }
        document.getElementById('saveForLaterBtn').textContent = '🔖 Saved!';
        document.getElementById('saveForLaterBtn').disabled = true;
    },

    // Re-quiz only saved questions
    requizSaved: function() {
        if (this.state.savedForLater.length === 0) return;

        this.state.savedForLater.forEach(q => { q.userAnswer = null; q.isCorrect = null; });
        this.state.questions = this.shuffleArray([...this.state.savedForLater]);
        this.state.savedForLater = [];
        this.state.currentQuestionIndex = 0;
        this.state.score = 0;
        this.state.selectedOption = null;
        this.state.quizInProgress = true;
        this.state.missedQuestions = [];

        this.showQuestion();
        document.getElementById('quizQuestion').style.display = 'block';
        document.getElementById('quizResults').style.display = 'none';
    },

    // Re-quiz only the missed questions
    requizMissed: function() {
        if (this.state.missedQuestions.length === 0) return;

        // Reset each missed question's answer state
        this.state.missedQuestions.forEach(q => {
            q.userAnswer = null;
            q.isCorrect = null;
        });

        this.state.questions = this.state.settings.randomize !== false
            ? this.shuffleArray([...this.state.missedQuestions])
            : [...this.state.missedQuestions];
        this.state.currentQuestionIndex = 0;
        this.state.score = 0;
        this.state.selectedOption = null;
        this.state.quizInProgress = true;
        this.state.missedQuestions = [];

        this.showQuestion();
        document.getElementById('quizQuestion').style.display = 'block';
        document.getElementById('quizResults').style.display = 'none';
    },

    // Retry the quiz with the same questions
    retryQuiz: function() {
        console.log("Retrying quiz");
        
        // Reset quiz state but keep the same questions
        this.state.currentQuestionIndex = 0;
        this.state.score = 0;
        this.state.selectedOption = null;
        this.state.quizInProgress = true;
        this.state.missedQuestions = [];
        
        // Reset question state
        this.state.questions.forEach(question => {
            question.userAnswer = null;
            question.isCorrect = null;
        });
        
        // Shuffle questions
        this.state.questions = this.shuffleArray(this.state.questions);
        
        // Show the first question
        this.showQuestion();
        
        // Show question, hide results
        document.getElementById('quizQuestion').style.display = 'block';
        document.getElementById('quizResults').style.display = 'none';
    },

    // Export questions in the format required by the URL generator
    exportQuestions: function(questionList, filename) {
        if (!questionList || questionList.length === 0) return;
        
        // Filter for multiple-choice only as the URL generator expects exactly 4 options
        const exportData = questionList
            .filter(q => q.options && q.options.length === 4)
            .map(q => ({
                question: q.question,
                options: q.options,
                correctIndex: q.options.indexOf(q.correctAnswer)
            }));
        
        if (exportData.length === 0) {
            alert('No multiple-choice questions available to export. (True/False questions are not currently supported by the export format).');
            return;
        }

        const json = JSON.stringify(exportData, null, 2);
        if (typeof app !== 'undefined' && app.downloadFile) {
            app.downloadFile(json, filename, 'application/json');
        }
    },

    exportMissed: function() {
        this.exportQuestions(this.state.missedQuestions, 'missed_questions.json');
    },

    exportSaved: function() {
        this.exportQuestions(this.state.savedForLater, 'saved_questions.json');
    },

    // Reset the quiz and go back to setup
    resetQuiz: function() {
        console.log("Resetting quiz and clearing all data...");
        
        // Reset everything
        this.state.questions = [];
        this.state.currentQuestionIndex = 0;
        this.state.score = 0;
        this.state.selectedOption = null;
        this.state.quizInProgress = false;
        this.state.missedQuestions = [];
        this.state.savedForLater = [];
        
        // Clear URL parameters and fragment
        const url = new URL(window.location);
        url.searchParams.delete('qCont');
        window.history.replaceState({}, '', url.pathname + url.search);
        
        // Clear only quiz-related storage, not Leitner progress
        try {
            localStorage.removeItem('flashcard-data');
            sessionStorage.clear();
        } catch(e) {}
        
        // Restore all tabs visibility
        this.setTabsVisibility(false);
        
        // Show setup, hide question and results
        document.getElementById('quizSetup').style.display = 'block';
        document.getElementById('quizQuestion').style.display = 'none';
        document.getElementById('quizResults').style.display = 'none';
    },

    // Utility function to shuffle an array
    shuffleArray: function(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    // Generate Base64 from JSON input
    generateBase64: function() {
        const jsonInput = document.getElementById('jsonQuizInput').value.trim();
        const errorDiv = document.getElementById('base64Error');
        const resultDiv = document.getElementById('base64Result');
        
        // Clear previous messages
        errorDiv.style.display = 'none';
        resultDiv.style.display = 'none';
        
        // Validate JSON
        if (!jsonInput) {
            errorDiv.textContent = 'Please enter JSON data';
            errorDiv.style.display = 'block';
            return;
        }
        
        try {
            const jsonData = JSON.parse(jsonInput);
            
            // Validate structure
            if (!this.validateExternalData(jsonData)) {
                errorDiv.textContent = 'Invalid JSON structure. Must be an array with at least one item, each with "question" (string), "options" (array of 4 strings), and "correctIndex" (0-3).';
                errorDiv.style.display = 'block';
                return;
            }
            
            // Generate Base64 with Unicode support
            const base64 = btoa(unescape(encodeURIComponent(jsonInput)));
            
            // Estimate size
            const estimatedSize = base64.length;
            const useFragment = estimatedSize > 1500; // Use fragment for data larger than ~1.5KB
            
            // Create URLs for both methods
            const queryUrl = window.location.origin + window.location.pathname + '?qCont=' + base64;
            const fragmentUrl = window.location.origin + window.location.pathname + '#qData=' + base64;
            
            // Choose which URL to display based on size
            const finalUrl = useFragment ? fragmentUrl : queryUrl;
            
            // Display result
            document.getElementById('base64Output').value = finalUrl;
            
            // Show recommendation message if using fragment due to size
            if (useFragment) {
                const noteElem = document.createElement('div');
                noteElem.className = 'url-note';
                noteElem.innerHTML = `<p>Note: Using fragment identifier (#qData) due to large data size (${Math.round(estimatedSize/1024 * 10) / 10}KB).</p>
                                      <p>This URL has better compatibility with large quizzes.</p>`;
                
                // Add alternate URL option
                const altUrlBtn = document.createElement('button');
                altUrlBtn.textContent = "Show query parameter URL (less compatible)";
                altUrlBtn.className = "btn btn-sm";
                altUrlBtn.addEventListener('click', function() {
                    document.getElementById('base64Output').value = queryUrl;
                    this.textContent = "Show fragment URL (recommended)";
                    this.addEventListener('click', function() {
                        document.getElementById('base64Output').value = fragmentUrl;
                        this.textContent = "Show query parameter URL (less compatible)";
                    }, { once: true });
                });
                
                noteElem.appendChild(altUrlBtn);
                resultDiv.appendChild(noteElem);
            }
            
            resultDiv.style.display = 'block';
            
            console.log("Generated Base64 URL:", finalUrl);
        } catch (e) {
            errorDiv.textContent = 'Invalid JSON: ' + e.message;
            errorDiv.style.display = 'block';
        }
    },

    // Copy example JSON to clipboard
    copyExampleJson: function() {
        const example = '[{"question":"What is the capital of France?","options":["London","Berlin","Paris","Madrid"],"correctIndex":2}]';
        navigator.clipboard.writeText(example).then(() => {
            app.showMessage('textMsg', 'Example copied!', 'success');
        });
    },

    // Copy Base64 URL to clipboard
    copyBase64Url: function() {
        const output = document.getElementById('base64Output');
        output.select();
        document.execCommand('copy');
        
        // Show feedback
        const originalText = output.placeholder;
        output.placeholder = 'Copied!';
        setTimeout(() => {
            output.placeholder = originalText;
        }, 2000);
    }
};

// Initialize the quiz module when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing quiz module...");
    
    // Wait a bit to make sure the app is initialized
    setTimeout(() => {
        if (typeof app !== 'undefined' && app) {
            quiz.init();
        } else {
            console.error("App not initialized yet, trying again in 500ms");
            setTimeout(() => {
                if (typeof app !== 'undefined' && app) {
                    quiz.init();
                } else {
                    console.error("Failed to initialize quiz module: app not available");
                }
            }, 500);
        }
    }, 100);
});

// Make sure tab switching works for the quiz tab
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Remove active class from all buttons and tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to current button and tab
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            // If switching to quiz tab, check for cards
            if (tabId === 'quiz' && quiz) {
                setTimeout(() => quiz.checkForCards(), 100);
            }
        });
    });
});