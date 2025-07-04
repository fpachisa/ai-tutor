document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL STATE & CONSTANTS ---
    //const API_BASE_URL = 'https://aicampus-live.uc.r.appspot.com/api';
    const API_BASE_URL = 'http://127.0.0.1:8080/api';
    
    // Application configuration for hierarchical URLs
    const APP_CONFIG = {
        currentGrade: 'p6',
        currentSubject: 'math',
        getHierarchicalURL: function(endpoint) {
            return `${API_BASE_URL}/grades/${this.currentGrade}/subjects/${this.currentSubject}${endpoint}`;
        }
    };
    let authToken = null;
    let currentProblemId = null;
    let chatHistory = [];
    let quizState = {
        questions: [],
        currentQuestionIndex: 0,
        userAnswers: [],
        recommendedTopic: null,
    };
    let currentChart = null;
    let currentProblemData = null;
    let currentTopicName = null;
    let isTtsEnabled = true; // Voice is on by default
    const synth = window.speechSynthesis;
    

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
    const TOPIC_METADATA = {
        "Algebra":    { icon: "hash",    gradient: "linear-gradient(45deg, #ff9a9e 0%, #fecfef 100%)" },
        "Fractions":  { icon: "book",      gradient: "linear-gradient(45deg, #a1c4fd 0%, #c2e9fb 100%)" },
        "Speed":      { icon: "wind",           gradient: "linear-gradient(45deg, #84fab0 0%, #8fd3f4 100%)" },
        "Ratio":      { icon: "bar-chart-2",    gradient: "linear-gradient(45deg, #d4fc79 0%, #96e6a1 100%)" },
        "Measurement":{ icon: "box",          gradient: "linear-gradient(45deg, #fbc2eb 0%, #a6c1ee 100%)" },
        "Data Analysis": { icon: "pie-chart",    gradient: "linear-gradient(45deg, #ffc3a0 0%, #ffafbd 100%)" },
        "Percentage": { icon: "percent",        gradient: "linear-gradient(45deg, #f6d365 0%, #fda085 100%)" },
        "Geometry":   { icon: "triangle",       gradient: "linear-gradient(45deg, #89f7fe 0%, #66a6ff 100%)" },
        "Default":    { icon: "book-open",      gradient: "linear-gradient(45deg, #6c757d 0%, #a9a9a9 100%)" }
    };

    const welcomeChatLog = document.getElementById('welcome-chat-log');
    const welcomeChatActions = document.getElementById('welcome-chat-actions');

    // --- VIEW MANAGEMENT WITH URL ROUTING ---
    function showView(viewId, updateURL = true) {
        // This function robustly finds all views and hides them
        const allViewElements = document.querySelectorAll('.view-container');
        allViewElements.forEach(view => {
            view.style.display = 'none';
        });
        
        // Then it finds the specific view to show and displays it
        const activeView = document.getElementById(viewId);
        if (activeView) {
            // We use 'flex' because our containers rely on flexbox for centering
            activeView.style.display = 'flex';
            
            // Update URL hash to reflect current view
            if (updateURL) {
                updateURLHash(viewId);
            }
        } else {
            console.error(`Error: Could not find view with id "${viewId}"`);
        }
    }

    function updateURLHash(viewId, context = null) {
        let hash = `#/${viewId.replace('-view', '')}`;
        
        // Add context for specific views
        if (context) {
            if (viewId === 'topic-view') {
                hash = `#/topics/${encodeURIComponent(context)}`;
            } else if (viewId === 'solver-view') {
                hash = `#/problems/${encodeURIComponent(context)}`;
            }
        }
        
        // Update URL without triggering a page reload
        window.history.pushState({viewId, context}, '', hash);
    }

    function handleURLChange() {
        const hash = window.location.hash;
        
        if (!hash || hash === '#/' || hash === '#') {
            // Default route
            initializeApp();
            return;
        }

        // Parse hash routes
        if (hash.startsWith('#/topics/')) {
            const topicName = decodeURIComponent(hash.replace('#/topics/', ''));
            currentTopicName = topicName;
            showTopicView(topicName);
        } else if (hash.startsWith('#/problems/')) {
            const problemId = decodeURIComponent(hash.replace('#/problems/', ''));
            switchToSolverView(problemId);
        } else if (hash === '#/quiz') {
            showView('quiz-view', false);
        } else if (hash === '#/signup') {
            showView('signup-view', false);
        } else if (hash === '#/login') {
            showView('login-view', false);
        } else if (hash === '#/dashboard') {
            showView('dashboard-view', false);
            fetchAndDisplayDashboard();
        } else {
            // Default to welcome/dashboard based on auth
            initializeApp();
        }
    }

    async function typewriterEffect(element, lines, onComplete) {
        element.innerHTML = ''; // Clear the element
        const cursor = `<span class="typing-cursor"></span>`;

        for (const line of lines) {
            const lineElement = document.createElement('p');
            element.appendChild(lineElement);

            for (let i = 0; i < line.length; i++) {
                lineElement.innerHTML = line.substring(0, i + 1) + cursor;
                await new Promise(resolve => setTimeout(resolve, 45)); // Adjust typing speed here
            }
            lineElement.innerHTML = line; // Finalize line without cursor
            await new Promise(resolve => setTimeout(resolve, 700)); // The pause between lines
        }

        if (onComplete) {
            onComplete(); // Call the callback when all lines are done
        }
    }

    async function startSession() {
        showView('welcome-chat-view');
        welcomeChatLog.innerHTML = `<div class="chat-turn model-turn"><p>Connecting to your AI Tutor...</p></div>`;
        welcomeChatActions.innerHTML = '';
        authToken = localStorage.getItem('authToken');

        try {
            const response = await fetch(`${API_BASE_URL}/session/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // This line conditionally adds the Authorization header ONLY if a token exists
                    ...(authToken && { 'Authorization': `Bearer ${authToken}` })
                },
                // A POST request should have a body, even if it's empty
                body: JSON.stringify({})
            });
            if (!response.ok) throw new Error('Session start failed');
            
            const data = await response.json();
            
            const messageContainer = document.createElement('div');
            messageContainer.className = 'chat-turn model-turn';
            const textElement = document.createElement('p');
            messageContainer.appendChild(textElement);
            
            welcomeChatLog.innerHTML = '';
            welcomeChatLog.appendChild(messageContainer);

            // This determines the message content based on user state
            const linesToType = data.message_lines || [data.message];
            const fullMessageToSpeak = linesToType.join(' ');

            // --- THE FIX IS HERE ---
            // We call speak() with the full message first
            speak(fullMessageToSpeak);
            
            // Then we start the typewriter effect
            typewriterEffect(textElement, linesToType, () => {
                // This callback runs only after the typing is complete
                if (data.suggested_actions && welcomeChatActions.children.length === 0) {
                    data.suggested_actions.forEach(action => {
                        const button = document.createElement('button');
                        button.className = 'action-button';
                        button.textContent = action.text;
                        button.dataset.actionId = action.action_id;
                        if (action.context) button.dataset.context = action.context;
                        welcomeChatActions.appendChild(button);
                    });
                }
            });

        } catch (error) {
            welcomeChatLog.innerHTML = `<div class="chat-turn model-turn"><p>Sorry, I couldn't connect. Please try refreshing the page.</p></div>`;
            console.error("Error starting session:", error);
        }
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
        const ttsButton = document.createElement('button');
        ttsButton.id = 'tts-toggle-button';

        // Set the initial icon based on the state
        ttsButton.innerHTML = isTtsEnabled ? `<i data-feather="volume-2"></i>` : `<i data-feather="volume-x"></i>`;

        ttsButton.addEventListener('click', () => {
            isTtsEnabled = !isTtsEnabled; // Toggle the state
            ttsButton.innerHTML = isTtsEnabled ? `<i data-feather="volume-2"></i>` : `<i data-feather="volume-x"></i>`;
            if (!isTtsEnabled) {
                synth.cancel(); // Stop any currently speaking utterance
            }
            feather.replace();
        });

        mainNav.appendChild(ttsButton);

        // Add the Login or Logout button next to it
        if (authToken) {
            const logoutButton = document.createElement('button');
            logoutButton.innerHTML = `<i data-feather="log-out"></i> Logout`;
            logoutButton.addEventListener('click', handleLogout);
            mainNav.appendChild(logoutButton);
        } else {
            const loginButton = document.createElement('button');
            loginButton.textContent = 'Login';
            loginButton.addEventListener('click', () => { showView('login-view'); });
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

        // Get the new name fields
        const firstName = document.getElementById('signup-firstname').value;
        const lastName = document.getElementById('signup-lastname').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        // The rest of the logic remains the same
        const quizResults = quizState.userAnswers.length > 0 ? quizState.userAnswers : null;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    firstName, // Send the new data
                    lastName,  // Send the new data
                    quiz_results: quizResults,
                    recommended_topic: quizState.recommendedTopic
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Signup failed');

            if (data.token) {
                authToken = data.token;
                localStorage.setItem('authToken', authToken);
                initializeApp(); // This will trigger the personalized welcome flow
            } else {
                // Fallback in case token isn't returned
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
        showView('logout-view');
        updateHeader();
    }
    
    // --- QUIZ LOGIC ---
    async function startQuiz() {
        showView('quiz-view');
        quizState = { questions: [], currentQuestionIndex: 0, userAnswers: [] };
        try {
            const response = await fetch(APP_CONFIG.getHierarchicalURL('/diagnostic/start'));
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
        const recommendedContainer = document.getElementById('recommended-topics-container');
        const allTopicsContainer = document.getElementById('all-topics-container');
        recommendedContainer.innerHTML = '<p>Loading recommendations...</p>';
        allTopicsContainer.innerHTML = '';

        try {
            const response = await authedFetch(APP_CONFIG.getHierarchicalURL('/dashboard'));
            if (!response.ok) throw new Error('Could not fetch dashboard data');
            const data = await response.json();

            // A helper function to create a card to avoid repeating code
            const createTopicCard = (topic) => {
                const card = document.createElement('div');
                card.className = 'topic-card';

                // Get the specific icon and gradient for this topic
                const metadata = TOPIC_METADATA[topic] || TOPIC_METADATA['Default'];

                card.style.background = metadata.gradient;
                card.innerHTML = `<i data-feather="${metadata.icon}"></i><span>${topic}</span>`;

                card.addEventListener('click', () => showTopicView(topic));
                return card;
            };

            // --- Populate Recommended Topics ---
            recommendedContainer.innerHTML = '';
            if (data.recommended_topics && data.recommended_topics.length > 0) {
                data.recommended_topics.forEach(topic => {
                    recommendedContainer.appendChild(createTopicCard(topic));
                });
            } else {
                recommendedContainer.innerHTML = '<p>No specific recommendations yet. Great job! Pick any topic to begin.</p>';
            }

            // --- Populate All Other Topics ---
            allTopicsContainer.innerHTML = '';
            if (data.all_topics && data.all_topics.length > 0) {
                data.all_topics.forEach(topic => {
                    allTopicsContainer.appendChild(createTopicCard(topic));
                });
            }

            // This is essential to render the new icons
            feather.replace();

        } catch (error) {
            recommendedContainer.innerHTML = '<p>Could not load recommendations.</p>';
            console.error("Dashboard fetch error:", error);
        }
    }
    
    async function showTopicView(topicName) {
        currentTopicName = topicName;
        showView('topic-view', false); // Don't auto-update URL, we'll do it manually
        updateURLHash('topic-view', topicName);
        document.getElementById('topic-title').textContent = topicName;

        // --- 1. INITIALIZE LOADING STATES ---
        const scorecard = document.getElementById('topic-scorecard');
        const problemList = document.getElementById('topic-problem-list');
        const listHeader = document.getElementById('problem-list-header');
        
        scorecard.innerHTML = `<p>Loading stats...</p>`;
        problemList.innerHTML = '<p>Loading problems...</p>';
        listHeader.textContent = 'Next Up For You';

        try {
            // --- 2. LOAD STATS AND PROBLEMS IN PARALLEL ---
            const [summaryResponse] = await Promise.all([
                authedFetch(APP_CONFIG.getHierarchicalURL(`/topics/${encodeURIComponent(topicName)}/progress/summary`)),
                // Start loading the default 'next' problems immediately
                fetchAndDisplayProblemList(topicName, 'next')
            ]);
            
            const summary = await summaryResponse.json();

            // --- 3. RENDER SCORECARD AFTER STATS LOAD ---
            scorecard.innerHTML = `
                <button id="filter-in-progress" class="stat-card in-progress">
                    <div class="stat-card-value">${summary.in_progress_count}</div>
                    <div class="stat-card-label">In Progress</div>
                </button>
                <button id="filter-mastered" class="stat-card mastered">
                    <div class="stat-card-value">${summary.mastered_count}</div>
                    <div class="stat-card-label">Mastered</div>
                </button>
            `;

            // --- 4. ADD EVENT LISTENERS TO SCORECARD ---
            const masteredButton = document.getElementById('filter-mastered');
            const inProgressButton = document.getElementById('filter-in-progress');
            
            masteredButton.addEventListener('click', () => {
                masteredButton.classList.add('active');
                inProgressButton.classList.remove('active');
                fetchAndDisplayProblemList(topicName, 'mastered');
            });

            inProgressButton.addEventListener('click', () => {
                inProgressButton.classList.add('active');
                masteredButton.classList.remove('active');
                fetchAndDisplayProblemList(topicName, 'in_progress');
            });

            // --- 5. SET UP NEXT PROBLEM BUTTON ---
            const nextProblemButton = document.getElementById('show-next-problem-button');
            nextProblemButton.addEventListener('click', () => {
                // De-select the other filter buttons
                masteredButton.classList.remove('active');
                inProgressButton.classList.remove('active');
                // Fetch the next unseen problem
                fetchAndDisplayProblemList(topicName, 'next');
            });

        } catch (error) {
            console.error('Error loading topic view:', error);
            scorecard.innerHTML = '<p>Error loading stats</p>';
            problemList.innerHTML = '<p>Error loading problems</p>';
        }
    }


    async function fetchAndDisplayProblemList(topicName, filter) {
        const problemList = document.getElementById('topic-problem-list');
        const listHeader = document.getElementById('problem-list-header');
        problemList.innerHTML = '<p>Loading problems...</p>';

        // Update header based on filter
        if (filter === 'mastered') {
            listHeader.textContent = 'Completed Problems';
        } else if (filter === 'in_progress') {
            listHeader.textContent = 'In Progress Problems';
        } else {
            listHeader.textContent = 'Next Up For You';
        }

        try {
            const response = await authedFetch(APP_CONFIG.getHierarchicalURL(`/topics/${encodeURIComponent(topicName)}/problems?filter=${filter}`));
            if (!response.ok) throw new Error('Could not fetch problems');
            const problems = await response.json();

            problemList.innerHTML = ''; // Clear loading message
            if (problems.length > 0) {
                problems.forEach(problem => {
                    const problemElement = document.createElement('div');
                    problemElement.className = 'problem-item';
                    problemElement.innerHTML = `<span>${problem.title}</span>`;
                    problemElement.addEventListener('click', () => switchToSolverView(problem.id));
                    problemList.appendChild(problemElement);
                });
            } else {
                problemList.innerHTML = `<p>No problems found for this filter.</p>`;
            }
        } catch (error) {
            problemList.innerHTML = '<p>Could not load problems.</p>';
            console.error(`Error fetching problems for filter ${filter}:`, error);
        }
    }

    async function switchToSolverView(problemId) {
        // 1. Immediately switch to the solver view and reset all states
        showView('solver-view', false); // Don't auto-update URL, we'll do it manually
        updateURLHash('solver-view', problemId);
        currentProblemId = problemId;
        currentProblemData = null;
        chatHistory = [];
        currentHintIndex = 0;
        
        // 2. Clear the UI and show a loading message

        problemTextElement.innerHTML = '<p>Loading problem...</p>';
        renderChart(null);
        renderChatHistory();

        try {
            // 3. Fetch both the problem data and the user's progress for it at the same time
            const [problemResponse, progressResponse] = await Promise.all([
                authedFetch(APP_CONFIG.getHierarchicalURL(`/problems/${problemId}`)),
                authedFetch(`${API_BASE_URL}/progress/${problemId}`) // Progress endpoint remains non-hierarchical
            ]);

            if (!problemResponse.ok || !progressResponse.ok) {
                throw new Error('Could not load problem data or user progress.');
            }

            const problem = await problemResponse.json();
            const progress = await progressResponse.json();

            // 4. Update our application's state with the fetched data
            currentProblemData = problem;
            chatHistory = progress.chat_history || [];

            // 5. Render all the new content
            problemTextElement.innerHTML = currentProblemData.problem_text;
            typesetMath(problemTextElement);

            problemImageElement.style.display = currentProblemData.image_url ? 'block' : 'none';
            problemImageElement.src = currentProblemData.image_url || '';
            
            if (currentProblemData.chart_data) {
                renderChart(currentProblemData.chart_data);
            }

            renderChatHistory(); // Render the loaded chat history


        } catch (error) {
            console.error("Error loading solver view:", error);
            problemTextElement.innerHTML = '<p>Failed to load the problem. Please go back and try again.</p>';
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
            const response = await authedFetch(APP_CONFIG.getHierarchicalURL('/tutor/submit_answer'), {
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
        resultsArea.innerHTML = '<h2>Analyzing your results<span class="ellipsis"><span>.</span><span>.</span><span>.</span></span></h2><p>I am building your personalized report.</p>';
        signupPromptArea.style.display = 'none'; // Ensure the prompt is hidden initially

        try {
            const response = await fetch(APP_CONFIG.getHierarchicalURL('/diagnostic/analyze'), {
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

            // Add click event listener to the recommended topic card
            const recommendedTopicCard = resultsArea.querySelector('.recommended-topic-card');
            if (recommendedTopicCard) {
                recommendedTopicCard.addEventListener('click', () => {
                    showView('signup-view');
                });
            }

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


    function renderChart(chartConfig) {
        // If a chart already exists, destroy it before drawing a new one
        if (currentChart) {
            currentChart.destroy();
        }

        const chartContainer = document.getElementById('chart-container');
        const problemChartCanvas = document.getElementById('problem-chart');

        // Check if we have valid data to render
        if (chartConfig && chartConfig.type && chartConfig.data) {
            chartContainer.style.display = 'block';
            const ctx = problemChartCanvas.getContext('2d');

            // For now, we only handle 'pie', but this is ready for 'bar', 'line', etc.
            if (chartConfig.type === 'pie') {
                currentChart = new Chart(ctx, {
                    type: 'pie',
                    data: chartConfig.data, // Use the data object directly from our JSON
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'top',
                            }
                        }
                    }
                });
            }
            // Future: else if (chartConfig.type === 'bar') { ... }

        } else {
            // If no chart data, hide the container
            chartContainer.style.display = 'none';
        }
    }

    async function speak(textToSpeak) {
        if (!isTtsEnabled || !textToSpeak) {
            return;
        }

        try {
            // Call our new backend endpoint to generate the audio
            const response = await fetch(`${API_BASE_URL}/tts/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToSpeak })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch audio from backend.');
            }

            // Get the audio data as a 'blob'
            const audioBlob = await response.blob();
            // Create a temporary URL for the audio blob
            const audioUrl = URL.createObjectURL(audioBlob);

            // Create an audio element and play it
            const audio = new Audio(audioUrl);
            audio.play();

        } catch (error) {
            console.error("Text-to-speech failed:", error);
        }
    }

    // --- INITIALIZATION ---
    function initializeApp() {
        updateHeader(); // Set up the header button first
        startSession(); // Start the session to get personalized welcome
    }

    // Attach all event listeners
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    showSignupLink.addEventListener('click', (e) => { e.preventDefault(); showView('signup-view'); });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); showView('login-view'); });
    hookShowSignupButton.addEventListener('click', (e) => { e.preventDefault(); showView('signup-view'); });
    hookShowLoginLink.addEventListener('click', (e) => { e.preventDefault(); showView('login-view'); });
    backButton.addEventListener('click', () => {
        // If we know what the last topic was, reload it completely.
        if (currentTopicName) {
            showTopicView(currentTopicName);
        } else {
            // As a fallback, just go to the main dashboard.
            showView('dashboard-view');
            fetchAndDisplayDashboard();
        }
    });
    backToDashboardFromTopicButton.addEventListener('click', () => { showView('dashboard-view'); fetchAndDisplayDashboard(); });
    submitButton.addEventListener('click', submitAnswer);
    answerInputElement.addEventListener('keyup', (e) => { if (e.key === 'Enter') submitAnswer(); });
    startQuizButton.addEventListener('click', startQuiz);
    quizSubmitButton.addEventListener('click', handleQuizSubmit);

    document.body.addEventListener('click', (e) => {
        // Check if the clicked element is one of our dynamic action buttons
        if (e.target && e.target.matches('.action-button')) {
            const actionId = e.target.dataset.actionId;
            const context = e.target.dataset.context;

            if (actionId === 'start_quiz') {
                startQuiz();
            } else if (actionId === 'show_login') {
                showView('login-view');
            } else if (actionId === 'browse_topics') {
                showView('dashboard-view');
                fetchAndDisplayDashboard();
            } else if (actionId === 'continue_topic' && context) {
                showTopicView(context);
            }
        }
        });

    // --- URL ROUTING EVENT LISTENERS ---
    // Handle browser back/forward buttons
    window.addEventListener('popstate', handleURLChange);
    
    // Initialize app - only once when DOM is ready
    if (window.location.hash) {
        handleURLChange();
    } else {
        initializeApp();
    }
});
