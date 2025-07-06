"""
Concept routes blueprint for AI-guided learning pathways.
"""
from flask import Blueprint, request, jsonify
from routes.auth import token_required
from config.settings import Config
from services.concept_service import concept_service


concepts_bp = Blueprint('concepts', __name__, url_prefix='/api/grades')


@concepts_bp.route('/<grade>/subjects/<subject>/topics/<topic>/concepts', methods=['GET'])
@token_required
def get_topic_concepts(current_user_id, grade, subject, topic):
    """Get all concepts for a specific topic."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        concepts = concept_service.get_concepts_for_topic(topic)
        concepts_data = [concept.to_dict() for concept in concepts]
        
        return jsonify({
            "topic": topic,
            "concepts": concepts_data,
            "total_count": len(concepts_data)
        })
        
    except Exception as e:
        print(f"Error fetching concepts for topic {topic}: {e}")
        return jsonify({"error": "Could not retrieve concepts"}), 500


@concepts_bp.route('/<grade>/subjects/<subject>/topics/<topic>/learning-pathway', methods=['GET'])
@token_required
def get_learning_pathway(current_user_id, grade, subject, topic):
    """Get personalized learning pathway for a user and topic."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        pathway = concept_service.get_learning_pathway(current_user_id, topic)
        return jsonify(pathway)
        
    except Exception as e:
        print(f"Error generating learning pathway for user {current_user_id}, topic {topic}: {e}")
        return jsonify({"error": "Could not generate learning pathway"}), 500


@concepts_bp.route('/<grade>/subjects/<subject>/concepts/<concept_id>', methods=['GET'])
@token_required
def get_concept_details(current_user_id, grade, subject, concept_id):
    """Get detailed information about a specific concept."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        concept = concept_service.get_concept_by_id(concept_id)
        if not concept:
            return jsonify({"error": "Concept not found"}), 404
        
        return jsonify(concept.to_dict())
        
    except Exception as e:
        print(f"Error fetching concept {concept_id}: {e}")
        return jsonify({"error": "Could not retrieve concept"}), 500


@concepts_bp.route('/<grade>/subjects/<subject>/concepts/<concept_id>/learn', methods=['POST'])
@token_required
def start_concept_learning(current_user_id, grade, subject, concept_id):
    """Start learning a specific concept."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        result = concept_service.start_concept_learning(current_user_id, concept_id)
        
        if "error" in result:
            return jsonify(result), 400
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error starting concept learning for user {current_user_id}, concept {concept_id}: {e}")
        return jsonify({"error": "Could not start concept learning"}), 500


@concepts_bp.route('/<grade>/subjects/<subject>/concepts/<concept_id>/progress', methods=['POST'])
@token_required
def update_concept_progress(current_user_id, grade, subject, concept_id):
    """Update user's progress on a specific concept."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        understanding_level = data.get('understanding_level')
        confidence_score = data.get('confidence_score', 0)
        time_spent_minutes = data.get('time_spent_minutes', 0)
        
        if not understanding_level:
            return jsonify({"error": "understanding_level is required"}), 400
        
        # Validate understanding level
        valid_levels = ['not_started', 'exploring', 'understood', 'mastered']
        if understanding_level not in valid_levels:
            return jsonify({"error": f"Invalid understanding_level. Must be one of: {valid_levels}"}), 400
        
        result = concept_service.update_concept_progress(
            user_id=current_user_id,
            concept_id=concept_id,
            understanding_level=understanding_level,
            confidence_score=confidence_score,
            time_spent_minutes=time_spent_minutes
        )
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error updating concept progress for user {current_user_id}, concept {concept_id}: {e}")
        return jsonify({"error": "Could not update concept progress"}), 500


@concepts_bp.route('/<grade>/subjects/<subject>/topics/<topic>/readiness', methods=['GET'])
@token_required
def check_problem_readiness(current_user_id, grade, subject, topic):
    """Check if user is ready to start practicing problems for a topic."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        pathway = concept_service.get_learning_pathway(current_user_id, topic)
        
        return jsonify({
            "topic": topic,
            "ready_for_problems": pathway["ready_for_problems"],
            "progress_summary": pathway["user_progress"],
            "next_steps": {
                "next_concept": pathway["next_concept"],
                "recommendation": pathway["ready_for_problems"]["recommendation"]
            }
        })
        
    except Exception as e:
        print(f"Error checking readiness for user {current_user_id}, topic {topic}: {e}")
        return jsonify({"error": "Could not check problem readiness"}), 500


@concepts_bp.route('/<grade>/subjects/<subject>/concepts/<concept_id>/session', methods=['GET'])
@token_required
def get_concept_session(current_user_id, grade, subject, concept_id):
    """Get a structured learning session for a concept."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        concept = concept_service.get_concept_by_id(concept_id)
        if not concept:
            return jsonify({"error": "Concept not found"}), 404
        
        # Create learning session
        session = concept_service._create_learning_session(concept)
        
        return jsonify({
            "concept": concept.to_dict(),
            "learning_session": session
        })
        
    except Exception as e:
        print(f"Error creating concept session for {concept_id}: {e}")
        return jsonify({"error": "Could not create learning session"}), 500


@concepts_bp.route('/<grade>/subjects/<subject>/concepts/<concept_id>/assess', methods=['POST'])
@token_required
def assess_concept_understanding(current_user_id, grade, subject, concept_id):
    """Use AI to assess user's understanding of a concept based on their responses."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        user_responses = data.get('responses', [])
        if not user_responses:
            return jsonify({"error": "No responses provided for assessment"}), 400
        
        # Validate response format
        required_fields = ['question', 'answer', 'correct_answer']
        for i, response in enumerate(user_responses):
            for field in required_fields:
                if field not in response:
                    return jsonify({"error": f"Response {i+1} missing field: {field}"}), 400
        
        result = concept_service.assess_concept_understanding(
            user_id=current_user_id,
            concept_id=concept_id,
            user_responses=user_responses
        )
        
        if "error" in result:
            return jsonify(result), 400
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error assessing concept understanding for user {current_user_id}, concept {concept_id}: {e}")
        return jsonify({"error": "Could not assess concept understanding"}), 500


@concepts_bp.route('/<grade>/subjects/<subject>/concepts/<concept_id>/practice', methods=['GET'])
@token_required
def generate_practice_questions(current_user_id, grade, subject, concept_id):
    """Generate AI-powered personalized practice questions for a concept."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        # Get difficulty preference from query parameters
        difficulty = request.args.get('difficulty', 'adaptive')
        valid_difficulties = ['easy', 'medium', 'hard', 'adaptive']
        
        if difficulty not in valid_difficulties:
            return jsonify({"error": f"Invalid difficulty. Must be one of: {valid_difficulties}"}), 400
        
        result = concept_service.generate_personalized_practice(
            user_id=current_user_id,
            concept_id=concept_id,
            difficulty_preference=difficulty
        )
        
        if "error" in result:
            return jsonify(result), 400
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error generating practice questions for user {current_user_id}, concept {concept_id}: {e}")
        return jsonify({"error": "Could not generate practice questions"}), 500


@concepts_bp.route('/<grade>/subjects/<subject>/concepts/<concept_id>/problems', methods=['GET'])
@token_required  
def get_concept_related_problems(current_user_id, grade, subject, concept_id):
    """Get existing problems from the database that relate to a specific concept."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        # Get concept details
        concept = concept_service.get_concept_by_id(concept_id)
        if not concept:
            return jsonify({"error": "Concept not found"}), 404
        
        # Import problem service to get related problems
        from services.problem_service import problem_service
        
        # Get problems for the concept's topic
        problems = problem_service.get_problems_for_topic(concept.topic)
        
        # Filter problems based on concept learning objectives
        # This is a simple mapping - in production you might want more sophisticated matching
        concept_difficulty = concept.difficulty_level
        
        # Select problems with appropriate complexity
        if concept_difficulty <= 2:  # Basic concepts
            related_problems = [p for p in problems if p.get('complexity', 3) <= 2]
        elif concept_difficulty <= 3:  # Intermediate concepts  
            related_problems = [p for p in problems if p.get('complexity', 3) <= 3]
        else:  # Advanced concepts
            related_problems = problems
        
        # Limit to 5 most relevant problems
        related_problems = related_problems[:5]
        
        return jsonify({
            "concept_id": concept_id,
            "concept_title": concept.title,
            "related_problems": related_problems,
            "total_problems": len(related_problems),
            "recommendation": f"Try these {len(related_problems)} problems to practice {concept.title}"
        })
        
    except Exception as e:
        print(f"Error getting related problems for concept {concept_id}: {e}")
        return jsonify({"error": "Could not retrieve related problems"}), 500


@concepts_bp.route('/<grade>/subjects/<subject>/topics/<topic>/concept-map', methods=['GET'])
@token_required
def get_topic_concept_map(current_user_id, grade, subject, topic):
    """Get a visual concept map showing prerequisites and relationships."""
    # Validate grade and subject
    if not Config.validate_grade_subject(grade, subject):
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        concepts = concept_service.get_concepts_for_topic(topic)
        
        if not concepts:
            return jsonify({"error": f"No concepts found for topic: {topic}"}), 404
        
        # Build concept map with relationships
        concept_map = {
            "topic": topic,
            "concepts": [],
            "relationships": []
        }
        
        for concept in concepts:
            # Get user progress for this concept
            from models.concept import ConceptProgress
            progress = ConceptProgress.get_user_concept_progress(current_user_id, concept.concept_id)
            
            concept_map["concepts"].append({
                "concept_id": concept.concept_id,
                "title": concept.title,
                "difficulty_level": concept.difficulty_level,
                "prerequisites": concept.prerequisites,
                "learning_objectives": concept.learning_objectives,
                "user_progress": {
                    "understanding_level": progress.understanding_level if progress else "not_started",
                    "confidence_score": progress.confidence_score if progress else 0
                },
                "estimated_minutes": concept.estimated_minutes
            })
            
            # Add prerequisite relationships
            for prereq_id in concept.prerequisites:
                concept_map["relationships"].append({
                    "from": prereq_id,
                    "to": concept.concept_id,
                    "type": "prerequisite"
                })
        
        return jsonify(concept_map)
        
    except Exception as e:
        print(f"Error creating concept map for topic {topic}: {e}")
        return jsonify({"error": "Could not create concept map"}), 500