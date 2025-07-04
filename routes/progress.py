"""
Progress tracking routes blueprint.
"""
from flask import Blueprint, jsonify
from routes.auth import token_required
from services.progress_service import progress_service

progress_bp = Blueprint('progress', __name__, url_prefix='/api/progress')

@progress_bp.route('/<problem_id>', methods=['GET'])
@token_required
def get_progress(current_user_id, problem_id):
    """Get progress and chat history for a specific problem."""
    try:
        chat_history = progress_service.get_chat_history(current_user_id, problem_id)
        return jsonify({"chat_history": chat_history})
    except Exception as e:
        print(f"An error occurred fetching progress for problem {problem_id}: {e}")
        return jsonify({"chat_history": []}), 500

@progress_bp.route('/all', methods=['GET'])
@token_required
def get_all_progress(current_user_id):
    """Fetch all problem statuses for the current user."""
    try:
        progress_map = progress_service.get_all_user_progress(current_user_id)
        return jsonify(progress_map)
    except Exception as e:
        print(f"An error occurred fetching all progress: {e}")
        return jsonify({}), 500