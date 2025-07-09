"""
Fractions Tutor Routes - Simple conversational tutoring endpoints  
"""

from flask import Blueprint, request, jsonify
from services.fractions_tutor_service import FractionsTutorService
from services.progress_service import progress_service
from routes.auth import token_required

fractions_tutor_bp = Blueprint('fractions_tutor', __name__)
fractions_service = FractionsTutorService()

@fractions_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/fractions-tutor/start', methods=['POST'])
@token_required
def start_fractions_tutor(user_id, grade, subject):
    """
    Start a new fractions tutoring session or resume existing one
    """
    try:
        # Use a special problem ID for fractions tutoring sessions
        fractions_tutor_id = "fractions_tutor_session"
        
        # Get user progress to determine current section
        user_progress = progress_service.get_all_user_progress(user_id)
        current_section_id = fractions_service.get_current_section_for_user(user_progress)
        
        # Load conversation history from current section + previous section for context
        existing_history = []
        if current_section_id:
            # Get current section messages
            current_section_history = progress_service.get_chat_history(user_id, current_section_id)
            if current_section_history:
                existing_history.extend(current_section_history)
            
            # If current section has no messages, get previous section for context
            if not current_section_history:
                all_sections = fractions_service.get_all_section_ids()
                try:
                    current_index = all_sections.index(current_section_id)
                    if current_index > 0:
                        previous_section_id = all_sections[current_index - 1]
                        previous_section_history = progress_service.get_chat_history(user_id, previous_section_id)
                        if previous_section_history:
                            existing_history.extend(previous_section_history)
                except ValueError:
                    pass  # Current section not found in list
        
        if existing_history:
            # Resume existing session
            progress_map = progress_service.get_all_user_progress(user_id)
            fractions_tutor_status = progress_map.get(fractions_tutor_id, 'pending')
            
            if fractions_tutor_status == 'mastered':
                # Student has completed all steps
                return jsonify({
                    'success': True,
                    'message': "Great to see you back! You've already completed the fractions basics. Ready for some practice problems?",
                    'step': 5,
                    'session_id': f"fractions_tutor_{user_id}",
                    'instructions': 'You can now practice your fractions skills!',
                    'is_resume': True,
                    'completed_learning': True
                })
            
            # Generate resume message
            resume_message = fractions_service.generate_resume_message(
                existing_history, user_progress, current_section_id
            )
            
            return jsonify({
                'success': True,
                'message': resume_message,
                'current_section_id': current_section_id,
                'session_id': f"fractions_tutor_{user_id}",
                'instructions': 'Type your answer or question in the chat box below.',
                'is_resume': True
            })
        else:
            # Start new session
            starter_message = fractions_service.get_conversation_starter(user_progress)
            
            return jsonify({
                'success': True,
                'message': starter_message,
                'current_section_id': current_section_id,
                'session_id': f"fractions_tutor_{user_id}",
                'instructions': 'Type your answer or question in the chat box below.',
                'is_resume': False
            })
        
    except Exception as e:
        print(f"Error starting fractions tutor: {e}")
        return jsonify({'error': 'Could not start fractions tutor'}), 500

@fractions_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/fractions-tutor/chat', methods=['POST'])
@token_required  
def fractions_tutor_chat(user_id, grade, subject):
    """
    Handle conversation with fractions tutor
    """
    try:
        data = request.get_json()
        student_answer = data.get('student_answer', '').strip()
        conversation_history = data.get('conversation_history', [])
        emotional_intelligence = data.get('emotional_intelligence', {})
        
        if not student_answer:
            return jsonify({'error': 'Student answer is required'}), 400
        
        # Get user progress for section tracking
        user_progress = progress_service.get_all_user_progress(user_id)
        current_section_id = fractions_service.get_current_section_for_user(user_progress)
        
        # Generate tutor response
        result = fractions_service.generate_tutor_response(
            student_answer, conversation_history, 1, emotional_intelligence, 
            user_progress, current_section_id)
        
        # Handle different return formats
        if len(result) == 6:
            tutor_response, new_step, shows_understanding, section_completed, _, next_section_id = result
            updated_section_id = next_section_id if section_completed else current_section_id
        else:
            tutor_response, new_step, shows_understanding = result
            section_completed = False
            updated_section_id = current_section_id
        
        # Create message objects
        student_message = {'sender': 'student', 'message': student_answer, 'section_id': current_section_id}
        tutor_message = {'sender': 'tutor', 'message': tutor_response, 'section_id': updated_section_id}
        
        # Calculate response data
        all_sections = fractions_service.get_all_section_ids()
        completed_sections_count = len([sid for sid in all_sections if user_progress.get(sid) == 'completed'])
        if section_completed and current_section_id:
            completed_sections_count += 1
        
        ready_for_problems = completed_sections_count >= len(all_sections)
        
        # Save progress asynchronously
        from threading import Thread
        
        def save_progress_async():
            try:
                if section_completed and current_section_id:
                    progress_service.save_progress(user_id, current_section_id, 'completed', [])
                
                section_messages = [student_message, tutor_message]
                message_save_status = 'completed' if (section_completed and current_section_id) else 'in_progress'
                progress_service.save_progress(user_id, current_section_id, message_save_status, section_messages)
                
                if section_completed and updated_section_id and updated_section_id != current_section_id:
                    progress_service.save_progress(user_id, updated_section_id, 'in_progress', [])
                
                progress_status = 'mastered' if ready_for_problems else ('in_progress' if completed_sections_count > 0 else 'pending')
                progress_service.save_progress(user_id, "fractions_tutor_session", progress_status, [])
            except Exception as e:
                print(f"Background save error: {e}")
        
        Thread(target=save_progress_async, daemon=True).start()
        
        return jsonify({
            'success': True,
            'tutor_response': tutor_response,
            'current_section_id': updated_section_id or current_section_id,
            'shows_understanding': shows_understanding,
            'section_completed': section_completed,
            'ready_for_problems': ready_for_problems,
            'completed_sections_count': completed_sections_count,
            'total_sections': len(all_sections)
        })
        
    except Exception as e:
        print(f"Error in fractions tutor chat: {e}")
        return jsonify({'error': 'Could not process your response'}), 500

@fractions_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/fractions-tutor/status', methods=['GET'])
@token_required
def get_fractions_tutor_status(user_id, grade, subject):
    """
    Get current status of fractions tutoring progress
    """
    try:
        fractions_tutor_id = "fractions_tutor_session"
        
        # Get existing progress
        existing_history = progress_service.get_chat_history(user_id, fractions_tutor_id)
        progress_map = progress_service.get_all_user_progress(user_id)
        
        # Get all section progress dynamically for ALL steps
        all_sections = fractions_service.get_all_section_ids()
        
        # Dynamically detect all step sequences
        step_data = {}
        
        # Group sections by step number
        for section_id in all_sections:
            if '_step' in section_id:
                step_num = int(section_id.split('_step')[1].split('_')[0])
                if step_num not in step_data:
                    step_data[step_num] = {
                        'sections': [],
                        'completed_sections': 0,
                        'total_sections': 0,
                        'completed': False
                    }
                step_data[step_num]['sections'].append(section_id)
                step_data[step_num]['total_sections'] += 1
                
                if progress_map.get(section_id) == 'completed':
                    step_data[step_num]['completed_sections'] += 1
        
        # Calculate completion status for each step
        for step_num in step_data:
            step_info = step_data[step_num]
            step_info['completed'] = step_info['completed_sections'] >= step_info['total_sections']
        
        # Determine completed steps and current step
        completed_steps = []
        current_step = 1
        
        sorted_steps = sorted(step_data.keys())
        
        for step_num in sorted_steps:
            if step_data[step_num]['completed']:
                completed_steps.append(step_num)
                if step_num == current_step:
                    current_step = step_num + 1
            else:
                if step_data[step_num]['completed_sections'] > 0:
                    current_step = step_num
                break
        
        # If all steps are completed, user is ready for practice
        all_steps_completed = len(completed_steps) == len(sorted_steps)
        if all_steps_completed:
            current_step = len(sorted_steps) + 1
        
        # Get progress status  
        progress_status = progress_map.get(fractions_tutor_id, 'pending')
        
        if progress_status == 'mastered':
            completed_steps = sorted_steps
            current_step = len(sorted_steps) + 1
        
        is_completed = all_steps_completed
        
        # Build dynamic step progress data
        step_progress = {}
        for step_num in sorted_steps:
            step_progress[f'step{step_num}_progress'] = {
                'completed_sections': step_data[step_num]['completed_sections'],
                'total_sections': step_data[step_num]['total_sections'],
                'completed': step_data[step_num]['completed']
            }
        
        return jsonify({
            'success': True,
            'current_step': current_step,
            'completed_steps': len(completed_steps),
            'is_completed': is_completed,
            'progress_status': progress_status,
            'has_history': len(existing_history) > 0 if existing_history else False,
            'message_count': len(existing_history) if existing_history else 0,
            'completed_step_list': completed_steps,
            'total_steps': len(sorted_steps),
            **step_progress
        })
        
    except Exception as e:
        print(f"Error getting fractions tutor status: {e}")
        return jsonify({'error': 'Could not get tutor status'}), 500

@fractions_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/fractions-tutor/reset', methods=['POST'])
@token_required
def reset_fractions_tutor_progress(user_id, grade, subject):
    """
    Reset fractions tutoring progress
    """
    try:
        from models.chat_history import ChatHistory
        from models.problem_progress import ProblemProgress
        
        fractions_tutor_id = "fractions_tutor_session"
        
        # Delete existing records
        chat_history = ChatHistory.get_chat_history(user_id, fractions_tutor_id)
        if chat_history:
            chat_history.clear_history()
        
        # Reset progress
        progress = ProblemProgress.get_progress(user_id, fractions_tutor_id)
        if progress:
            progress.status = 'pending'
            progress.save()
        
        return jsonify({
            'success': True,
            'message': 'Fractions tutor progress has been reset'
        })
        
    except Exception as e:
        print(f"Error resetting fractions tutor progress: {e}")
        return jsonify({'error': 'Could not reset progress'}), 500

@fractions_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/fractions-tutor/practice-review', methods=['POST'])
@token_required
def get_fractions_practice_review(user_id, grade, subject):
    """
    Get AI-generated review of student's fractions practice progress
    """
    try:
        progress_map = progress_service.get_all_user_progress(user_id)
        
        # Filter for fractions problems
        fractions_problems = {pid: status for pid, status in progress_map.items() 
                            if pid.startswith('FRAC') and pid != 'fractions_tutor_session'}
        
        # Analyze practice patterns
        completed = [pid for pid, status in fractions_problems.items() if status == 'mastered']
        in_progress = [pid for pid, status in fractions_problems.items() if status == 'in_progress']
        
        total_attempted = len(completed) + len(in_progress)
        
        # Generate AI-powered feedback
        feedback = fractions_service.generate_practice_review_message(
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
        print(f"Error getting fractions practice review: {e}")
        return jsonify({'error': 'Could not analyze practice progress'}), 500