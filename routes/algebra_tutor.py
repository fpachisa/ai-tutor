"""
Algebra Tutor Routes - Simple conversational tutoring endpoints
"""

from flask import Blueprint, request, jsonify
from services.algebra_tutor_service import AlgebraTutorService
from services.progress_service import progress_service
from routes.auth import token_required

algebra_tutor_bp = Blueprint('algebra_tutor', __name__)
algebra_service = AlgebraTutorService()

@algebra_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/algebra-tutor/start', methods=['POST'])
@token_required
def start_algebra_tutor(user_id, grade, subject):
    """
    Start a new algebra tutoring session or resume existing one
    """
    try:
        # Use a special problem ID for algebra tutoring sessions
        algebra_tutor_id = "algebra_tutor_session"
        
        # Check if user has existing algebra tutor progress
        existing_history = progress_service.get_chat_history(user_id, algebra_tutor_id)
        
        if existing_history:
            # Resume existing session
            # Check if student has completed all steps (mastered status)
            progress_map = progress_service.get_all_user_progress(user_id)
            tutor_progress_status = progress_map.get(algebra_tutor_id, 'pending')
            
            if tutor_progress_status == 'mastered':
                # Student has completed all steps - check if they're practicing
                # Get their practice progress to provide relevant feedback
                try:
                    practice_progress = progress_service.get_all_user_progress(user_id)
                    algebra_practice_problems = [pid for pid in practice_progress.keys() 
                                               if pid.startswith('ALG') and pid != algebra_tutor_id]
                    
                    if algebra_practice_problems:
                        # Student is practicing - provide practice review
                        completed_problems = [pid for pid in algebra_practice_problems 
                                            if practice_progress[pid] == 'mastered']
                        in_progress_problems = [pid for pid in algebra_practice_problems 
                                              if practice_progress[pid] == 'in_progress']
                        
                        # Generate AI-powered encouraging feedback based on practice progress
                        total_attempted = len(completed_problems) + len(in_progress_problems)
                        review_message = algebra_service.generate_practice_review_message(
                            completed_count=len(completed_problems),
                            in_progress_count=len(in_progress_problems),
                            total_attempted=total_attempted
                        )
                        
                        return jsonify({
                            'success': True,
                            'message': review_message,
                            'step': 5,  # Completed step
                            'session_id': f"algebra_tutor_{user_id}",
                            'instructions': 'Keep practicing your algebra skills!',
                            'is_resume': True,
                            'practice_review': True,
                            'practice_stats': {
                                'completed': len(completed_problems),
                                'in_progress': len(in_progress_problems),
                                'total_attempted': total_attempted
                            }
                        })
                    else:
                        # No practice yet - encourage to start
                        return jsonify({
                            'success': True,
                            'message': "Great to see you back! You've already completed the algebra basics. Ready for some practice problems?",
                            'step': 5,  # Completed step
                            'session_id': f"algebra_tutor_{user_id}",
                            'instructions': 'You can now practice your algebra skills!',
                            'is_resume': True,
                            'completed_learning': True
                        })
                        
                except Exception as e:
                    print(f"Error getting practice progress: {e}")
                    # Fallback to original behavior
                    return jsonify({
                        'success': True,
                        'message': "Great to see you back! You've already completed the algebra basics. Ready for some practice problems?",
                        'step': 5,  # Completed step
                        'session_id': f"algebra_tutor_{user_id}",
                        'instructions': 'You can now practice your algebra skills!',
                        'is_resume': True,
                        'completed_learning': True
                    })
            
            # Determine current step from history
            current_step = 1
            for msg in existing_history:
                if msg.get('step'):
                    current_step = max(current_step, msg.get('step', 1))
            
            # Get appropriate resume message with next prompt
            step_info = algebra_service.get_step_summary(current_step)
            
            # Create a more engaging resume message that includes the next learning step
            if current_step == 1:
                next_prompt = "Let's try: □ + 4 = 10. What number should go in the box?"
            elif current_step == 2:
                next_prompt = "Let's practice with letters: x + 5 = 12. What is x?"
            elif current_step == 3:
                next_prompt = "Now for substitution: If a = 4, what is a + 5?"
            else:
                next_prompt = "Let's try a word problem: 'Some children are in a class. If 5 more join, there will be 23 total.' Can you write this as an equation?"
            
            resume_message = f"Welcome back! We were working on {step_info['title']}. Let's continue from where we left off.\n\n{next_prompt}"
            
            return jsonify({
                'success': True,
                'message': resume_message,
                'step': current_step,
                'session_id': f"algebra_tutor_{user_id}",
                'instructions': 'Type your answer or question in the chat box below.',
                'existing_history': existing_history,
                'is_resume': True
            })
        else:
            # Start new session
            starter_message = algebra_service.get_conversation_starter()
            
            return jsonify({
                'success': True,
                'message': starter_message,
                'step': 1,
                'session_id': f"algebra_tutor_{user_id}",
                'instructions': 'Type your answer or question in the chat box below.',
                'is_resume': False
            })
        
    except Exception as e:
        print(f"Error starting algebra tutor: {e}")
        return jsonify({'error': 'Could not start algebra tutor'}), 500

@algebra_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/algebra-tutor/chat', methods=['POST'])
@token_required  
def algebra_tutor_chat(user_id, grade, subject):
    """
    Handle conversation with algebra tutor
    """
    try:
        data = request.get_json()
        student_answer = data.get('student_answer', '').strip()
        conversation_history = data.get('conversation_history', [])
        current_step = data.get('current_step', 1)
        emotional_intelligence = data.get('emotional_intelligence', {})
        
        # DEBUG: Basic route logging
        print(f"\n🔍 ALGEBRA TUTOR CHAT REQUEST:")
        print(f"   Student Answer: '{student_answer}'")
        print(f"   Current Step: {current_step}")
        print(f"   EI Data Received: {bool(emotional_intelligence)}")
        if emotional_intelligence:
            print(f"   EI Keys: {list(emotional_intelligence.keys())}")
        
        if not student_answer:
            return jsonify({'error': 'Student answer is required'}), 400
        
        # Generate tutor response using the service with emotional intelligence
        result = algebra_service.generate_tutor_response(
            student_answer, conversation_history, current_step, emotional_intelligence)
        
        # Handle both old format (tuple) and new format (with asked_question)
        if len(result) == 3:
            tutor_response, new_step, shows_understanding = result
            asked_question = False  # Default for backward compatibility
        else:
            tutor_response, new_step, shows_understanding, asked_question = result
        
        # Check if student is ready for practice problems
        updated_history = conversation_history + [
            {'sender': 'student', 'message': student_answer, 'step': current_step},
            {'sender': 'tutor', 'message': tutor_response, 'step': new_step}
        ]
        
        # Evaluate readiness more precisely based on current response
        # Student is ready ONLY if they're at step 4+ AND just showed understanding
        ready_for_problems = (new_step >= 4 and shows_understanding)
        
        # Save progress to datastore
        algebra_tutor_id = "algebra_tutor_session"
        
        # Determine progress status based on current step and understanding
        if ready_for_problems:
            progress_status = 'mastered'  # Ready for practice problems
        elif new_step > 1:
            progress_status = 'in_progress'  # Making progress
        else:
            progress_status = 'pending'  # Just starting
        
        # Save both progress and chat history
        progress_service.save_progress(user_id, algebra_tutor_id, progress_status, updated_history)
        
        response_data = {
            'success': True,
            'tutor_response': tutor_response,
            'new_step': new_step,
            'shows_understanding': shows_understanding,
            'ready_for_problems': ready_for_problems,
            'step_info': algebra_service.get_step_summary(new_step)
        }
        
        # Practice transition is now handled by AI in the main tutor_response
        # No need for separate practice_transition message
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Error in algebra tutor chat: {e}")
        return jsonify({'error': 'Could not process your response'}), 500

@algebra_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/algebra-tutor/status', methods=['GET'])
@token_required
def get_algebra_tutor_status(user_id, grade, subject):
    """
    Get current status of algebra tutoring progress
    """
    try:
        algebra_tutor_id = "algebra_tutor_session"
        
        # Get existing progress
        existing_history = progress_service.get_chat_history(user_id, algebra_tutor_id)
        progress_map = progress_service.get_all_user_progress(user_id)
        
        # Determine current step and completed steps from history
        current_step = 1
        completed_steps = []
        
        if existing_history:
            for msg in existing_history:
                if msg.get('step'):
                    step = msg.get('step', 1)
                    current_step = max(current_step, step)
                    if step not in completed_steps and step < current_step:
                        completed_steps.append(step)
        
        # Get progress status
        progress_status = progress_map.get(algebra_tutor_id, 'pending')
        
        return jsonify({
            'success': True,
            'available_steps': list(algebra_service.learning_steps.keys()),
            'step_summaries': {
                step: info for step, info in algebra_service.learning_steps.items()
            },
            'current_step': current_step,
            'completed_steps': completed_steps,
            'progress_status': progress_status,
            'has_history': len(existing_history) > 0 if existing_history else False,
            'message_count': len(existing_history) if existing_history else 0
        })
        
    except Exception as e:
        print(f"Error getting algebra tutor status: {e}")
        return jsonify({'error': 'Could not get tutor status'}), 500

@algebra_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/algebra-tutor/reset', methods=['POST'])
@token_required
def reset_algebra_tutor_progress(user_id, grade, subject):
    """
    Reset algebra tutoring progress (for testing/debugging)
    """
    try:
        algebra_tutor_id = "algebra_tutor_session"
        
        # Clear chat history by creating empty history
        from models.chat_history import ChatHistory
        from models.problem_progress import ProblemProgress
        
        # Delete existing records
        chat_history = ChatHistory.get_chat_history(user_id, algebra_tutor_id)
        if chat_history:
            chat_history.clear_history()
        
        # Reset progress
        progress = ProblemProgress.get_progress(user_id, algebra_tutor_id)
        if progress:
            progress.status = 'pending'
            progress.save()
        
        return jsonify({
            'success': True,
            'message': 'Algebra tutor progress has been reset'
        })
        
    except Exception as e:
        print(f"Error resetting algebra tutor progress: {e}")
        return jsonify({'error': 'Could not reset progress'}), 500

@algebra_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/algebra-tutor/practice-review', methods=['POST'])
@token_required
def get_practice_review(user_id, grade, subject):
    """
    Get AI-generated intelligent review of student's algebra practice progress
    """
    try:
        # Get all user progress
        progress_map = progress_service.get_all_user_progress(user_id)
        
        # Filter for algebra problems (they start with 'ALG' like ALG-101, ALG-102, etc.)
        algebra_problems = {pid: status for pid, status in progress_map.items() 
                          if pid.startswith('ALG') and pid != 'algebra_tutor_session'}
        
        # Analyze practice patterns
        completed = [pid for pid, status in algebra_problems.items() if status == 'mastered']
        in_progress = [pid for pid, status in algebra_problems.items() if status == 'in_progress']
        
        total_attempted = len(completed) + len(in_progress)
        
        # Generate AI-powered feedback
        feedback = algebra_service.generate_practice_review_message(
            completed_count=len(completed),
            in_progress_count=len(in_progress),
            total_attempted=total_attempted
        )
        
        return jsonify({
            'success': True,
            'feedback': feedback,
            'stats': {
                'completed': len(completed),
                'in_progress': len(in_progress),
                'total_attempted': total_attempted
            }
        })
        
    except Exception as e:
        print(f"Error getting practice review: {e}")
        return jsonify({'error': 'Could not analyze practice progress'}), 500