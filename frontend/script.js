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
    let authToken = localStorage.getItem('authToken');
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
    let algebraTutorHistory = [];
    let currentAlgebraStep = 1;
    let isTtsEnabled = true; // Voice is on by default
    const synth = window.speechSynthesis;
    
    // --- EMOTIONAL INTELLIGENCE AI TRACKING ---
    let emotionalState = {
        questionStartTime: null,
        consecutiveErrors: 0,
        responseTimeHistory: [],
        confidenceIndicators: [],
        strugglingPattern: false,
        lastEmotionalIntervention: null
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
        algebraTutor: document.getElementById('algebra-tutor-view'),
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
        console.log('🌐 DEBUGGING: handleURLChange called with hash:', hash);
        console.log('🌐 DEBUGGING: handleURLChange call stack:', new Error().stack);
        
        if (!hash || hash === '#/' || hash === '#') {
            // Default route
            initializeApp();
            return;
        }

        // Parse hash routes
        if (hash.startsWith('#/topics/')) {
            if (!authToken) {
                showView('login-view', false);
                return;
            }
            const topicName = decodeURIComponent(hash.replace('#/topics/', ''));
            currentTopicName = topicName;
            showTopicView(topicName);
        } else if (hash.startsWith('#/problems/')) {
            if (!authToken) {
                showView('login-view', false);
                return;
            }
            const problemId = decodeURIComponent(hash.replace('#/problems/', ''));
            switchToSolverView(problemId);
        } else if (hash.startsWith('#/algebra-tutor')) {
            console.log('🔗 Hash routing: detected #/algebra-tutor, calling startAlgebraTutor');
            console.log('🔗 DEBUGGING: Hash routing call stack:', new Error().stack);
            if (!authToken) {
                showView('login-view', false);
                return;
            }
            startAlgebraTutor();
        } else if (hash.startsWith('#/fractions-tutor')) {
            console.log('🔗 Hash routing: detected #/fractions-tutor, calling startFractionsTutor');
            console.log('🔗 DEBUGGING: Hash routing call stack:', new Error().stack);
            if (!authToken) {
                showView('login-view', false);
                return;
            }
            startFractionsTutor();
        } else if (hash.match(/#\/(\w+)-tutor/)) {
            // Generic tutor routing for any topic (geometry, ratio, speed, etc.)
            const topicMatch = hash.match(/#\/(\w+)-tutor/);
            const topic = topicMatch[1];
            
            // Skip if it's a topic we already handle specifically
            if (topic !== 'algebra' && topic !== 'fractions') {
                console.log(`🔗 Hash routing: detected #/${topic}-tutor, calling startLearningTutor`);
                if (!authToken) {
                    showView('login-view', false);
                    return;
                }
                startLearningTutor(topic);
            }
        } else if (hash === '#/quiz') {
            showView('quiz-view', false);
        } else if (hash === '#/signup') {
            showView('signup-view', false);
        } else if (hash === '#/login') {
            showView('login-view', false);
        } else if (hash === '#/dashboard') {
            if (!authToken) {
                showView('login-view', false);
                return;
            }
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

        // --- 1. INITIALIZE CLEAN STATE ---
        const scorecard = document.getElementById('topic-scorecard');
        const problemList = document.getElementById('topic-problem-list');
        const listHeader = document.getElementById('problem-list-header');
        
        // Clear legacy elements
        scorecard.innerHTML = '';
        problemList.innerHTML = '';
        listHeader.textContent = '';

        try {
            // --- 2. LOAD STATS FOR DECISION MAKING ---
            const summaryResponse = await authedFetch(APP_CONFIG.getHierarchicalURL(`/topics/${encodeURIComponent(topicName)}/progress/summary`));
            
            const summary = await summaryResponse.json();

            // --- 3. CLEAR LEGACY UI ELEMENTS ---
            scorecard.innerHTML = '';
            problemList.innerHTML = '';
            listHeader.textContent = '';

            // --- 5. SET UP CONTEXT-AWARE DASHBOARD ---
            await updateTopicViewForLearning(topicName, summary);

            // Event handlers are set up in updateTopicViewForLearning

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
        
        // Remove any existing next problem button when loading a new problem
        const existingButton = document.getElementById('next-problem-button');
        if (existingButton) {
            existingButton.remove();
        }
        
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
            
            // 5. Set current topic name from problem data
            if (problem.topic) {
                currentTopicName = problem.topic;
                console.log('switchToSolverView: currentTopicName set to:', currentTopicName);
            } else {
                console.warn('Problem data does not include topic information');
            }

            // 6. Render all the new content
            problemTextElement.innerHTML = currentProblemData.problem_text;
            typesetMath(problemTextElement);

            problemImageElement.style.display = currentProblemData.image_url ? 'block' : 'none';
            problemImageElement.src = currentProblemData.image_url || '';
            
            if (currentProblemData.chart_data) {
                renderChart(currentProblemData.chart_data);
            }

            renderChatHistory(); // Render the loaded chat history
            
            // --- EMOTIONAL INTELLIGENCE: Start timing for new problem ---
            emotionalState.questionStartTime = Date.now();
            emotionalState.consecutiveErrors = 0; // Reset error count for new problem
            console.log("⏱️ EI: Started timing for new problem, reset error count");


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
        
        // --- EMOTIONAL INTELLIGENCE FOR PRACTICE MODE ---
        const responseTime = emotionalState.questionStartTime ? 
            Date.now() - emotionalState.questionStartTime : null;
        
        // AI-powered confidence analysis
        const confidenceMarkers = await analyzeConfidence(studentAnswer);
        
        // Debug logging
        console.log("⏱️ EI: Response time:", responseTime + "ms");
        console.log("🤖 EI: AI Confidence analysis:", confidenceMarkers);
        
        if (responseTime) {
            emotionalState.responseTimeHistory.push(responseTime);
            if (emotionalState.responseTimeHistory.length > 10) {
                emotionalState.responseTimeHistory.shift();
            }
        }
        
        try {
            const response = await authedFetch(APP_CONFIG.getHierarchicalURL('/tutor/submit_answer'), {
                method: 'POST',
                body: JSON.stringify({ 
                    problem_id: currentProblemId, 
                    student_answer: studentAnswer, 
                    chat_history: chatHistory,
                    emotional_intelligence: {
                        response_time: responseTime,
                        consecutive_errors: emotionalState.consecutiveErrors,
                        avg_response_time: emotionalState.responseTimeHistory.length > 0 ? 
                            emotionalState.responseTimeHistory.reduce((a, b) => a + b, 0) / emotionalState.responseTimeHistory.length : null,
                        confidence_indicators: confidenceMarkers,
                        struggling_pattern: emotionalState.strugglingPattern
                    }
                }),
            });
            if (!response.ok) throw new Error('Network response was not ok');
            const result = await response.json();
            
            // --- EMOTIONAL INTELLIGENCE: Update error tracking ---
            if (result.is_correct) {
                emotionalState.consecutiveErrors = 0; // Reset on success
                console.log("✅ EI: Correct answer, resetting error count");
                chatHistory.push({ role: 'model', parts: [result.feedback.encouragement] });
            } else {
                emotionalState.consecutiveErrors++; // Increment on error
                console.log(`❌ EI: Wrong answer, consecutive errors: ${emotionalState.consecutiveErrors}`);
                
                // Format feedback properly - combine encouragement and socratic question
                let feedbackText = result.feedback.encouragement || "";
                if (result.feedback.socratic_question) {
                    feedbackText += (feedbackText ? "\n\n" : "") + result.feedback.socratic_question;
                }
                
                chatHistory.push({ role: 'model', parts: [feedbackText] });
            }
            
            // Update struggling pattern detection
            detectStrugglePattern();
            
            renderChatHistory();
            if (result.is_correct) {
                // Refresh dashboard data in background to update status badge
                fetchAndDisplayDashboard();
                // Show Next Problem button
                showNextProblemButton();
            }
        } catch (error) { console.error('Submit answer error:', error); }
    }

    function showNextProblemButton() {
        // Remove any existing next problem button
        const existingButton = document.getElementById('next-problem-button');
        if (existingButton) {
            existingButton.remove();
        }
        
        // Create Next Problem button
        const nextButton = document.createElement('button');
        nextButton.id = 'next-problem-button';
        nextButton.className = 'next-problem-btn';
        nextButton.innerHTML = `
            <i data-feather="arrow-right"></i>
            Next Problem
        `;
        nextButton.onclick = loadNextProblem;
        
        // Add button to feedback area
        const feedbackArea = document.getElementById('feedback-area');
        feedbackArea.appendChild(nextButton);
        
        // Refresh feather icons
        feather.replace();
    }

    function loadNextProblem() {
        // Get the current topic and find next problem
        if (!currentTopicName) {
            console.error('No current topic set');
            return;
        }
        
        // Get next problem from the same topic
        fetch(APP_CONFIG.getHierarchicalURL(`/topics/${encodeURIComponent(currentTopicName)}/problems?filter=next`), {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        })
        .then(response => response.json())
        .then(problems => {
            if (problems && problems.length > 0) {
                // Find a problem that's not the current one
                let nextProblem = problems.find(p => p.id !== currentProblemId);
                
                if (!nextProblem) {
                    // If no different problem found, just take the first one
                    nextProblem = problems[0];
                }
                
                if (nextProblem) {
                    // Load the next problem
                    switchToSolverView(nextProblem.id);
                } else {
                    // No more problems available
                    alert('Great job! You\'ve completed all available problems in this topic.');
                    showTopicView(currentTopicName);
                }
            } else {
                // No problems available, go back to topic view
                alert('Great job! You\'ve completed all available problems in this topic.');
                showTopicView(currentTopicName);
            }
        })
        .catch(error => {
            console.error('Error loading next problem:', error);
            alert('Error loading next problem. Please try again.');
        });
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

    // --- CONCEPT LEARNING FUNCTIONS ---
    
    
    async function determineStudentLearningState(topicName, summary) {
        // Determine if student should see learning mode or practice mode
        if (topicName !== 'Algebra' && topicName !== 'Fractions') {
            return { mode: 'practice', reason: 'not_learning_topic' };
        }
        
        // TEMPORARILY DISABLE STATUS CHECK TO DEBUG HANGING ISSUE
        // try {
        //     // Check algebra tutor status first (with timeout)
        //     const controller = new AbortController();
        //     const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
            
        //     const tutorResponse = await authedFetch(APP_CONFIG.getHierarchicalURL('/algebra-tutor/status'), {
        //         signal: controller.signal
        //     });
        //     clearTimeout(timeoutId);
            
        //     if (tutorResponse.ok) {
        //         const tutorStatus = await tutorResponse.json();
                
        //         // If user completed tutoring (mastered), always show practice mode
        //         if (tutorStatus.progress_status === 'mastered') {
        //             return { mode: 'practice', reason: 'completed_tutoring' };
        //         }
                
        //         // If user has tutoring history, show learning mode to continue
        //         if (tutorStatus.has_history && tutorStatus.progress_status === 'in_progress') {
        //             return { mode: 'learning', reason: 'continue_tutoring' };
        //         }
        //     }
        // } catch (error) {
        //     console.warn('Could not check algebra tutor status:', error);
        //     // Fall through to problem-based logic to ensure page doesn't break
        // }
        
        // Check if student has significant progress (indicating they've done some work)
        const totalProgress = (summary.mastered_count || 0) + (summary.in_progress_count || 0);
        
        if (totalProgress === 0) {
            // Brand new to algebra - show learning mode
            return { mode: 'learning', reason: 'new_student' };
        } else if (summary.mastered_count >= 2) {
            // Has mastered multiple problems - show practice mode
            return { mode: 'practice', reason: 'experienced_student' };
        } else {
            // Has some progress but not much - could be either, default to learning
            return { mode: 'learning', reason: 'minimal_progress' };
        }
    }
    
    function showLearningModeDashboard(topicName) {
        // Show learning mode UI
        document.getElementById('learning-mode-dashboard').style.display = 'block';
        document.getElementById('practice-mode-dashboard').style.display = 'none';
        document.getElementById('legacy-practice-area').style.display = 'none';
        
        // Update the topic title
        const topicTitle = document.getElementById('learning-topic-title');
        if (topicTitle) {
            topicTitle.textContent = `🎓 Learn ${topicName}`;
        }
        
        // Create the pathway content for this topic
        createPathwayContent(topicName);
        
        // Initialize the learning pathway for the specific topic
        initializeLearningPathway(topicName);
        
        // Set up event listeners
        const skipToPracticeBtn = document.getElementById('skip-to-practice');
        
        if (skipToPracticeBtn) {
            console.log('🔗 DEBUGGING: Adding event listener to skip-to-practice button');
            // Remove existing listeners first to prevent duplicates
            const newSkipBtn = skipToPracticeBtn.cloneNode(true);
            skipToPracticeBtn.parentNode.replaceChild(newSkipBtn, skipToPracticeBtn);
            newSkipBtn.addEventListener('click', () => {
                showPracticeModeDashboard(currentTopicName);
            });
        }
    }

    function createPathwayContent(topicName) {
        const container = document.getElementById('pathway-container');
        if (!container) return;
        
        // Clear existing content
        container.innerHTML = '';
        
        let steps = [];
        
        if (topicName === 'Algebra') {
            steps = [
                {
                    icon: '📦➡️📝',
                    title: 'From Boxes to Letters',
                    description: 'Understanding that letters can represent unknown numbers'
                },
                {
                    icon: '🔢',
                    title: 'Simple Algebraic Expressions', 
                    description: 'Working with expressions like a + 3, 2x, and n ÷ 3'
                },
                {
                    icon: '🔄',
                    title: 'Substitution',
                    description: 'Finding values when we know what letters represent'
                },
                {
                    icon: '📖',
                    title: 'Word Problems with Visual Models',
                    description: 'Solving real-world problems using algebra'
                }
            ];
        } else if (topicName === 'Fractions') {
            steps = [
                {
                    icon: '🍕➗',
                    title: 'Dividing Fractions by Whole Numbers',
                    description: 'Understanding how to divide fractions like 1/2 ÷ 3'
                },
                {
                    icon: '🔄📊',
                    title: 'Dividing by Fractions',
                    description: 'Learning to divide using reciprocals like 4 ÷ 1/2'
                },
                {
                    icon: '📝🧮',
                    title: 'Word Problems with Four Operations',
                    description: 'Solving real-world problems with +, -, ×, ÷ of fractions'
                },
                {
                    icon: '🧩🎯',
                    title: 'Multi-Step Complex Problems',
                    description: 'Advanced problems requiring multiple operations'
                }
            ];
        }
        
        // Create pathway steps
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const stepNumber = i + 1;
            
            // Create step element
            const stepElement = document.createElement('div');
            stepElement.className = 'pathway-step unlocked current';
            stepElement.setAttribute('data-step', stepNumber);
            
            if (stepNumber === 1) {
                stepElement.classList.add('unlocked', 'current');
            } else {
                stepElement.classList.remove('unlocked', 'current');
                stepElement.classList.add('locked');
            }
            
            stepElement.innerHTML = `
                <div class="step-icon">
                    <span class="icon-symbol">${step.icon}</span>
                    <div class="step-number">${stepNumber}</div>
                </div>
                <div class="step-content">
                    <h4>${step.title}</h4>
                    <p>${step.description}</p>
                    <div class="step-status">
                        <span class="status-text">${stepNumber === 1 ? 'Ready to start!' : `🔒 Complete Step ${stepNumber - 1} to unlock`}</span>
                    </div>
                </div>
            `;
            
            container.appendChild(stepElement);
            
            // Add connector (except after last step)
            if (i < steps.length - 1) {
                const connector = document.createElement('div');
                connector.className = 'pathway-connector locked';
                container.appendChild(connector);
            }
        }
    }

    // --- LEARNING PATHWAY MANAGEMENT ---
    function initializeLearningPathway(topicName) {
        // Get user's tutor progress from localStorage or API
        if (topicName === 'Algebra') {
            getUserAlgebraTutorProgress().then(progress => {
                updateLearningPathway(progress);
                setupPathwayInteractivity(topicName);
            });
        } else if (topicName === 'Fractions') {
            getUserFractionsTutorProgress().then(progress => {
                updateLearningPathway(progress);
                setupPathwayInteractivity(topicName);
            });
        }
    }

    async function getUserAlgebraTutorProgress() {
        try {
            // Use hierarchical URL structure
            const url = APP_CONFIG.getHierarchicalURL('/algebra-tutor/status');
            const response = await authedFetch(url);
            if (response.ok) {
                const status = await response.json();
                console.log('📊 PATHWAY: Fetched algebra tutor status:', status);
                const progress = {
                    completedSteps: status.completed_steps || 0,
                    currentStep: status.current_step || 1,
                    isCompleted: status.is_completed || false,
                    progressStatus: status.progress_status || 'pending'
                };
                console.log('📊 PATHWAY: Processed progress data:', progress);
                return progress;
            }
        } catch (error) {
            console.log('Could not fetch algebra tutor progress:', error);
        }
        
        // Default progress for new users
        return {
            completedSteps: 0,
            currentStep: 1,
            isCompleted: false,
            progressStatus: 'pending'
        };
    }

    async function getUserFractionsTutorProgress() {
        try {
            // Use hierarchical URL structure
            const url = APP_CONFIG.getHierarchicalURL('/fractions-tutor/status');
            const response = await authedFetch(url);
            if (response.ok) {
                const status = await response.json();
                console.log('📊 PATHWAY: Fetched fractions tutor status:', status);
                const progress = {
                    completedSteps: status.completed_steps || 0,
                    currentStep: status.current_step || 1,
                    isCompleted: status.is_completed || false,
                    progressStatus: status.progress_status || 'pending'
                };
                console.log('📊 PATHWAY: Processed progress data:', progress);
                return progress;
            }
        } catch (error) {
            console.log('Could not fetch fractions tutor progress:', error);
        }
        
        // Default progress for new users
        return {
            completedSteps: 0,
            currentStep: 1,
            isCompleted: false,
            progressStatus: 'pending'
        };
    }

    function updateLearningPathway(progress) {
        const { completedSteps, currentStep, isCompleted, progressStatus } = progress;
        console.log('📊 PATHWAY: Updating pathway with:', progress);
        
        const pathwaySteps = document.querySelectorAll('.pathway-step');
        const pathwayConnectors = document.querySelectorAll('.pathway-connector');
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');

        console.log(`📊 PATHWAY: Found ${pathwaySteps.length} pathway steps in DOM`);

        // Calculate progress percentage
        const progressPercentage = isCompleted ? 100 : (completedSteps / 4) * 100;
        console.log(`📊 PATHWAY: Progress percentage: ${progressPercentage}% (${completedSteps}/4 steps completed)`);

        // Update progress bar
        if (progressFill && progressText) {
            progressFill.style.width = `${progressPercentage}%`;
            progressText.textContent = `${Math.round(progressPercentage)}% Complete`;
        }

        // Update each step
        pathwaySteps.forEach((step, index) => {
            const stepNumber = index + 1;
            const statusText = step.querySelector('.status-text');

            // Remove all status classes
            step.classList.remove('locked', 'unlocked', 'current', 'completed');

            if (stepNumber <= completedSteps) {
                // Completed step
                step.classList.add('completed');
                if (statusText) {
                    statusText.textContent = '✅ Completed!';
                }
            } else if (stepNumber === currentStep && !isCompleted) {
                // Current step - check if it's actually in progress or just ready to start
                step.classList.add('current', 'unlocked');
                if (statusText) {
                    // If progressStatus is 'in_progress', the user has started learning
                    if (progressStatus === 'in_progress' || progressStatus === 'mastered') {
                        statusText.textContent = '🔄 In Progress';
                    } else {
                        statusText.textContent = 'Ready to start!';
                    }
                }
            } else if (stepNumber === completedSteps + 1 && !isCompleted) {
                // Next available step
                step.classList.add('unlocked');
                if (statusText) {
                    statusText.textContent = 'Ready to start!';
                }
            } else {
                // Locked step
                step.classList.add('locked');
                if (statusText) {
                    statusText.textContent = `🔒 Complete Step ${stepNumber - 1} to unlock`;
                }
            }
        });

        // Update connectors
        pathwayConnectors.forEach((connector, index) => {
            connector.classList.remove('locked', 'unlocked', 'completed');
            
            if (index < completedSteps) {
                connector.classList.add('completed');
            } else if (index < currentStep - 1) {
                connector.classList.add('unlocked');
            } else {
                connector.classList.add('locked');
            }
        });
    }

    function setupPathwayInteractivity(topicName) {
        const pathwaySteps = document.querySelectorAll('.pathway-step');
        
        pathwaySteps.forEach((step, index) => {
            step.addEventListener('click', () => {
                const stepNumber = index + 1;
                
                // Only allow clicking on unlocked/current steps
                if (step.classList.contains('unlocked') || step.classList.contains('current')) {
                    handlePathwayStepClick(stepNumber, topicName);
                }
            });

            // Add hover effects for unlocked steps
            step.addEventListener('mouseenter', () => {
                if (step.classList.contains('unlocked') || step.classList.contains('current')) {
                    step.style.transform = 'scale(1.03)';
                    step.style.boxShadow = '0 8px 25px rgba(74, 144, 226, 0.2)';
                }
            });

            step.addEventListener('mouseleave', () => {
                if (!step.classList.contains('current')) {
                    step.style.transform = 'scale(1.0)';
                    step.style.boxShadow = '';
                }
            });
        });
    }

    function handlePathwayStepClick(stepNumber, topicName) {
        // Start the appropriate tutor based on topic
        if (topicName === 'Algebra') {
            console.log(`Starting algebra tutor from step ${stepNumber}`);
            startAlgebraTutorFromStep(stepNumber);
        } else if (topicName === 'Fractions') {
            console.log(`Starting fractions tutor from step ${stepNumber}`);
            startFractionsTutorFromStep(stepNumber);
        }
    }

    function startAlgebraTutorFromStep(stepNumber = 1) {
        // Modify the start algebra tutor function to accept a step parameter
        currentAlgebraStep = stepNumber;
        startAlgebraTutor();
    }

    function onAlgebraStepCompleted(stepNumber) {
        // This function should be called when a step is completed in the tutor
        console.log(`Algebra step ${stepNumber} completed!`);
        
        // Update the pathway display
        getUserAlgebraTutorProgress().then(progress => {
            updateLearningPathway(progress);
        });

        // Add celebration animation
        const step = document.querySelector(`[data-step="${stepNumber}"]`);
        if (step) {
            step.style.animation = 'celebrateCompletion 0.6s ease-in-out';
            setTimeout(() => {
                step.style.animation = '';
            }, 600);
        }
    }
    
    function showPracticeModeDashboard(topicName) {
        // Show practice mode UI
        document.getElementById('learning-mode-dashboard').style.display = 'none';
        document.getElementById('practice-mode-dashboard').style.display = 'block';
        document.getElementById('legacy-practice-area').style.display = 'none';
        
        // Update the practice progress title
        const practiceTitle = document.getElementById('practice-progress-title');
        if (practiceTitle) {
            practiceTitle.textContent = `📊 Your ${topicName} Progress`;
        }
        
        // Set up review with tutor button
        const reviewBtn = document.getElementById('review-with-tutor');
        if (reviewBtn) {
            console.log('🔗 DEBUGGING: Adding event listener to review-with-tutor button');
            // Remove existing listeners first to prevent duplicates
            const newReviewBtn = reviewBtn.cloneNode(true);
            reviewBtn.parentNode.replaceChild(newReviewBtn, reviewBtn);
            
            // Start the appropriate tutor based on topic
            if (topicName === 'Algebra') {
                newReviewBtn.addEventListener('click', startAlgebraTutor);
            } else if (topicName === 'Fractions') {
                newReviewBtn.addEventListener('click', startFractionsTutor);
            }
        }
        
        // Load practice mode data
        loadPracticeModeData(topicName);
    }
    
    async function loadPracticeModeData(topicName) {
        try {
            // Load stats and problems for practice mode
            const [summaryResponse] = await Promise.all([
                authedFetch(APP_CONFIG.getHierarchicalURL(`/topics/${encodeURIComponent(topicName)}/progress/summary`))
            ]);
            
            const summary = await summaryResponse.json();
            
            // Populate stats grid
            const statsGrid = document.getElementById('practice-stats');
            statsGrid.innerHTML = `
                <div class="practice-stat-card mastered" onclick="filterPracticeProblems('mastered')">
                    <div class="practice-stat-value">${summary.mastered_count || 0}</div>
                    <div class="practice-stat-label">Mastered</div>
                </div>
                <div class="practice-stat-card in-progress" onclick="filterPracticeProblems('in_progress')">
                    <div class="practice-stat-value">${summary.in_progress_count || 0}</div>
                    <div class="practice-stat-label">In Progress</div>
                </div>
            `;
            
            // Load initial problem list
            await loadPracticeProblems(topicName, 'next');
            
        } catch (error) {
            console.error('Error loading practice mode data:', error);
        }
    }
    
    async function loadPracticeProblems(topicName, filter) {
        try {
            const response = await authedFetch(APP_CONFIG.getHierarchicalURL(`/topics/${encodeURIComponent(topicName)}/problems?filter=${filter}`));
            const problems = await response.json();
            
            const problemList = document.getElementById('practice-problem-list');
            const header = document.getElementById('practice-problems-header');
            
            // Update header
            if (filter === 'mastered') {
                header.textContent = '✅ Completed Problems';
            } else if (filter === 'in_progress') {
                header.textContent = '🔄 In Progress Problems';
            } else {
                header.textContent = '📝 Next Problems';
            }
            
            // Populate problem list
            problemList.innerHTML = '';
            if (problems.length > 0) {
                problems.forEach(problem => {
                    const problemElement = document.createElement('div');
                    problemElement.className = 'problem-item';
                    problemElement.innerHTML = `<span>${problem.title}</span>`;
                    problemElement.addEventListener('click', () => switchToSolverView(problem.id));
                    problemList.appendChild(problemElement);
                });
            } else {
                problemList.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">No problems found for this filter.</p>`;
            }
        } catch (error) {
            console.error('Error loading practice problems:', error);
        }
    }
    
    // Global function for filtering practice problems
    window.filterPracticeProblems = (filter) => {
        loadPracticeProblems(currentTopicName, filter);
    };
    
    // Global function for going to practice problems from tutor
    window.goToPracticeProblems = () => {
        // Go directly to practice problems without showing dashboard
        console.log('goToPracticeProblems called, currentTopicName:', currentTopicName);
        showView('topic-view');
        if (currentTopicName) {
            // Show practice mode dashboard instead of learning mode
            showPracticeModeDashboard(currentTopicName);
            // Then load the practice problems
            loadPracticeProblems(currentTopicName, 'next');
        } else {
            console.error('currentTopicName is not set!');
        }
    };
    
    async function updateTopicViewForLearning(topicName, summary) {
        // Determine which dashboard to show based on student state
        const studentState = await determineStudentLearningState(topicName, summary);
        
        if (studentState.mode === 'learning') {
            showLearningModeDashboard(topicName);
        } else {
            showPracticeModeDashboard(topicName);
        }
    }
    
    // Algebra tutor functions
    let algebraTutorInitializing = false;  // Flag to prevent duplicate initialization
    let lastAlgebraTutorCall = 0;  // Track last call time to prevent rapid successive calls
    
    async function startAlgebraTutor() {
        try {
            // Enhanced debugging for duplicate calls
            const currentTime = Date.now();
            console.log('🔍 DEBUGGING: startAlgebraTutor called at', new Date().toISOString());
            console.log('🔍 DEBUGGING: Call stack:', new Error().stack);
            
            // Prevent rapid successive calls (within 1 second)
            if (currentTime - lastAlgebraTutorCall < 1000) {
                console.log('⚠️ RAPID SUCCESSIVE CALL: Ignoring call within 1 second of previous call');
                return;
            }
            
            // Prevent duplicate initialization
            if (algebraTutorInitializing) {
                console.log('⚠️ DUPLICATE CALL: Algebra tutor already initializing, skipping...');
                return;
            }
            
            lastAlgebraTutorCall = currentTime;
            algebraTutorInitializing = true;
            
            console.log('🚀 Starting algebra tutor...', new Date().toISOString());
            
            // Set current topic name for navigation back to practice problems
            currentTopicName = 'Algebra';
            console.log('startAlgebraTutor: currentTopicName set to:', currentTopicName);
            
            // Update tutor header text
            const tutorTitle = document.getElementById('tutor-header-title');
            const backText = document.getElementById('back-to-topic-text');
            if (tutorTitle) tutorTitle.textContent = '🎯 Algebra Tutor';
            if (backText) backText.textContent = 'Back to Algebra';
            
            showView('algebra-tutor-view', false);
            updateURLHash('algebra-tutor-view');
            
            // Clear previous chat
            const chatLog = document.getElementById('tutor-chat-log');
            chatLog.innerHTML = '';
            algebraTutorHistory = [];
            currentAlgebraStep = 1;
            
            console.log('Making API call to start algebra tutor...');
            
            // Start tutoring session with API
            const response = await authedFetch(APP_CONFIG.getHierarchicalURL('/algebra-tutor/start'), {
                method: 'POST'
            });
            
            console.log('API response received:', response.status);
            
            if (!response.ok) throw new Error('Failed to start algebra tutor');
            
            const data = await response.json();
            console.log('API data:', data);
            
            // Handle resume vs new session
            if (data.is_resume && data.practice_review) {
                // Student is reviewing their practice progress
                console.log('Showing practice review with stats:', data.practice_stats);
                await sendTutorMessage(data.message, 'tutor', data.current_section_id);
                
                // Show practice stats if available
                if (data.practice_stats && data.practice_stats.total_attempted > 0) {
                    setTimeout(async () => {
                        const statsMessage = `📊 Your Practice Summary:\n✅ Completed: ${data.practice_stats.completed} problems\n🔄 In Progress: ${data.practice_stats.in_progress} problems\n\nKeep practicing - you're doing great!`;
                        await sendTutorMessage(statsMessage, 'tutor');
                    }, 2000);
                }
                
                // Show continue practicing button
                setTimeout(() => {
                    const chatLog = document.getElementById('tutor-chat-log');
                    const buttonDiv = document.createElement('div');
                    buttonDiv.className = 'tutor-message tutor';
                    
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    avatar.innerHTML = '🎯';
                    
                    const messageContent = document.createElement('div');
                    messageContent.className = 'message-content';
                    messageContent.innerHTML = `
                        <button class="button-primary" onclick="goToPracticeProblems()" style="margin-top: 0.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; padding: 0.75rem 1.5rem; border-radius: 25px; color: white; cursor: pointer; font-weight: 600; transition: all 0.2s ease;">
                            <i data-feather="arrow-right"></i> Continue Practice
                        </button>
                    `;
                    
                    buttonDiv.appendChild(avatar);
                    buttonDiv.appendChild(messageContent);
                    chatLog.appendChild(buttonDiv);
                    chatLog.scrollTop = chatLog.scrollHeight;
                    feather.replace();
                }, 3500);
                
            } else if (data.is_resume && data.completed_learning) {
                // Student has already completed learning - show message and practice button
                console.log('Student already completed learning, showing practice option');
                await sendTutorMessage(data.message, 'tutor', data.current_section_id);
                
                // Show practice button immediately
                setTimeout(() => {
                    const chatLog = document.getElementById('tutor-chat-log');
                    const buttonDiv = document.createElement('div');
                    buttonDiv.className = 'tutor-message tutor';
                    
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    avatar.innerHTML = '🎯';
                    
                    const messageContent = document.createElement('div');
                    messageContent.className = 'message-content';
                    messageContent.innerHTML = `
                        <button class="button-primary" onclick="goToPracticeProblems()" style="margin-top: 0.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; padding: 0.75rem 1.5rem; border-radius: 25px; color: white; cursor: pointer; font-weight: 600; transition: all 0.2s ease;">
                            <i data-feather="arrow-right"></i> Try Practice Problems
                        </button>
                    `;
                    
                    buttonDiv.appendChild(avatar);
                    buttonDiv.appendChild(messageContent);
                    chatLog.appendChild(buttonDiv);
                    chatLog.scrollTop = chatLog.scrollHeight;
                    feather.replace();
                }, 1000);
                
            } else if (data.is_resume && data.existing_history) {
                // Resume existing session - restore chat history
                algebraTutorHistory = data.existing_history;
                currentAlgebraStep = data.step;
                
                console.log('🔄 DEBUGGING: Resuming session with', data.existing_history.length, 'messages');
                console.log('🔄 DEBUGGING: Resume data - completed steps:', data.completed_steps_count, 'current step:', data.current_step);
                console.log('🔄 DEBUGGING: Resume message:', data.message.substring(0, 100));
                
                // Update the learning pathway with current progress
                if (data.completed_steps_count !== undefined && data.current_step !== undefined) {
                    const resumeProgress = {
                        completedSteps: data.completed_steps_count,
                        currentStep: data.current_step,
                        isCompleted: data.ready_for_problems || false,
                        progressStatus: 'in_progress'  // If resuming, we're in progress
                    };
                    console.log('🔄 DEBUGGING: Updating pathway on resume with:', resumeProgress);
                    updateLearningPathway(resumeProgress);
                }
                
                // Just send the resume message, don't replay all history (too slow/complex)
                console.log('🔄 DEBUGGING: About to send resume message to chat');
                await sendTutorMessage(data.message, 'tutor', data.current_section_id);
            } else {
                // New session - clear history and start fresh
                algebraTutorHistory = [];
                currentAlgebraStep = data.step;
                
                console.log('Starting new session');
                
                // Update pathway to show "In Progress" immediately when starting
                const newSessionProgress = {
                    completedSteps: 0,
                    currentStep: data.step,
                    isCompleted: false,
                    progressStatus: 'in_progress'
                };
                updateLearningPathway(newSessionProgress);
                
                // Send initial message
                await sendTutorMessage(data.message, 'tutor', data.current_section_id);
            }
            
            console.log('Setting up event listeners...');
            
            // Set up event listeners
            setupAlgebraTutorListeners();
            
            console.log('Algebra tutor started successfully');
            
        } catch (error) {
            console.error('Error starting algebra tutor:', error);
            
            // Show clear error message when AI is unavailable
            const chatLog = document.getElementById('tutor-chat-log');
            chatLog.innerHTML = `
                <div class="tutor-message tutor">
                    <div class="avatar">⚠️</div>
                    <div class="message-content">
                        <div class="error-message">
                            <h4>Algebra Tutor Unavailable</h4>
                            <p>The AI tutor service is currently unavailable. This could be due to:</p>
                            <ul>
                                <li>Network connectivity issues</li>
                                <li>Server maintenance</li>
                                <li>API configuration problems</li>
                            </ul>
                            <p>Please try again later or contact support if the problem persists.</p>
                        </div>
                    </div>
                </div>
            `;
            
            // Don't set up listeners since the tutor is not functional
            console.log('Algebra tutor failed to start - no fallback available');
        } finally {
            // Reset the initialization flag
            algebraTutorInitializing = false;
            console.log('🔍 DEBUGGING: Reset algebraTutorInitializing flag');
        }
    }
    
    function setupAlgebraTutorListeners() {
        const input = document.getElementById('tutor-answer-input');
        const submitBtn = document.getElementById('tutor-submit-button');
        const backBtn = document.getElementById('back-to-topic-from-tutor-button');
        
        // Remove existing listeners
        const newInput = input.cloneNode(true);
        const newSubmitBtn = submitBtn.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        
        // Add new listeners
        newSubmitBtn.addEventListener('click', handleTutorSubmit);
        newInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleTutorSubmit();
        });
        
        backBtn.addEventListener('click', () => {
            if (currentTopicName) {
                showTopicView(currentTopicName);
            } else {
                showView('dashboard-view');
                fetchAndDisplayDashboard();
            }
        });
    }
    
    async function handleTutorSubmit() {
        const input = document.getElementById('tutor-answer-input');
        const userAnswer = input.value.trim();
        
        if (!userAnswer) return;
        
        // Add user message to chat
        await sendTutorMessage(userAnswer, 'student');
        input.value = '';
        
        // Get AI response based on conversation step
        await getTutorResponse(userAnswer);
    }
    
    function parseMarkdown(text) {
        // Simple markdown parser for basic formatting
        let parsed = text;
        
        // Bold text: **text** -> <strong>text</strong>
        parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic text: *text* -> <em>text</em>
        parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Code inline: `text` -> <code>text</code>
        parsed = parsed.replace(/`(.*?)`/g, '<code style="background: rgba(102, 126, 234, 0.1); padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace;">$1</code>');
        
        // Math equations: □ symbol highlighting
        parsed = parsed.replace(/□/g, '<span style="background: rgba(102, 126, 234, 0.2); padding: 0.1rem 0.3rem; border-radius: 3px; font-weight: bold;">□</span>');
        
        // Line breaks: \n -> <br> (convert newlines to HTML breaks)
        // Also handle escaped newlines that appear as literal \n text
        parsed = parsed.replace(/\\n/g, '<br>');
        parsed = parsed.replace(/\n/g, '<br>');
        
        // Preserve existing HTML (like equation boxes)
        return parsed;
    }

    // --- EMOTIONAL INTELLIGENCE HELPER FUNCTIONS ---
    async function analyzeConfidence(userAnswer) {
        // Simplified confidence analysis - no AI call for better performance
        return {
            level: 'medium',
            indicators: ['response_provided'],
            ai_analysis: 'Student provided response'
        };
    }
    
    function detectStrugglePattern() {
        // Check if student is struggling based on response times and error patterns
        const wasStruggling = emotionalState.strugglingPattern;
        
        if (emotionalState.responseTimeHistory.length >= 3) {
            const avgTime = emotionalState.responseTimeHistory.reduce((a, b) => a + b, 0) / emotionalState.responseTimeHistory.length;
            const longResponseTimes = avgTime > 30000; // More than 30 seconds average
            
            const recentErrors = emotionalState.consecutiveErrors >= 2;
            
            emotionalState.strugglingPattern = longResponseTimes || recentErrors;
            
            // Debug logging when struggle pattern changes
            if (emotionalState.strugglingPattern !== wasStruggling) {
                console.log(`🆘 EI: Struggling pattern ${emotionalState.strugglingPattern ? 'DETECTED' : 'CLEARED'}:`, {
                    avgResponseTime: Math.round(avgTime),
                    consecutiveErrors: emotionalState.consecutiveErrors,
                    longResponseTimes,
                    recentErrors
                });
            }
        }
    }

    async function sendTutorMessage(message, sender, sectionId = null) {
        console.log(`📩 sendTutorMessage called: ${sender} - "${message.substring(0, 50)}..."`);
        if (sectionId) {
            console.log(`📩 Section ID: ${sectionId}`);
        }
        
        const chatLog = document.getElementById('tutor-chat-log');
        const messageDiv = document.createElement('div');
        messageDiv.className = `tutor-message ${sender}`;
        
        // --- EMOTIONAL INTELLIGENCE TRACKING ---
        if (sender === 'tutor') {
            // Check if tutor is asking a question to start timing
            const isQuestion = message.includes('?') || 
                              message.toLowerCase().includes('what') ||
                              message.toLowerCase().includes('how');
            
            if (isQuestion) {
                emotionalState.questionStartTime = Date.now();
            }
        }
        
        // Create avatar
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = sender === 'student' ? '👤' : '🎯';
        
        // Create message content
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = parseMarkdown(message); // Parse markdown and support HTML content
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        chatLog.appendChild(messageDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
        
        // Add to history
        algebraTutorHistory.push({ sender, message, step: currentAlgebraStep });
        
        // Type math equations with MathJax if needed
        typesetMath(messageContent);
        
        // --- IMAGE ENHANCEMENT ---
        // Add image to tutor messages if available (async, non-blocking)
        if (sender === 'tutor' && sectionId) {
            enhanceMessageWithImage(messageDiv, sectionId).then(() => {
                // Scroll again after image loads to keep content visible
                chatLog.scrollTop = chatLog.scrollHeight;
            });
        }
    }
    
    function showTypingIndicator() {
        const chatLog = document.getElementById('tutor-chat-log');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'tutor-message tutor typing-indicator';
        typingDiv.id = 'typing-indicator';
        
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.innerHTML = '🎯';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = `
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        typingDiv.appendChild(avatar);
        typingDiv.appendChild(messageContent);
        chatLog.appendChild(typingDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
    }
    
    function hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    async function getTutorResponse(userAnswer) {
        try {
            // --- EMOTIONAL INTELLIGENCE TRACKING ---
            const responseTime = emotionalState.questionStartTime ? 
                Date.now() - emotionalState.questionStartTime : null;
            
            // Analyze confidence indicators in student response
            const confidenceMarkers = analyzeConfidence(userAnswer);
            
            // Track response time for pattern analysis
            if (responseTime) {
                emotionalState.responseTimeHistory.push(responseTime);
                // Keep only last 10 response times
                if (emotionalState.responseTimeHistory.length > 10) {
                    emotionalState.responseTimeHistory.shift();
                }
            }
            
            // Send user input to algebra tutor API with emotional intelligence data
            const response = await authedFetch(APP_CONFIG.getHierarchicalURL('/algebra-tutor/chat'), {
                method: 'POST',
                body: JSON.stringify({
                    student_answer: userAnswer,
                    conversation_history: algebraTutorHistory,
                    current_step: currentAlgebraStep,
                    emotional_intelligence: {
                        response_time: responseTime,
                        consecutive_errors: emotionalState.consecutiveErrors,
                        avg_response_time: emotionalState.responseTimeHistory.length > 0 ? 
                            emotionalState.responseTimeHistory.reduce((a, b) => a + b, 0) / emotionalState.responseTimeHistory.length : null,
                        confidence_indicators: confidenceMarkers,
                        struggling_pattern: emotionalState.strugglingPattern
                    }
                })
            });
            
            if (!response.ok) throw new Error('Failed to get tutor response');
            
            const data = await response.json();
            
            // --- EMOTIONAL INTELLIGENCE PROCESSING ---
            // Update error tracking based on student understanding
            if (data.shows_understanding) {
                emotionalState.consecutiveErrors = 0; // Reset on success
                console.log("✅ EI: Student shows understanding, resetting error count");
            } else if (data.new_step === currentAlgebraStep) {
                // Student didn't advance, likely made an error
                emotionalState.consecutiveErrors++;
                console.log(`❌ EI: Error detected, consecutive errors: ${emotionalState.consecutiveErrors}`);
            }
            
            // Update struggling pattern detection
            detectStrugglePattern();
            
            // Debug logging for emotional intelligence
            console.log("🧠 Emotional Intelligence Data:", {
                responseTime: responseTime,
                consecutiveErrors: emotionalState.consecutiveErrors,
                avgResponseTime: emotionalState.responseTimeHistory.length > 0 ? 
                    Math.round(emotionalState.responseTimeHistory.reduce((a, b) => a + b, 0) / emotionalState.responseTimeHistory.length) : null,
                confidenceLevel: confidenceMarkers.level,
                strugglingPattern: emotionalState.strugglingPattern
            });
            
            // Update step
            const previousStep = currentAlgebraStep;
            currentAlgebraStep = data.new_step;
            
            // Update learning pathway if step was completed
            if (data.step_completed) {
                console.log(`🎉 Step ${data.step_completed} completed! Updating pathway...`);
                // Immediately update the pathway with the new progress
                const updatedProgress = {
                    completedSteps: data.completed_steps_count || 0,
                    currentStep: data.new_step,
                    isCompleted: data.ready_for_problems || false,
                    progressStatus: data.ready_for_problems ? 'mastered' : 'in_progress'
                };
                
                // Update the pathway immediately
                updateLearningPathway(updatedProgress);
                
                // Add celebration animation after a brief delay
                setTimeout(() => {
                    if (typeof onAlgebraStepCompleted === 'function') {
                        onAlgebraStepCompleted(data.step_completed);
                    }
                }, 500);
            }
            
            // Show typing indicator
            showTypingIndicator();
            
            // Send tutor response after a brief delay to feel natural
            setTimeout(async () => {
                hideTypingIndicator();
                await sendTutorMessage(data.tutor_response, 'tutor', data.current_section_id);
                
                // If ready for problems, show practice button (transition message is now included in main response)
                if (data.ready_for_problems) {
                    setTimeout(async () => {
                        // Add practice button to chat (without additional transition message)
                        const chatLog = document.getElementById('tutor-chat-log');
                        const buttonDiv = document.createElement('div');
                        buttonDiv.className = 'tutor-message tutor';
                        
                        const avatar = document.createElement('div');
                        avatar.className = 'avatar';
                        avatar.innerHTML = '🎯';
                        
                        const messageContent = document.createElement('div');
                        messageContent.className = 'message-content';
                        messageContent.innerHTML = `
                            <button class="button-primary" onclick="goToPracticeProblems()" style="margin-top: 0.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; padding: 0.75rem 1.5rem; border-radius: 25px; color: white; cursor: pointer; font-weight: 600; transition: all 0.2s ease;">
                                <i data-feather="arrow-right"></i> Try Practice Problems
                            </button>
                        `;
                        
                        buttonDiv.appendChild(avatar);
                        buttonDiv.appendChild(messageContent);
                        chatLog.appendChild(buttonDiv);
                        chatLog.scrollTop = chatLog.scrollHeight;
                        feather.replace();
                    }, 1500); // Shorter delay since no transition message
                }
            }, 1500);
            
        } catch (error) {
            console.error('Error getting tutor response:', error);
            
            // Show clear error when AI fails
            hideTypingIndicator();
            await sendTutorMessage(`
                <div class="error-message">
                    <h4>⚠️ Tutor Service Error</h4>
                    <p>The AI tutor is currently unavailable. Please try again later.</p>
                    <p>If the problem persists, please contact support.</p>
                </div>
            `, 'tutor');
        }
    }
    
    
    
    
    
    
    

    // --- INITIALIZATION ---
    function initializeApp() {
        updateHeader(); // Set up the header button first
        
        // If user is already authenticated, go to dashboard
        if (authToken) {
            showView('dashboard-view');
            fetchAndDisplayDashboard();
        } else {
            startSession(); // Start the session to get personalized welcome
        }
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

    // --- FRACTIONS TUTOR FUNCTIONS ---
    let fractionsTutorInitializing = false;  // Flag to prevent duplicate initialization
    let lastFractionsTutorCall = 0;  // Track last call time to prevent rapid successive calls
    let fractionsTutorHistory = [];
    let currentFractionsStep = 1;

    function startFractionsTutorFromStep(stepNumber = 1) {
        // Modify the start fractions tutor function to accept a step parameter
        currentFractionsStep = stepNumber;
        startFractionsTutor();
    }

    async function startFractionsTutor() {
        try {
            // Enhanced debugging for duplicate calls
            const currentTime = Date.now();
            console.log('🔍 DEBUGGING: startFractionsTutor called at', new Date().toISOString());
            console.log('🔍 DEBUGGING: Call stack:', new Error().stack);
            
            // Prevent rapid successive calls (within 1 second)
            if (currentTime - lastFractionsTutorCall < 1000) {
                console.log('⚠️ RAPID SUCCESSIVE CALL: Ignoring call within 1 second of previous call');
                return;
            }
            
            // Prevent duplicate initialization
            if (fractionsTutorInitializing) {
                console.log('⚠️ DUPLICATE CALL: Fractions tutor already initializing, skipping...');
                return;
            }
            
            lastFractionsTutorCall = currentTime;
            fractionsTutorInitializing = true;
            
            console.log('🚀 Starting fractions tutor...', new Date().toISOString());
            
            // Set current topic name for navigation back to practice problems
            currentTopicName = 'Fractions';
            console.log('startFractionsTutor: currentTopicName set to:', currentTopicName);
            
            // Update tutor header text
            const tutorTitle = document.getElementById('tutor-header-title');
            const backText = document.getElementById('back-to-topic-text');
            if (tutorTitle) tutorTitle.textContent = '🎯 Fractions Tutor';
            if (backText) backText.textContent = 'Back to Fractions';
            
            showView('algebra-tutor-view', false);  // Reuse the same tutor view
            updateURLHash('fractions-tutor-view');
            
            // Clear previous chat
            const chatLog = document.getElementById('tutor-chat-log');
            chatLog.innerHTML = '';
            fractionsTutorHistory = [];
            currentFractionsStep = 1;
            
            console.log('Making API call to start fractions tutor...');
            
            // Start tutoring session with API
            const response = await authedFetch(APP_CONFIG.getHierarchicalURL('/fractions-tutor/start'), {
                method: 'POST'
            });
            
            console.log('API response received:', response.status);
            
            if (!response.ok) throw new Error('Failed to start fractions tutor');
            
            const data = await response.json();
            console.log('API data:', data);
            
            // Handle resume vs new session
            if (data.is_resume && data.practice_review) {
                // Student is reviewing their practice progress
                console.log('Showing practice review with stats:', data.practice_stats);
                await sendTutorMessage(data.message, 'tutor', data.current_section_id);
                
                // Show practice stats if available
                if (data.practice_stats && data.practice_stats.total_attempted > 0) {
                    setTimeout(async () => {
                        const statsMessage = `📊 Your Practice Summary:\n✅ Completed: ${data.practice_stats.completed} problems\n🔄 In Progress: ${data.practice_stats.in_progress} problems\n\nKeep practicing - you're doing great!`;
                        await sendTutorMessage(statsMessage, 'tutor');
                    }, 2000);
                }
                
                // Show continue practicing button
                setTimeout(() => {
                    const chatLog = document.getElementById('tutor-chat-log');
                    const buttonDiv = document.createElement('div');
                    buttonDiv.className = 'tutor-message tutor';
                    
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    avatar.innerHTML = '🎯';
                    
                    const messageContent = document.createElement('div');
                    messageContent.className = 'message-content';
                    messageContent.innerHTML = `
                        <button class="button-primary" onclick="goToPracticeProblems()" style="margin-top: 0.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; padding: 0.75rem 1.5rem; border-radius: 25px; color: white; cursor: pointer; font-weight: 600; transition: all 0.2s ease;">
                            <i data-feather="arrow-right"></i> Continue Practice
                        </button>
                    `;
                    
                    buttonDiv.appendChild(avatar);
                    buttonDiv.appendChild(messageContent);
                    chatLog.appendChild(buttonDiv);
                    chatLog.scrollTop = chatLog.scrollHeight;
                    feather.replace();
                }, 3500);
                
            } else if (data.is_resume && data.completed_learning) {
                // Student has already completed learning - show message and practice button
                console.log('Student already completed learning, showing practice option');
                await sendTutorMessage(data.message, 'tutor', data.current_section_id);
                
                // Show practice button immediately
                setTimeout(() => {
                    const chatLog = document.getElementById('tutor-chat-log');
                    const buttonDiv = document.createElement('div');
                    buttonDiv.className = 'tutor-message tutor';
                    
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    avatar.innerHTML = '🎯';
                    
                    const messageContent = document.createElement('div');
                    messageContent.className = 'message-content';
                    messageContent.innerHTML = `
                        <button class="button-primary" onclick="goToPracticeProblems()" style="margin-top: 0.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; padding: 0.75rem 1.5rem; border-radius: 25px; color: white; cursor: pointer; font-weight: 600; transition: all 0.2s ease;">
                            <i data-feather="arrow-right"></i> Try Practice Problems
                        </button>
                    `;
                    
                    buttonDiv.appendChild(avatar);
                    buttonDiv.appendChild(messageContent);
                    chatLog.appendChild(buttonDiv);
                    chatLog.scrollTop = chatLog.scrollHeight;
                    feather.replace();
                }, 1000);
                
            } else if (data.is_resume && data.existing_history) {
                // Resume existing session - restore chat history
                fractionsTutorHistory = data.existing_history;
                currentFractionsStep = data.step;
                
                console.log('🔄 DEBUGGING: Resuming session with', data.existing_history.length, 'messages');
                console.log('🔄 DEBUGGING: Resume data - completed steps:', data.completed_steps_count, 'current step:', data.current_step);
                console.log('🔄 DEBUGGING: Resume message:', data.message.substring(0, 100));
                
                // Update the learning pathway with current progress
                if (data.completed_steps_count !== undefined && data.current_step !== undefined) {
                    const resumeProgress = {
                        completedSteps: data.completed_steps_count,
                        currentStep: data.current_step,
                        isCompleted: data.ready_for_problems || false,
                        progressStatus: 'in_progress'  // If resuming, we're in progress
                    };
                    console.log('🔄 DEBUGGING: Updating pathway on resume with:', resumeProgress);
                    updateLearningPathway(resumeProgress);
                }
                
                // Just send the resume message, don't replay all history (too slow/complex)
                console.log('🔄 DEBUGGING: About to send resume message to chat');
                await sendTutorMessage(data.message, 'tutor', data.current_section_id);
            } else {
                // New session - clear history and start fresh
                fractionsTutorHistory = [];
                currentFractionsStep = data.step;
                
                console.log('Starting new session');
                
                // Update pathway to show "In Progress" immediately when starting
                const newSessionProgress = {
                    completedSteps: 0,
                    currentStep: data.step,
                    isCompleted: false,
                    progressStatus: 'in_progress'
                };
                updateLearningPathway(newSessionProgress);
                
                // Send initial message with section ID for image support
                await sendTutorMessage(data.message, 'tutor', data.current_section_id);
                // Add initial message to conversation history
                fractionsTutorHistory.push({ sender: 'tutor', message: data.message, step: currentFractionsStep });
            }
            
            console.log('Setting up event listeners...');
            
            // Set up event listeners
            setupFractionsTutorListeners();
            
            console.log('Fractions tutor started successfully');
            
        } catch (error) {
            console.error('Error starting fractions tutor:', error);
            
            // Show clear error message when AI is unavailable
            const chatLog = document.getElementById('tutor-chat-log');
            chatLog.innerHTML = `
                <div class="tutor-message tutor">
                    <div class="avatar">⚠️</div>
                    <div class="message-content">
                        <div class="error-message">
                            <h4>Fractions Tutor Unavailable</h4>
                            <p>The AI tutor service is currently unavailable. This could be due to:</p>
                            <ul>
                                <li>Network connectivity issues</li>
                                <li>Server maintenance</li>
                                <li>API configuration problems</li>
                            </ul>
                            <p>Please try again later or contact support if the problem persists.</p>
                        </div>
                    </div>
                </div>
            `;
            
            // Don't set up listeners since the tutor is not functional
            console.log('Fractions tutor failed to start - no fallback available');
        } finally {
            // Reset the initialization flag
            fractionsTutorInitializing = false;
            console.log('🔍 DEBUGGING: Reset fractionsTutorInitializing flag');
        }
    }
    
    function setupFractionsTutorListeners() {
        const input = document.getElementById('tutor-answer-input');
        const submitBtn = document.getElementById('tutor-submit-button');
        const backBtn = document.getElementById('back-to-topic-from-tutor-button');
        
        // Remove existing listeners
        const newInput = input.cloneNode(true);
        const newSubmitBtn = submitBtn.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        
        // Add new listeners
        newSubmitBtn.addEventListener('click', handleFractionsTutorSubmit);
        newInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleFractionsTutorSubmit();
        });
        
        backBtn.addEventListener('click', () => {
            if (currentTopicName) {
                showTopicView(currentTopicName);
            } else {
                showView('dashboard-view');
                fetchAndDisplayDashboard();
            }
        });
    }
    
    async function handleFractionsTutorSubmit() {
        const input = document.getElementById('tutor-answer-input');
        const userAnswer = input.value.trim();
        
        if (!userAnswer) return;
        
        // Add user message to chat
        await sendTutorMessage(userAnswer, 'student');
        input.value = '';
        
        // Get AI response based on conversation step
        await getFractionsTutorResponse(userAnswer);
    }
    
    async function getFractionsTutorResponse(userAnswer) {
        try {
            // Show typing indicator immediately when user submits
            showTypingIndicator();
            
            // --- EMOTIONAL INTELLIGENCE TRACKING ---
            const responseTime = emotionalState.questionStartTime ? 
                Date.now() - emotionalState.questionStartTime : null;
            
            // Analyze confidence indicators in student response
            const confidenceMarkers = analyzeConfidence(userAnswer);
            
            // Track response time for pattern analysis
            if (responseTime) {
                emotionalState.responseTimeHistory.push(responseTime);
                // Keep only last 10 response times
                if (emotionalState.responseTimeHistory.length > 10) {
                    emotionalState.responseTimeHistory.shift();
                }
            }
            
            // Add student message to conversation history before API call (check for duplicates)
            const lastMessage = fractionsTutorHistory[fractionsTutorHistory.length - 1];
            if (!lastMessage || lastMessage.sender !== 'student' || lastMessage.message !== userAnswer) {
                fractionsTutorHistory.push({ sender: 'student', message: userAnswer, step: currentFractionsStep });
            }
            
            // Send user input to fractions tutor API with emotional intelligence data
            const response = await authedFetch(APP_CONFIG.getHierarchicalURL('/fractions-tutor/chat'), {
                method: 'POST',
                body: JSON.stringify({
                    student_answer: userAnswer,
                    conversation_history: fractionsTutorHistory,
                    current_step: currentFractionsStep,
                    emotional_intelligence: {
                        response_time: responseTime,
                        consecutive_errors: emotionalState.consecutiveErrors,
                        avg_response_time: emotionalState.responseTimeHistory.length > 0 ? 
                            emotionalState.responseTimeHistory.reduce((a, b) => a + b, 0) / emotionalState.responseTimeHistory.length : null,
                        confidence_indicators: confidenceMarkers,
                        struggling_pattern: emotionalState.strugglingPattern
                    }
                })
            });
            
            if (!response.ok) throw new Error('Failed to get tutor response');
            
            const data = await response.json();
            
            // --- EMOTIONAL INTELLIGENCE PROCESSING ---
            // Update error tracking based on student understanding
            if (data.shows_understanding) {
                emotionalState.consecutiveErrors = 0; // Reset on success
                console.log("✅ EI: Student shows understanding, resetting error count");
            } else if (data.new_step === currentFractionsStep) {
                // Student didn't advance, likely made an error
                emotionalState.consecutiveErrors++;
                console.log(`❌ EI: Error detected, consecutive errors: ${emotionalState.consecutiveErrors}`);
            }
            
            // Update struggling pattern detection
            detectStrugglePattern();
            
            // Update step
            const previousStep = currentFractionsStep;
            currentFractionsStep = data.new_step;
            
            // Update learning pathway if step was completed
            if (data.step_completed) {
                console.log(`🎉 Step ${data.step_completed} completed! Updating pathway...`);
                // Immediately update the pathway with the new progress
                const updatedProgress = {
                    completedSteps: data.completed_steps_count || 0,
                    currentStep: data.new_step,
                    isCompleted: data.ready_for_problems || false,
                    progressStatus: data.ready_for_problems ? 'mastered' : 'in_progress'
                };
                
                // Update the pathway immediately
                updateLearningPathway(updatedProgress);
            }
            
            // Send tutor response after a brief delay to feel natural
            setTimeout(async () => {
                hideTypingIndicator();
                await sendTutorMessage(data.tutor_response, 'tutor', data.current_section_id);
                
                // Add tutor response to conversation history
                if (fractionsTutorHistory.length > 0 && fractionsTutorHistory[fractionsTutorHistory.length - 1].sender === 'tutor' && fractionsTutorHistory[fractionsTutorHistory.length - 1].message === '') {
                    // Update the empty tutor message that was added earlier
                    fractionsTutorHistory[fractionsTutorHistory.length - 1].message = data.tutor_response;
                } else {
                    // Add new tutor message
                    fractionsTutorHistory.push({ sender: 'tutor', message: data.tutor_response, step: currentFractionsStep });
                }
                
                // If ready for problems, show practice button
                if (data.ready_for_problems) {
                    setTimeout(async () => {
                        // Add practice button to chat
                        const chatLog = document.getElementById('tutor-chat-log');
                        const buttonDiv = document.createElement('div');
                        buttonDiv.className = 'tutor-message tutor';
                        
                        const avatar = document.createElement('div');
                        avatar.className = 'avatar';
                        avatar.innerHTML = '🎯';
                        
                        const messageContent = document.createElement('div');
                        messageContent.className = 'message-content';
                        messageContent.innerHTML = `
                            <button class="button-primary" onclick="goToPracticeProblems()" style="margin-top: 0.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; padding: 0.75rem 1.5rem; border-radius: 25px; color: white; cursor: pointer; font-weight: 600; transition: all 0.2s ease;">
                                <i data-feather="arrow-right"></i> Try Practice Problems
                            </button>
                        `;
                        
                        buttonDiv.appendChild(avatar);
                        buttonDiv.appendChild(messageContent);
                        chatLog.appendChild(buttonDiv);
                        chatLog.scrollTop = chatLog.scrollHeight;
                        feather.replace();
                    }, 2000);
                }
            }, Math.random() * 1000 + 500); // Random delay between 0.5-1.5 seconds
            
        } catch (error) {
            console.error('Error getting fractions tutor response:', error);
            hideTypingIndicator();
            await sendTutorMessage("I'm having trouble processing that. Could you try again?", 'tutor');
            // Add error message to conversation history
            fractionsTutorHistory.push({ sender: 'tutor', message: "I'm having trouble processing that. Could you try again?", step: currentFractionsStep });
        }
    }

    // --- GENERIC LEARNING TUTOR FUNCTIONS ---
    // These functions work with any topic (fractions, algebra, geometry, etc.)
    // while preserving backward compatibility with existing topic-specific functions
    
    let genericTutorState = {
        currentTopic: null,
        history: [],
        currentStep: 1,
        initializing: false,
        lastCallTime: 0
    };

    /**
     * Start a learning tutor session for any topic
     * @param {string} topic - The topic name (e.g., 'fractions', 'algebra', 'geometry')
     * @param {number} stepNumber - Optional step number to start from
     */
    async function startLearningTutor(topic, stepNumber = 1) {
        try {
            // Enhanced debugging for duplicate calls
            const currentTime = Date.now();
            console.log(`🔍 DEBUGGING: startLearningTutor called for ${topic} at`, new Date().toISOString());
            
            // Prevent rapid successive calls (within 1 second)
            if (currentTime - genericTutorState.lastCallTime < 1000 && genericTutorState.currentTopic === topic) {
                console.log('⚠️ RAPID SUCCESSIVE CALL: Ignoring call within 1 second of previous call');
                return;
            }
            
            // Prevent duplicate initialization for same topic
            if (genericTutorState.initializing && genericTutorState.currentTopic === topic) {
                console.log(`⚠️ DUPLICATE CALL: ${topic} tutor already initializing, skipping...`);
                return;
            }
            
            genericTutorState.lastCallTime = currentTime;
            genericTutorState.initializing = true;
            genericTutorState.currentTopic = topic;
            genericTutorState.currentStep = stepNumber;
            
            console.log(`🚀 Starting ${topic} tutor...`, new Date().toISOString());
            
            // Set current topic name for navigation back to practice problems
            currentTopicName = topic.charAt(0).toUpperCase() + topic.slice(1);
            console.log(`startLearningTutor: currentTopicName set to:`, currentTopicName);
            
            // Update tutor header text
            const tutorTitle = document.getElementById('tutor-header-title');
            const backText = document.getElementById('back-to-topic-text');
            if (tutorTitle) tutorTitle.textContent = `🎯 ${currentTopicName} Tutor`;
            if (backText) backText.textContent = `Back to ${currentTopicName}`;
            
            showView('algebra-tutor-view', false);  // Reuse the same tutor view
            updateURLHash(`${topic}-tutor-view`);
            
            // Clear previous chat
            const chatLog = document.getElementById('tutor-chat-log');
            chatLog.innerHTML = '';
            genericTutorState.history = [];
            
            console.log(`Making API call to start ${topic} tutor...`);
            
            // Start tutoring session with API using generic route
            const response = await authedFetch(APP_CONFIG.getHierarchicalURL(`/${topic}-tutor/start`), {
                method: 'POST'
            });
            
            console.log('API response received:', response.status);
            
            if (!response.ok) throw new Error(`Failed to start ${topic} tutor`);
            
            const data = await response.json();
            console.log('API data:', data);
            
            // Handle resume vs new session (same logic as fractions)
            if (data.is_resume && data.practice_review) {
                // Student is reviewing their practice progress
                console.log('Showing practice review with stats:', data.practice_stats);
                await sendTutorMessage(data.message, 'tutor', data.current_section_id);
                
                // Show practice stats if available
                if (data.practice_stats && data.practice_stats.total_attempted > 0) {
                    setTimeout(async () => {
                        const statsMessage = `📊 Your Practice Summary:\n✅ Completed: ${data.practice_stats.completed} problems\n🔄 In Progress: ${data.practice_stats.in_progress} problems\n\nKeep practicing - you're doing great!`;
                        await sendTutorMessage(statsMessage, 'tutor');
                    }, 2000);
                }
                
                // Show continue practicing button
                setTimeout(() => {
                    const chatLog = document.getElementById('tutor-chat-log');
                    const buttonDiv = document.createElement('div');
                    buttonDiv.className = 'tutor-message tutor';
                    
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    avatar.innerHTML = '🎯';
                    
                    const messageContent = document.createElement('div');
                    messageContent.className = 'message-content';
                    
                    const practiceBtn = document.createElement('button');
                    practiceBtn.className = 'primary-button';
                    practiceBtn.textContent = `Continue ${currentTopicName} Practice`;
                    practiceBtn.onclick = () => showTopicProblems(currentTopicName);
                    
                    messageContent.appendChild(practiceBtn);
                    buttonDiv.appendChild(avatar);
                    buttonDiv.appendChild(messageContent);
                    chatLog.appendChild(buttonDiv);
                    
                    chatLog.scrollTop = chatLog.scrollHeight;
                }, 3000);
                
            } else if (data.is_resume && data.completed_learning) {
                // Student has completed learning, encourage practice
                await sendTutorMessage(data.message, 'tutor', data.current_section_id);
                
                setTimeout(() => {
                    const chatLog = document.getElementById('tutor-chat-log');
                    const buttonDiv = document.createElement('div');
                    buttonDiv.className = 'tutor-message tutor';
                    
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    avatar.innerHTML = '🎯';
                    
                    const messageContent = document.createElement('div');
                    messageContent.className = 'message-content';
                    
                    const practiceBtn = document.createElement('button');
                    practiceBtn.className = 'primary-button';
                    practiceBtn.textContent = `Start ${currentTopicName} Practice`;
                    practiceBtn.onclick = () => showTopicProblems(currentTopicName);
                    
                    messageContent.appendChild(practiceBtn);
                    buttonDiv.appendChild(avatar);
                    buttonDiv.appendChild(messageContent);
                    chatLog.appendChild(buttonDiv);
                    
                    chatLog.scrollTop = chatLog.scrollHeight;
                }, 2000);
                
            } else {
                // Regular session start or resume
                await sendTutorMessage(data.message, 'tutor', data.current_section_id);
                
                // Add to conversation history
                genericTutorState.history.push({ 
                    sender: 'tutor', 
                    message: data.message, 
                    step: genericTutorState.currentStep 
                });
            }
            
            // Set up event listeners
            setupLearningTutorListeners(topic);
            
            console.log(`${topic} tutor started successfully`);
            
        } catch (error) {
            console.error(`Error starting ${topic} tutor:`, error);
            await sendTutorMessage(`Sorry, I'm having trouble starting the ${topic} tutor. Please try again later.`, 'tutor');
        } finally {
            genericTutorState.initializing = false;
        }
    }

    /**
     * Set up event listeners for the generic learning tutor
     * @param {string} topic - The topic name
     */
    function setupLearningTutorListeners(topic) {
        const input = document.getElementById('tutor-answer-input');
        const submitBtn = document.getElementById('tutor-submit-button');
        
        // Remove existing listeners to prevent duplicates
        const newInput = input.cloneNode(true);
        const newSubmitBtn = submitBtn.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        
        // Add new listeners
        newSubmitBtn.addEventListener('click', () => handleLearningTutorSubmit(topic));
        newInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLearningTutorSubmit(topic);
        });
        
        // Focus on input
        newInput.focus();
        
        // Reset question start time for emotional intelligence
        emotionalState.questionStartTime = Date.now();
        
        console.log(`${topic} tutor listeners set up`);
    }

    /**
     * Handle submit button click for generic learning tutor
     * @param {string} topic - The topic name
     */
    async function handleLearningTutorSubmit(topic) {
        const input = document.getElementById('tutor-answer-input');
        const userAnswer = input.value.trim();
        
        if (!userAnswer) return;
        
        input.value = '';
        await sendTutorMessage(userAnswer, 'student');
        
        // Get AI response based on conversation step
        await getLearningTutorResponse(topic, userAnswer);
    }

    /**
     * Get tutor response for any topic
     * @param {string} topic - The topic name
     * @param {string} userAnswer - The user's answer
     */
    async function getLearningTutorResponse(topic, userAnswer) {
        try {
            // Show typing indicator immediately when user submits
            showTypingIndicator();
            
            // --- EMOTIONAL INTELLIGENCE TRACKING ---
            const responseTime = emotionalState.questionStartTime ? 
                Date.now() - emotionalState.questionStartTime : null;
            
            // Analyze confidence indicators in student response
            const confidenceMarkers = analyzeConfidence(userAnswer);
            
            // Track response time for pattern analysis
            if (responseTime) {
                emotionalState.responseTimeHistory.push(responseTime);
                // Keep only last 10 response times
                if (emotionalState.responseTimeHistory.length > 10) {
                    emotionalState.responseTimeHistory.shift();
                }
            }
            
            // Add student message to conversation history before API call (check for duplicates)
            const lastMessage = genericTutorState.history[genericTutorState.history.length - 1];
            if (!lastMessage || lastMessage.sender !== 'student' || lastMessage.message !== userAnswer) {
                genericTutorState.history.push({ 
                    sender: 'student', 
                    message: userAnswer, 
                    step: genericTutorState.currentStep 
                });
            }
            
            // Send user input to learning tutor API with emotional intelligence data
            const response = await authedFetch(APP_CONFIG.getHierarchicalURL(`/${topic}-tutor/chat`), {
                method: 'POST',
                body: JSON.stringify({
                    student_answer: userAnswer,
                    conversation_history: genericTutorState.history,
                    current_step: genericTutorState.currentStep,
                    emotional_intelligence: {
                        response_time: responseTime,
                        consecutive_errors: emotionalState.consecutiveErrors,
                        avg_response_time: emotionalState.responseTimeHistory.length > 0 ? 
                            emotionalState.responseTimeHistory.reduce((a, b) => a + b, 0) / emotionalState.responseTimeHistory.length : null,
                        confidence_indicators: confidenceMarkers,
                        struggling_pattern: emotionalState.strugglingPattern
                    }
                })
            });
            
            if (!response.ok) throw new Error('Failed to get tutor response');
            
            const data = await response.json();
            
            // --- EMOTIONAL INTELLIGENCE PROCESSING ---
            // Update consecutive errors count based on understanding
            if (data.shows_understanding) {
                emotionalState.consecutiveErrors = 0;
            } else {
                emotionalState.consecutiveErrors++;
            }
            
            // Detect struggling pattern (3+ consecutive errors or very slow responses)
            const isStrugglingNow = emotionalState.consecutiveErrors >= 3 || 
                (responseTime && responseTime > 30000); // 30+ seconds
            
            if (isStrugglingNow && !emotionalState.strugglingPattern) {
                emotionalState.strugglingPattern = true;
                emotionalState.lastEmotionalIntervention = Date.now();
            } else if (!isStrugglingNow && emotionalState.strugglingPattern) {
                emotionalState.strugglingPattern = false;
            }
            
            hideTypingIndicator();
            
            // Send tutor response with section ID for image support
            await sendTutorMessage(data.tutor_response, 'tutor', data.current_section_id);
            
            // Add tutor response to conversation history
            genericTutorState.history.push({ 
                sender: 'tutor', 
                message: data.tutor_response, 
                step: genericTutorState.currentStep 
            });
            
            // Handle step progression and completion
            if (data.section_completed) {
                console.log(`✅ Section completed for ${topic}!`);
            }
            
            if (data.ready_for_problems) {
                console.log(`🎓 ${topic} learning completed - student ready for practice!`);
                
                // Show completion message and practice button after a delay
                setTimeout(() => {
                    const chatLog = document.getElementById('tutor-chat-log');
                    const buttonDiv = document.createElement('div');
                    buttonDiv.className = 'tutor-message tutor';
                    
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    avatar.innerHTML = '🎯';
                    
                    const messageContent = document.createElement('div');
                    messageContent.className = 'message-content';
                    messageContent.innerHTML = `<p>🎉 Congratulations! You've completed the ${currentTopicName} fundamentals. Ready to practice?</p>`;
                    
                    const practiceBtn = document.createElement('button');
                    practiceBtn.className = 'primary-button';
                    practiceBtn.textContent = `Start ${currentTopicName} Practice`;
                    practiceBtn.onclick = () => showTopicProblems(currentTopicName);
                    
                    messageContent.appendChild(practiceBtn);
                    buttonDiv.appendChild(avatar);
                    buttonDiv.appendChild(messageContent);
                    chatLog.appendChild(buttonDiv);
                    
                    chatLog.scrollTop = chatLog.scrollHeight;
                }, 2000);
            }
            
            // Reset question start time for next question
            emotionalState.questionStartTime = Date.now();
            
        } catch (error) {
            console.error(`Error getting ${topic} tutor response:`, error);
            hideTypingIndicator();
            await sendTutorMessage("I'm having trouble processing that. Could you try again?", 'tutor');
            // Add error message to conversation history
            genericTutorState.history.push({ 
                sender: 'tutor', 
                message: "I'm having trouble processing that. Could you try again?", 
                step: genericTutorState.currentStep 
            });
        }
    }

    // --- IMAGE SUPPORT UTILITIES ---
    // Functions to handle automatic image loading for learning sections
    
    /**
     * Extract topic from section ID for image path construction
     * @param {string} sectionId - Section ID like "p6_math_fractions_step1_001"
     * @returns {string} - Topic name like "fractions"
     */
    function extractTopicFromSectionId(sectionId) {
        if (!sectionId || typeof sectionId !== 'string') return null;
        
        // Parse format: p6_math_{topic}_step{n}_{section}
        const parts = sectionId.split('_');
        if (parts.length >= 4 && parts[0] === 'p6' && parts[1] === 'math') {
            return parts[2]; // Topic is the 3rd part
        }
        
        return null;
    }

    /**
     * Check if an image exists for a given section ID
     * @param {string} sectionId - Section ID to check for image
     * @returns {Promise<string|null>} - Image URL if exists, null otherwise
     */
    async function checkImageExists(sectionId) {
        if (!sectionId) return null;
        
        const topic = extractTopicFromSectionId(sectionId);
        if (!topic) return null;
        
        // Try PNG, JPG, and SVG formats
        const formats = ['png', 'jpg', 'svg'];
        
        for (const format of formats) {
            const imageUrl = `assets/images/${topic}/${sectionId}.${format}`;
            
            try {
                // Use a promise-based approach to check if image loads
                await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = imageUrl;
                });
                
                return imageUrl; // Image exists and loads successfully
            } catch (error) {
                // Image doesn't exist or failed to load, try next format
                continue;
            }
        }
        
        return null; // No image found in any format
    }

    /**
     * Create an image element for a section with mobile-first responsive design
     * @param {string} imageUrl - URL of the image to display
     * @param {string} sectionId - Section ID for alt text
     * @returns {HTMLElement} - Image element ready for insertion
     */
    function createSectionImage(imageUrl, sectionId) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'section-image-container';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = `Learning visual for ${sectionId}`;
        img.className = 'section-image';
        img.loading = 'lazy'; // Lazy loading for performance
        
        // Error handling - hide container if image fails to load
        img.onerror = () => {
            imageContainer.style.display = 'none';
            console.log(`Image failed to load: ${imageUrl}`);
        };
        
        imageContainer.appendChild(img);
        return imageContainer;
    }

    /**
     * Add image to a chat message if available
     * @param {HTMLElement} messageElement - The message element to enhance
     * @param {string} sectionId - Section ID to check for image
     */
    async function enhanceMessageWithImage(messageElement, sectionId) {
        if (!sectionId || !messageElement) return;
        
        try {
            const imageUrl = await checkImageExists(sectionId);
            if (imageUrl) {
                const imageElement = createSectionImage(imageUrl, sectionId);
                
                // Add image below the text content
                const messageContent = messageElement.querySelector('.message-content');
                if (messageContent) {
                    messageContent.appendChild(imageElement);
                    console.log(`✅ Added image for section: ${sectionId}`);
                }
            }
        } catch (error) {
            console.log(`Image check failed for ${sectionId}:`, error);
            // Fail silently - missing images shouldn't break the experience
        }
    }

    // --- WRAPPER FUNCTIONS FOR BACKWARD COMPATIBILITY ---
    // These functions allow existing topic-specific code to optionally use generic functions
    
    /**
     * Enhanced fractions tutor that can optionally use generic functions
     * This provides a migration path while preserving existing functionality
     */
    function startFractionsTutorGeneric(stepNumber = 1) {
        // Use the new generic function for fractions
        return startLearningTutor('fractions', stepNumber);
    }

    /**
     * Enhanced fractions tutor progress that works with generic status endpoint
     */
    async function getUserFractionsTutorProgressGeneric() {
        try {
            // Use the new generic status endpoint for fractions
            const url = APP_CONFIG.getHierarchicalURL('/fractions-tutor/status');
            const response = await authedFetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📊 Fractions Tutor Progress (Generic):', data);
            
            return data;
        } catch (error) {
            console.error('Error fetching fractions tutor progress:', error);
            // Fallback to default structure
            return {
                current_step: 1,
                completed_steps: 0,
                is_completed: false,
                progress_status: 'pending',
                has_history: false,
                message_count: 0
            };
        }
    }

    /**
     * Generic topic status fetcher that works with any topic
     * @param {string} topic - The topic name (e.g., 'fractions', 'algebra', 'geometry')
     */
    async function getLearningTutorStatus(topic) {
        try {
            const url = APP_CONFIG.getHierarchicalURL(`/${topic}-tutor/status`);
            const response = await authedFetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`📊 ${topic.charAt(0).toUpperCase() + topic.slice(1)} Tutor Status:`, data);
            
            return data;
        } catch (error) {
            console.error(`Error fetching ${topic} tutor status:`, error);
            // Fallback to default structure
            return {
                current_step: 1,
                completed_steps: 0,
                is_completed: false,
                progress_status: 'pending',
                has_history: false,
                message_count: 0
            };
        }
    }

    /**
     * Enhanced pathway interactivity that works with any topic
     * @param {string} topicName - The topic name (e.g., 'Fractions', 'Algebra', 'Geometry')
     */
    function setupPathwayInteractivityGeneric(topicName) {
        const topicLower = topicName.toLowerCase();
        
        // Set up generic step click handlers
        const steps = document.querySelectorAll('.learning-step');
        steps.forEach((step, index) => {
            const stepNumber = index + 1;
            step.addEventListener('click', () => {
                console.log(`Starting ${topicName} tutor from step ${stepNumber}`);
                startLearningTutor(topicLower, stepNumber);
            });
        });
        
        // Set up "New Review" button for generic topics
        const newReviewBtn = document.querySelector('#start-learning-btn');
        if (newReviewBtn) {
            // Remove existing listeners
            const newBtn = newReviewBtn.cloneNode(true);
            newReviewBtn.parentNode.replaceChild(newBtn, newReviewBtn);
            
            // Add new listener for this topic
            newBtn.addEventListener('click', () => startLearningTutor(topicLower));
        }
    }

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
