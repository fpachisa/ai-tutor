"""
Generic Learning Tutor Service - Base class for all topic-based conversational tutoring
Supports sequential JSON-based conversation flow where JSON controls content, AI handles conversation, and System controls progression
"""

import json
import os
from typing import Dict, List, Tuple, Optional
import google.generativeai as genai
from config.settings import Config

class LearningTutorService:
    """
    Base class for topic-specific learning tutors following sequential JSON-based conversation flow
    """
    
    def __init__(self, topic: str, grade: str = "p6", subject: str = "math"):
        self.topic = topic
        self.grade = grade
        self.subject = subject
        self.section_prefix = f"{grade}_{subject}_{topic}_step"
        
        if not Config.GOOGLE_API_KEY:
            print(f"WARNING: No GOOGLE_API_KEY found. {topic.title()} tutor will not function.")
            self.model = None
        else:
            genai.configure(api_key=Config.GOOGLE_API_KEY)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Load JSON curriculum content
        self.curriculum_content = self._load_curriculum_content()
        
    def _load_curriculum_content(self) -> Dict:
        """Load curriculum content from JSON file"""
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            json_path = os.path.join(current_dir, '..', 'problems', self.grade, f'{self.topic}_learn.json')
            
            with open(json_path, 'r', encoding='utf-8') as file:
                content = json.load(file)
                print(f"✅ Successfully loaded {self.topic} curriculum content")
                return content
        except FileNotFoundError:
            print(f"❌ CRITICAL: Could not find {self.topic}_learn.json")
            raise Exception(f"Curriculum file not found. Check {self.topic}_learn.json exists.")
        except json.JSONDecodeError as e:
            print(f"❌ CRITICAL: Error parsing {self.topic}_learn.json: {e}")
            raise Exception(f"JSON syntax error in curriculum file: {e}")
        except Exception as e:
            print(f"❌ CRITICAL: Unexpected error loading {self.topic} curriculum: {e}")
            raise Exception(f"Failed to load curriculum: {e}")
    
    def get_all_section_ids(self) -> List[str]:
        """Get all section IDs in order from all steps"""
        if not self.curriculum_content:
            return []
        
        section_ids = []
        
        # Find all step sequences (step1_sequence, step2_sequence, etc.)
        step_keys = [key for key in self.curriculum_content.keys() if key.endswith('_sequence')]
        step_keys.sort()  # Ensure proper order (step1, step2, step3...)
        
        # If no step sequences found, fallback to old behavior
        if not step_keys and "step1_sequence" in self.curriculum_content:
            step_keys = ["step1_sequence"]
        
        for step_key in step_keys:
            step_sections = self.curriculum_content.get(step_key, [])
            for section in step_sections:
                section_id = section.get('id')
                if section_id:
                    section_ids.append(section_id)
        
        return section_ids
    
    def get_section_by_id(self, section_id: str) -> Dict:
        """Get section content by its ID from any step sequence"""
        if not self.curriculum_content:
            return {}
        
        # Find all step sequences (step1_sequence, step2_sequence, etc.)
        step_keys = [key for key in self.curriculum_content.keys() if key.endswith('_sequence')]
        step_keys.sort()  # Ensure proper order (step1, step2, step3...)
        
        # Search through all step sequences for the section
        for step_key in step_keys:
            step_sections = self.curriculum_content.get(step_key, [])
            for section in step_sections:
                if section.get('id') == section_id:
                    return section
        
        return {}
    
    def get_current_section_for_user(self, user_section_progress: Dict) -> str:
        """Determine which section the user should work on next"""
        all_sections = self.get_all_section_ids()
        
        if not all_sections:
            return ""
        
        # Find the first section that is not completed
        for section_id in all_sections:
            section_status = user_section_progress.get(section_id, 'pending')
            if section_status != 'completed':
                return section_id
        
        # All sections completed
        return ""
    
    def get_next_section_id(self, current_section_id: str) -> Optional[str]:
        """Get the next section ID in the sequence"""
        all_sections = self.get_all_section_ids()
        
        try:
            current_index = all_sections.index(current_section_id)
            if current_index + 1 < len(all_sections):
                return all_sections[current_index + 1]
            else:
                return None  # No more sections
        except ValueError:
            return None
    
    def get_conversation_starter(self, user_section_progress: Dict = None) -> str:
        """Get the initial conversation starter message"""
        if user_section_progress is None:
            user_section_progress = {}
        
        # Get the current section the user should work on
        current_section_id = self.get_current_section_for_user(user_section_progress)
        
        if not current_section_id:
            return f"Hi! I'm your {self.topic} tutor. It looks like you've completed all the sections! Great job!"
        
        # Get the section content and generate starter
        return self._generate_section_message(current_section_id, is_starter=True)
    
    def generate_resume_message(self, conversation_history: List[Dict], user_section_progress: Dict, current_section_id: str) -> str:
        """Generate intelligent resume message"""
        if not self.model:
            raise Exception("AI model is required for resume message but not available.")
        
        section_content = self.get_section_by_id(current_section_id)
        if not section_content:
            return f"Welcome back! Let's continue with your {self.topic} learning."
        
        # Get last few messages for context
        recent_messages = conversation_history[-4:] if conversation_history else []
        conversation_context = ""
        if recent_messages:
            conversation_context = "Recent conversation:\\n" + "\\n".join([
                f"{msg.get('sender', 'unknown')}: {msg.get('message', '')}" 
                for msg in recent_messages
            ])
        
        section_type = section_content.get('type', '')
        section_text = section_content.get('text', '')
        section_question = section_content.get('question', '')
        
        prompt = f"""You are a P6 math tutor. A student is returning to their {self.topic} lesson.

CURRENT SECTION: {section_type}
SECTION CONTENT: {section_text}

{conversation_context}

GUIDELINES:
1. Welcome them back warmly but briefly
2. Continue naturally from where they left off
3. Use the section content as foundation
4. Always end with the section question: {section_question}
5. Keep it conversational and encouraging

Generate a resume message:"""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"❌ CRITICAL: Error generating resume message: {e}")
            raise Exception(f"AI failed to generate resume message: {e}")
    
    def generate_tutor_response(self, student_answer: str, conversation_history: List[Dict], 
                              current_step: int = 1, emotional_intelligence: Dict = None,
                              user_progress: Dict = None, current_section_id: str = None) -> Tuple[str, str, bool, int]:
        """
        Generate tutor response and determine progression
        
        Args:
            student_answer: The student's response
            conversation_history: Previous conversation messages
            current_step: Current learning step (kept for backward compatibility)
            emotional_intelligence: Dict containing emotional state data
            user_progress: Dict containing section-level progress
            current_section_id: ID of the current section being worked on
            
        Returns:
            Tuple of (tutor_message, next_section_id, section_completed, new_attempt_count)
        """
        if not self.model:
            raise Exception("AI model is required but not available.")
        
        # Get section-level progress if user_progress provided
        if user_progress:
            section_progress = {
                pid: status for pid, status in user_progress.items() 
                if pid.startswith(self.section_prefix)
            }
            if not current_section_id:
                current_section_id = self.get_current_section_for_user(section_progress)
        
        if not current_section_id:
            current_section_id = self.get_all_section_ids()[0] if self.get_all_section_ids() else ""
        
        section_content = self.get_section_by_id(current_section_id)
        if not section_content:
            raise Exception(f"Section not found: {current_section_id}")
        
        # Get current attempt count from conversation history within this section ONLY
        attempt_count = 1
        if conversation_history:
            # Count student messages ONLY for the current section
            previous_attempts_in_section = 0
            
            # Go through conversation history in reverse and count ONLY current section attempts
            for msg in reversed(conversation_history):
                msg_section_id = msg.get('section_id')
                msg_sender = msg.get('sender')
                
                # Only count student messages that explicitly belong to the current section
                if (msg_sender == 'student' and msg_section_id == current_section_id):
                    previous_attempts_in_section += 1
            
            # Current attempt number = previous attempts in this section + 1
            attempt_count = previous_attempts_in_section + 1
            
            print(f"🔍 ATTEMPT COUNTING: Section {current_section_id}, Previous attempts: {previous_attempts_in_section}, Current attempt: {attempt_count}")
            
            # Debug: Show which messages were counted
            current_section_student_messages = [
                f"'{msg.get('message', '')[:30]}...'" 
                for msg in conversation_history 
                if msg.get('sender') == 'student' and msg.get('section_id') == current_section_id
            ]
            if current_section_student_messages:
                print(f"🔍 COUNTED MESSAGES: {current_section_student_messages}")
        
        # Extract section data
        section_type = section_content.get('type', '')
        section_text = section_content.get('text', '')
        section_question = section_content.get('question', '')
        sample_correct = section_content.get('sample_correct_response', '')
        sample_incorrect = section_content.get('sample_incorrect_response', '')
        detailed_explanation = section_content.get('exact_detailed_explanation', '')
        
        # For completion sections, both yes and no responses should be treated as correct
        if section_type == 'completion':
            student_lower = student_answer.lower().strip()
            is_correct = any(word in student_lower for word in ['yes', 'no', 'ready', 'not ready', 'confident', 'not confident', 'sure', 'not sure'])
        else:
            # Check if response is correct using AI
            is_correct = self._evaluate_student_response(
                student_answer, sample_correct, sample_incorrect, section_question
            )
        
        
        # Initialize progression variables
        next_section_id = current_section_id  # Default to staying in same section
        section_completed = False  # Initialize as False
        
        
        # Determine progression based on our rules
        if is_correct:
            # Handle completion sections specially
            if section_type == 'completion':
                student_lower = student_answer.lower().strip()
                is_ready = any(word in student_lower for word in ['yes', 'ready', 'confident', 'sure'])
                
                # For completion sections, both yes and no lead to advancement
                next_section_id = self.get_next_section_id(current_section_id)
                section_completed = True
                new_attempt_count = 1
                
                if is_ready:
                    # Student says yes - regular positive transition
                    if next_section_id:
                        tutor_message = self._generate_correct_response_with_transition(
                            current_section_id, next_section_id
                        )
                    else:
                        tutor_message = f"Excellent work! You've completed all the {self.topic} sections. You're now ready for practice problems!"
                else:
                    # Student says no - encouragement then transition
                    if next_section_id:
                        tutor_message = self._generate_encouragement_and_transition(
                            detailed_explanation, current_section_id, next_section_id
                        )
                    else:
                        tutor_message = f"That's perfectly fine! {detailed_explanation} You've completed all the {self.topic} sections. You're now ready for practice problems!"
            else:
                # Regular sections - move to next section
                next_section_id = self.get_next_section_id(current_section_id)
                section_completed = True
                new_attempt_count = 1  # Reset for next section
                
                # Generate encouraging response and introduce next section
                if next_section_id:
                    tutor_message = self._generate_correct_response_with_transition(
                        current_section_id, next_section_id
                    )
                else:
                    tutor_message = f"Excellent work! You've completed all the {self.topic} sections. You're now ready for practice problems!"
            
        elif attempt_count > 2:
            # Max attempts reached - provide explanation and advance to next section
            next_section_id = self.get_next_section_id(current_section_id)
            section_completed = True
            new_attempt_count = 1  # Reset for next section
            
            # Generate explanation and advance to next section
            if next_section_id:
                tutor_message = self._generate_explanation_and_advance(
                    detailed_explanation, current_section_id, next_section_id
                )
            else:
                # Final section - just provide explanation
                tutor_message = f"No worries! {detailed_explanation} You've completed all the {self.topic} sections. You're now ready for practice problems!"
            
        else:
            # Incorrect response, give hint and try again
            next_section_id = current_section_id  # Stay in same section
            section_completed = False
            new_attempt_count = attempt_count + 1
            
            tutor_message = self._generate_hint_response(
                student_answer, section_content, emotional_intelligence
            )
        
        # For backward compatibility, return in expected format
        # Convert to old format: (tutor_response, new_step, shows_understanding, section_completed, current_section_id, next_section_id)
        new_step = current_step  # Keep same step for backward compatibility
        shows_understanding = is_correct
        
        return (tutor_message, new_step, shows_understanding, section_completed, 
               current_section_id, next_section_id)
    
    def _evaluate_student_response(self, student_answer: str, sample_correct: str, 
                                 sample_incorrect: str, question: str) -> bool:
        """Use AI to evaluate if student response matches the correct sample"""
        if not self.model:
            return False
        
        prompt = f"""You are evaluating a P6 student's {self.topic} response.

QUESTION: {question}
STUDENT ANSWER: "{student_answer}"
SAMPLE CORRECT RESPONSE: "{sample_correct}"
SAMPLE INCORRECT RESPONSES: "{sample_incorrect}"

Is the student's answer correct? Consider:
1. Mathematical accuracy
2. Conceptual understanding shown
3. Similarity to sample correct response

Respond with only: "CORRECT" or "INCORRECT" """

        try:
            response = self.model.generate_content(prompt)
            result = response.text.strip().upper()
            return result == "CORRECT"
        except Exception as e:
            print(f"❌ CRITICAL: Error evaluating response: {e}")
            raise Exception(f"AI failed to evaluate student response: {e}")
    
    def _generate_section_message(self, section_id: str, is_starter: bool = False) -> str:
        """Generate message for a section (starter or transition)"""
        section_content = self.get_section_by_id(section_id)
        if not section_content:
            return f"Let's continue with your {self.topic} learning."
        
        section_type = section_content.get('type', '')
        section_text = section_content.get('text', '')
        section_question = section_content.get('question', '')
        
        # Handle worked examples differently
        if section_type == 'worked_example':
            demo_problem = section_content.get('demonstration_problem', '')
            solution_steps = section_content.get('solution_steps', [])
            demo_answer = section_content.get('demonstration_answer', '')
            
            if is_starter:
                intro = f"Hi! I'm your {self.topic} tutor. "
            else:
                intro = ""
            
            # Format the worked example display
            steps_text = "\\n".join(solution_steps) if solution_steps else ""
            
            return f"""{intro}{section_text}

**Problem: {demo_problem}**

**Solution:**
{steps_text}

**Answer: {demo_answer}**

Now it's your turn! **{section_question}**"""
        
        else:
            # Regular sections
            if is_starter:
                intro = f"Hi! I'm your {self.topic} tutor. "
            else:
                intro = ""
            
            return f"{intro}{section_text} **{section_question}**"
    
    def _generate_correct_response_with_transition(self, current_section_id: str, next_section_id: str) -> str:
        """Generate response for correct answer and transition to next section"""
        if not self.model:
            next_section_message = self._generate_section_message(next_section_id)
            return f"That's correct! {next_section_message}"
        
        current_section = self.get_section_by_id(current_section_id)
        next_section = self.get_section_by_id(next_section_id)
        
        current_type = current_section.get('type', '')
        next_type = next_section.get('type', '')
        next_text = next_section.get('text', '')
        next_question = next_section.get('question', '')
        
        # Check if this is a step transition (e.g., step1 → step2, step2 → step3)
        is_step_transition = (
            current_section_id.endswith('_012') and 
            next_section_id.endswith('_001') and
            'step' in current_section_id and 'step' in next_section_id and
            current_section_id.split('_step')[1][0] != next_section_id.split('_step')[1][0]
        )
        
        # Handle worked examples for next section
        if next_type == 'worked_example':
            demo_problem = next_section.get('demonstration_problem', '')
            solution_steps = next_section.get('solution_steps', [])
            demo_answer = next_section.get('demonstration_answer', '')
            steps_text = "\\n".join(solution_steps) if solution_steps else ""
            
            next_content = f"""{next_text}

**Problem: {demo_problem}**

**Solution:**
{steps_text}

**Answer: {demo_answer}**

Now it's your turn! **{next_question}**"""
        else:
            next_content = f"{next_text} **{next_question}**"
        
        # For step transitions, create a more natural flow
        if is_step_transition:
            # Extract step numbers for dynamic messaging
            current_step = current_section_id.split('_step')[1][0]
            next_step = next_section_id.split('_step')[1][0]
            
            prompt = f"""You are a P6 math tutor. The student just completed Step {current_step} and is moving to Step {next_step}.

CURRENT SECTION COMPLETED: {current_section.get('text', '')}
NEXT SECTION STARTING: {next_text}

Generate a natural transition (2-3 sentences) that:
1. Celebrates completing the previous step
2. Naturally introduces the next step as a logical progression
3. Makes the content flow feel seamless and connected
4. Builds excitement for the new learning ahead

Create a smooth bridge that makes this feel like one continuous lesson, not two separate topics."""
        else:
            prompt = f"""You are a P6 math tutor. The student just answered correctly.

CURRENT SECTION TYPE: {current_type}
NEXT SECTION TYPE: {next_type}

Generate a brief encouraging response (1-2 sentences) that:
1. Celebrates their correct answer
2. Naturally transitions to the next section
3. Is warm and supportive

Then I'll add the next section content."""

        try:
            response = self.model.generate_content(prompt)
            encouragement = response.text.strip()
            # Include the next section content for a complete transition
            return f"{encouragement}\\n\\n{next_content}"
        except Exception as e:
            print(f"❌ CRITICAL: Error generating transition: {e}")
            raise Exception(f"AI failed to generate transition message: {e}")
    
    def _generate_explanation_and_advance(self, detailed_explanation: str, 
                                        current_section_id: str, next_section_id: str) -> str:
        """Generate explanation after max attempts and advance"""
        if not self.model:
            raise Exception("AI model is required for explanation and advancement but not available.")
        
        current_section = self.get_section_by_id(current_section_id)
        current_type = current_section.get('type', '')
        
        if next_section_id:
            next_section = self.get_section_by_id(next_section_id)
            next_type = next_section.get('type', '')
            next_text = next_section.get('text', '')
            next_question = next_section.get('question', '')
            
            # Handle worked examples for next section
            if next_type == 'worked_example':
                demo_problem = next_section.get('demonstration_problem', '')
                solution_steps = next_section.get('solution_steps', [])
                demo_answer = next_section.get('demonstration_answer', '')
                steps_text = "\\n".join(solution_steps) if solution_steps else ""
                
                next_content = f"""{next_text}

**Problem: {demo_problem}**

**Solution:**
{steps_text}

**Answer: {demo_answer}**

Now it's your turn! **{next_question}**"""
            else:
                next_content = f"{next_text} **{next_question}**"
            
            # Handle completion sections differently
            if next_type == 'completion':
                prompt = f"""You are a P6 math tutor. The student has tried multiple times but hasn't gotten the correct answer.

DETAILED EXPLANATION: {detailed_explanation}

Generate a natural response that:
1. Provides the explanation in a conversational way
2. Encourages the student despite the difficulty  
3. Acknowledges their learning progress
4. Stays warm and supportive

Do NOT mention moving to the next section - just provide the explanation and encouragement."""
            else:
                prompt = f"""You are a P6 math tutor. The student has tried multiple times but hasn't gotten the correct answer.

CURRENT SECTION TYPE: {current_type}
DETAILED EXPLANATION: {detailed_explanation}
NEXT SECTION TYPE: {next_type}

Generate a natural response that:
1. Provides the explanation in a conversational way
2. Encourages the student despite the difficulty
3. Smoothly transitions to the next section
4. Stays warm and supportive

Then I'll add the next section content."""

            try:
                response = self.model.generate_content(prompt)
                ai_explanation = response.text.strip()
                # Include the next section content for a complete transition
                return f"{ai_explanation}\\n\\n{next_content}"
            except Exception as e:
                print(f"❌ CRITICAL: Error generating explanation: {e}")
                raise Exception(f"AI failed to generate explanation: {e}")
        else:
            # Final section completion
            prompt = f"""You are a P6 math tutor. The student has completed all {self.topic} sections.

DETAILED EXPLANATION: {detailed_explanation}

Generate a natural response that:
1. Provides the final explanation conversationally
2. Celebrates their completion of all sections
3. Is warm and encouraging
4. Acknowledges their learning journey

Keep it brief but meaningful."""

            try:
                response = self.model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                print(f"❌ CRITICAL: Error generating completion: {e}")
                raise Exception(f"AI failed to generate completion message: {e}")
    
    def _generate_hint_response(self, student_answer: str, section_content: Dict, 
                              emotional_intelligence: Dict = None) -> str:
        """Generate helpful hint based on student's incorrect response"""
        if not self.model:
            return f"That's not quite right. Let me give you a hint: {section_content.get('exact_detailed_explanation', 'Try thinking about it step by step.')}"
        
        section_question = section_content.get('question', '')
        sample_correct = section_content.get('sample_correct_response', '')
        detailed_explanation = section_content.get('exact_detailed_explanation', '')
        
        # Build emotional intelligence context if available
        ei_context = ""
        if emotional_intelligence:
            ei_context = self._build_emotional_context(emotional_intelligence)
        
        prompt = f"""You are a supportive P6 math tutor. The student gave an incorrect answer.

QUESTION: {section_question}
STUDENT'S INCORRECT ANSWER: "{student_answer}"
CORRECT ANSWER SHOULD BE SIMILAR TO: "{sample_correct}"
DETAILED EXPLANATION: {detailed_explanation}

{ei_context}

Generate a helpful hint that:
1. Acknowledges their attempt positively
2. Gives a specific hint (don't give the full answer)
3. Asks them to try again
4. Is encouraging and age-appropriate

Keep it brief and supportive."""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"❌ Error generating hint: {e}")
            return f"That's not quite right, but good try! Here's a hint: {detailed_explanation[:100]}... Can you try again?"
    
    def _build_emotional_context(self, emotional_intelligence: Dict) -> str:
        """Build emotional intelligence context for AI prompt (kept for future use)"""
        if not emotional_intelligence:
            return ""
        
        response_time = emotional_intelligence.get('response_time')
        consecutive_errors = emotional_intelligence.get('consecutive_errors', 0)
        confidence = emotional_intelligence.get('confidence_indicators', {})
        struggling = emotional_intelligence.get('struggling_pattern', False)
        
        context_parts = ["EMOTIONAL INTELLIGENCE CONTEXT:"]
        
        if response_time and response_time > 45000:  # >45 seconds
            context_parts.append("⏰ Student took a long time - likely struggling or overthinking")
            context_parts.append("→ ADAPTATION: Use extra encouragement and simpler language")
        
        if consecutive_errors >= 2:
            context_parts.append("❌ Student has made multiple errors - may be frustrated")
            context_parts.append("→ ADAPTATION: Be extra encouraging and supportive")
        
        confidence_level = confidence.get('level', 'medium')
        if confidence_level == 'low':
            context_parts.append("😰 Student seems uncertain - low confidence detected")
            context_parts.append("→ ADAPTATION: Build confidence with process praise")
        
        if struggling:
            context_parts.append("🆘 Struggling pattern detected")
            context_parts.append("→ ADAPTATION: Maximum encouragement needed")
        
        if len(context_parts) == 1:  # Only header
            return ""
        
        return "\\n".join(context_parts) + "\\n"
    
    def _generate_encouragement_and_transition(self, detailed_explanation: str, current_section_id: str, next_section_id: str) -> str:
        """Generate encouragement for 'no' response in completion section, then transition to next step"""
        if not self.model:
            next_section_message = self._generate_section_message(next_section_id)
            return f"That's perfectly fine! {detailed_explanation} {next_section_message}"
        
        current_section = self.get_section_by_id(current_section_id)
        next_section = self.get_section_by_id(next_section_id)
        
        current_text = current_section.get('text', '')
        next_text = next_section.get('text', '')
        next_question = next_section.get('question', '')
        next_type = next_section.get('type', '')
        
        # Handle worked examples for next section
        if next_type == 'worked_example':
            demo_problem = next_section.get('demonstration_problem', '')
            solution_steps = next_section.get('solution_steps', [])
            demo_answer = next_section.get('demonstration_answer', '')
            steps_text = "\\n".join(solution_steps) if solution_steps else ""
            
            next_content = f"""{next_text}

**Problem: {demo_problem}**

**Solution:**
{steps_text}

**Answer: {demo_answer}**

Now it's your turn! **{next_question}**"""
        else:
            next_content = f"{next_text} **{next_question}**"
        
        prompt = f"""You are a P6 math tutor. The student just completed a step but says they don't feel confident yet.

CURRENT STEP COMPLETED: {current_text}
ENCOURAGEMENT GUIDANCE: {detailed_explanation}
NEXT STEP CONTENT: {next_text}

Generate ONE cohesive response that:
1. Acknowledges their honesty - it's perfectly okay to feel that way
2. Reassures them they've done great to reach this far
3. Mentions they'll get plenty of practice opportunities to build confidence
4. Naturally introduces the next step as a logical progression 
5. Ends with the next step question seamlessly integrated

Make it feel like one natural conversation, not two separate messages. The transition should be so smooth that moving to the next step feels like the obvious next thing to do."""

        try:
            response = self.model.generate_content(prompt)
            # Return the complete cohesive response (no need to append next_content)
            return response.text.strip()
        except Exception as e:
            print(f"❌ Error generating encouragement transition: {e}")
            # Fallback: create a natural single message
            return f"That's perfectly fine! {detailed_explanation} You've done great to reach this far, and you'll get plenty of practice opportunities. Now, let's build on what you learned - {next_text.lower()} **{next_question}**"
    
    def generate_practice_review_message(self, completed_count: int, in_progress_count: int, total_attempted: int) -> str:
        """Generate AI-powered practice review message based on student progress"""
        if not self.model:
            raise Exception("AI model is required for practice review but not available.")
        
        prompt = f"""You are a friendly P6 math tutor reviewing a student's {self.topic} practice progress.

STUDENT'S PRACTICE PROGRESS:
- Completed problems: {completed_count}
- Problems in progress: {in_progress_count}  
- Total problems attempted: {total_attempted}

Generate a warm, encouraging message (2-3 sentences) that acknowledges their progress and motivates continued practice."""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"❌ CRITICAL: Error generating practice review: {e}")
            raise Exception(f"AI failed to generate practice review: {e}")
    
    # Legacy methods kept for backward compatibility but simplified
    def get_step_summary(self, step: int) -> Dict:
        """Get summary information about a learning step (legacy compatibility)"""
        return {
            "concept": f"step_{step}",
            "title": f"{self.topic.title()} Step {step}",
            "description": "Sequential JSON-based learning",
            "examples": [],
            "prompts": []
        }
    
    # Kept for future practice mode integration
    def analyze_misconceptions(self, student_answer: str, conversation_history: List[Dict]) -> Dict:
        """Analyze potential misconceptions (kept for practice mode)"""
        misconceptions = {
            'detected': [],
            'interventions': [],
            'risk_level': 'low'
        }
        
        student_answer_lower = student_answer.lower().strip()
        
        # Common misconceptions (can be customized per topic)
        if any(word in student_answer_lower for word in ['multiply', 'times', '*']):
            if 'divide' in conversation_history[-1].get('message', '').lower():
                misconceptions['detected'].append("confusing_operations")
                misconceptions['interventions'].append("Clarify division vs multiplication")
        
        if any(word in student_answer_lower for word in ['flip', 'reciprocal']):
            # Check if they're applying reciprocal incorrectly
            misconceptions['detected'].append("reciprocal_confusion")
            misconceptions['interventions'].append("Review reciprocal concept")
        
        if len(misconceptions['detected']) >= 1:
            misconceptions['risk_level'] = 'medium'
        
        return misconceptions