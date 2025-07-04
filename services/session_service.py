"""
Session management service.
"""
import json
import random
from typing import Dict, List, Optional
import google.generativeai as genai
from google.cloud import texttospeech
from config.settings import Config
from models.user import User
from models.problem_progress import ProblemProgress


class SessionService:
    """Service class for session management and personalized greetings."""
    
    def __init__(self):
        genai.configure(api_key=Config.GOOGLE_API_KEY)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        self.tts_client = texttospeech.TextToSpeechClient()
    
    def generate_welcome_message(self, user_id: int, practice_problems: Dict) -> Dict:
        """Generate a personalized welcome message for a logged-in user."""
        user = User.get_by_id(user_id)
        
        if not user:
            raise ValueError("User not found in database")
        
        first_name = user.first_name
        message = ""
        suggested_actions = []

        if user.is_new_user:
            # New user flow
            if user.recommended_topic:
                recommended_topic = user.recommended_topic
            else:
                recommended_topic = random.choice(Config.P6_TOPICS)
            
            suggested_actions = [
                {"text": f"Start '{recommended_topic}' Practice", "action_id": "continue_topic", "context": recommended_topic},
                {"text": "Browse All Topics", "action_id": "browse_topics"}
            ]
            
            ai_prompt = f"""
            You are TutorAI, a friendly and insightful PSLE Math tutor.
            A new user named '{first_name}' has just signed up after a quiz. Their recommended starting topic is '{recommended_topic}'.
            Your task is to write a single, short, welcoming paragraph that greets them by name and presents their recommendation.
            """
            
            # Generate AI response for new user
            response = self.model.generate_content(ai_prompt)
            message = response.text.strip()
            
            # Mark user as no longer new
            user.mark_as_returning_user()

        else:
            # Returning user flow
            recent_progress = ProblemProgress.get_recent_user_progress(user_id, 5)
            
            progress_summary = []
            for progress in recent_progress:
                problem = practice_problems.get(progress.problem_id)
                if problem:
                    progress_summary.append(
                        f"- Worked on '{problem.get('title')}' in topic '{problem.get('topic')}' (Status: {progress.status})"
                    )

            # Create a personalized prompt for the AI
            ai_prompt = f"""
            You are TutorAI, a friendly and encouraging PSLE Math tutor.
            A user has just returned to the app. Your task is to generate a short, friendly, and context-aware welcome back message based on their recent activity.

            USER'S RECENT ACTIVITY:
            {chr(10).join(progress_summary) if progress_summary else "This user has not attempted any practice problems yet."}

            YOUR TASK:
            Generate a JSON object with the following keys:
            - "message": A personalized welcome message (1-2 sentences). If they have progress, reference it. If not, encourage them to start.
            - "recommended_topic": A topic name from this list {Config.P6_TOPICS} based on the user's progress.

            Example for a user with progress:
            {{
                "message": "Welcome back! It looks like you were making good progress on Ratio problems. Ready to keep going?",
                "recommended_topic": "Ratio"
            }}
            """
            
            # Get the personalized response from the AI
            response = self.model.generate_content(ai_prompt)
            try:
                ai_response = json.loads(response.text.strip())
                message = ai_response['message']
                recommended_topic = ai_response['recommended_topic']
            except (json.JSONDecodeError, KeyError):
                # Fallback in case AI response parsing fails
                message = f"Welcome back, {first_name}! Ready to continue your math practice?"
                recommended_topic = random.choice(Config.P6_TOPICS)
            
            suggested_actions = [
                {"text": f"Practice '{recommended_topic}'", "action_id": "continue_topic", "context": recommended_topic},
                {"text": "Browse All Topics", "action_id": "browse_topics"}
            ]
            
            # Update user's recommended topic
            user.update_recommended_topic(recommended_topic)
        
        return {
            "is_authenticated": True,
            "message": message,
            "suggested_actions": suggested_actions
        }
    
    def get_guest_welcome_message(self) -> Dict:
        """Get the standard welcome message for new/logged-out users."""
        return {
            "is_authenticated": False,
            "message_lines": [
                "Hello! I'm TutorAI, your personal math tutor.",
                "To get started, I can give you a short diagnostic quiz to find your strengths,",
                "or you can log in to an existing account."
            ],
            "suggested_actions": [
                {"text": "Take Diagnostic Quiz", "action_id": "start_quiz"},
                {"text": "Login", "action_id": "show_login"}
            ]
        }
    
    def generate_tts_audio(self, text: str) -> bytes:
        """Generate TTS audio from text using Google Cloud TTS."""
        if not text:
            raise ValueError("No text provided")

        synthesis_input = texttospeech.SynthesisInput(text=text)

        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            name="en-US-Studio-O"  # High-quality, friendly female voice
        )

        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3
        )

        try:
            response = self.tts_client.synthesize_speech(
                input=synthesis_input, voice=voice, audio_config=audio_config
            )
            return response.audio_content
        except Exception as e:
            print(f"An error occurred during TTS generation: {e}")
            raise


# Global instance
session_service = SessionService()