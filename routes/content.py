"""
Content routes blueprint for problems, dashboard, and topics.
"""
from flask import Blueprint, request, jsonify
from routes.auth import token_required
from config.settings import Config
from services.problem_service import problem_service
from services.content_service import content_service
from services.progress_service import progress_service

content_bp = Blueprint('content', __name__, url_prefix='/api/grades')

@content_bp.route('/<grade>/subjects/<subject>/topics/<topic>/problems', methods=['GET'])
@token_required
def get_problems_by_topic(current_user_id, grade, subject, topic):
    """Get practice problems for a specific grade/subject/topic."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        filter_type = request.args.get('filter')
        
        # Get problem IDs for the topic
        problem_ids = problem_service.get_problems_by_topic(topic)
        
        # Get filtered problems using the content service
        final_problem_list = content_service.get_filtered_problems(
            user_id=current_user_id,
            topic=topic,
            filter_type=filter_type,
            problem_ids=problem_ids,
            practice_problems=problem_service.get_practice_problems_dict()
        )

        return jsonify(final_problem_list)

    except Exception as e:
        print(f"An error occurred in get_problems_by_topic: {e}")
        return jsonify({"error": "Could not retrieve problems for topic"}), 500

@content_bp.route('/<grade>/subjects/<subject>/problems/<problem_id>')
def get_problem(grade, subject, problem_id):
    """Get the full details for a single problem."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    problem = problem_service.get_practice_problem(problem_id)
    if not problem:
        return jsonify({"error": "Problem not found"}), 404
    return jsonify(problem)

@content_bp.route('/<grade>/subjects/<subject>/dashboard', methods=['GET'])
@token_required
def get_dashboard_data(current_user_id, grade, subject):
    """Get dashboard data for a specific grade and subject."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        dashboard_data = content_service.get_dashboard_data(current_user_id)
        return jsonify(dashboard_data)
    except Exception as e:
        print(f"An error occurred fetching dashboard data: {e}")
        # On error, return all topics in the main list
        return jsonify({
            "recommended_topics": [],
            "all_topics": Config.get_topics_for_grade_subject(grade, subject)
        })

@content_bp.route('/<grade>/subjects/<subject>/topics/<topic_name>/progress/summary', methods=['GET'])
@token_required
def get_topic_summary(current_user_id, grade, subject, topic_name):
    """Get topic progress summary for a specific grade, subject, and topic."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        # Get problem IDs for the topic
        problem_ids = problem_service.get_problems_by_topic(topic_name)
        
        if not problem_ids:
            return jsonify({
                "topic": topic_name, "total_problems": 0,
                "mastered_count": 0, "in_progress_count": 0
            })

        # Get topic summary using progress service
        summary = progress_service.get_topic_summary(current_user_id, problem_ids)
        summary["topic"] = topic_name
        
        return jsonify(summary)

    except Exception as e:
        print(f"An error occurred fetching topic summary for {topic_name}: {e}")
        return jsonify({"error": "Could not retrieve topic summary"}), 500