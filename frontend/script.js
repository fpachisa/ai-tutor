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
        },
        
        // Learning-Practice Integration Methods
        getProblemsForLearningStep: function(topic, maxStep) {
            return this.getHierarchicalURL(`/topics/${topic}/problems/by-learning-step/${maxStep}`);
        },
        
        getProblemsForSpecificStep: function(topic, step) {
            return this.getHierarchicalURL(`/topics/${topic}/problems/for-step/${step}`);
        },
        
        getProblemsWithLearningFilter: function(topic, maxStep) {
            return this.getHierarchicalURL(`/topics/${topic}/problems?max_learning_step=${maxStep}`);
        },
        
        getLearningProgress: function(topic) {
            return this.getHierarchicalURL(`/${topic}-tutor/status`);
        }
    };
    
    // --- CACHING SYSTEM ---
    const CACHE_CONFIG = {
        TTL: {
            DASHBOARD: 5 * 60 * 1000,      // 5 minutes
            TOPIC_PROGRESS: 3 * 60 * 1000,  // 3 minutes
            USER_STATS: 5 * 60 * 1000,      // 5 minutes
        },
        KEYS: {
            DASHBOARD: 'ai_tutor_dashboard',
            TOPIC_PROGRESS: 'ai_tutor_topic_progress',
            USER_STATS: 'ai_tutor_user_stats',
        }
    };
    
    const CacheManager = {
        // Set data in cache with timestamp
        set(key, data, ttl = CACHE_CONFIG.TTL.DASHBOARD) {
            try {
                const cacheItem = {
                    data: data,
                    timestamp: Date.now(),
                    ttl: ttl
                };
                localStorage.setItem(key, JSON.stringify(cacheItem));
                console.log(`Cache SET: ${key}`);
            } catch (error) {
                console.warn('Cache storage failed:', error);
            }
        },
        
        // Get data from cache if valid
        get(key) {
            try {
                const cached = localStorage.getItem(key);
                if (!cached) return null;
                
                const cacheItem = JSON.parse(cached);
                const now = Date.now();
                
                // Check if cache is expired
                if (now - cacheItem.timestamp > cacheItem.ttl) {
                    console.log(`Cache EXPIRED: ${key}`);
                    this.remove(key);
                    return null;
                }
                
                console.log(`Cache HIT: ${key}`);
                return cacheItem.data;
            } catch (error) {
                console.warn('Cache retrieval failed:', error);
                return null;
            }
        },
        
        // Remove specific cache entry
        remove(key) {
            localStorage.removeItem(key);
            console.log(`Cache REMOVED: ${key}`);
        },
        
        // Clear all cache entries
        clearAll() {
            Object.values(CACHE_CONFIG.KEYS).forEach(key => {
                this.remove(key);
            });
            console.log('All cache cleared');
        },
        
        // Check if cache exists and is valid
        isValid(key) {
            const cached = this.get(key);
            return cached !== null;
        },
        
        // Get cache info for debugging
        getInfo(key) {
            try {
                const cached = localStorage.getItem(key);
                if (!cached) return null;
                
                const cacheItem = JSON.parse(cached);
                const now = Date.now();
                const age = now - cacheItem.timestamp;
                const remaining = cacheItem.ttl - age;
                
                return {
                    exists: true,
                    age: Math.round(age / 1000) + 's',
                    remaining: Math.round(remaining / 1000) + 's',
                    expired: remaining <= 0
                };
            } catch (error) {
                return null;
            }
        }
    };
    
    // --- SPECIALIZED CACHE FUNCTIONS ---
    const DashboardCache = {
        // Cache dashboard data
        setDashboardData(data) {
            CacheManager.set(CACHE_CONFIG.KEYS.DASHBOARD, data, CACHE_CONFIG.TTL.DASHBOARD);
        },
        
        getDashboardData() {
            return CacheManager.get(CACHE_CONFIG.KEYS.DASHBOARD);
        },
        
        // Cache topic progress data with topic-specific keys
        setTopicProgress(topic, progressData) {
            const cacheKey = `${CACHE_CONFIG.KEYS.TOPIC_PROGRESS}_${topic}`;
            CacheManager.set(cacheKey, progressData, CACHE_CONFIG.TTL.TOPIC_PROGRESS);
        },
        
        getTopicProgress(topic) {
            const cacheKey = `${CACHE_CONFIG.KEYS.TOPIC_PROGRESS}_${topic}`;
            return CacheManager.get(cacheKey);
        },
        
        // Cache all topics progress in one object
        setAllTopicsProgress(allProgressData) {
            CacheManager.set(CACHE_CONFIG.KEYS.TOPIC_PROGRESS, allProgressData, CACHE_CONFIG.TTL.TOPIC_PROGRESS);
        },
        
        getAllTopicsProgress() {
            return CacheManager.get(CACHE_CONFIG.KEYS.TOPIC_PROGRESS);
        },
        
        // Cache user statistics
        setUserStats(statsData) {
            CacheManager.set(CACHE_CONFIG.KEYS.USER_STATS, statsData, CACHE_CONFIG.TTL.USER_STATS);
        },
        
        getUserStats() {
            return CacheManager.get(CACHE_CONFIG.KEYS.USER_STATS);
        },
        
        // Invalidate specific caches when user completes problems
        invalidateAfterProblemCompletion(topicName) {
            // Remove topic-specific progress cache
            const topicCacheKey = `${CACHE_CONFIG.KEYS.TOPIC_PROGRESS}_${topicName}`;
            CacheManager.remove(topicCacheKey);
            
            // Remove learning progress cache for this topic
            const learningCacheKey = `learning_progress_${topicName}`;
            CacheManager.remove(learningCacheKey);
            
            // Remove general caches that depend on progress
            CacheManager.remove(CACHE_CONFIG.KEYS.TOPIC_PROGRESS);
            CacheManager.remove(CACHE_CONFIG.KEYS.USER_STATS);
            CacheManager.remove(CACHE_CONFIG.KEYS.DASHBOARD);
            
            console.log(`Cache invalidated after ${topicName} progress update`);
        },
        
        // Clear all dashboard-related caches
        clearAll() {
            CacheManager.clearAll();
            // Also clear topic-specific caches
            const topics = ['Algebra', 'Fractions', 'Speed', 'Ratio', 'Measurement', 'Data Analysis', 'Percentage', 'Geometry'];
            topics.forEach(topic => {
                const topicCacheKey = `${CACHE_CONFIG.KEYS.TOPIC_PROGRESS}_${topic}`;
                CacheManager.remove(topicCacheKey);
                
                // Also clear learning progress cache for each topic
                const learningCacheKey = `learning_progress_${topic}`;
                CacheManager.remove(learningCacheKey);
            });
        }
    };
    
    // --- LEARNING-PRACTICE INTEGRATION SERVICE ---
    const LearningPracticeIntegrator = {
        // Get completed learning steps for a topic
        async getCompletedLearningSteps(topic) {
            try {
                const response = await fetch(APP_CONFIG.getLearningProgress(topic), {
                    headers: {
                        'Authorization': 'Bearer ' + localStorage.getItem('authToken')
                    }
                });
                
                if (!response.ok) {
                    console.warn(`No learning progress found for ${topic}`);
                    return [];
                }
                
                const learningStatus = await response.json();
                return this.extractCompletedSteps(learningStatus);
            } catch (error) {
                console.warn(`Error fetching learning progress for ${topic}:`, error);
                return [];
            }
        },
        
        // Extract completed step numbers from learning status
        extractCompletedSteps(learningStatus) {
            if (!learningStatus || !learningStatus.progress_by_step) {
                return [];
            }
            
            const completedSteps = [];
            Object.entries(learningStatus.progress_by_step).forEach(([step, status]) => {
                if (status === 'mastered' || status === 'completed') {
                    const stepNumber = parseInt(step.replace('step', ''));
                    if (!isNaN(stepNumber)) {
                        completedSteps.push(stepNumber);
                    }
                }
            });
            
            return completedSteps;
        },
        
        // Get practice problems appropriate for completed learning steps
        async getRecommendedProblems(topic, filter = null) {
            try {
                const completedSteps = await this.getCompletedLearningSteps(topic);
                const maxStep = completedSteps.length > 0 ? Math.max(...completedSteps) : 0;
                
                // If no learning completed, get all available problems
                if (maxStep === 0) {
                    return this.getAllProblems(topic, filter);
                }
                
                // Get problems appropriate for completed learning steps
                const url = filter 
                    ? `${APP_CONFIG.getProblemsForLearningStep(topic, maxStep)}?filter=${filter}`
                    : APP_CONFIG.getProblemsForLearningStep(topic, maxStep);
                
                const response = await fetch(url, {
                    headers: {
                        'Authorization': 'Bearer ' + localStorage.getItem('authToken')
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Failed to fetch recommended problems');
                }
                
                const data = await response.json();
                return {
                    problems: data.problems || data, // Handle both formats
                    maxLearningStep: maxStep,
                    completedSteps: completedSteps
                };
            } catch (error) {
                console.error('Error getting recommended problems:', error);
                // Fallback to all problems
                return this.getAllProblems(topic, filter);
            }
        },
        
        // Get all problems for a topic (fallback)
        async getAllProblems(topic, filter = null) {
            try {
                const url = filter 
                    ? APP_CONFIG.getHierarchicalURL(`/topics/${topic}/problems?filter=${filter}`)
                    : APP_CONFIG.getHierarchicalURL(`/topics/${topic}/problems`);
                
                const response = await fetch(url, {
                    headers: {
                        'Authorization': 'Bearer ' + localStorage.getItem('authToken')
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Failed to fetch problems');
                }
                
                const problems = await response.json();
                return {
                    problems: problems,
                    maxLearningStep: null,
                    completedSteps: []
                };
            } catch (error) {
                console.error('Error getting all problems:', error);
                return { problems: [], maxLearningStep: null, completedSteps: [] };
            }
        },
        
        // Get problems for a specific learning step (for step completion celebration)
        async getProblemsForStep(topic, step) {
            try {
                const response = await fetch(APP_CONFIG.getProblemsForSpecificStep(topic, step), {
                    headers: {
                        'Authorization': 'Bearer ' + localStorage.getItem('authToken')
                    }
                });
                
                if (!response.ok) {
                    return [];
                }
                
                const data = await response.json();
                return data.problems || [];
            } catch (error) {
                console.error(`Error getting problems for step ${step}:`, error);
                return [];
            }
        },
        
        // Determine if user should start with learning or practice
        async shouldShowLearningFirst(topic) {
            const completedSteps = await this.getCompletedLearningSteps(topic);
            // Show learning first if no steps completed or less than 2 steps completed
            return completedSteps.length < 2;
        },
        
        // Get learning context for a practice problem
        getLearningContext(problem) {
            if (!problem.learn_step) {
                return null;
            }
            
            return {
                step: problem.learn_step,
                message: `This problem uses concepts from Learning Step ${problem.learn_step}`,
                reviewAction: () => {
                    // Navigate to learning step review
                    navigateToLearningStep(problem.topic, problem.learn_step);
                }
            };
        }
    };
    
    // --- SMART NAVIGATION SERVICE ---
    const SmartNavigationService = {
        // Determine the best next action for a user based on their progress
        async getNextAction(topic) {
            try {
                const completedSteps = await LearningPracticeIntegrator.getCompletedLearningSteps(topic);
                const recommendedData = await LearningPracticeIntegrator.getRecommendedProblems(topic);
                
                // Decision tree for next action
                if (completedSteps.length === 0) {
                    return {
                        action: 'start_learning',
                        step: 1,
                        text: 'Begin Learning',
                        description: 'Start with Step 1 to learn fundamental concepts',
                        buttonClass: 'button-primary',
                        icon: '🚀'
                    };
                }
                
                if (this.hasNewPracticeProblems(completedSteps, recommendedData)) {
                    const newProblems = await LearningPracticeIntegrator.getProblemsForStep(topic, Math.max(...completedSteps));
                    return {
                        action: 'practice_problems',
                        text: 'Try Practice Problems',
                        description: `${newProblems.length} new problems unlocked from Step ${Math.max(...completedSteps)}`,
                        buttonClass: 'button-primary',
                        icon: '💪'
                    };
                }
                
                if (this.canContinueLearning(completedSteps)) {
                    const nextStep = Math.max(...completedSteps) + 1;
                    return {
                        action: 'continue_learning',
                        step: nextStep,
                        text: `Continue to Step ${nextStep}`,
                        description: 'Learn new concepts to unlock more practice problems',
                        buttonClass: 'button-primary',
                        icon: '📚'
                    };
                }
                
                if (this.hasMorePractice(recommendedData)) {
                    return {
                        action: 'continue_practice',
                        text: 'Continue Practice',
                        description: 'Master more problems to complete the topic',
                        buttonClass: 'button-secondary',
                        icon: '🎯'
                    };
                }
                
                return {
                    action: 'topic_mastered',
                    text: 'Topic Mastered! 🎉',
                    description: 'You\'ve completed all learning steps and practice problems',
                    buttonClass: 'button-success',
                    icon: '✨'
                };
            } catch (error) {
                console.error('Error determining next action:', error);
                return {
                    action: 'start_learning',
                    step: 1,
                    text: 'Begin Learning',
                    description: 'Start your learning journey',
                    buttonClass: 'button-primary',
                    icon: '🚀'
                };
            }
        },
        
        // Check if there are new practice problems available
        hasNewPracticeProblems(completedSteps, recommendedData) {
            if (completedSteps.length === 0) return false;
            
            const maxStep = Math.max(...completedSteps);
            const availableProblems = recommendedData.problems || [];
            
            // Check if there are problems for the latest completed step that haven't been practiced
            return availableProblems.some(problem => 
                problem.learn_step === maxStep && 
                !this.isProblemMastered(problem.id)
            );
        },
        
        // Check if user can continue learning (not all 4 steps completed)
        canContinueLearning(completedSteps) {
            return completedSteps.length < 4;
        },
        
        // Check if there are more practice problems to do
        hasMorePractice(recommendedData) {
            const problems = recommendedData.problems || [];
            return problems.some(problem => !this.isProblemMastered(problem.id));
        },
        
        // Check if a specific problem is mastered (would need to check progress)
        isProblemMastered(problemId) {
            // This would need to check actual problem progress
            // For now, assume not mastered
            return false;
        },
        
        // Navigate based on action
        async executeAction(topic, action) {
            switch (action.action) {
                case 'start_learning':
                case 'continue_learning':
                    await this.navigateToLearning(topic, action.step || 1);
                    break;
                case 'practice_problems':
                case 'continue_practice':
                    await this.navigateToPractice(topic);
                    break;
                case 'topic_mastered':
                    this.showMasterycelebration(topic);
                    break;
                default:
                    console.warn('Unknown action:', action);
            }
        },
        
        // Navigate to learning mode
        async navigateToLearning(topic, step = 1) {
            // This would trigger the learning pathway view
            showTopicView(topic); // Uses existing function
        },
        
        // Navigate to practice mode with smart problem filtering
        async navigateToPractice(topic) {
            // This would show practice problems filtered by learning progress
            showTopicView(topic); // Uses existing function
        },
        
        // Show mastery celebration
        showMasterycelebration(topic) {
            // Create celebration modal or notification
            console.log(`🎉 Congratulations! You've mastered ${topic}!`);
        }
    };
    
    // --- REQUEST BATCHING UTILITY ---
    const RequestBatcher = {
        // In-flight request cache to prevent duplicate requests
        inFlightRequests: new Map(),
        
        // Batch promises into groups to prevent overwhelming the server
        async batchProcess(items, processFn, batchSize = 5) {
            const results = [];
            for (let i = 0; i < items.length; i += batchSize) {
                const batch = items.slice(i, i + batchSize);
                const batchPromises = batch.map(processFn);
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                
                // Small delay between batches to be server-friendly
                if (i + batchSize < items.length) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            return results;
        },
        
        // Deduplicate API requests by URL
        async deduplicatedFetch(url, options = {}) {
            const requestKey = `${url}_${JSON.stringify(options)}`;
            
            // If request is already in flight, return the existing promise
            if (this.inFlightRequests.has(requestKey)) {
                console.log(`Deduplicated request: ${url}`);
                return this.inFlightRequests.get(requestKey);
            }
            
            // Create new request and cache the promise
            const requestPromise = authedFetch(url, options)
                .finally(() => {
                    // Clean up the cache when request completes
                    this.inFlightRequests.delete(requestKey);
                });
            
            this.inFlightRequests.set(requestKey, requestPromise);
            return requestPromise;
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
        } else if (hash.match(/#\/(\w+)-tutor/)) {
            // Generic tutor routing for any topic (including algebra, fractions, geometry, ratio, speed, etc.)
            const topicMatch = hash.match(/#\/(\w+)-tutor/);
            const topic = topicMatch[1];
            
            console.log(`🔗 Hash routing: detected #/${topic}-tutor, calling startLearningTutor`);
            if (!authToken) {
                showView('login-view', false);
                return;
            }
            startLearningTutor(topic);
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
        
        // Clear all cached data on logout
        DashboardCache.clearAll();
        
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
            showView('welcome-chat-view');
        }
    }

    function displayCurrentQuizQuestion() {
        const question = quizState.questions[quizState.currentQuestionIndex];
        const questionNumber = quizState.currentQuestionIndex + 1;
        
        // Update question counter
        const questionCounter = document.getElementById('quiz-question-counter');
        if (questionCounter) {
            questionCounter.textContent = `Question ${questionNumber} of ${quizState.questions.length}`;
        }
        
        quizQuestionNumber.textContent = `Question ${questionNumber} of ${quizState.questions.length}`;
        quizQuestionText.innerHTML = question.question;
        
        // Handle SVG diagrams
        const diagramContainer = document.getElementById('quiz-question-diagram');
        if (question.diagram_svg && question.diagram_svg !== null) {
            diagramContainer.innerHTML = question.diagram_svg;
            diagramContainer.style.display = 'flex';
        } else {
            diagramContainer.innerHTML = '';
            diagramContainer.style.display = 'none';
        }
        
        // Handle traditional images (fallback)
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
        
        // Ensure MathJax processes the new content
        setTimeout(() => {
            typesetMath(document.getElementById('quiz-question-area'));
            typesetMath(document.getElementById('quiz-options-area'));
        }, 100);
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
        
        // Check for cached dashboard data first
        const cachedDashboard = DashboardCache.getDashboardData();
        const cachedStats = DashboardCache.getUserStats();
        
        if (cachedDashboard && cachedStats) {
            console.log('Loading dashboard from cache...');
            // Display cached data immediately
            await displayDashboardData(cachedDashboard, cachedStats);
            return;
        }
        
        // Show loading state if no cache
        recommendedContainer.innerHTML = '<div class="loading-message">Loading recommendations...</div>';
        allTopicsContainer.innerHTML = '<div class="loading-message">Loading topics...</div>';

        try {
            // Fetch fresh dashboard data
            const response = await authedFetch(APP_CONFIG.getHierarchicalURL('/dashboard'));
            if (!response.ok) throw new Error('Could not fetch dashboard data');
            const data = await response.json();
            
            // Cache the dashboard data
            DashboardCache.setDashboardData(data);
            
            // Update dashboard stats with real data
            const statsData = await updateDashboardStats();
            
            // Display the data
            await displayDashboardData(data, statsData);

        } catch (error) {
            recommendedContainer.innerHTML = '<div class="error-state">Could not load recommendations. Please try again.</div>';
            allTopicsContainer.innerHTML = '<div class="error-state">Could not load topics. Please try again.</div>';
            console.error("Dashboard fetch error:", error);
        }
    }
    
    // Separate function to display dashboard data (used for both cached and fresh data)
    async function displayDashboardData(data, statsData) {
        const recommendedContainer = document.getElementById('recommended-topics-container');
        const allTopicsContainer = document.getElementById('all-topics-container');
        
        // Enhanced function to create topic cards with cached data
        const createEnhancedTopicCard = async (topic, isRecommended = false) => {
            const card = document.createElement('div');
            card.className = 'enhanced-topic-card';
            
            // Get topic metadata
            const metadata = TOPIC_METADATA[topic] || TOPIC_METADATA['Default'];
            
            // Try to get cached data first
            let topicStats = DashboardCache.getTopicProgress(topic);
            let learningProgress = null;
            const learningCacheKey = `learning_progress_${topic}`;
            learningProgress = CacheManager.get(learningCacheKey);
            
            // Prepare parallel API calls for missing data
            const apiCalls = [];
            
            if (!topicStats) {
                apiCalls.push(
                    RequestBatcher.deduplicatedFetch(APP_CONFIG.getHierarchicalURL(`/topics/${topic}/progress/summary`))
                        .then(response => response.ok ? response.json() : null)
                        .catch(error => {
                            console.warn(`Could not fetch stats for ${topic}:`, error);
                            return null;
                        })
                );
            } else {
                apiCalls.push(Promise.resolve(topicStats));
            }
            
            if (!learningProgress) {
                const topicKey = topic.toLowerCase();
                apiCalls.push(
                    RequestBatcher.deduplicatedFetch(APP_CONFIG.getHierarchicalURL(`/${topicKey}-tutor/status`))
                        .then(response => response.ok ? response.json() : null)
                        .catch(error => {
                            console.warn(`Could not fetch learning progress for ${topic}:`, error);
                            return null;
                        })
                );
            } else {
                apiCalls.push(Promise.resolve(learningProgress));
            }
            
            // Execute both API calls in parallel
            const [practiceData, learningData] = await Promise.all(apiCalls);
            
            // Update topic stats
            if (!topicStats && practiceData) {
                topicStats = practiceData;
                DashboardCache.setTopicProgress(topic, topicStats);
            } else if (!topicStats) {
                topicStats = {
                    total_problems: 0,
                    mastered_count: 0,
                    in_progress_count: 0
                };
            }
            
            // Update learning progress
            if (!learningProgress && learningData) {
                learningProgress = learningData;
                console.log(`Learning progress for ${topic}:`, learningProgress);
                CacheManager.set(learningCacheKey, learningProgress, CACHE_CONFIG.TTL.TOPIC_PROGRESS);
            }
            
            // Calculate integrated learning journey status using our new service
            const completedSteps = learningProgress ? 
                LearningPracticeIntegrator.extractCompletedSteps(learningProgress) : [];
            
            const masteredPercent = topicStats.total_problems > 0 ? 
                Math.round((topicStats.mastered_count / topicStats.total_problems) * 100) : 0;
            
            // Create unified progress display
            let journeyStatus = 'Not Started';
            let statusClass = 'status-not-started';
            let progressDetails = '';
            
            // Enhanced status calculation with learning steps integration
            if (learningProgress && learningProgress.progress_status === 'mastered') {
                journeyStatus = 'Mastered';
                statusClass = 'status-mastered';
                progressDetails = `All 4 Steps Complete • ${topicStats.mastered_count}/${topicStats.total_problems} Practice Problems`;
            } else if (completedSteps.length > 0) {
                journeyStatus = 'In Progress';
                statusClass = 'status-in-progress';
                const stepText = completedSteps.length === 1 ? 'Step' : 'Steps';
                progressDetails = `${completedSteps.length}/4 ${stepText} • ${topicStats.mastered_count}/${topicStats.total_problems} Practice`;
            } else if (learningProgress && (learningProgress.progress_status === 'in_progress' || learningProgress.has_history)) {
                journeyStatus = 'In Progress';
                statusClass = 'status-in-progress';
                progressDetails = `Learning in Progress • ${topicStats.mastered_count}/${topicStats.total_problems} Practice`;
            } else if (topicStats.mastered_count > 0 && topicStats.mastered_count === topicStats.total_problems) {
                journeyStatus = 'Mastered';
                statusClass = 'status-mastered';
                progressDetails = `Practice Complete • ${topicStats.mastered_count}/${topicStats.total_problems} Problems`;
            } else if (topicStats.in_progress_count > 0 || topicStats.mastered_count > 0) {
                journeyStatus = 'In Progress';
                statusClass = 'status-in-progress';
                progressDetails = `Practice Only • ${topicStats.mastered_count}/${topicStats.total_problems} Problems`;
            } else {
                progressDetails = `${topicStats.total_problems} Practice Problems Available`;
            }
            
            card.innerHTML = `
                <div class="topic-card-header">
                    <div class="topic-card-icon">
                        <i data-feather="${metadata.icon}"></i>
                    </div>
                    <h3 class="topic-card-title">${topic}</h3>
                </div>
                
                <div class="topic-card-stats">
                    <div class="stat-item">
                        <span class="stat-label">Learning Journey</span>
                        <span class="stat-value ${statusClass}">${journeyStatus}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Progress Details</span>
                        <span class="stat-details">${progressDetails}</span>
                    </div>
                </div>
                
                <div class="topic-card-meta">
                    ${completedSteps.length > 0 ? `<span class="learning-badge">Step ${Math.max(...completedSteps)}/4</span>` : ''}
                    ${masteredPercent > 0 ? `<span class="mastery-badge">${masteredPercent}% Practice</span>` : ''}
                    ${topicStats.in_progress_count > 0 ? `<span class="progress-badge">${topicStats.in_progress_count} Active</span>` : ''}
                </div>
            `;
            
            card.addEventListener('click', () => showTopicView(topic));
            return card;
        };

        // --- Populate Recommended Topics (Batched Parallel Processing) ---
        recommendedContainer.innerHTML = '';
        if (data.recommended_topics && data.recommended_topics.length > 0) {
            // Create recommended topic cards with batching (max 5 concurrent)
            const recommendedCards = await RequestBatcher.batchProcess(
                data.recommended_topics,
                topic => createEnhancedTopicCard(topic, true),
                5
            );
            
            // Append all cards at once
            recommendedCards.forEach(card => {
                recommendedContainer.appendChild(card);
            });
        } else {
            recommendedContainer.innerHTML = '<div class="empty-state">No specific recommendations yet. Great job! Pick any topic to begin.</div>';
        }

        // --- Populate All Other Topics (Batched Parallel Processing) ---
        allTopicsContainer.innerHTML = '';
        if (data.all_topics && data.all_topics.length > 0) {
            // Create all topic cards with batching (max 5 concurrent)
            const allTopicCards = await RequestBatcher.batchProcess(
                data.all_topics,
                topic => createEnhancedTopicCard(topic, false),
                5
            );
            
            // Append all cards at once
            allTopicCards.forEach(card => {
                allTopicsContainer.appendChild(card);
            });
        }
        
        // Set up quick action event listeners
        setupQuickActions();

        // This is essential to render the new icons
        feather.replace();
    }
    
    async function updateDashboardStats() {
        // Check for cached stats first
        const cachedStats = DashboardCache.getUserStats();
        if (cachedStats) {
            console.log('Loading dashboard stats from cache...');
            // Update stat values with cached data
            animateStatValue('topics-completed', cachedStats.topicsCompleted);
            animateStatValue('learning-streak', cachedStats.learningStreak);
            animateStatValue('total-problems', cachedStats.totalProblems);
            return cachedStats;
        }
        
        try {
            // Fetch real user progress data
            const progressResponse = await authedFetch(`${API_BASE_URL}/progress/all`);
            if (!progressResponse.ok) throw new Error('Could not fetch progress data');
            const progressData = await progressResponse.json();
            
            // Calculate real statistics
            const totalProblems = Object.keys(progressData).length;
            const masteredProblems = Object.values(progressData).filter(status => status === 'mastered').length;
            
            // For topics completed, we need to check each topic's completion status
            const topicsCompleted = await calculateCompletedTopics();
            
            // For learning streak, we'll use mastered problems for now (could be enhanced with date tracking)
            const learningStreak = masteredProblems;
            
            const stats = {
                topicsCompleted: topicsCompleted,
                learningStreak: learningStreak,
                totalProblems: masteredProblems,
                progressData: progressData // Include raw data for future use
            };
            
            // Cache the stats
            DashboardCache.setUserStats(stats);
            
            // Update stat values with animation
            animateStatValue('topics-completed', stats.topicsCompleted);
            animateStatValue('learning-streak', stats.learningStreak);
            animateStatValue('total-problems', stats.totalProblems);
            
            return stats;
            
        } catch (error) {
            console.warn('Could not fetch real dashboard stats:', error);
            // Fallback to default values on error
            const fallbackStats = {
                topicsCompleted: 0,
                learningStreak: 0,
                totalProblems: 0
            };
            animateStatValue('topics-completed', 0);
            animateStatValue('learning-streak', 0);
            animateStatValue('total-problems', 0);
            return fallbackStats;
        }
    }
    
    async function calculateCompletedTopics() {
        const topics = ['Algebra', 'Fractions', 'Speed', 'Ratio', 'Measurement', 'Data Analysis', 'Percentage', 'Geometry'];
        
        // Use batched processing for topic completion checks
        const completionResults = await RequestBatcher.batchProcess(
            topics,
            async topic => {
                // Try to get cached topic progress first
                let topicStats = DashboardCache.getTopicProgress(topic);
                
                if (!topicStats) {
                    // If not cached, fetch it
                    try {
                        const statsResponse = await authedFetch(APP_CONFIG.getHierarchicalURL(`/topics/${topic}/progress/summary`));
                        if (statsResponse.ok) {
                            topicStats = await statsResponse.json();
                            // Cache the topic progress for future use
                            DashboardCache.setTopicProgress(topic, topicStats);
                        }
                    } catch (error) {
                        console.warn(`Could not check completion for ${topic}:`, error);
                        return false; // Return false for failed fetches
                    }
                }
                
                // Check if topic is completed
                return topicStats && topicStats.mastered_count > 0 && 
                       topicStats.mastered_count === topicStats.total_problems && 
                       topicStats.total_problems > 0;
            },
            4 // Batch size of 4 for stats calculation
        );
        
        // Count completed topics
        const completedCount = completionResults.filter(Boolean).length;
        
        return completedCount;
    }
    
    function animateStatValue(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const startValue = 0;
        const duration = 1000;
        const startTime = Date.now();
        
        function updateValue() {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);
            element.textContent = currentValue;
            
            if (progress < 1) {
                requestAnimationFrame(updateValue);
            }
        }
        
        requestAnimationFrame(updateValue);
    }
    
    function setupQuickActions() {
        const retakeQuizCard = document.getElementById('retake-quiz-card');
        const continueCard = document.getElementById('continue-learning-card');
        
        if (retakeQuizCard) {
            retakeQuizCard.addEventListener('click', () => {
                startQuiz();
            });
        }
        
        if (continueCard) {
            continueCard.addEventListener('click', () => {
                // Navigate to the first recommended topic or show topic selection
                const firstRecommended = document.querySelector('#recommended-topics-container .enhanced-topic-card');
                if (firstRecommended) {
                    firstRecommended.click();
                } else {
                    // If no recommendations, scroll to all topics
                    document.getElementById('all-topics-section').scrollIntoView({ behavior: 'smooth' });
                }
            });
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
                // Invalidate cache for this topic since user completed a problem
                if (currentTopicName) {
                    DashboardCache.invalidateAfterProblemCompletion(currentTopicName);
                }
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

        // Ensure the prompt is hidden initially
        signupPromptArea.style.display = 'none';

        try {
            const response = await fetch(APP_CONFIG.getHierarchicalURL('/diagnostic/analyze'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_answers: quizState.userAnswers })
            });

            if (!response.ok) {
                throw new Error('Analysis failed');
            }

            const report = await response.json();
            
            // Store the recommended topic for signup
            quizState.recommendedTopic = report.recommended_topic;
            
            // Calculate score percentage for visual display
            const correctAnswers = quizState.userAnswers.filter(answer => answer.is_correct).length;
            const totalQuestions = quizState.userAnswers.length;
            const scorePercentage = Math.round((correctAnswers / totalQuestions) * 100);
            
            // Get topic icon from metadata
            const topicMetadata = TOPIC_METADATA[report.recommended_topic] || TOPIC_METADATA['Default'];
            
            // Display enhanced results with visual elements
            resultsArea.innerHTML = `
                <div class="score-section">
                    <h2>${report.score_text}</h2>
                    <div class="score-description">${report.summary_message}</div>
                </div>
                
                <div class="recommendation-section">
                    <h3>Your Personalized Learning Path</h3>
                    <div class="recommendation-card" id="recommendation-card">
                        <div class="recommendation-icon">
                            <i data-feather="${topicMetadata.icon}"></i>
                        </div>
                        <h3>Start with ${report.recommended_topic}</h3>
                        <p>Based on your assessment, this topic will help you build a strong foundation and boost your confidence.</p>
                        <div class="recommendation-cta" id="begin-learning-btn">
                            <span>Begin Learning</span>
                            <i data-feather="arrow-right"></i>
                        </div>
                    </div>
                </div>
            `;
            
            // Re-initialize feather icons for the new content
            feather.replace();
            
            // Add click event listener to the Begin Learning button
            const beginLearningBtn = document.getElementById('begin-learning-btn');
            const recommendationCard = document.getElementById('recommendation-card');
            
            if (beginLearningBtn) {
                beginLearningBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showView('signup-view');
                });
            }
            
            if (recommendationCard) {
                recommendationCard.addEventListener('click', () => {
                    showView('signup-view');
                });
            }

        } catch (error) {
            console.error("Error analyzing results:", error);
            // If there's an error, display a fallback message
            resultsArea.innerHTML = `
                <div class="score-section">
                    <h2>Quiz Complete!</h2>
                    <div class="score-description">There was an issue generating your personalized report, but you can still sign up to start practicing.</div>
                </div>
            `;
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
        
        // Check if topic has learning tutor support by trying to get steps
        try {
            const topicKey = topicName.toLowerCase();
            const url = APP_CONFIG.getHierarchicalURL(`/${topicKey}/learn/steps`);
            const response = await authedFetch(url);
            
            if (!response.ok) {
                console.log(`📚 ${topicName} does not have learning tutor support, showing practice mode`);
                return { mode: 'practice', reason: 'no_learning_support' };
            }
            
            console.log(`📚 ${topicName} has learning tutor support, checking progress...`);
        } catch (error) {
            console.log(`📚 Error checking ${topicName} learning support:`, error);
            return { mode: 'practice', reason: 'learning_check_failed' };
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
    
    async function showLearningModeDashboard(topicName) {
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
        await createPathwayContent(topicName);
        
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

    // --- DYNAMIC STEPS LOADING ---
    async function getStepsForTopic(topicName) {
        try {
            // Try to get steps from new API endpoint
            const topicKey = topicName.toLowerCase();
            const url = APP_CONFIG.getHierarchicalURL(`/${topicKey}/learn/steps`);
            
            const response = await authedFetch(url);
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Loaded ${data.total_steps} steps for ${topicName} from API`);
                return data.steps;
            } else {
                console.log(`⚠️ API call failed for ${topicName}, using fallback steps`);
            }
        } catch (error) {
            console.log(`⚠️ Error loading steps for ${topicName}, using fallback:`, error);
        }
        
        // Fallback to hardcoded steps for backward compatibility
        return getHardcodedStepsForTopic(topicName);
    }

    function getHardcodedStepsForTopic(topicName) {
        if (topicName === 'Algebra') {
            return [
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
            return [
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
        
        // Default fallback for other topics
        return [
            {
                icon: '📚',
                title: 'Step 1',
                description: `Learning step 1 for ${topicName}`
            },
            {
                icon: '📚',
                title: 'Step 2', 
                description: `Learning step 2 for ${topicName}`
            },
            {
                icon: '📚',
                title: 'Step 3',
                description: `Learning step 3 for ${topicName}`
            },
            {
                icon: '📚',
                title: 'Step 4',
                description: `Learning step 4 for ${topicName}`
            }
        ];
    }

    async function createPathwayContent(topicName) {
        const container = document.getElementById('pathway-container');
        if (!container) return;
        
        // Clear existing content
        container.innerHTML = '';
        
        // Get steps dynamically from API, with fallback to hardcoded
        let steps = await getStepsForTopic(topicName);
        
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
        // Get user's tutor progress using generic system for all topics
        getUserGenericTutorProgress(topicName).then(progress => {
            updateLearningPathway(progress);
            setupPathwayInteractivity(topicName);
        });
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

    async function getUserGenericTutorProgress(topicName) {
        try {
            // Use hierarchical URL structure with generic learning tutor
            const topicKey = topicName.toLowerCase();
            const url = APP_CONFIG.getHierarchicalURL(`/${topicKey}-tutor/status`);
            const response = await authedFetch(url);
            if (response.ok) {
                const status = await response.json();
                console.log(`📊 PATHWAY: Fetched ${topicName} tutor status:`, status);
                const progress = {
                    completedSteps: status.completed_steps || 0,
                    currentStep: status.current_step || 1,
                    isCompleted: status.is_completed || false,
                    progressStatus: status.progress_status || 'pending'
                };
                console.log(`📊 PATHWAY: Processed ${topicName} progress data:`, progress);
                return progress;
            }
        } catch (error) {
            console.log(`Could not fetch ${topicName} tutor progress:`, error);
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
        // Start the appropriate tutor based on topic using generic system
        console.log(`Starting ${topicName} tutor from step ${stepNumber}`);
        startLearningTutor(topicName.toLowerCase(), stepNumber);
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
            
            // Start the appropriate tutor using generic system
            newReviewBtn.addEventListener('click', () => startLearningTutor(topicName.toLowerCase()));
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
            await showLearningModeDashboard(topicName);
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
                        <button class="button-primary" onclick="goToPracticeProblems()" style="margin-top: 0.5rem;">
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
                        <button class="button-primary" onclick="goToPracticeProblems()" style="margin-top: 0.5rem;">
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
                
                // Invalidate cache since learning progress started
                DashboardCache.invalidateAfterProblemCompletion('Algebra');
                
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
        // IMPORTANT: Preserve MathJax $...$ and $$...$$ expressions
        let parsed = text;
        
        // First, protect MathJax expressions by temporarily replacing them
        const mathExpressions = [];
        let mathIndex = 0;
        
        // Protect display math $$...$$ 
        parsed = parsed.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
            mathExpressions[mathIndex] = match;
            return `__MATH_${mathIndex++}__`;
        });
        
        // Protect inline math $...$
        parsed = parsed.replace(/\$([^$\n]+?)\$/g, (match) => {
            mathExpressions[mathIndex] = match;
            return `__MATH_${mathIndex++}__`;
        });
        
        // Now safely apply markdown formatting (won't interfere with math)
        // Bold text: **text** -> <strong>text</strong>
        parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic text: *text* -> <em>text</em> (but be careful not to affect asterisks in math)
        parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Code inline: `text` -> <code>text</code>
        parsed = parsed.replace(/`(.*?)`/g, '<code style="background: rgba(102, 126, 234, 0.1); padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace;">$1</code>');
        
        // Math equations: □ symbol highlighting
        parsed = parsed.replace(/□/g, '<span style="background: rgba(102, 126, 234, 0.2); padding: 0.1rem 0.3rem; border-radius: 3px; font-weight: bold;">□</span>');
        
        // Line breaks: \n -> <br> (convert newlines to HTML breaks)
        // Also handle escaped newlines that appear as literal \n text
        parsed = parsed.replace(/\\n/g, '<br>');
        parsed = parsed.replace(/\n/g, '<br>');
        
        // Finally, restore the protected MathJax expressions
        for (let i = mathExpressions.length - 1; i >= 0; i--) {
            parsed = parsed.replace(`__MATH_${i}__`, mathExpressions[i]);
        }
        
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
                            <button class="button-primary" onclick="goToPracticeProblems()" style="margin-top: 0.5rem;">
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
                        <button class="button-primary" onclick="goToPracticeProblems()" style="margin-top: 0.5rem;">
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
                        <button class="button-primary" onclick="goToPracticeProblems()" style="margin-top: 0.5rem;">
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
                
                // Invalidate cache since learning progress started
                DashboardCache.invalidateAfterProblemCompletion('Fractions');
                
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
                            <button class="button-primary" onclick="goToPracticeProblems()" style="margin-top: 0.5rem;">
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
        currentSectionId: null,  // Track current section for attempt counting
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
                
                // Update current section ID for attempt counting
                if (data.current_section_id) {
                    genericTutorState.currentSectionId = data.current_section_id;
                }
                
                // Invalidate cache since learning progress started
                DashboardCache.invalidateAfterProblemCompletion(currentTopicName);
                
                // Add to conversation history
                genericTutorState.history.push({ 
                    sender: 'tutor', 
                    message: data.message, 
                    step: genericTutorState.currentStep,
                    section_id: data.current_section_id
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
        const backBtn = document.getElementById('back-to-topic-from-tutor-button');
        
        // Remove existing listeners to prevent duplicates
        const newInput = input.cloneNode(true);
        const newSubmitBtn = submitBtn.cloneNode(true);
        const newBackBtn = backBtn.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        
        // Add new listeners
        newSubmitBtn.addEventListener('click', () => handleLearningTutorSubmit(topic));
        newInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLearningTutorSubmit(topic);
        });
        
        // Set up back button listener
        newBackBtn.addEventListener('click', () => {
            if (currentTopicName) {
                showTopicView(currentTopicName);
            } else {
                showView('dashboard-view');
                fetchAndDisplayDashboard();
            }
        });
        
        // Focus on input
        newInput.focus();
        
        // Reset question start time for emotional intelligence
        emotionalState.questionStartTime = Date.now();
        
        console.log(`${topic} tutor listeners set up`);
    }

    /**
     * Generic step completion callback system for any topic
     * @param {string} topic - The topic name
     * @param {number} stepNumber - The completed step number
     */
    async function onGenericStepCompleted(topic, stepNumber) {
        console.log(`${topic} step ${stepNumber} completed!`);
        
        // Update the pathway display using generic progress function
        getUserGenericTutorProgress(topic).then(progress => {
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
        
        // Show practice problem recommendation after step completion
        setTimeout(async () => {
            await showStepCompletionCelebration(topic, stepNumber);
        }, 1000);
    }

    // New function to show step completion celebration with practice recommendations
    async function showStepCompletionCelebration(topic, stepNumber) {
        try {
            // Get newly unlocked practice problems for this step
            const newProblems = await LearningPracticeIntegrator.getProblemsForStep(topic, stepNumber);
            
            if (newProblems.length > 0) {
                // Show celebration with practice recommendation
                const celebrationHTML = `
                    <div class="step-completion-celebration">
                        <div class="celebration-content">
                            <div class="celebration-header">
                                <h3>🎉 Step ${stepNumber} Complete!</h3>
                                <p>Great job! You've mastered the concepts from Step ${stepNumber}.</p>
                            </div>
                            <div class="practice-recommendation">
                                <h4>What would you like to do next? 🤔</h4>
                                <p>You've unlocked <strong>${newProblems.length} new practice problems</strong> that use Step ${stepNumber} concepts!</p>
                                <div class="celebration-buttons">
                                    <button class="button-primary" onclick="navigateToPracticeProblems('${topic}', ${stepNumber})">
                                        <i data-feather="target"></i>
                                        Practice Step ${stepNumber} Problems
                                    </button>
                                    <button class="button-secondary" onclick="continueToNextStep('${topic}', ${stepNumber})">
                                        <i data-feather="arrow-right"></i>
                                        Continue to Step ${stepNumber + 1}
                                    </button>
                                </div>
                                <p style="font-size: 0.9em; color: var(--text-muted); margin-top: 1rem;">
                                    💡 <strong>Tip:</strong> Practicing now helps reinforce what you learned before moving on!
                                </p>
                            </div>
                        </div>
                    </div>
                `;
                
                // Add celebration to chat log
                const chatLog = document.getElementById('tutor-chat-log');
                if (chatLog) {
                    const celebrationDiv = document.createElement('div');
                    celebrationDiv.innerHTML = celebrationHTML;
                    chatLog.appendChild(celebrationDiv);
                    chatLog.scrollTop = chatLog.scrollHeight;
                    
                    // Update feather icons
                    if (typeof feather !== 'undefined') {
                        feather.replace();
                    }
                }
            }
        } catch (error) {
            console.error('Error showing step completion celebration:', error);
        }
    }

    // Navigation functions for celebration buttons
    async function navigateToPracticeProblems(topic, stepNumber) {
        console.log(`Navigating to practice problems for ${topic} step ${stepNumber}`);
        
        // Invalidate cache to ensure fresh data
        DashboardCache.invalidateAfterProblemCompletion(topic);
        
        // Navigate to topic view which will show practice mode
        showTopicView(topic);
    }

    async function continueToNextStep(topic, stepNumber) {
        console.log(`Continuing to next step for ${topic} from step ${stepNumber}`);
        
        // Close the celebration
        const celebration = document.querySelector('.step-completion-celebration');
        if (celebration) {
            celebration.style.display = 'none';
        }
        
        // Continue the learning flow by sending a continue message to the backend
        try {
            const response = await fetch(APP_CONFIG.getHierarchicalURL(`/${topic.toLowerCase()}-tutor/chat`), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('authToken')
                },
                body: JSON.stringify({
                    message: 'Yes, I want to continue to the next step.',
                    action: 'continue_learning'
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Show typing indicator
                showTypingIndicator();
                
                // Process the response (transition to next step)
                setTimeout(async () => {
                    hideTypingIndicator();
                    await sendTutorMessage(data.tutor_response, 'tutor', data.current_section_id);
                }, 1000);
            }
        } catch (error) {
            console.error('Error continuing to next step:', error);
            // Fallback: just show a continuation message
            await sendTutorMessage('Great! Let\'s continue to the next step.', 'tutor');
        }
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
            
            // Send user input to learning tutor API with emotional intelligence data
            // NOTE: Do NOT add the current student message to history before sending to backend
            // The backend needs to count previous attempts only, not including the current message
            const response = await authedFetch(APP_CONFIG.getHierarchicalURL(`/${topic}-tutor/chat`), {
                method: 'POST',
                body: JSON.stringify({
                    student_answer: userAnswer,
                    conversation_history: genericTutorState.history,  // Only previous messages, not current
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
            
            // Add natural typing delay (same as fractions tutor for consistency)
            const naturalDelay = Math.random() * 1000 + 500; // 0.5-1.5 seconds
            await new Promise(resolve => setTimeout(resolve, naturalDelay));
            
            hideTypingIndicator();
            
            
            // Send tutor response with section ID for image support
            await sendTutorMessage(data.tutor_response, 'tutor', data.current_section_id);
            
            // Update current section ID for attempt counting
            if (data.current_section_id) {
                genericTutorState.currentSectionId = data.current_section_id;
            }
            
            // NOW add the student message to conversation history (after API call)
            // Check for duplicates first
            const lastMessage = genericTutorState.history[genericTutorState.history.length - 1];
            if (!lastMessage || lastMessage.sender !== 'student' || lastMessage.message !== userAnswer) {
                genericTutorState.history.push({ 
                    sender: 'student', 
                    message: userAnswer, 
                    step: genericTutorState.currentStep,
                    section_id: genericTutorState.currentSectionId  // Use updated section_id
                });
            }
            
            // Add tutor response to conversation history
            genericTutorState.history.push({ 
                sender: 'tutor', 
                message: data.tutor_response, 
                step: genericTutorState.currentStep,
                section_id: data.current_section_id
            });
            
            
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
                step: genericTutorState.currentStep,
                section_id: genericTutorState.currentSectionId
            });
        }
    }

    // --- BACKWARD COMPATIBILITY WRAPPER FUNCTIONS ---
    // These functions maintain existing API while redirecting to generic system
    
    /**
     * Backward compatibility wrapper for startAlgebraTutor()
     * Redirects to generic learning tutor system
     */
    function startAlgebraTutorGeneric() {
        console.log('🔄 Using generic system for Algebra tutor');
        return startLearningTutor('algebra');
    }
    
    /**
     * Backward compatibility wrapper for startFractionsTutor()
     * Redirects to generic learning tutor system
     */
    function startFractionsTutorGeneric() {
        console.log('🔄 Using generic system for Fractions tutor');
        return startLearningTutor('fractions');
    }
    
    /**
     * Backward compatibility wrapper for startAlgebraTutorFromStep()
     * Redirects to generic learning tutor system
     */
    function startAlgebraTutorFromStepGeneric(stepNumber = 1) {
        console.log(`🔄 Using generic system for Algebra tutor from step ${stepNumber}`);
        return startLearningTutor('algebra', stepNumber);
    }
    
    /**
     * Backward compatibility wrapper for startFractionsTutorFromStep()
     * Redirects to generic learning tutor system
     */
    function startFractionsTutorFromStepGeneric(stepNumber = 1) {
        console.log(`🔄 Using generic system for Fractions tutor from step ${stepNumber}`);
        return startLearningTutor('fractions', stepNumber);
    }
    
    /**
     * Backward compatibility wrapper for setupAlgebraTutorListeners()
     * Redirects to generic learning tutor system
     */
    function setupAlgebraTutorListenersGeneric() {
        console.log('🔄 Using generic system for Algebra tutor listeners');
        return setupLearningTutorListeners('algebra');
    }
    
    /**
     * Backward compatibility wrapper for setupFractionsTutorListeners()
     * Redirects to generic learning tutor system
     */
    function setupFractionsTutorListenersGeneric() {
        console.log('🔄 Using generic system for Fractions tutor listeners');
        return setupLearningTutorListeners('fractions');
    }
    
    /**
     * Backward compatibility wrapper for onAlgebraStepCompleted()
     * Redirects to generic completion callback
     */
    function onAlgebraStepCompletedGeneric(stepNumber) {
        console.log('🔄 Using generic system for Algebra step completion');
        return onGenericStepCompleted('algebra', stepNumber);
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

    // --- NAVIGATION FUNCTIONALITY ---
    function initNavigation() {
        // Dark Mode Toggle
        const themeToggle = document.getElementById('theme-toggle');
        
        // Check for saved theme preference or default to light mode
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        if (themeToggle) {
            const themeIcon = themeToggle.querySelector('i');
            
            // Update icon based on current theme
            updateThemeIcon(savedTheme);
            
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                updateThemeIcon(newTheme);
            });
            
            function updateThemeIcon(theme) {
                if (themeIcon) {
                    themeIcon.setAttribute('data-feather', theme === 'dark' ? 'sun' : 'moon');
                    feather.replace();
                }
            }
        }
        
        // Sound Toggle
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            const soundIcon = soundToggle.querySelector('i');
            
            // Check for saved sound preference
            const savedSound = localStorage.getItem('sound') || 'on';
            isTtsEnabled = savedSound === 'on';
            updateSoundIcon(savedSound);
            
            soundToggle.addEventListener('click', () => {
                isTtsEnabled = !isTtsEnabled;
                const newSound = isTtsEnabled ? 'on' : 'off';
                localStorage.setItem('sound', newSound);
                updateSoundIcon(newSound);
            });
            
            function updateSoundIcon(sound) {
                if (soundIcon) {
                    soundIcon.setAttribute('data-feather', sound === 'on' ? 'volume-2' : 'volume-x');
                    feather.replace();
                }
            }
        } else {
            // If sound toggle doesn't exist, still set the TTS state from localStorage
            const savedSound = localStorage.getItem('sound') || 'on';
            isTtsEnabled = savedSound === 'on';
        }
        
        // Login Button
        const navLoginButton = document.getElementById('nav-login-button');
        if (navLoginButton) {
            navLoginButton.addEventListener('click', () => {
                showView('login');
            });
        }
        
        // Learn More Button
        const learnMoreButton = document.getElementById('learn-more-button');
        if (learnMoreButton) {
            learnMoreButton.addEventListener('click', () => {
                // Scroll to how it works section
                const howItWorksSection = document.querySelector('.how-it-works-section');
                if (howItWorksSection) {
                    howItWorksSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
        
        // Floating Math Cards Click Handlers
        const mathCards = document.querySelectorAll('.math-card');
        mathCards.forEach(card => {
            card.addEventListener('click', () => {
                const cardText = card.querySelector('.card-text')?.textContent?.toLowerCase();
                let targetTopic = '';
                
                // Map card text to topic data attributes
                switch(cardText) {
                    case 'statistics':
                        targetTopic = 'data-analysis';
                        break;
                    case 'algebra':
                        targetTopic = 'algebra';
                        break;
                    case 'geometry':
                        targetTopic = 'geometry';
                        break;
                    case 'fractions':
                        targetTopic = 'fractions';
                        break;
                    case 'measurement':
                        targetTopic = 'measurement';
                        break;
                    case 'ratio':
                        targetTopic = 'ratio';
                        break;
                    case 'percentage':
                        targetTopic = 'percentage';
                        break;
                    case 'speed':
                        targetTopic = 'speed';
                        break;
                }
                
                if (targetTopic) {
                    const targetCard = document.querySelector(`[data-topic="${targetTopic}"]`);
                    if (targetCard) {
                        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Add a highlight effect
                        targetCard.style.transform = 'translateY(-8px)';
                        targetCard.style.boxShadow = '0 20px 40px rgba(37, 99, 235, 0.3)';
                        targetCard.style.borderColor = 'var(--primary-color)';
                        
                        // Remove highlight after 2 seconds
                        setTimeout(() => {
                            targetCard.style.transform = '';
                            targetCard.style.boxShadow = '';
                            targetCard.style.borderColor = '';
                        }, 2000);
                    }
                }
            });
        });
    }
    
    // Initialize navigation
    initNavigation();

    // --- URL ROUTING EVENT LISTENERS ---
    // Handle browser back/forward buttons
    window.addEventListener('popstate', handleURLChange);
    
    // Initialize app - only once when DOM is ready
    if (window.location.hash) {
        handleURLChange();
    } else {
        initializeApp();
    }
    
    // Ensure all feather icons are properly rendered
    feather.replace();
});
