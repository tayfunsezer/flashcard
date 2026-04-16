// Quiz functionality for Polish-Turkish Flashcard app

// Add these properties to the app object
const quizProperties = {
    // Quiz properties
    quiz: {
        questions: [],
        currentQuestion: 0,
        answers: [],
        startTime: null,
        endTime: null,
        timerInterval: null,
        settings: {
            questionCount: 10,
            type: 'multiple-choice',
            direction: 'pol-tur',
            filters: { easy: true, medium: true, hard: true, unmarked: true },
            group: ''
        }
    },
};

// Add these methods to the app object
const quizMethods = {
    // Update quiz UI based on current state
    updateQuizUI() {
        if (this.cards.length === 0) {
            document.getElementById('emptyQuiz').style.display = 'block';
            document.getElementById('quizContent').style.display = 'none';
            return;
        }

        document.getElementById('emptyQuiz').style.display = 'none';
        document.getElementById('quizContent').style.display = 'block';
        
        // Update quiz group dropdown with available groups
        this.updateQuizGroupDropdown();
    },

    // Update quiz group dropdown
    updateQuizGroupDropdown() {
        const groups = new Set();
        this.cards.forEach(card => {
            if (card.group && card.group.trim()) {
                groups.add(card.group.trim());
            }
        });
        
        const quizSelect = document.getElementById('quizGroup');
        const quizCurrentValue = quizSelect.value;
        quizSelect.innerHTML = '<option value="">-- All --</option>';
        Array.from(groups).sort().forEach(group => {
            const opt = document.createElement('option');
            opt.value = group;
            opt.textContent = group;
            quizSelect.appendChild(opt);
        });
        quizSelect.value = quizCurrentValue;
    },

    // Start a new quiz with current settings
    startQuiz() {
        // Get quiz settings from form
        this.quiz.settings.questionCount = parseInt(document.getElementById('quizQuestionCount').value);
        this.quiz.settings.type = document.getElementById('quizType').value;
        this.quiz.settings.direction = document.getElementById('quizDirection').value;
        this.quiz.settings.filters = {
            easy: document.getElementById('quizEasy').checked,
            medium: document.getElementById('quizMedium').checked,
            hard: document.getElementById('quizHard').checked,
            unmarked: document.getElementById('quizUnmarked').checked
        };
        this.quiz.settings.group = document.getElementById('quizGroup').value;

        // Filter cards based on settings
        const filteredCards = this.cards.filter(card => {
            const diff = card.difficulty || 'unmarked';
            if (!this.quiz.settings.filters[diff]) return false;
            
            if (this.quiz.settings.group && card.group !== this.quiz.settings.group) return false;
            
            return true;
        });

        if (filteredCards.length === 0) {
            this.showMessage('quizMsg', 'No cards match your filter criteria', 'error');
            return;
        }

        // Determine how many questions to use
        let questionCount = this.quiz.settings.questionCount;
        if (questionCount === 'all' || questionCount > filteredCards.length) {
            questionCount = filteredCards.length;
        }

        // Randomly select cards for the quiz
        const shuffledCards = [...filteredCards].sort(() => Math.random() - 0.5);
        const selectedCards = shuffledCards.slice(0, questionCount);

        // Create quiz questions
        this.quiz.questions = selectedCards.map(card => {
            // Determine question direction for this card
            let direction = this.quiz.settings.direction;
            if (direction === 'mixed') {
                direction = Math.random() < 0.5 ? 'pol-tur' : 'tur-pol';
            }

            // Determine question type for this card
            let type = this.quiz.settings.type;
            if (type === 'mixed') {
                type = Math.random() < 0.5 ? 'multiple-choice' : 'typing';
            }

            const question = {
                card,
                direction,
                type,
                options: [],
                correctAnswer: '',
                userAnswer: null
            };

            // Set up question based on direction
            if (direction === 'pol-tur') {
                question.word = card.pol;
                question.correctAnswer = card.tur;
                question.fromLanguage = 'Polish';
                question.toLanguage = 'Turkish';
            } else {
                question.word = card.tur;
                question.correctAnswer = card.pol;
                question.fromLanguage = 'Turkish';
                question.toLanguage = 'Polish';
            }

            // For multiple choice, generate options
            if (type === 'multiple-choice') {
                // Get the correct answer
                const correctAnswer = question.correctAnswer;
                
                // Find 3 other random options from other cards
                const otherOptions = filteredCards
                    .filter(c => c !== card)
                    .map(c => direction === 'pol-tur' ? c.tur : c.pol)
                    .filter(opt => opt !== correctAnswer)
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 3);
                
                // If we couldn't get 3 other options, generate some variations
                while (otherOptions.length < 3) {
                    const randomWord = this.generateRandomVariation(correctAnswer);
                    if (!otherOptions.includes(randomWord) && randomWord !== correctAnswer) {
                        otherOptions.push(randomWord);
                    }
                }
                
                // Combine correct answer with other options and shuffle
                question.options = [correctAnswer, ...otherOptions].sort(() => Math.random() - 0.5);
            }

            return question;
        });

        // Reset quiz state
        this.quiz.currentQuestion = 0;
        this.quiz.answers = Array(this.quiz.questions.length).fill(null);
        this.quiz.startTime = new Date();
        this.quiz.endTime = null;

        // Show quiz session UI
        document.getElementById('quizSetup').style.display = 'none';
        document.getElementById('quizSession').style.display = 'block';
        document.getElementById('quizResults').style.display = 'none';

        // Start timer
        this.startQuizTimer();

        // Show first question
        this.showQuizQuestion();
    },

    // Generate a random variation of a word (for multiple choice distractors)
    generateRandomVariation(word) {
        if (!word || word.length < 3) return word + Math.floor(Math.random() * 10);
        
        const variations = [
            // Swap two adjacent characters
            () => {
                const pos = Math.floor(Math.random() * (word.length - 1));
                return word.substring(0, pos) + word.charAt(pos + 1) + word.charAt(pos) + word.substring(pos + 2);
            },
            // Remove a random character
            () => {
                const pos = Math.floor(Math.random() * word.length);
                return word.substring(0, pos) + word.substring(pos + 1);
            },
            // Add a random character
            () => {
                const pos = Math.floor(Math.random() * word.length);
                const chars = 'abcdefghijklmnopqrstuvwxyzçğıöşü';
                const randomChar = chars.charAt(Math.floor(Math.random() * chars.length));
                return word.substring(0, pos) + randomChar + word.substring(pos);
            },
            // Replace a character
            () => {
                const pos = Math.floor(Math.random() * word.length);
                const chars = 'abcdefghijklmnopqrstuvwxyzçğıöşü';
                const randomChar = chars.charAt(Math.floor(Math.random() * chars.length));
                return word.substring(0, pos) + randomChar + word.substring(pos + 1);
            }
        ];
        
        const variation = variations[Math.floor(Math.random() * variations.length)]();
        return variation;
    },

    // Start the quiz timer
    startQuizTimer() {
        const timerElement = document.getElementById('quizTimer');
        const startTime = this.quiz.startTime;
        
        // Clear any existing timer
        if (this.quiz.timerInterval) {
            clearInterval(this.quiz.timerInterval);
        }
        
        // Update timer every second
        this.quiz.timerInterval = setInterval(() => {
            const elapsedSeconds = Math.floor((new Date() - startTime) / 1000);
            const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
            const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
            timerElement.textContent = `${minutes}:${seconds}`;
        }, 1000);
    },

    // Stop the quiz timer
    stopQuizTimer() {
        if (this.quiz.timerInterval) {
            clearInterval(this.quiz.timerInterval);
            this.quiz.timerInterval = null;
        }
    },

    // Show the current quiz question
    showQuizQuestion() {
        const question = this.quiz.questions[this.quiz.currentQuestion];
        const totalQuestions = this.quiz.questions.length;
        
        // Update progress indicator
        document.getElementById('quizProgress').textContent = `Question ${this.quiz.currentQuestion + 1} / ${totalQuestions}`;
        document.getElementById('quizProgressFill').style.width = `${(this.quiz.currentQuestion + 1) / totalQuestions * 100}%`;
        
        // Update navigation buttons
        document.getElementById('quizPrevBtn').disabled = this.quiz.currentQuestion === 0;
        document.getElementById('quizNextBtn').style.display = this.quiz.currentQuestion < totalQuestions - 1 ? 'inline-block' : 'none';
        document.getElementById('quizFinishBtn').style.display = this.quiz.currentQuestion === totalQuestions - 1 ? 'inline-block' : 'none';
        
        // Show the appropriate question type
        if (question.type === 'multiple-choice') {
            this.showMultipleChoiceQuestion(question);
        } else {
            this.showTypingQuestion(question);
        }
    },

    // Show a multiple choice question
    showMultipleChoiceQuestion(question) {
        // Hide typing question, show multiple choice
        document.getElementById('typingQuestionTemplate').style.display = 'none';
        document.getElementById('multipleChoiceTemplate').style.display = 'block';
        
        // Update question text
        document.getElementById('mcQuestionNumber').textContent = `Question ${this.quiz.currentQuestion + 1} of ${this.quiz.questions.length}`;
        document.getElementById('mcQuestionWord').textContent = question.word;
        
        // Create options
        const optionsContainer = document.getElementById('mcOptions');
        optionsContainer.innerHTML = '';
        
        question.options.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'quiz-option';
            optionElement.textContent = option;
            optionElement.dataset.index = index;
            
            // If user already answered this question, show feedback
            if (this.quiz.answers[this.quiz.currentQuestion] !== null) {
                const userAnswer = this.quiz.answers[this.quiz.currentQuestion];
                const isSelected = option === userAnswer;
                const isCorrect = option === question.correctAnswer;
                
                if (isSelected) {
                    optionElement.classList.add('selected');
                }
                
                if (isCorrect) {
                    optionElement.classList.add('correct');
                } else if (isSelected) {
                    optionElement.classList.add('incorrect');
                }
            } else {
                // Add click handler if not answered yet
                optionElement.addEventListener('click', () => {
                    this.selectMultipleChoiceAnswer(option);
                });
            }
            
            optionsContainer.appendChild(optionElement);
        });
    },

    // Show a typing question
    showTypingQuestion(question) {
        // Hide multiple choice, show typing
        document.getElementById('multipleChoiceTemplate').style.display = 'none';
        document.getElementById('typingQuestionTemplate').style.display = 'block';
        
        // Update question text
        document.getElementById('typingQuestionNumber').textContent = `Question ${this.quiz.currentQuestion + 1} of ${this.quiz.questions.length}`;
        document.getElementById('typingQuestionWord').textContent = question.word;
        
        const inputElement = document.getElementById('typingAnswer');
        const feedbackElement = document.getElementById('typingFeedback');
        
        // If user already answered this question, show feedback
        if (this.quiz.answers[this.quiz.currentQuestion] !== null) {
            const userAnswer = this.quiz.answers[this.quiz.currentQuestion];
            const isCorrect = this.compareAnswers(userAnswer, question.correctAnswer);
            
            inputElement.value = userAnswer;
            inputElement.disabled = true;
            
            if (isCorrect) {
                inputElement.classList.add('correct');
                feedbackElement.innerHTML = `<span style="color: var(--success);">Correct!</span>`;
            } else {
                inputElement.classList.add('incorrect');
                feedbackElement.innerHTML = `<span style="color: var(--danger);">Incorrect.</span> Correct answer: <strong>${question.correctAnswer}</strong>`;
            }
        } else {
            // Reset for new answer
            inputElement.value = '';
            inputElement.disabled = false;
            inputElement.classList.remove('correct', 'incorrect');
            feedbackElement.innerHTML = '';
            
            // Focus the input
            setTimeout(() => inputElement.focus(), 100);
        }
    },

    // Handle selection of multiple choice answer
    selectMultipleChoiceAnswer(selectedOption) {
        const question = this.quiz.questions[this.quiz.currentQuestion];
        const isCorrect = selectedOption === question.correctAnswer;
        
        // Save the answer
        this.quiz.answers[this.quiz.currentQuestion] = selectedOption;
        
        // Show feedback
        const options = document.querySelectorAll('#mcOptions .quiz-option');
        options.forEach(option => {
            const optionText = option.textContent;
            const isSelected = optionText === selectedOption;
            const isCorrectOption = optionText === question.correctAnswer;
            
            if (isSelected) {
                option.classList.add('selected');
                option.classList.add(isCorrect ? 'correct' : 'incorrect');
            } else if (isCorrectOption) {
                option.classList.add('correct');
            }
            
            // Remove click handlers
            option.replaceWith(option.cloneNode(true));
        });
        
        // Automatically go to next question after a short delay
        setTimeout(() => {
            if (this.quiz.currentQuestion < this.quiz.questions.length - 1) {
                this.nextQuizQuestion();
            }
        }, 1000);
    },

    // Check typing answer
    checkTypingAnswer() {
        const inputElement = document.getElementById('typingAnswer');
        const feedbackElement = document.getElementById('typingFeedback');
        const userAnswer = inputElement.value.trim();
        
        if (!userAnswer) return;
        
        const question = this.quiz.questions[this.quiz.currentQuestion];
        const isCorrect = this.compareAnswers(userAnswer, question.correctAnswer);
        
        // Save the answer
        this.quiz.answers[this.quiz.currentQuestion] = userAnswer;
        
        // Show feedback
        inputElement.disabled = true;
        
        if (isCorrect) {
            inputElement.classList.add('correct');
            feedbackElement.innerHTML = `<span style="color: var(--success);">Correct!</span>`;
        } else {
            inputElement.classList.add('incorrect');
            feedbackElement.innerHTML = `<span style="color: var(--danger);">Incorrect.</span> Correct answer: <strong>${question.correctAnswer}</strong>`;
        }
    },

    // Compare user answer with correct answer (with some flexibility)
    compareAnswers(userAnswer, correctAnswer) {
        if (!userAnswer || !correctAnswer) return false;
        
        // Convert to lowercase and trim
        userAnswer = userAnswer.toLowerCase().trim();
        correctAnswer = correctAnswer.toLowerCase().trim();
        
        // Exact match
        if (userAnswer === correctAnswer) return true;
        
        // Allow for minor typos (Levenshtein distance <= 2 for longer words)
        if (correctAnswer.length > 4) {
            const distance = this.levenshteinDistance(userAnswer, correctAnswer);
            if (distance <= 2) return true;
        }
        
        return false;
    },

    // Calculate Levenshtein distance between two strings
    levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        
        const matrix = [];
        
        // Initialize matrix
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        
        // Fill matrix
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        return matrix[b.length][a.length];
    },

    // Navigate to next quiz question
    nextQuizQuestion() {
        if (this.quiz.currentQuestion < this.quiz.questions.length - 1) {
            // If it's a typing question, check the answer before proceeding
            const question = this.quiz.questions[this.quiz.currentQuestion];
            if (question.type === 'typing' && this.quiz.answers[this.quiz.currentQuestion] === null) {
                this.checkTypingAnswer();
            }
            
            this.quiz.currentQuestion++;
            this.showQuizQuestion();
        }
    },

    // Navigate to previous quiz question
    prevQuizQuestion() {
        if (this.quiz.currentQuestion > 0) {
            this.quiz.currentQuestion--;
            this.showQuizQuestion();
        }
    },

    // Finish the quiz and show results
    finishQuiz() {
        // If it's a typing question, check the answer before finishing
        const question = this.quiz.questions[this.quiz.currentQuestion];
        if (question.type === 'typing' && this.quiz.answers[this.quiz.currentQuestion] === null) {
            this.checkTypingAnswer();
        }
        
        // Stop the timer
        this.quiz.endTime = new Date();
        this.stopQuizTimer();
        
        // Calculate results
        const totalQuestions = this.quiz.questions.length;
        let correctAnswers = 0;
        const incorrectQuestions = [];
        
        this.quiz.questions.forEach((question, index) => {
            const userAnswer = this.quiz.answers[index];
            const isCorrect = this.compareAnswers(userAnswer, question.correctAnswer);
            
            if (isCorrect) {
                correctAnswers++;
            } else {
                incorrectQuestions.push({
                    questionNumber: index + 1,
                    word: question.word,
                    fromLanguage: question.fromLanguage,
                    toLanguage: question.toLanguage,
                    correctAnswer: question.correctAnswer,
                    userAnswer: userAnswer || '(no answer)'
                });
            }
        });
        
        const score = Math.round((correctAnswers / totalQuestions) * 100);
        const elapsedSeconds = Math.floor((this.quiz.endTime - this.quiz.startTime) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
        const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
        
        // Update results UI
        document.getElementById('quizScoreDisplay').textContent = `${score}%`;
        document.getElementById('quizTimeDisplay').textContent = `Time: ${minutes}:${seconds}`;
        document.getElementById('quizTotalQuestions').textContent = totalQuestions;
        document.getElementById('quizCorrectAnswers').textContent = correctAnswers;
        document.getElementById('quizIncorrectAnswers').textContent = totalQuestions - correctAnswers;
        
        // Show incorrect answers if any
        const reviewSection = document.getElementById('quizReviewSection');
        const reviewList = document.getElementById('quizReviewList');
        
        if (incorrectQuestions.length > 0) {
            reviewSection.style.display = 'block';
            reviewList.innerHTML = '';
            
            incorrectQuestions.forEach(q => {
                const item = document.createElement('div');
                item.className = 'quiz-review-item';
                item.innerHTML = `
                    <div class="quiz-review-question">
                        <strong>Q${q.questionNumber}:</strong> ${q.word} (${q.fromLanguage} → ${q.toLanguage})
                    </div>
                    <div class="quiz-review-answer incorrect">
                        <span>Your answer: ${q.userAnswer}</span>
                    </div>
                    <div class="quiz-review-answer correct">
                        <span>Correct answer: ${q.correctAnswer}</span>
                    </div>
                `;
                reviewList.appendChild(item);
            });
        } else {
            reviewSection.style.display = 'none';
        }
        
        // Show results screen
        document.getElementById('quizSetup').style.display = 'none';
        document.getElementById('quizSession').style.display = 'none';
        document.getElementById('quizResults').style.display = 'block';
    },

    // Reset quiz to setup screen
    resetQuiz() {
        // Stop timer if running
        this.stopQuizTimer();
        
        // Reset quiz state
        this.quiz.questions = [];
        this.quiz.currentQuestion = 0;
        this.quiz.answers = [];
        this.quiz.startTime = null;
        this.quiz.endTime = null;
        
        // Show setup screen
        document.getElementById('quizSetup').style.display = 'block';
        document.getElementById('quizSession').style.display = 'none';
        document.getElementById('quizResults').style.display = 'none';
    },
};