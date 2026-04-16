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
        settings: {
            type: 'multiple-choice',
            direction: 'pol-tur',
            length: 10,
            filters: {
                easy: true,
                medium: true,
                hard: true,
                unmarked: true,
                group: '',
                afterDate: ''
            }
        }
    },

    // Initialize the quiz module
    init: function() {
        console.log("Quiz module initializing...");
        
        // Set up event listeners
        document.getElementById('startQuizBtn').addEventListener('click', this.startQuiz.bind(this));
        document.getElementById('nextQuestionBtn').addEventListener('click', this.nextQuestion.bind(this));
        document.getElementById('retryQuizBtn').addEventListener('click', this.retryQuiz.bind(this));
        document.getElementById('newQuizBtn').addEventListener('click', this.resetQuiz.bind(this));
        // Add event listener for reset button during quiz
        document.getElementById('resetQuizBtn').addEventListener('click', this.resetQuiz.bind(this));
        
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

    // Check if there are cards available for quiz
    checkForCards: function() {
        console.log("Checking for cards...");
        console.log("App cards:", app.cards);
        
        const hasCards = app && app.cards && app.cards.length > 0;
        console.log("Has cards:", hasCards);
        
        const emptyQuiz = document.getElementById('emptyQuiz');
        const quizContent = document.getElementById('quizContent');
        
        if (emptyQuiz && quizContent) {
            emptyQuiz.style.display = hasCards ? 'none' : 'block';
            quizContent.style.display = hasCards ? 'block' : 'none';
        } else {
            console.error("Quiz elements not found in DOM");
        }
    },

    // Populate the group filter dropdown
    populateGroupFilter: function() {
        if (!app || !app.cards || app.cards.length === 0) {
            console.log("No cards available for group filter");
            return;
        }
        
        const groupSelect = document.getElementById('quizFilterGroup');
        if (!groupSelect) {
            console.error("Group filter element not found");
            return;
        }
        
        // Clear existing options except the first one
        while (groupSelect.options.length > 1) {
            groupSelect.remove(1);
        }
        
        // Get unique groups
        const groups = [...new Set(app.cards
            .filter(card => card.group && card.group.trim() !== '')
            .map(card => card.group))];
        
        console.log("Available groups:", groups);
        
        // Add options
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            groupSelect.appendChild(option);
        });
    },

    // Start a new quiz
    startQuiz: function() {
        console.log("Starting quiz...");
        
        // Get quiz settings
        this.state.settings.type = document.getElementById('quizType').value;
        this.state.settings.direction = document.getElementById('quizDirection').value;
        this.state.settings.length = document.getElementById('quizLength').value;
        
        // Get filters
        this.state.settings.filters = {
            easy: document.getElementById('quizChkEasy').checked,
            medium: document.getElementById('quizChkMedium').checked,
            hard: document.getElementById('quizChkHard').checked,
            unmarked: document.getElementById('quizChkUnmarked').checked,
            group: document.getElementById('quizFilterGroup').value,
            afterDate: '' // Not implemented in this version
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
            if (this.state.settings.filters.group && 
                (!card.group || card.group !== this.state.settings.filters.group)) {
                return false;
            }
            
            return true;
        });
        
        console.log("Filtered cards:", filteredCards.length);
        
        // Shuffle the cards
        filteredCards = this.shuffleArray([...filteredCards]);
        
        // Limit to specified length
        const quizLength = this.state.settings.length === 'all' ? 
            filteredCards.length : Math.min(parseInt(this.state.settings.length), filteredCards.length);
        
        filteredCards = filteredCards.slice(0, quizLength);
        
        // Create questions
        this.state.questions = filteredCards.map(card => {
            // Determine question and correct answer based on direction
            const isPolToTur = this.state.settings.direction === 'pol-tur';
            const question = isPolToTur ? card.pol : card.tur;
            const correctAnswer = isPolToTur ? card.tur : card.pol;
            
            // For multiple choice, generate options
            let options = [correctAnswer];
            
            if (this.state.settings.type === 'multiple-choice') {
                // Get other cards to use as distractors
                const otherCards = app.cards.filter(c => c !== card);
                const shuffledOtherCards = this.shuffleArray([...otherCards]);
                
                // Add 3 distractors (or fewer if not enough cards)
                for (let i = 0; i < Math.min(3, shuffledOtherCards.length); i++) {
                    const distractor = isPolToTur ? shuffledOtherCards[i].tur : shuffledOtherCards[i].pol;
                    if (!options.includes(distractor)) {
                        options.push(distractor);
                    }
                }
                
                // Shuffle options
                options = this.shuffleArray(options);
            }
            
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

    // Show the current question
    showQuestion: function() {
        const currentQuestion = this.state.questions[this.state.currentQuestionIndex];
        console.log("Showing question:", this.state.currentQuestionIndex + 1);
        
        // Update progress
        document.getElementById('quizProgress').textContent = 
            `Question ${this.state.currentQuestionIndex + 1} / ${this.state.questions.length}`;
        document.getElementById('quizProgressFill').style.width = 
            `${((this.state.currentQuestionIndex + 1) / this.state.questions.length) * 100}%`;
        
        // Update score
        document.getElementById('quizScore').textContent = this.state.score;
        
        // Set question text
        document.getElementById('quizQuestionText').textContent = 
            `${this.state.settings.direction === 'pol-tur' ? '🇵🇱' : '🇹🇷'} ${currentQuestion.question}`;
        
        // Create options
        const optionsContainer = document.getElementById('quizOptions');
        optionsContainer.innerHTML = '';
        
        currentQuestion.options.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'quiz-option';
            optionElement.dataset.index = index;
            
            const optionLetter = document.createElement('span');
            optionLetter.className = 'quiz-option-letter';
            optionLetter.textContent = String.fromCharCode(65 + index); // A, B, C, D
            
            const optionText = document.createElement('span');
            optionText.textContent = option;
            
            optionElement.appendChild(optionLetter);
            optionElement.appendChild(optionText);
            
            // Add click handler
            optionElement.addEventListener('click', () => this.selectOption(index));
            
            optionsContainer.appendChild(optionElement);
        });
        
        // Hide feedback and next button
        document.getElementById('quizFeedback').style.display = 'none';
        document.getElementById('nextQuestionBtn').style.display = 'none';
        
        // Reset selected option
        this.state.selectedOption = null;
    },

    // Handle option selection
    selectOption: function(index) {
        // Ignore if already answered
        if (this.state.selectedOption !== null) return;
        
        const currentQuestion = this.state.questions[this.state.currentQuestionIndex];
        const selectedOption = currentQuestion.options[index];
        this.state.selectedOption = index;
        
        console.log("Selected option:", selectedOption);
        
        // Mark the option as selected
        const options = document.querySelectorAll('.quiz-option');
        options.forEach(option => option.classList.remove('selected'));
        options[index].classList.add('selected');
        
        // Check if correct
        const isCorrect = selectedOption === currentQuestion.correctAnswer;
        currentQuestion.userAnswer = selectedOption;
        currentQuestion.isCorrect = isCorrect;
        
        console.log("Is correct:", isCorrect);
        
        // Update score
        if (isCorrect) {
            this.state.score++;
        } else {
            // Add to missed questions
            this.state.missedQuestions.push(currentQuestion);
        }
        
        // Show feedback
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
        feedbackElement.innerHTML = isCorrect ? 
            '<strong>Correct!</strong> Great job!' :
            `<strong>Incorrect.</strong> The correct answer is: ${currentQuestion.correctAnswer}`;
        
        feedbackElement.className = `quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
        feedbackElement.style.display = 'block';
        
        // Show next button
        document.getElementById('nextQuestionBtn').style.display = 'block';
        
        // Update the original card difficulty based on performance
        if (app.updateCardDifficulty && typeof app.updateCardDifficulty === 'function') {
            const newDifficulty = isCorrect ? 'easy' : 'hard';
            app.updateCardDifficulty(currentQuestion.originalCard, newDifficulty);
        }
    },

    // Move to the next question
    nextQuestion: function() {
        this.state.currentQuestionIndex++;
        
        // Check if quiz is complete
        if (this.state.currentQuestionIndex >= this.state.questions.length) {
            this.showResults();
            return;
        }
        
        // Show the next question
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
        
        // Quiz is no longer in progress
        this.state.quizInProgress = false;
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

    // Reset the quiz and go back to setup
    resetQuiz: function() {
        console.log("Resetting quiz");
        
        // Reset everything
        this.state.questions = [];
        this.state.currentQuestionIndex = 0;
        this.state.score = 0;
        this.state.selectedOption = null;
        this.state.quizInProgress = false;
        this.state.missedQuestions = [];
        
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