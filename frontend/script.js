document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL STATE & CONSTANTS ---
    const API_BASE_URL = 'https://aicampus-live.uc.r.appspot.com/api';
    let authToken = null;
    let currentProblemId = null;
    let chatHistory = [];

    // --- ELEMENT REFERENCES ---
    const views = { login: document.getElementById('login-view'), signup: document.getElementById('signup-view'), dashboard: document.getElementById('dashboard-view'), solver: document.getElementById('solver-view'), };
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginError = document.getElementById('login-error');
    const signupError = document.getElementById('signup-error');
    const showSignupLink = document.getElementById('show-signup-link');
    const showLoginLink = document.getElementById('show-login-link');
    const logoutButton = document.getElementById('logout-button');
    const problemListContainer = document.getElementById('problem-list-container');
    const backButton = document.getElementById('back-to-dashboard-button');
    const problemTextElement = document.getElementById('problem-text');
    const problemImageElement = document.getElementById('problem-image');
    const answerInputElement = document.getElementById('answer-input');
    const submitButton = document.getElementById('submit-button');
    const feedbackArea = document.getElementById('feedback-area');

    // --- AUTHENTICATED FETCH HELPER ---
    async function authedFetch(url, options = {}) {
        if (!authToken) { handleLogout(); throw new Error("User not authenticated"); }
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`, ...options.headers, };
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) { handleLogout(); throw new Error("Authentication failed"); }
        return response;
    }

    // --- VIEW MANAGEMENT ---
    function showView(viewId) {
        Object.values(views).forEach(view => view.style.display = 'none');
        if (views[viewId]) views[viewId].style.display = 'flex';
    }

    // --- AUTHENTICATION LOGIC ---
    async function handleLogin(e) {
        e.preventDefault();
        loginError.textContent = '';
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), });
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
            const response = await fetch(`${API_BASE_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Signup failed');
            showView('login');
            loginForm.reset();
            signupForm.reset();
            loginError.textContent = 'Signup successful! Please log in.';
        } catch (error) {
            signupError.textContent = error.message;
        }
    }

    function handleLogout() {
        authToken = null;
        localStorage.removeItem('authToken');
        loginForm.reset();
        signupForm.reset();
        showView('login');
    }
    
    // --- APP LOGIC ---
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
    }

    async function fetchAndDisplayDashboard() {
        try {
            const [problemsResponse, progressResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/problems`),
                authedFetch(`${API_BASE_URL}/progress/all`)
            ]);
            if (!problemsResponse.ok || !progressResponse.ok) throw new Error('Could not fetch dashboard data');
            const problems = await problemsResponse.json();
            const progressMap = await progressResponse.json();
            problemListContainer.innerHTML = '';
            problems.forEach(problem => {
                const problemElement = document.createElement('div');
                problemElement.classList.add('problem-item');
                problemElement.dataset.problemId = problem.id;
                const status = progressMap[problem.id];
                let statusBadge = '';
                if (status) {
                    const icon = status === 'mastered' ? 'check-circle' : 'edit-3';
                    statusBadge = `<span class="status-badge ${status.replace(' ', '_')}"><i data-feather="${icon}"></i> ${status}</span>`;
                }
                problemElement.innerHTML = `<div class="problem-item-icon"><i data-feather="bar-chart-2"></i></div><div class="problem-item-details"><span class="problem-item-title">${problem.id}. ${problem.title}</span><span class="problem-item-meta">Topic: ${problem.topic}</span></div>${statusBadge}`;
                problemElement.addEventListener('click', () => {
                    switchToSolverView(problem.id);
                });
                problemListContainer.appendChild(problemElement);
            });
            feather.replace();
        } catch (error) {
            problemListContainer.innerHTML = `<p>${error.message}</p>`;
        }
    }
    
    async function switchToSolverView(problemId) {
        currentProblemId = problemId;
        chatHistory = [];
        renderChatHistory();
        answerInputElement.value = '';
        showView('solver');
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
            const response = await fetch(`${API_BASE_URL}/problems/${problemId}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const problem = await response.json();
            problemTextElement.innerText = problem.problem_text;
            if (problem.image_url) {
                problemImageElement.src = problem.image_url;
                problemImageElement.style.display = 'block';
            } else {
                problemImageElement.style.display = 'none';
            }
        } catch (error) {
            problemTextElement.innerText = 'Failed to load problem.';
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
            if (result.is_correct) fetchAndDisplayDashboard();
        } catch (error) { console.error('Submit answer error:', error); }
    }

    // --- INITIALIZATION ---
    function initializeApp() {
        const savedToken = localStorage.getItem('authToken');
        if (savedToken) {
            authToken = savedToken;
            showView('dashboard');
            fetchAndDisplayDashboard();
        } else {
            showView('login');
        }
    }

    // Attach all event listeners
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    logoutButton.addEventListener('click', handleLogout);
    showSignupLink.addEventListener('click', (e) => { e.preventDefault(); signupForm.reset(); signupError.textContent = ''; showView('signup'); });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); loginForm.reset(); loginError.textContent = ''; showView('login'); });
    backButton.addEventListener('click', () => { showView('dashboard'); fetchAndDisplayDashboard(); });
    submitButton.addEventListener('click', submitAnswer);
    answerInputElement.addEventListener('keyup', (e) => { if (e.key === 'Enter') submitAnswer(); });

    initializeApp();
});