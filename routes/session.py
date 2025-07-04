"""
Session and utility routes blueprint.
"""
from flask import Blueprint, request, jsonify
import jwt
from config.settings import Config
from services.session_service import session_service
from services.problem_service import problem_service

session_bp = Blueprint('session', __name__, url_prefix='/api')

@session_bp.route('/session/start', methods=['POST'])
def session_start():
    """Initialize user session with personalized greeting."""
    token = None
    if 'Authorization' in request.headers:
        try:
            token = request.headers['Authorization'].split(" ")[1]
            token_data = jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
            current_user_id = token_data['user_id']
            
            # Generate welcome message for logged-in user
            result = session_service.generate_welcome_message(
                current_user_id, 
                problem_service.get_practice_problems_dict()
            )
            return jsonify(result)

        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            # If token is present but invalid, treat as a new user
            pass

    # NEW / LOGGED-OUT USER FLOW
    result = session_service.get_guest_welcome_message()
    return jsonify(result)

@session_bp.route('/tts/generate', methods=['POST'])
def generate_tts():
    """Generate speech from text using Google Cloud TTS."""
    try:
        data = request.get_json()
        text_to_speak = data.get("text")
        
        audio_content = session_service.generate_tts_audio(text_to_speak)
        return audio_content, 200, {'Content-Type': 'audio/mpeg'}
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"An error occurred during TTS generation: {e}")
        return jsonify({"error": "Failed to generate audio"}), 500