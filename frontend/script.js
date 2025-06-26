document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL STATE & CONSTANTS ---
    //const API_BASE_URL = 'https://aicampus-live.uc.r.appspot.com/api';
    const API_BASE_URL = 'http://127.0.0.1:8080/api';
    let authToken = null;
    let currentProblemId = null;
    let chatHistory = [];
    let quizState = {
        questions: [],
        currentQuestionIndex: 0,
        userAnswers: [],
        recommendedTopic: null,
    };

    // --- ELEMENT REFERENCES ---
    const views = {
        welcome: document.getElementById('welcome-view'),
        quiz: document.getElementById('quiz-view'),
        authHook: document.getElementById('auth-hook-view'),
        login: document.getElementById('login-view'),
        signup: document.getElementById('signup-view'),
        dashboard: document.getElementById('dashboard-view'),
        topic: document.getElementById('topic-view'),
        solver: document.getElementById('solver-view'),
    };
    const mainNav = document.getElementById('main-nav');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginError = document.getElementById('login-error');
    const signupError = document.getElementById('signup-error');
    const showSignupLink = document.getElementById('show-signup-link');
    const showLoginLink = document.getElementById('show-login-link');
    const hookShowSignupButton = document.getElementById('hook-show-signup-button');
    const hookShowLoginLink = document.getElementById('hook-show-login-link');
    const startQuizButton = document.getElementById('start-quiz-button');
    const quizProgressFill = document.getElementById('quiz-progress-fill');
    const quizQuestionNumber = document.getElementById('quiz-question-number');
    const quizQuestionText = document.getElementById('quiz-question-text');
    const quizQuestionImage = document.getElementById('quiz-question-image');
    const quizOptionsArea = document.getElementById('quiz-options-area');
    const quizSubmitButton = document.getElementById('quiz-submit-button');
    const problemListContainer = document.getElementById('problem-list-container');
    const backButton = document.getElementById('back-to-dashboard-button');
    const backToDashboardFromTopicButton = document.getElementById('back-to-dashboard-from-topic-button');
    const problemTextElement = document.getElementById('problem-text');
    const problemImageElement = document.getElementById('problem-image');
    const answerInputElement = document.getElementById('answer-input');
    const submitButton = document.getElementById('submit-button');
    const feedbackArea = document.getElementById('feedback-area');

    // --- VIEW MANAGEMENT ---
    function showView(viewId) {
        Object.values(views).forEach(view => {
            if(view) view.style.display = 'none';
        });
        const activeView = document.getElementById(viewId);
        if (activeView) activeView.style.display = 'flex';
    }

    // --- AUTHENTICATED FETCH HELPER ---
    async function authedFetch(url, options = {}) {
        if (!authToken) { handleLogout(); throw new Error("User not authenticated"); }
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`, ...options.headers };
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) { handleLogout(); throw new Error("Authentication failed"); }
        return response;
    }

    // --- MATHJAX RENDERING ---
    function typesetMath(element) {
        if (window.MathJax) {
            window.MathJax.typesetPromise(element ? [element] : undefined)
                .catch(err => console.error('MathJax typesetting error:', err));
        }
    }

    // --- HEADER AND NAVIGATION ---
    function updateHeader() {
        mainNav.innerHTML = '';
        if (authToken) {
            const logoutButton = document.createElement('button');
            logoutButton.id = 'logout-button-dynamic';
            logoutButton.innerHTML = `<i data-feather="log-out"></i> Logout`;
            logoutButton.addEventListener('click', handleLogout);
            mainNav.appendChild(logoutButton);
        } else {
            const loginButton = document.createElement('button');
            loginButton.id = 'show-login-button';
            loginButton.textContent = 'Login';
            loginButton.addEventListener('click', () => showView('login-view'));
            mainNav.appendChild(loginButton);
        }
        feather.replace();
    }

    // --- AUTHENTICATION LOGIC ---
    async function handleLogin(e) {
        e.preventDefault();
        loginError.textContent = '';
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Login failed');
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            initializeApp();
        } catch (error) {
            loginError.textContent = error.message;
        }
    }

    async function handleSignup(e) {
        e.preventDefault();
        signupError.textContent = '';
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        try {
            const response = await fetch(`${API_BASE_URL}/auth/signup`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email, 
                    password, 
                    recommended_topic: quizState.recommendedTopic 
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Signup failed');
            
            // If signup is successful and a token is returned, log the user in
            if (data.token) {
                authToken = data.token;
                localStorage.setItem('authToken', authToken);
                initializeApp(); // This will now show the dashboard
            } else {
                // Fallback in case the backend doesn't return a token
                showView('login-view');
                loginError.textContent = 'Signup successful! Please log in.';
            }
            signupForm.reset();

        } catch (error) {
            signupError.textContent = error.message;
        }
    }

    function handleLogout() {
        authToken = null;
        localStorage.removeItem('authToken');
        quizState.userAnswers = [];
        loginForm.reset();
        signupForm.reset();
        showView('welcome-view');
        updateHeader();
    }
    
    // --- QUIZ LOGIC ---
    async function startQuiz() {
        showView('quiz-view');
        quizState = { questions: [], currentQuestionIndex: 0, userAnswers: [] };
        try {
            const response = await fetch(`${API_BASE_URL}/diagnostic/start`);
            if (!response.ok) throw new Error('Could not start quiz');
            const questions = await response.json();
            if (questions && questions.length > 0) {
                quizState.questions = questions;
                displayCurrentQuizQuestion();
            } else {
                throw new Error("No diagnostic questions found.");
            }
        } catch(error) {
            console.error("Error starting quiz:", error);
            // In a real app, show this error in the UI
            alert("Could not load the diagnostic quiz. Please try again later.");
            showView('welcome-view');
        }
    }

    function displayCurrentQuizQuestion() {
        const question = quizState.questions[quizState.currentQuestionIndex];
        const questionNumber = quizState.currentQuestionIndex + 1;
        
        quizQuestionNumber.textContent = `Question ${questionNumber} of ${quizState.questions.length}`;
        quizQuestionText.innerHTML = question.question;
        quizQuestionImage.style.display = question.image_url ? 'block' : 'none';
        quizQuestionImage.src = question.image_url || '';
        
        quizOptionsArea.innerHTML = '';
        question.options.forEach((option, index) => {
            const label = document.createElement('label');
            label.className = 'quiz-option';
            label.innerHTML = `<input type="radio" name="quiz_option" value="${index}"><span>${option}</span>`;
            label.addEventListener('click', () => {
                document.querySelectorAll('.quiz-option').forEach(l => l.classList.remove('selected'));
                label.classList.add('selected');
                quizSubmitButton.disabled = false;
            });
            quizOptionsArea.appendChild(label);
        });
        quizProgressFill.style.width = `${(questionNumber / quizState.questions.length) * 100}%`;
        quizSubmitButton.disabled = true;
        typesetMath(views.quiz);
    }



    async function handleQuizSubmit() {
        const selectedRadio = document.querySelector('input[name="quiz_option"]:checked');
        if (!selectedRadio) return;

        console.log(`Submitting answer for question index: ${quizState.currentQuestionIndex}`);

        // Record the user's answer
        const question = quizState.questions[quizState.currentQuestionIndex];
        const selectedAnswerIndex = parseInt(selectedRadio.value, 10);
        const isCorrect = (selectedAnswerIndex === question.answer);
        quizState.userAnswers.push({ question_id: question.id, is_correct: isCorrect });

        // Move to the next question index
        quizState.currentQuestionIndex++;

        console.log(`New index is: ${quizState.currentQuestionIndex}. Total questions in quiz: ${quizState.questions.length}`);

        // Check if we have run out of questions
        if (quizState.currentQuestionIndex < quizState.questions.length) {
            console.log("Quiz continues. Displaying next question.");
            displayCurrentQuizQuestion();
        } else {
            console.log("Quiz complete! Calling analyzeAndShowResults.");
            // This block should execute after the 10th question
            analyzeAndShowResults();
        }
    }
    // --- MAIN APP LOGIC (Dashboard & Solver) ---
    async function fetchAndDisplayDashboard() {
        // Get the new container elements
        const recommendedContainer = document.getElementById('recommended-topics-container');
        const allTopicsContainer = document.getElementById('all-topics-container');

        // Clear any previous content
        recommendedContainer.innerHTML = 'Loading recommendations...';
        allTopicsContainer.innerHTML = '';

        try {
            // Call our new smart dashboard endpoint
            const response = await authedFetch(`${API_BASE_URL}/dashboard`);
            if (!response.ok) throw new Error('Could not fetch dashboard data');
            const data = await response.json();

            // --- Populate Recommended Topics ---
            recommendedContainer.innerHTML = ''; // Clear loading message
            if (data.recommended_topics && data.recommended_topics.length > 0) {
                data.recommended_topics.forEach(topic => {
                    const card = document.createElement('div');
                    card.className = 'topic-card';
                    card.textContent = topic;
                    card.addEventListener('click', () => showTopicView(topic));
                    recommendedContainer.appendChild(card);
                });
            } else {
                recommendedContainer.innerHTML = '<p>No specific recommendations yet. Great job! Pick any topic to begin.</p>';
            }

            // --- Populate All Other Topics ---
            allTopicsContainer.innerHTML = ''; // Clear loading message
            if (data.all_topics && data.all_topics.length > 0) {
                data.all_topics.forEach(topic => {
                    const card = document.createElement('div');
                    card.className = 'topic-card';
                    card.textContent = topic;
                    card.addEventListener('click', () => showTopicView(topic));
                    allTopicsContainer.appendChild(card);
                });
            }

        } catch (error) {
            recommendedContainer.innerHTML = '<p>Could not load recommendations.</p>';
            console.error("Dashboard fetch error:", error);
        }
    }

    async function showTopicView(topicName) {
        showView('topic-view');
        const topicTitle = document.getElementById('topic-title');
        const problemList = document.getElementById('topic-problem-list');
        
        topicTitle.textContent = topicName;
        problemList.innerHTML = 'Loading problems...';

        try {
            // Construct the URL with the topic query parameter
            const response = await authedFetch(`${API_BASE_URL}/problems?topic=${encodeURIComponent(topicName)}`);
            if (!response.ok) throw new Error('Could not fetch problems');
            
            // The backend now returns only the problems for the specified topic
            const topicProblems = await response.json();
            
            problemList.innerHTML = '';
            if (topicProblems.length > 0) {
                topicProblems.forEach(problem => {
                    const problemElement = document.createElement('div');
                    problemElement.className = 'problem-item';
                    problemElement.textContent = problem.title;
                    problemElement.addEventListener('click', () => switchToSolverView(problem.id));
                    problemList.appendChild(problemElement);
                });
            } else {
                problemList.innerHTML = '<p>No problems found for this topic yet.</p>';
            }
        } catch (error) {
            problemList.innerHTML = '<p>Could not load problems for this topic.</p>';
            console.error(`Error fetching problems for ${topicName}:`, error);
        }
    }
    
    async function switchToSolverView(problemId) {
        showView('solver-view');
        currentProblemId = problemId;
        try {
            const response = await authedFetch(`${API_BASE_URL}/progress/${problemId}`);
            if (!response.ok) throw new Error('Could not fetch progress');
            const data = await response.json();
            chatHistory = data.chat_history || [];
            renderChatHistory();
        } catch(error) {
            chatHistory = [];
            renderChatHistory();
        }
        fetchProblem(problemId);
    }
    
    async function fetchProblem(problemId) {
        try {
            const response = await authedFetch(`${API_BASE_URL}/problems/${problemId}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const problem = await response.json();
            problemTextElement.innerHTML = problem.problem_text;
            problemImageElement.style.display = problem.image_url ? 'block' : 'none';
            problemImageElement.src = problem.image_url || '';
            typesetMath(problemTextElement);
        } catch (error) {
            problemTextElement.innerHTML = 'Failed to load problem.';
        }
    }
    
    async function submitAnswer() {
        const studentAnswer = answerInputElement.value;
        if (!studentAnswer) return;
        const currentTurn = { role: 'user', parts: [studentAnswer] };
        chatHistory.push(currentTurn);
        renderChatHistory();
        answerInputElement.value = '';
        try {
            const response = await authedFetch(`${API_BASE_URL}/tutor/submit_answer`, {
                method: 'POST',
                body: JSON.stringify({ problem_id: currentProblemId, student_answer: studentAnswer, chat_history: chatHistory }),
            });
            if (!response.ok) throw new Error('Network response was not ok');
            const result = await response.json();
            if (result.is_correct) {
                chatHistory.push({ role: 'model', parts: [result.feedback.encouragement] });
            } else {
                chatHistory.push({ role: 'model', parts: [JSON.stringify(result.feedback)] });
            }
            renderChatHistory();
            if (result.is_correct) {
                // Refresh dashboard data in background to update status badge
                fetchAndDisplayDashboard();
            }
        } catch (error) { console.error('Submit answer error:', error); }
    }

    function renderChatHistory() {
        feedbackArea.innerHTML = '';
        chatHistory.forEach(turn => {
            const turnDiv = document.createElement('div');
            turnDiv.classList.add('chat-turn');
            let contentHTML = '';
            if (turn.role === 'user') {
                turnDiv.classList.add('user-turn');
                contentHTML = `<p>${turn.parts[0]}</p>`;
            } else {
                turnDiv.classList.add('model-turn');
                const partText = turn.parts[0];
                if (partText && partText.trim().startsWith('{')) {
                    try {
                        const feedback = JSON.parse(partText);
                        const encouragement = feedback.encouragement || '';
                        const question = feedback.socratic_question || '';
                        let encouragementHTML = encouragement ? `<p><strong>${encouragement}</strong></p>` : '';
                        let questionHTML = question ? `<p>${question}</p>` : '';
                        if (!encouragementHTML && !questionHTML) {
                            contentHTML = `<p>I'm not sure how to respond to that. Could you try rephrasing?</p>`;
                        } else {
                            contentHTML = encouragementHTML + questionHTML;
                        }
                    } catch (e) {
                        contentHTML = `<p>I had a formatting error with my response.</p>`;
                    }
                } else {
                    contentHTML = `<p>${partText}</p>`;
                }
            }
            turnDiv.innerHTML = contentHTML;
            feedbackArea.appendChild(turnDiv);
        });
        feedbackArea.scrollTop = feedbackArea.scrollHeight;
        typesetMath(feedbackArea);
    }

    async function analyzeAndShowResults() {
        // Switch to the results view immediately
        showView('auth-hook-view');

        // Get references to the elements we will manipulate
        const resultsArea = document.getElementById('quiz-results-area');
        const signupPromptArea = document.getElementById('signup-prompt-area');

        // Set the initial "loading" state
        resultsArea.innerHTML = '<h2>Analyzing your results<span class="ellipsis"><span>.</span><span>.</span><span>.</span></span></h2><p>We are building your personalized report.</p>';
        signupPromptArea.style.display = 'none'; // Ensure the prompt is hidden initially

        try {
            const response = await fetch(`${API_BASE_URL}/diagnostic/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_answers: quizState.userAnswers })
            });

            if (!response.ok) {
                // This will be handled by the 'catch' block below
                throw new Error('Analysis failed');
            }

            const report = await response.json();
            
            // Store the recommended topic for signup
            quizState.recommendedTopic = report.recommended_topic;

            // If successful, display the personalized report
            resultsArea.innerHTML = `
                <h2>Quiz Complete!</h2>
                <h3>${report.score_text}</h3>
                <p>${report.summary_message}</p>
                <p><strong>We recommend you start with:</strong></p>
                <div class="recommended-topic-card">${report.recommended_topic}</div>
            `;

        } catch (error) {
            console.error("Error analyzing results:", error);
            // If there's an error, display a fallback message
            resultsArea.innerHTML = "<h2>Quiz Complete!</h2><p>There was an issue generating your personalized report, but you can still sign up to start practicing.</p>";
        } finally {
            // This block is guaranteed to run after the try/catch finishes.
            // This ensures the signup prompt always appears once the process is done.
            signupPromptArea.style.display = 'block';
        }
    }  
    // --- INITIALIZATION ---
    function initializeApp() {
        const savedToken = localStorage.getItem('authToken');
        if (savedToken) {
            authToken = savedToken;
            showView('dashboard-view');
            fetchAndDisplayDashboard();
        } else {
            showView('welcome-view');
        }
        updateHeader();
    }

    // Attach all event listeners
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    showSignupLink.addEventListener('click', (e) => { e.preventDefault(); showView('signup-view'); });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); showView('login-view'); });
    hookShowSignupButton.addEventListener('click', (e) => { e.preventDefault(); showView('signup-view'); });
    hookShowLoginLink.addEventListener('click', (e) => { e.preventDefault(); showView('login-view'); });
    backButton.addEventListener('click', () => { showView('topic-view'); }); // Go back to topic view from solver
    backToDashboardFromTopicButton.addEventListener('click', () => { showView('dashboard-view'); fetchAndDisplayDashboard(); });
    submitButton.addEventListener('click', submitAnswer);
    answerInputElement.addEventListener('keyup', (e) => { if (e.key === 'Enter') submitAnswer(); });
    startQuizButton.addEventListener('click', startQuiz);
    quizSubmitButton.addEventListener('click', handleQuizSubmit);

    initializeApp();
});