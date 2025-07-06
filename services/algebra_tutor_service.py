"""
Algebra Tutor Service - Conversational tutoring following Singapore P6 syllabus
Based on the official syllabus progression from Algebra-syllabus.png
"""

import json
from typing import Dict, List, Tuple, Optional
import google.generativeai as genai
from config.settings import Config

class AlgebraTutorService:
    """
    A conversational algebra tutor that follows Singapore P6 syllabus progression:
    1. Using letters to represent unknown numbers (□ to letters)
    2. Simple algebraic expressions (a ÷ 3, a × 3, a + 3)
    3. Simplifying expressions (excluding brackets)
    4. Evaluating expressions by substitution
    5. Solving simple linear equations with whole number coefficients
    """
    
    def __init__(self):
        if not Config.GOOGLE_API_KEY:
            print("WARNING: No GOOGLE_API_KEY found. Algebra tutor will use fallback responses only.")
            self.model = None
        else:
            genai.configure(api_key=Config.GOOGLE_API_KEY)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Define the learning progression based on P6 syllabus
        self.learning_steps = {
            1: {
                "concept": "boxes_to_letters",
                "title": "From Boxes to Letters",
                "description": "Understanding that letters can represent unknown numbers, just like boxes",
                "examples": ["□ + 4 = 10", "a + 4 = 10"],
                "prompts": [
                    "Have you ever seen a problem like this: □ + 4 = 10?",
                    "Instead of boxes, mathematicians use letters like 'a' or 'x'. So: a + 4 = 10. What is a?"
                ]
            },
            2: {
                "concept": "simple_expressions",
                "title": "Simple Algebraic Expressions", 
                "description": "Working with expressions like a ÷ 3, a × 3, 3a, and a + 3",
                "examples": ["x + 5 = 12", "2y = 14", "n ÷ 3 = 4"],
                "prompts": [
                    "Let's try: x + 5 = 12. What is x?",
                    "Now with multiplication: 2y = 14. This means 2 times y equals 14. What is y?",
                    "Division: n ÷ 3 = 4. What number divided by 3 equals 4?"
                ]
            },
            3: {
                "concept": "substitution",
                "title": "Substitution",
                "description": "Finding the value of expressions when we know what the letter represents",
                "examples": ["If a = 5, find a + 3", "If x = 7, find 2x - 1"],
                "prompts": [
                    "If a = 5, what is a + 3?",
                    "If x = 7, what is 2x? And what is 2x - 1?"
                ]
            },
            4: {
                "concept": "word_problems",
                "title": "Word Problems with Visual Models",
                "description": "Solving real-world problems using algebra with bar models or diagrams",
                "examples": [
                    "There are 50 children in a dance group. If there are 10 more boys than girls, how many girls are there?",
                    "Sara has some stickers. After giving 8 to her friend, she has 15 left. How many did she start with?"
                ],
                "prompts": [
                    "Let's solve a real problem: 'There are some children in a class. If 5 more join, there will be 23 total.' Can you write this as an equation?",
                    "Here's another: 'Ahmad bought some books. After reading 3, he has 7 left.' What equation represents this?"
                ]
            }
        }
    
    def get_conversation_starter(self) -> str:
        """Get the initial conversation starter message"""
        return ("Hi! I'm your algebra tutor. Today we're going to learn about using letters to represent "
                "numbers we don't know yet. Have you ever seen a problem like this: □ + 4 = 10?")
    
    def generate_tutor_response(self, student_answer: str, conversation_history: List[Dict], 
                              current_step: int = 1, emotional_intelligence: Dict = None) -> Tuple[str, int, bool]:
        """
        Generate a tutor response based on student input and current learning step.
        
        Args:
            student_answer: The student's response
            conversation_history: Previous conversation messages
            current_step: Current learning step (1-4)
            emotional_intelligence: Dict containing emotional state data
            
        Returns:
            Tuple of (response_message, new_step, should_advance)
        """
        
        # DEBUG: Method entry logging
        print(f"\n🎯 GENERATE_TUTOR_RESPONSE CALLED:")
        print(f"   Student Answer: '{student_answer}'")
        print(f"   EI Data Passed: {bool(emotional_intelligence)}")
        
        # Check if AI is available
        if not self.model:
            print("No AI model available, using fallback response")
            return self._get_fallback_response(student_answer, current_step)
        
        # Use AI to analyze student understanding and generate appropriate response
        prompt = self._build_analysis_prompt(student_answer, conversation_history, current_step, emotional_intelligence or {})
        
        try:
            response = self.model.generate_content(prompt)
            print(f"Raw AI response: {response.text}")  # Debug logging
            
            # Try to clean up the response if it has markdown formatting
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]  # Remove ```json
            if response_text.endswith('```'):
                response_text = response_text[:-3]  # Remove ```
            response_text = response_text.strip()
            
            ai_analysis = json.loads(response_text)
            print(f"Parsed AI analysis: {ai_analysis}")  # Debug logging
            
            # Extract response components
            tutor_message = ai_analysis.get('tutor_response', '')
            new_step = ai_analysis.get('next_step', current_step)
            shows_understanding = ai_analysis.get('shows_understanding', False)
            
            # Critical fix: Check if tutor is asking a question that needs an answer
            question_patterns = ['?', 'what is', 'how many', 'can you tell me', 'what would', 'how would you']
            asking_question = any(pattern in tutor_message.lower() for pattern in question_patterns)
            
            # If we're asking a question, student hasn't shown complete understanding yet
            if asking_question:
                shows_understanding = False
            
            # Add visual elements if appropriate
            if 'equation' in ai_analysis:
                equation_html = f'<div class="equation-box">{ai_analysis["equation"]}</div>'
                tutor_message += equation_html
            
            if 'visual' in ai_analysis and ai_analysis['visual']:
                visual_html = f'<div class="math-visual">{ai_analysis["visual"]}</div>'
                tutor_message += visual_html
                
            return tutor_message, new_step, shows_understanding
            
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            print(f"Raw response was: {response.text if 'response' in locals() else 'No response'}")
            # Fallback to rule-based response
            return self._get_fallback_response(student_answer, current_step)
        except Exception as e:
            print(f"General error in AI generation: {e}")
            # Fallback to rule-based response
            return self._get_fallback_response(student_answer, current_step)
    
    def _build_analysis_prompt(self, student_answer: str, conversation_history: List[Dict], 
                              current_step: int, emotional_intelligence: Dict) -> str:
        """Build prompt for AI analysis of student response"""
        
        current_step_info = self.learning_steps.get(current_step, self.learning_steps[1])
        
        conversation_context = "\n".join([
            f"{msg.get('sender', 'unknown')}: {msg.get('message', '')}" 
            for msg in conversation_history[-6:]  # Last 6 messages for context
        ])
        
        # Build emotional intelligence context
        emotional_context = self._build_emotional_context(emotional_intelligence)
        
        # Debug logging for emotional intelligence
        if emotional_intelligence:
            print(f"🧠 EMOTIONAL INTELLIGENCE RECEIVED:")
            print(f"   Response Time: {emotional_intelligence.get('response_time', 'N/A')}ms")
            print(f"   Consecutive Errors: {emotional_intelligence.get('consecutive_errors', 0)}")
            print(f"   Avg Response Time: {emotional_intelligence.get('avg_response_time', 'N/A')}ms")
            print(f"   Confidence Level: {emotional_intelligence.get('confidence_indicators', {}).get('level', 'N/A')}")
            print(f"   Struggling Pattern: {emotional_intelligence.get('struggling_pattern', False)}")
        else:
            print("📊 EMOTIONAL INTELLIGENCE: No data received (first interaction)")
        
        # Predict potential misconceptions
        misconceptions = self._predict_misconceptions(student_answer, current_step, conversation_history)
        misconception_context = self._build_misconception_context(misconceptions)
        
        # Debug logging for misconception prediction
        if misconceptions['detected']:
            print(f"🚨 MISCONCEPTION PREDICTION: Detected {len(misconceptions['detected'])} potential issues:")
            for i, misconception in enumerate(misconceptions['detected']):
                intervention = misconceptions['interventions'][i] if i < len(misconceptions['interventions']) else "Provide clarification"
                print(f"   - {misconception}: {intervention}")
            print(f"   Risk Level: {misconceptions['risk_level']}")
        else:
            print("✅ MISCONCEPTION PREDICTION: No concerning patterns detected")
        
        prompt = f"""You are a friendly P6 math tutor teaching algebra step-by-step to an 11-year-old student.

CURRENT STEP: {current_step_info['title']} (Step {current_step} of 4)
RECENT CONVERSATION CONTEXT:
{conversation_context}

STUDENT'S LATEST RESPONSE: "{student_answer}"

{emotional_context}

{misconception_context}

LEARNING PROGRESSION:
Step 1: Using boxes □ → letters (a, x, y) to represent unknowns
Step 2: Simple expressions like a + 4 = 10, x + 5 = 12, 2y = 14  
Step 3: Substitution - finding values when we know what the letter represents
Step 4: Real-world word problems with algebraic thinking (FINAL STEP before practice problems)

IMPORTANT: Analyze the student's response carefully:
- If they answered "yes/no" to a question, ask them to solve the actual problem
- If they gave a correct number answer, celebrate and IMMEDIATELY introduce the next concept
- If they seem confused, give a helpful hint but stay on current step
- When they show understanding, advance to the next step with a new concept

EXAMPLES OF GOOD RESPONSES:
- Student answers "6" to □ + 4 = 10: "🎉 Excellent! You got it right - the box equals 6! Now here's something cool: instead of boxes □, mathematicians use letters like 'a' or 'x'. So we can write: a + 4 = 10. What do you think 'a' equals?"
- Student answers "6" to a + 4 = 10: "Perfect! You understand that letters work just like boxes. Let's try another: x + 5 = 12. What is x?"
- Student writes "x + 5 = 23" for word problem: "🎉 Fantastic! You wrote the equation perfectly! Now solve it: What is x?" (shows_understanding = false because asking question)
- Student answers "18" to "What is x?": "Perfect! You've mastered all the algebra basics - from boxes to letters to word problems! You're ready to try some practice problems on your own!" (shows_understanding = true, includes natural transition)

STEP ADVANCEMENT RULES:
- Step 1 to 2: When student correctly solves □ + 4 = 10 (answer is 6), celebrate and introduce letters: "Great! Now let's use letters instead of boxes: a + 4 = 10. What is a?"
- Step 2 to 3: When student solves letter equations correctly, introduce substitution concepts  
- Step 3 to 4: When student handles substitution correctly, introduce word problems with specific question
- Step 4 has TWO parts: (a) Student writes equation correctly, (b) Student solves for the variable
- Step 4 to completion: Only after student completes BOTH parts of the word problem

CRITICAL RULES:
1. If student just answered correctly, celebrate first, then ask the NEXT question
2. Do NOT ask a question and then immediately jump to practice problems
3. Give students time to answer each question before moving on
4. Must complete ALL 4 steps before considering practice problems
5. At step 3, if student answers substitution correctly, move to step 4 with actual word problem
6. Only declare readiness for practice problems after step 4 completion

QUESTION DETECTION RULE:
- If your response ends with a question mark (?), you MUST set "shows_understanding": false
- If you ask "What is x?" or "How many children..." you are waiting for an answer
- Only set "shows_understanding": true when student has fully completed the concept

Respond with ONLY a JSON object:

{{
    "shows_understanding": true or false (FALSE if you ask any question that needs an answer),
    "tutor_response": "Your response to the student (either celebrate + ask next question, or give encouragement)",
    "next_step": {current_step + 1 if current_step < 4 else current_step} (advance only when student demonstrates understanding),
    "asked_question": true or false (true if your response contains a question for the student to answer)
}}

IMPORTANT: 
- Step 3: If you ask a substitution question like "If a = 4, what is a + 5?", wait for their answer, then move to Step 4
- Step 4: Give them an actual word problem to solve, wait for answer, THEN they're ready for practice problems
- When student completes Step 4 successfully, celebrate AND tell them they're ready for practice problems
- Include natural transition like "You're ready to try some practice problems on your own!" in your response
- Do NOT jump to practice problems until they complete Step 4!
- If you ask ANY question, set shows_understanding to FALSE until they answer it"""
        
        return prompt
    
    def _get_fallback_response(self, student_answer: str, current_step: int) -> Tuple[str, int, bool]:
        """Improved fallback response when AI is unavailable"""
        
        step_info = self.learning_steps.get(current_step, self.learning_steps[1])
        answer_lower = student_answer.lower()
        
        if current_step == 1:
            # Teaching boxes to letters
            if '6' in student_answer or 'six' in answer_lower:
                return ("🎉 Excellent! You're absolutely right - the box equals 6! "
                       "Now here's the cool part: instead of using boxes □, mathematicians use letters like 'a' or 'x'. "
                       "So we can write the same problem as: a + 4 = 10. What do you think 'a' equals?"), 2, True
            elif answer_lower in ['yes', 'yeah', 'yep', 'y']:
                return ("Great! Since you've seen this before, let's solve it together. "
                       "What number should go in the box to make □ + 4 = 10 true?"), 1, False
            elif answer_lower in ['no', 'nope', 'n']:
                return ("No worries! Let's learn together. Look at this: □ + 4 = 10. "
                       "We need to find what number plus 4 equals 10. Can you figure it out?"), 1, False
            else:
                return ("Let's think about this together! If □ + 4 = 10, what number do we need to add to 4 to get 10? "
                       "Try counting up from 4: 4 + ? = 10"), 1, False
        
        elif current_step == 2:
            # Understanding letters as variables  
            if '6' in student_answer or 'six' in answer_lower:
                return ("Perfect! Whether we use □ or the letter 'a', the answer is still 6. You're getting algebra! "
                       "Let's try another one: x + 3 = 8. What is x?"), 3, True
            else:
                return ("Think of the letter 'a' as just another way to write □. "
                       "So a + 4 = 10 is exactly the same as □ + 4 = 10. What number makes this true?"), 2, False
        
        elif current_step == 3:
            # More practice with equations
            if '5' in student_answer or 'five' in answer_lower:
                return ("Fantastic! You're really getting the hang of this! Now let's try something with multiplication: "
                       "2y = 12. This means 2 times y equals 12. What is y?"), 4, True
            else:
                return ("Let's break it down: x + 3 = 8. We need a number that when we add 3 to it gives us 8. "
                       "What number plus 3 equals 8?"), 3, False
        
        elif current_step == 4:
            # Word problems
            if any(word in answer_lower for word in ['18', 'x+5=23', 'x + 5 = 23', 'eighteen']):
                return ("🎉 Excellent! You got it! If there are 18 children originally, and 5 more join, that makes 18 + 5 = 23 total. "
                       "You've mastered all the basics of algebra! You're ready for practice problems now."), 5, True
            else:
                return ("Let's think step by step. We start with some unknown number of children (let's call it 'x'). "
                       "Then 5 more join. So we have x + 5 = 23. What is x?"), 4, False
        
        elif current_step >= 5:
            # Ready for practice problems
            return ("You've completed all the algebra basics! Time for practice problems.", current_step, True)
        
        else:
            return ("You're doing great! Keep practicing these algebra concepts. "
                   "Remember: letters in math represent unknown numbers, just like boxes did!"), current_step, False
    
    def get_step_summary(self, step: int) -> Dict:
        """Get summary information about a learning step"""
        return self.learning_steps.get(step, self.learning_steps[1])
    
    def evaluate_readiness_for_problems(self, conversation_history: List[Dict]) -> bool:
        """
        Evaluate if student is ready to move from tutoring to practice problems
        Note: This method is deprecated in favor of route-level evaluation using shows_understanding flag
        """
        # Simple check - just ensure they've reached step 4
        max_step = max([msg.get('step', 1) for msg in conversation_history], default=1)
        return max_step >= 4
    
    def generate_practice_transition(self) -> str:
        """Generate message to transition student to practice problems"""
        # Deprecated: Now handled by AI in the main response
        return ""
    
    def _build_emotional_context(self, emotional_intelligence: Dict) -> str:
        """Build emotional intelligence context for AI prompt"""
        if not emotional_intelligence:
            return ""
        
        # Extract emotional intelligence data
        response_time = emotional_intelligence.get('response_time')
        consecutive_errors = emotional_intelligence.get('consecutive_errors', 0)
        avg_response_time = emotional_intelligence.get('avg_response_time')
        confidence = emotional_intelligence.get('confidence_indicators', {})
        struggling = emotional_intelligence.get('struggling_pattern', False)
        
        # Build context based on emotional state
        context_parts = ["EMOTIONAL INTELLIGENCE DATA:"]
        
        # Response time analysis
        if response_time:
            if response_time > 45000:  # >45 seconds
                context_parts.append("⏰ SLOW RESPONSE: Student took over 45 seconds to respond - likely struggling or overthinking")
                context_parts.append("→ ADAPTATION: Provide encouragement, break down into smaller steps, use simpler language")
            elif response_time < 5000:  # <5 seconds
                context_parts.append("⚡ QUICK RESPONSE: Student answered very quickly - might be guessing or very confident")
                context_parts.append("→ ADAPTATION: Verify understanding with follow-up question")
        
        # Error pattern analysis
        if consecutive_errors >= 3:
            context_parts.append("❌ HIGH ERROR RATE: Student has made 3+ consecutive errors - showing signs of frustration")
            context_parts.append("→ ADAPTATION: Use more encouragement, provide hints, consider stepping back to review basics")
        elif consecutive_errors >= 2:
            context_parts.append("⚠️ MULTIPLE ERRORS: Student struggling with current concept")
            context_parts.append("→ ADAPTATION: Provide gentle hints, use different approach or examples")
        
        # Confidence analysis
        confidence_level = confidence.get('level', 'medium')
        if confidence_level == 'low':
            indicators = ', '.join(confidence.get('indicators', []))
            context_parts.append(f"😰 LOW CONFIDENCE: Student used uncertain language: {indicators}")
            context_parts.append("→ ADAPTATION: Build confidence with process praise, smaller steps, celebrate attempts")
        elif confidence_level == 'high':
            context_parts.append("😊 HIGH CONFIDENCE: Student seems confident in their response")
            context_parts.append("→ ADAPTATION: If correct, celebrate and challenge appropriately")
        
        # Struggling pattern
        if struggling:
            context_parts.append("🆘 STRUGGLING PATTERN DETECTED: Combination of slow responses and multiple errors")
            context_parts.append("→ CRITICAL ADAPTATION: Use maximum encouragement, simplify explanations, focus on building confidence")
        
        if len(context_parts) == 1:  # Only header
            return ""
        
        return "\n".join(context_parts) + "\n"
    
    def _predict_misconceptions(self, student_answer: str, current_step: int, conversation_history: List[Dict]) -> Dict:
        """Predict potential misconceptions based on student response patterns"""
        
        misconceptions = {
            'detected': [],
            'interventions': [],
            'risk_level': 'low'
        }
        
        student_answer_lower = student_answer.lower().strip()
        
        # Common algebra misconceptions by step
        if current_step == 1:  # Boxes to letters
            # Misconception: Thinking letters multiply
            if any(char.isalpha() and char.isdigit() for char in student_answer.replace(' ', '')):
                misconceptions['detected'].append("letter_multiplication_confusion")
                misconceptions['interventions'].append("Clarify that 'a' doesn't mean 'a × something'")
            
            # Misconception: Adding letters and numbers incorrectly
            if '+' in student_answer and any(c.isalpha() for c in student_answer):
                if not any(word in student_answer_lower for word in ['equals', '=']):
                    misconceptions['detected'].append("improper_variable_arithmetic")
                    misconceptions['interventions'].append("Review that letters are placeholders, not operations")
        
        elif current_step == 2:  # Simple expressions
            # Misconception: Concatenation instead of addition
            if any(student_answer.replace(' ', '') in pattern for pattern in ['45', '56', '67', '78', '89']):
                misconceptions['detected'].append("concatenation_error")
                misconceptions['interventions'].append("Prevent digit concatenation - emphasize proper addition")
            
            # Misconception: Wrong operation order
            if 'x' in student_answer_lower and any(op in student_answer for op in ['+', '-', '*', '/']):
                # Check for common operation confusion patterns
                for msg in conversation_history[-3:]:
                    if 'multiply' in msg.get('message', '').lower() and '+' in student_answer:
                        misconceptions['detected'].append("operation_confusion")
                        misconceptions['interventions'].append("Clarify difference between addition and multiplication")
        
        elif current_step == 3:  # Substitution
            # Misconception: Substituting incorrectly
            if any(char.isdigit() for char in student_answer) and any(char.isalpha() for char in student_answer):
                # Check if they're trying to substitute but keeping the variable
                if '=' in student_answer and len([c for c in student_answer if c.isalpha()]) > 0:
                    misconceptions['detected'].append("partial_substitution")
                    misconceptions['interventions'].append("Show that substitution means replacing the letter completely")
            
            # Misconception: Order of operations errors
            if any(op in student_answer for op in ['+', '-', '*', '/']) and len(student_answer.split()) > 2:
                misconceptions['detected'].append("order_of_operations_risk")
                misconceptions['interventions'].append("Review BODMAS/PEMDAS before proceeding")
        
        elif current_step == 4:  # Word problems
            # Misconception: Wrong equation setup
            if '=' in student_answer:
                # Check for common word problem setup errors
                if student_answer.count('=') > 1:
                    misconceptions['detected'].append("multiple_equals_confusion")
                    misconceptions['interventions'].append("Clarify that one equation has one equals sign")
                
                # Check for backwards equation setup
                parts = student_answer.split('=')
                if len(parts) == 2:
                    left, right = parts[0].strip(), parts[1].strip()
                    if right.count('+') > left.count('+') or len(right) > len(left):
                        misconceptions['detected'].append("backwards_equation_setup")
                        misconceptions['interventions'].append("Guide proper equation structure: unknown expression = known value")
        
        # Pattern-based predictions from conversation history
        recent_errors = []
        for msg in conversation_history[-5:]:
            if msg.get('sender') == 'student':
                answer = msg.get('message', '').lower()
                if any(word in answer for word in ['wrong', 'mistake', 'error', 'confused']):
                    recent_errors.append(answer)
        
        # Determine risk level
        if len(misconceptions['detected']) >= 2:
            misconceptions['risk_level'] = 'high'
        elif len(misconceptions['detected']) == 1 or len(recent_errors) >= 2:
            misconceptions['risk_level'] = 'medium'
        
        return misconceptions
    
    def _build_misconception_context(self, misconceptions: Dict) -> str:
        """Build misconception prediction context for AI prompt"""
        if not misconceptions['detected']:
            return ""
        
        context_parts = ["MISCONCEPTION PREDICTION ANALYSIS:"]
        
        # Add detected misconceptions
        for i, misconception in enumerate(misconceptions['detected']):
            intervention = misconceptions['interventions'][i] if i < len(misconceptions['interventions']) else "Provide clarification"
            
            misconception_descriptions = {
                'letter_multiplication_confusion': 'Student may think letters mean multiplication',
                'improper_variable_arithmetic': 'Student treating variables incorrectly in arithmetic',
                'concatenation_error': 'Student concatenating digits instead of adding (e.g., 4+5=45)',
                'operation_confusion': 'Student confusing addition and multiplication',
                'partial_substitution': 'Student not fully replacing variables with values',
                'order_of_operations_risk': 'Student may make BODMAS/PEMDAS errors',
                'multiple_equals_confusion': 'Student using multiple equals signs incorrectly',
                'backwards_equation_setup': 'Student setting up equation backwards'
            }
            
            description = misconception_descriptions.get(misconception, 'Unknown misconception')
            context_parts.append(f"⚠️ PREDICTED MISCONCEPTION: {description}")
            context_parts.append(f"→ PREVENTIVE ACTION: {intervention}")
        
        # Add risk level guidance
        risk_level = misconceptions['risk_level']
        if risk_level == 'high':
            context_parts.append("🚨 HIGH RISK: Multiple misconception indicators detected - use extra caution and clear explanations")
        elif risk_level == 'medium':
            context_parts.append("⚠️ MEDIUM RISK: Some misconception indicators - provide preventive clarification")
        
        context_parts.append("→ STRATEGY: Address potential misconceptions proactively before they become errors")
        
        return "\n".join(context_parts) + "\n"
    
    def generate_practice_review_message(self, completed_count: int, in_progress_count: int, total_attempted: int) -> str:
        """Generate AI-powered practice review message based on student progress"""
        
        # Check if AI is available
        if not self.model:
            print("No AI model available, using fallback practice review")
            return self._get_fallback_practice_review(completed_count, in_progress_count, total_attempted)
        
        # Build AI prompt for practice review
        prompt = f"""You are a friendly P6 math tutor reviewing a student's algebra practice progress.

STUDENT'S PRACTICE PROGRESS:
- Completed problems: {completed_count}
- Problems in progress: {in_progress_count}
- Total problems attempted: {total_attempted}

CONTEXT: The student has already learned the algebra basics through our tutoring system:
- Using letters (variables) to represent unknown numbers
- Writing and solving simple equations
- Substitution (putting numbers in place of letters)
- Solving word problems with algebraic thinking

Your task is to provide encouraging, personalized feedback about their practice progress.

GUIDELINES:
- Be encouraging and positive
- Reference their specific progress numbers naturally
- Connect their practice to the algebra concepts they learned
- Motivate them to continue practicing
- Keep it conversational and age-appropriate for 11-year-olds
- Be specific about what they're doing well
- If they haven't practiced much yet, encourage them to start

Generate a warm, encouraging message (2-3 sentences) that acknowledges their progress and motivates continued practice."""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
            
        except Exception as e:
            print(f"Error generating practice review with AI: {e}")
            return self._get_fallback_practice_review(completed_count, in_progress_count, total_attempted)
    
    def _get_fallback_practice_review(self, completed_count: int, in_progress_count: int, total_attempted: int) -> str:
        """Fallback practice review when AI is unavailable"""
        
        if total_attempted == 0:
            return ("Ready to put your algebra skills to work? You've mastered the basics - variables, equations, and problem-solving. "
                   "Time to tackle some real practice problems!")
                   
        elif completed_count >= 5:
            return (f"Outstanding! You've completed {completed_count} algebra problems. "
                   f"I can see you're really applying those variable and equation-solving skills we learned together!")
                   
        elif completed_count >= 2:
            return (f"Great work! You've solved {completed_count} problems successfully. "
                   f"You're showing real progress with your algebra skills!")
                   
        elif in_progress_count > 0:
            return (f"I see you're working through some problems - that's exactly how you build algebra strength! "
                   f"Remember: identify the unknown, use a variable, write an equation, and solve step by step.")
                   
        else:
            return ("You're ready to apply your algebra knowledge! Remember the process: variables, equations, and step-by-step solving. You've got this!")