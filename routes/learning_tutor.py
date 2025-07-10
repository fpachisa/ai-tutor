"""
Generic Learning Tutor Routes - Works for any topic (fractions, algebra, geometry, etc.)
"""

from flask import Blueprint, request, jsonify
from services.tutor_factory import get_tutor_service, TutorServiceFactory
from services.progress_service import progress_service
from routes.auth import token_required

learning_tutor_bp = Blueprint('learning_tutor', __name__)

@learning_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/<topic>-tutor/start', methods=['POST'])
@token_required
def start_learning_tutor(user_id, grade, subject, topic):
    """
    Start a new learning tutoring session or resume existing one for any topic
    """
    try:
        # Validate topic is supported
        if not TutorServiceFactory.is_topic_supported(topic):
            available_topics = TutorServiceFactory.get_available_topics()
            return jsonify({
                'error': f'Topic "{topic}" is not supported',
                'available_topics': available_topics
            }), 400
        
        # Get the appropriate service for this topic
        tutor_service = get_tutor_service(topic)
        
        # Use a topic-specific problem ID for tutoring sessions
        tutor_session_id = f"{topic}_tutor_session"
        
        # Get user progress to determine current section
        user_progress = progress_service.get_all_user_progress(user_id)
        current_section_id = tutor_service.get_current_section_for_user(user_progress)
        
        # Load conversation history from current section + previous section for context
        existing_history = []
        if current_section_id:
            # Get current section messages
            current_section_history = progress_service.get_chat_history(user_id, current_section_id)
            if current_section_history:
                existing_history.extend(current_section_history)
            
            # If current section has no messages, get previous section for context
            if not current_section_history:
                all_sections = tutor_service.get_all_section_ids()
                try:
                    current_index = all_sections.index(current_section_id)
                    if current_index > 0:
                        previous_section_id = all_sections[current_index - 1]
                        previous_section_history = progress_service.get_chat_history(user_id, previous_section_id)
                        if previous_section_history:
                            existing_history.extend(previous_section_history)
                            print(f"📖 Loaded {len(previous_section_history)} messages from previous section {previous_section_id}")
                except ValueError:
                    pass  # Current section not found in list
        
        
        if existing_history:
            # Resume existing session
            # Check if student has completed all steps (mastered status)
            progress_map = progress_service.get_all_user_progress(user_id)
            tutor_progress_status = progress_map.get(tutor_session_id, 'pending')
            
            if tutor_progress_status == 'mastered':
                # Student has completed all steps - check if they're practicing
                # Get their practice progress to provide relevant feedback
                try:
                    practice_progress = progress_service.get_all_user_progress(user_id)
                    topic_practice_problems = [pid for pid in practice_progress.keys() 
                                                 if pid.startswith(topic.upper()) and pid != tutor_session_id]
                    
                    if topic_practice_problems:
                        # Student is practicing - provide practice review
                        completed_problems = [pid for pid in topic_practice_problems 
                                            if practice_progress[pid] == 'mastered']
                        in_progress_problems = [pid for pid in topic_practice_problems 
                                              if practice_progress[pid] == 'in_progress']
                        
                        # Generate AI-powered encouraging feedback based on practice progress
                        total_attempted = len(completed_problems) + len(in_progress_problems)
                        review_message = tutor_service.generate_practice_review_message(
                            completed_count=len(completed_problems),
                            in_progress_count=len(in_progress_problems),
                            total_attempted=total_attempted
                        )
                        
                        return jsonify({
                            'success': True,
                            'message': review_message,
                            'step': 5,  # Completed step
                            'session_id': f"{topic}_tutor_{user_id}",
                            'instructions': f'Keep practicing your {topic} skills!',
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
                            'message': f"Great to see you back! You've already completed the {topic} basics. Ready for some practice problems?",
                            'step': 5,  # Completed step
                            'session_id': f"{topic}_tutor_{user_id}",
                            'instructions': f'You can now practice your {topic} skills!',
                            'is_resume': True,
                            'completed_learning': True
                        })
                        
                except Exception as e:
                    print(f"Error getting practice progress: {e}")
                    # Fallback to original behavior
                    return jsonify({
                        'success': True,
                        'message': f"Great to see you back! You've already completed the {topic} basics. Ready for some practice problems?",
                        'step': 5,  # Completed step
                        'session_id': f"{topic}_tutor_{user_id}",
                        'instructions': f'You can now practice your {topic} skills!',
                        'is_resume': True,
                        'completed_learning': True
                    })
            
            print(f"🔄 {topic.upper()} TUTOR RESUME:")
            print(f"   Current Section: {current_section_id}")
            print(f"   History Length: {len(existing_history)}")
            
            # Generate intelligent resume message based on conversation history and current section
            try:
                resume_message = tutor_service.generate_resume_message(
                    existing_history, user_progress, current_section_id
                )
                
                print(f"🔄 RESUME: Generated intelligent resume message for section {current_section_id}")
                
                return jsonify({
                    'success': True,
                    'message': resume_message,
                    'current_section_id': current_section_id,
                    'session_id': f"{topic}_tutor_{user_id}",
                    'instructions': 'Type your answer or question in the chat box below.',
                    'is_resume': True
                })
            except Exception as e:
                print(f"❌ CRITICAL: Resume message generation failed: {e}")
                return jsonify({'error': 'Unable to resume session - AI service unavailable'}), 500
        else:
            # Start new session
            starter_message = tutor_service.get_conversation_starter(user_progress)
            
            return jsonify({
                'success': True,
                'message': starter_message,
                'current_section_id': current_section_id,
                'session_id': f"{topic}_tutor_{user_id}",
                'instructions': 'Type your answer or question in the chat box below.',
                'is_resume': False
            })
        
    except Exception as e:
        print(f"Error starting {topic} tutor: {e}")
        return jsonify({'error': f'Could not start {topic} tutor'}), 500

@learning_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/<topic>-tutor/chat', methods=['POST'])
@token_required  
def learning_tutor_chat(user_id, grade, subject, topic):
    """
    Handle conversation with learning tutor for any topic
    """
    try:
        # Validate topic is supported
        if not TutorServiceFactory.is_topic_supported(topic):
            available_topics = TutorServiceFactory.get_available_topics()
            return jsonify({
                'error': f'Topic "{topic}" is not supported',
                'available_topics': available_topics
            }), 400
        
        # Get the appropriate service for this topic
        tutor_service = get_tutor_service(topic)
        
        data = request.get_json()
        student_answer = data.get('student_answer', '').strip()
        conversation_history = data.get('conversation_history', [])
        emotional_intelligence = data.get('emotional_intelligence', {})
        
        # DEBUG: Basic route logging
        print(f"\\n🔍 {topic.upper()} TUTOR CHAT REQUEST:")
        print(f"   Student Answer: '{student_answer}'")
        
        if not student_answer:
            return jsonify({'error': 'Student answer is required'}), 400
        
        # Get user progress for section tracking
        user_progress = progress_service.get_all_user_progress(user_id)
        current_section_id = tutor_service.get_current_section_for_user(user_progress)
        
        print(f"   User Progress: {user_progress}")
        print(f"   Current Section Determined: {current_section_id}")
        
        # Load full conversation context from multiple sections for AI processing
        full_conversation_context = []
        if current_section_id:
            all_sections = tutor_service.get_all_section_ids()
            current_index = all_sections.index(current_section_id) if current_section_id in all_sections else 0
            
            # Load messages from current section and a few previous sections for context
            sections_to_load = all_sections[max(0, current_index-2):current_index+1]
            
            for section_id in sections_to_load:
                section_history = progress_service.get_chat_history(user_id, section_id)
                if section_history:
                    full_conversation_context.extend(section_history)
            
            print(f"📖 Loaded conversation context from {len(sections_to_load)} sections: {sections_to_load}")
            print(f"📖 Total context messages: {len(full_conversation_context)}")
        
        # Use full context for AI processing (includes conversation_history + previous sections)
        ai_conversation_context = full_conversation_context + conversation_history
        
        # Generate tutor response using the service with full conversation context
        result = tutor_service.generate_tutor_response(
            student_answer, ai_conversation_context, 1, emotional_intelligence, 
            user_progress, current_section_id)
        
        # Handle different return formats
        if len(result) == 3:
            # Old format: (tutor_response, new_step, shows_understanding)
            tutor_response, new_step, shows_understanding = result
            section_completed = False
            updated_section_id = current_section_id
        elif len(result) == 6:
            # New format: (tutor_response, new_step, shows_understanding, section_completed, current_section_id, next_section_id)
            tutor_response, new_step, shows_understanding, section_completed, _, next_section_id = result
            # Use next_section_id if section completed, otherwise stay in current section
            updated_section_id = next_section_id if section_completed else current_section_id
        else:
            # Legacy format with asked_question
            tutor_response, new_step, shows_understanding, asked_question = result
            section_completed = False
            updated_section_id = current_section_id
        
        # Create message objects with section tracking
        student_message = {
            'sender': 'student', 
            'message': student_answer, 
            'section_id': current_section_id
        }
        tutor_message = {
            'sender': 'tutor', 
            'message': tutor_response, 
            'section_id': updated_section_id
        }
        
        # Debug: Log the evaluation results
        print(f"🔍 {topic.upper()} TUTOR EVALUATION:")
        print(f"   Current Section: {current_section_id}")
        print(f"   Updated Section: {updated_section_id}")
        print(f"   Shows Understanding: {shows_understanding}")
        print(f"   Section Completed: {section_completed}")
        print(f"   Student Answer: '{student_answer}'")
        
        # Section progression is handled by the service, no need for step logic here
        updated_history = conversation_history + [student_message, tutor_message]
        
        # Calculate response data BEFORE database operations
        all_sections = tutor_service.get_all_section_ids()
        # Count completed sections (including the one we just completed)
        completed_sections_count = len([sid for sid in all_sections if user_progress.get(sid) == 'completed'])
        if section_completed and current_section_id:
            completed_sections_count += 1  # Add the current section that was just completed
        
        ready_for_problems = completed_sections_count >= len(all_sections)
        
        response_data = {
            'success': True,
            'tutor_response': tutor_response,
            'current_section_id': updated_section_id or current_section_id,
            'shows_understanding': shows_understanding,
            'section_completed': section_completed,
            'ready_for_problems': ready_for_problems,
            'completed_sections_count': completed_sections_count,
            'total_sections': len(all_sections)
        }
        
        # SEND RESPONSE IMMEDIATELY - don't wait for database operations
        from threading import Thread
        
        def save_progress_async():
            try:
                # Save section progress if completed
                if section_completed and current_section_id:
                    progress_service.save_progress(user_id, current_section_id, 'completed', [])
                
                # Save messages to current section
                section_messages = [student_message, tutor_message]
                message_save_status = 'completed' if (section_completed and current_section_id) else 'in_progress'
                progress_service.save_progress(user_id, current_section_id, message_save_status, section_messages)
                
                # Position user in new section if completed
                if section_completed and updated_section_id and updated_section_id != current_section_id:
                    progress_service.save_progress(user_id, updated_section_id, 'in_progress', [])
                
                # Save overall progress
                progress_status = 'mastered' if ready_for_problems else ('in_progress' if completed_sections_count > 0 else 'pending')
                tutor_session_id = f"{topic}_tutor_session"
                progress_service.save_progress(user_id, tutor_session_id, progress_status, [])
            except Exception as e:
                print(f"Background save error: {e}")
        
        # Start background thread for database operations
        Thread(target=save_progress_async, daemon=True).start()
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Error in {topic} tutor chat: {e}")
        return jsonify({'error': 'Could not process your response'}), 500

@learning_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/<topic>-tutor/status', methods=['GET'])
@token_required
def get_learning_tutor_status(user_id, grade, subject, topic):
    """
    Get current status of learning tutoring progress for any topic
    """
    try:
        # Validate topic is supported
        if not TutorServiceFactory.is_topic_supported(topic):
            available_topics = TutorServiceFactory.get_available_topics()
            return jsonify({
                'error': f'Topic "{topic}" is not supported',
                'available_topics': available_topics
            }), 400
        
        # Get the appropriate service for this topic
        tutor_service = get_tutor_service(topic)
        
        tutor_session_id = f"{topic}_tutor_session"
        
        # Get existing progress
        existing_history = progress_service.get_chat_history(user_id, tutor_session_id)
        progress_map = progress_service.get_all_user_progress(user_id)
        
        # Get all section progress dynamically for ALL steps
        all_sections = tutor_service.get_all_section_ids()
        
        # Dynamically detect all step sequences
        step_data = {}
        step_numbers = []
        
        # Group sections by step number
        for section_id in all_sections:
            # Extract step number from section ID (e.g., "p6_math_fractions_step2_001" -> 2)
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
        
        # Sort step numbers to process in order
        sorted_steps = sorted(step_data.keys())
        
        for step_num in sorted_steps:
            if step_data[step_num]['completed']:
                completed_steps.append(step_num)
                # If this step is completed, user should be on the next step
                if step_num == current_step:
                    current_step = step_num + 1
            else:
                # If user has started this step but not completed it
                if step_data[step_num]['completed_sections'] > 0:
                    current_step = step_num
                break
        
        # If all steps are completed, user is ready for practice
        all_steps_completed = len(completed_steps) == len(sorted_steps)
        if all_steps_completed:
            current_step = len(sorted_steps) + 1  # Beyond the last step
            
        print(f"📊 {topic.upper()} STATUS (DYNAMIC):")
        for step_num in sorted_steps:
            step_info = step_data[step_num]
            print(f"   Step{step_num} sections: {step_info['completed_sections']}/{step_info['total_sections']} ({'✅' if step_info['completed'] else '🔄'})")
        print(f"   Completed steps: {completed_steps}")
        print(f"   Current step: {current_step}")
        print(f"   Total steps available: {len(sorted_steps)}")
        
        # Get progress status  
        progress_status = progress_map.get(tutor_session_id, 'pending')
        
        # Check if student is ready for practice problems (completed all learning)
        if progress_status == 'mastered':
            # If marked as mastered, then all steps are completed
            completed_steps = sorted_steps  # Override with all steps completed
            current_step = len(sorted_steps) + 1  # Ready for practice
            print(f"🎓 MASTERED STATUS: Marking all {len(sorted_steps)} steps as completed")
        
        # Determine if tutor is completed (ready for practice problems)
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
            'completed_steps': len(completed_steps),  # Frontend expects number of completed steps
            'is_completed': is_completed,
            'progress_status': progress_status,
            'has_history': len(existing_history) > 0 if existing_history else False,
            'message_count': len(existing_history) if existing_history else 0,
            'completed_step_list': completed_steps,  # Keep the original list too
            'total_steps': len(sorted_steps),  # Total number of steps available
            **step_progress  # Dynamically include all step progress data
        })
        
    except Exception as e:
        print(f"Error getting {topic} tutor status: {e}")
        return jsonify({'error': 'Could not get tutor status'}), 500

@learning_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/<topic>-tutor/reset', methods=['POST'])
@token_required
def reset_learning_tutor_progress(user_id, grade, subject, topic):
    """
    Reset learning tutoring progress for any topic (for testing/debugging)
    """
    try:
        # Validate topic is supported
        if not TutorServiceFactory.is_topic_supported(topic):
            available_topics = TutorServiceFactory.get_available_topics()
            return jsonify({
                'error': f'Topic "{topic}" is not supported',
                'available_topics': available_topics
            }), 400
        
        tutor_session_id = f"{topic}_tutor_session"
        
        # Clear chat history by creating empty history
        from models.chat_history import ChatHistory
        from models.problem_progress import ProblemProgress
        
        # Delete existing records
        chat_history = ChatHistory.get_chat_history(user_id, tutor_session_id)
        if chat_history:
            chat_history.clear_history()
        
        # Reset progress
        progress = ProblemProgress.get_progress(user_id, tutor_session_id)
        if progress:
            progress.status = 'pending'
            progress.save()
        
        return jsonify({
            'success': True,
            'message': f'{topic.title()} tutor progress has been reset'
        })
        
    except Exception as e:
        print(f"Error resetting {topic} tutor progress: {e}")
        return jsonify({'error': 'Could not reset progress'}), 500

@learning_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/<topic>-tutor/practice-review', methods=['POST'])
@token_required
def get_practice_review(user_id, grade, subject, topic):
    """
    Get AI-generated intelligent review of student's practice progress for any topic
    """
    try:
        # Validate topic is supported
        if not TutorServiceFactory.is_topic_supported(topic):
            available_topics = TutorServiceFactory.get_available_topics()
            return jsonify({
                'error': f'Topic "{topic}" is not supported',
                'available_topics': available_topics
            }), 400
        
        # Get the appropriate service for this topic
        tutor_service = get_tutor_service(topic)
        
        # Get all user progress
        progress_map = progress_service.get_all_user_progress(user_id)
        
        # Filter for topic problems (they start with topic prefix like 'FRAC', 'ALG', etc.)
        topic_prefix = topic[:4].upper()  # First 4 letters uppercase
        topic_problems = {pid: status for pid, status in progress_map.items() 
                        if pid.startswith(topic_prefix) and pid != f'{topic}_tutor_session'}
        
        # Analyze practice patterns
        completed = [pid for pid, status in topic_problems.items() if status == 'mastered']
        in_progress = [pid for pid, status in topic_problems.items() if status == 'in_progress']
        
        total_attempted = len(completed) + len(in_progress)
        
        # Generate AI-powered feedback
        feedback = tutor_service.generate_practice_review_message(
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
        print(f"Error getting {topic} practice review: {e}")
        return jsonify({'error': 'Could not analyze practice progress'}), 500

@learning_tutor_bp.route('/api/grades/<grade>/subjects/<subject>/<topic>/learn/steps', methods=['GET'])
@token_required
def get_learning_steps_metadata(user_id, grade, subject, topic):
    """
    Get learning steps metadata for any topic (icon, title, description)
    Reads from the 'steps' field in the {topic}_learn.json file
    """
    try:
        # Validate topic is supported
        if not TutorServiceFactory.is_topic_supported(topic):
            available_topics = TutorServiceFactory.get_available_topics()
            return jsonify({
                'error': f'Topic "{topic}" is not supported',
                'available_topics': available_topics
            }), 400
        
        # Get the appropriate service for this topic
        tutor_service = get_tutor_service(topic)
        
        # Get steps metadata from curriculum JSON
        steps_metadata = tutor_service.curriculum_content.get("steps", [])
        
        # If no steps field found, create fallback based on step sequences
        if not steps_metadata:
            # Count step sequences to determine step count
            step_sequences = [key for key in tutor_service.curriculum_content.keys() 
                            if key.startswith('step') and key.endswith('_sequence')]
            step_count = len(step_sequences)
            
            # Generate default steps structure
            steps_metadata = []
            for i in range(1, step_count + 1):
                steps_metadata.append({
                    "icon": f"📚",
                    "title": f"Step {i}",
                    "description": f"Learning step {i} for {topic.title()}"
                })
            
            print(f"ℹ️ Generated fallback steps for {topic}: {step_count} steps")
        
        return jsonify({
            'success': True,
            'topic': tutor_service.curriculum_content.get("topic", f"{topic.title()} - Primary 6"),
            'description': tutor_service.curriculum_content.get("description", f"Learning {topic}"),
            'total_steps': len(steps_metadata),
            'steps': steps_metadata
        })
        
    except Exception as e:
        print(f"Error getting {topic} steps metadata: {e}")
        return jsonify({
            'error': f'Could not load {topic} steps metadata',
            'message': str(e)
        }), 500