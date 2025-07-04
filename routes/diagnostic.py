"""
Diagnostic quiz routes blueprint.
"""
from flask import Blueprint, request, jsonify
from routes.auth import token_required
from config.settings import Config
from services.diagnostic_service import diagnostic_service

diagnostic_bp = Blueprint('diagnostic', __name__, url_prefix='/api/grades')

@diagnostic_bp.route('/<grade>/subjects/<subject>/diagnostic/start', methods=['GET'])
def start_diagnostic_quiz(grade, subject):
    """Start diagnostic quiz for a specific grade and subject."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        final_quiz_questions = diagnostic_service.generate_quiz(grade, subject)
        return jsonify(final_quiz_questions)
    except Exception as e:
        print(f"An error occurred fetching diagnostic quiz: {e}")
        return jsonify({"error": "Could not retrieve diagnostic quiz"}), 500

@diagnostic_bp.route('/<grade>/subjects/<subject>/diagnostic/analyze', methods=['POST'])
def analyze_diagnostic_results(grade, subject):
    """Analyze diagnostic results for a specific grade and subject."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        data = request.get_json()
        user_answers = data.get("user_answers", [])
        
        analysis_json = diagnostic_service.analyze_results(user_answers, grade, subject)
        return jsonify(analysis_json)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"An error occurred during quiz analysis: {e}")
        return jsonify({"error": "Could not analyze quiz results"}), 500