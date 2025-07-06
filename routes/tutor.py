"""
AI Tutor routes blueprint.
"""
from flask import Blueprint, request, jsonify
from routes.auth import token_required
from config.settings import Config
from services.problem_service import problem_service
from services.tutor_service import tutor_service
from services.progress_service import progress_service

tutor_bp = Blueprint('tutor', __name__, url_prefix='/api/grades')

@tutor_bp.route('/<grade>/subjects/<subject>/tutor/submit_answer', methods=['POST'])
@token_required
def submit_answer(current_user_id, grade, subject):
    """AI tutor answer submission for a specific grade and subject."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        # Get request data
        data = request.get_json()
        problem_id = data.get("problem_id")
        chat_history = data.get("chat_history", [])
        emotional_intelligence = data.get('emotional_intelligence', {})
        
        # DEBUG: Basic route logging for practice mode
        print(f"\n🔍 PRACTICE TUTOR REQUEST:")
        print(f"   Problem ID: {problem_id}")
        print(f"   EI Data Received: {bool(emotional_intelligence)}")
        if emotional_intelligence:
            print(f"   EI Keys: {list(emotional_intelligence.keys())}")
        
        # Get problem data
        problem = problem_service.get_practice_problem(problem_id)
        if not problem:
            return jsonify({"error": "Problem not found"}), 404

        # Evaluate answer using tutor service with emotional intelligence
        result = tutor_service.evaluate_answer(problem, chat_history, emotional_intelligence)
        
        # Save progress if we have feedback
        if result.get("feedback"):
            is_correct = result.get("is_correct", False)
            status = 'mastered' if is_correct else 'in_progress'
            
            # Format response for chat history
            model_response = tutor_service.format_feedback_for_history(
                result['feedback'], is_correct
            )
            updated_history = chat_history + [model_response]
            
            # Save to database
            progress_service.save_progress(
                user_id=current_user_id,
                problem_id=problem_id,
                status=status,
                chat_history=updated_history
            )

        return jsonify(result)
        
    except Exception as e:
        print(f"An error occurred in submit_answer: {e}")
        return jsonify({"error": "Could not process answer submission"}), 500