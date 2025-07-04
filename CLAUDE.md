# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a PSLE (Primary School Leaving Examination) mathematics tutoring application built with Flask and Google Cloud services. The app uses Gemini AI for intelligent tutoring, Google Cloud Datastore for user data, and Google Cloud TTS for speech synthesis.

## Key Architecture Components

### Backend (Modular Flask)
- **Main Application**: `app.py` - Flask app factory with blueprint registration
- **Routes**: Organized into blueprints by functionality
  - `routes/auth.py` - Authentication endpoints
  - `routes/content.py` - Problems, dashboard, and topics
  - `routes/diagnostic.py` - Quiz functionality
  - `routes/tutor.py` - AI tutoring endpoints
  - `routes/progress.py` - Progress tracking
  - `routes/session.py` - Session management and utilities
- **Configuration**: `config/settings.py` - Centralized configuration management
- **Database**: Google Cloud Datastore for user profiles, problem progress, and chat history
- **AI Integration**: Google Gemini 2.5 Flash model for intelligent tutoring responses
- **Authentication**: JWT-based auth with decorator pattern for route protection

### Frontend (Vanilla JS)
- **Single Page Application**: `frontend/index.html` with JavaScript in `frontend/script.js`
- **Static Assets**: CSS styling in `frontend/style.css` and images in `frontend/assets/`
- **Problem Data**: JSON files in `problems/p6/` containing practice problems and diagnostic quiz questions

### Problem Management System
- **Practice Problems**: Topic-based math problems loaded from JSON files
- **Diagnostic Quiz**: Stratified sampling from `p6_maths_diagnostic_quiz.json` to create balanced quizzes
- **Progress Tracking**: User progress states (pending, in_progress, mastered) stored in Datastore

## Common Development Commands

### Running the Application
```bash
# Install dependencies
pip install -r requirements.txt

# Run locally (development mode)
python app.py

# The app runs on port 8080 by default
# Frontend is served as static files - open frontend/index.html in browser
```

### Dependencies
- No package.json (pure Python backend)
- Requirements managed in `requirements.txt`
- Uses Google Cloud services (Datastore, TTS, Generative AI)

## Key API Endpoints

### Authentication (Non-hierarchical)
- `/api/auth/signup` - User registration
- `/api/auth/login` - User authentication  
- `/api/session/start` - Initialize user session

### Hierarchical Endpoints (Grade/Subject scoped)
- `/api/grades/{grade}/subjects/{subject}/dashboard` - Get personalized dashboard data
- `/api/grades/{grade}/subjects/{subject}/topics/{topic}/problems` - Get practice problems by topic with filtering
- `/api/grades/{grade}/subjects/{subject}/problems/{problem_id}` - Get individual problem details
- `/api/grades/{grade}/subjects/{subject}/tutor/submit_answer` - Submit answers for AI evaluation
- `/api/grades/{grade}/subjects/{subject}/diagnostic/start` - Generate diagnostic quiz
- `/api/grades/{grade}/subjects/{subject}/diagnostic/analyze` - Analyze quiz results with AI
- `/api/grades/{grade}/subjects/{subject}/topics/{topic}/progress/summary` - Get topic progress summary

### Utility Endpoints
- `/api/progress/{problem_id}` - Get individual problem progress/chat history
- `/api/progress/all` - Get all user progress
- `/api/tts/generate` - Generate speech from text

## Environment Variables
- `GOOGLE_API_KEY` - Gemini AI API key
- `SECRET_KEY` - JWT signing secret
- Google Cloud credentials for Datastore and TTS

## Development Notes
- **Modular Architecture**: Code is organized into blueprints for better maintainability
- **Configuration Management**: All settings centralized in `config/settings.py`
- **Scalable Structure**: Easy to add new grades/subjects via configuration
- Frontend uses hierarchical URLs via APP_CONFIG.getHierarchicalURL() in script.js
- Currently hardcoded to grade 'p6' and subject 'math' - easily configurable for expansion
- Problem data is loaded at startup into global dictionaries
- AI responses are parsed as JSON for structured tutoring feedback
- Progress tracking uses compound keys: `{user_id}-{problem_id}`
- The app supports both practice mode and diagnostic assessment workflows
- All main endpoints include grade/subject validation for future scalability

## Code Organization Benefits
- **Separation of Concerns**: Each blueprint handles specific functionality
- **Easier Testing**: Individual components can be tested in isolation
- **Team Development**: Multiple developers can work on different blueprints
- **Maintainability**: Changes to one feature don't affect others
- **Scalability**: Easy to add new functionality as separate blueprints