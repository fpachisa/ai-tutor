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
            if (!authToken) {
                showView('login-view', false);
                return;
            }
            startAlgebraTutor();
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
            await updateTopicViewForAlgebra(topicName, summary);

            // Event handlers are set up in updateTopicViewForAlgebra

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

            // 5. Render all the new content
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
    
    
    async function determineStudentAlgebraState(topicName, summary) {
        // Determine if student should see learning mode or practice mode
        if (topicName !== 'Algebra') {
            return { mode: 'practice', reason: 'not_algebra' };
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
    
    function showLearningModeDashboard() {
        // Show learning mode UI
        document.getElementById('learning-mode-dashboard').style.display = 'block';
        document.getElementById('practice-mode-dashboard').style.display = 'none';
        document.getElementById('legacy-practice-area').style.display = 'none';
        
        // Set up event listeners
        const startLearningBtn = document.getElementById('start-algebra-learning');
        const skipToPracticeBtn = document.getElementById('skip-to-practice');
        
        if (startLearningBtn) {
            startLearningBtn.addEventListener('click', startAlgebraTutor);
        }
        
        if (skipToPracticeBtn) {
            skipToPracticeBtn.addEventListener('click', () => {
                showPracticeModeDashboard(currentTopicName);
            });
        }
    }
    
    function showPracticeModeDashboard(topicName) {
        // Show practice mode UI
        document.getElementById('learning-mode-dashboard').style.display = 'none';
        document.getElementById('practice-mode-dashboard').style.display = 'block';
        document.getElementById('legacy-practice-area').style.display = 'none';
        
        // Set up review with tutor button
        const reviewBtn = document.getElementById('review-with-tutor');
        if (reviewBtn) {
            reviewBtn.addEventListener('click', startAlgebraTutor);
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
    
    async function updateTopicViewForAlgebra(topicName, summary) {
        // Determine which dashboard to show based on student state
        const studentState = await determineStudentAlgebraState(topicName, summary);
        
        if (studentState.mode === 'learning') {
            showLearningModeDashboard();
        } else {
            showPracticeModeDashboard(topicName);
        }
    }
    
    // Algebra tutor functions
    async function startAlgebraTutor() {
        try {
            console.log('Starting algebra tutor...');
            
            // Set current topic name for navigation back to practice problems
            currentTopicName = 'Algebra';
            console.log('startAlgebraTutor: currentTopicName set to:', currentTopicName);
            
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
                await sendTutorMessage(data.message, 'tutor');
                
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
                await sendTutorMessage(data.message, 'tutor');
                
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
                
                console.log('Resuming session with', data.existing_history.length, 'messages');
                
                // Just send the resume message, don't replay all history (too slow/complex)
                await sendTutorMessage(data.message, 'tutor');
            } else {
                // New session - clear history and start fresh
                algebraTutorHistory = [];
                currentAlgebraStep = data.step;
                
                console.log('Starting new session');
                
                // Send initial message
                await sendTutorMessage(data.message, 'tutor');
            }
            
            console.log('Setting up event listeners...');
            
            // Set up event listeners
            setupAlgebraTutorListeners();
            
            console.log('Algebra tutor started successfully');
            
        } catch (error) {
            console.error('Error starting algebra tutor:', error);
            
            // Fallback to client-side version
            try {
                console.log('Using fallback client-side tutor...');
                const chatLog = document.getElementById('tutor-chat-log');
                chatLog.innerHTML = '';
                algebraTutorHistory = [];
                currentAlgebraStep = 1;
                
                await sendTutorMessage("Hi! I'm your algebra tutor. Let's start with the very basics. Have you ever seen a problem like this: □ + 4 = 10?", 'tutor');
                setupAlgebraTutorListeners();
                console.log('Fallback tutor setup complete');
            } catch (fallbackError) {
                console.error('Even fallback failed:', fallbackError);
                // Last resort - show a simple message
                const chatLog = document.getElementById('tutor-chat-log');
                chatLog.innerHTML = '<div class="tutor-message tutor">Sorry, there was an error starting the tutor. Please try again.</div>';
            }
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
        parsed = parsed.replace(/\n/g, '<br>');
        
        // Preserve existing HTML (like equation boxes)
        return parsed;
    }

    // --- EMOTIONAL INTELLIGENCE HELPER FUNCTIONS ---
    async function analyzeConfidence(userAnswer) {
        // AI-powered confidence analysis - no hardcoded rules!
        try {
            const response = await authedFetch(`${API_BASE_URL}/ai/analyze-confidence`, {
                method: 'POST',
                body: JSON.stringify({
                    user_response: userAnswer
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                return {
                    level: result.confidence_level, // 'low', 'medium', 'high'
                    indicators: result.reasoning,   // AI's reasoning
                    ai_analysis: result.analysis    // Full AI analysis
                };
            }
        } catch (error) {
            console.log("AI confidence analysis failed, using fallback:", error);
        }
        
        // Simple fallback only for critical errors
        return {
            level: 'medium',
            indicators: ['fallback'],
            ai_analysis: 'AI analysis unavailable'
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

    async function sendTutorMessage(message, sender) {
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
            currentAlgebraStep = data.new_step;
            
            // Show typing indicator
            showTypingIndicator();
            
            // Send tutor response after a brief delay to feel natural
            setTimeout(async () => {
                hideTypingIndicator();
                await sendTutorMessage(data.tutor_response, 'tutor');
                
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
            // Fallback response with typing indicator
            showTypingIndicator();
            setTimeout(async () => {
                hideTypingIndicator();
                await sendTutorMessage("I'm having trouble right now. Can you try rephrasing your answer?", 'tutor');
            }, 1000);
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
