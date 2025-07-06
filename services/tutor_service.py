"""
AI Tutor service for problem solving assistance.
"""
import json
from typing import Dict, List
import google.generativeai as genai
from config.settings import Config


class TutorService:
    """Service class for AI tutoring functionality."""
    
    def __init__(self):
        genai.configure(api_key=Config.GOOGLE_API_KEY)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
    
    def evaluate_answer(self, problem: Dict, chat_history: List[Dict], emotional_intelligence: Dict = None) -> Dict:
        """
        Evaluate a student's answer using AI and provide appropriate feedback.
        
        Args:
            problem: The problem data including problem_text, verified_answer, etc.
            chat_history: The conversation history between student and tutor
            emotional_intelligence: Dict containing emotional state data
            
        Returns:
            Dict containing is_correct boolean and feedback object
        """
        if not self.model:
            raise RuntimeError("AI Model not configured")

        # --- EMOTIONAL INTELLIGENCE PROCESSING ---
        print(f"\n🧠 PRACTICE MODE - EMOTIONAL INTELLIGENCE RECEIVED:")
        if emotional_intelligence:
            print(f"   Response Time: {emotional_intelligence.get('response_time', 'N/A')}ms")
            print(f"   Consecutive Errors: {emotional_intelligence.get('consecutive_errors', 0)}")
            print(f"   Avg Response Time: {emotional_intelligence.get('avg_response_time', 'N/A')}ms")
            print(f"   Confidence Level: {emotional_intelligence.get('confidence_indicators', {}).get('level', 'N/A')}")
            print(f"   Struggling Pattern: {emotional_intelligence.get('struggling_pattern', False)}")
            
            # Build emotional context for AI
            emotional_context = self._build_emotional_context_for_practice(emotional_intelligence)
        else:
            print(f"   No EI data received (first interaction)")
            emotional_context = ""

        # --- MISCONCEPTION PREDICTION ---
        # Get the latest student response from chat history
        latest_student_response = ""
        if chat_history:
            for msg in reversed(chat_history):
                if msg.get('role') == 'user':
                    latest_student_response = msg.get('parts', [''])[0]
                    break
        
        # AI-powered misconception prediction
        misconception_context = self._predict_misconceptions_ai(
            latest_student_response, problem, chat_history)

        # Construct the AI examiner prompt
        examiner_prompt = f"""
        You are an expert PSLE Mathematics examiner and tutor. Your task is to analyze a student's conversation and determine if they have solved the problem correctly, then provide the appropriate response.

        --- CONTEXT ---
        PROBLEM: {problem['problem_text']}
        VERIFIED ANSWER: "{problem['verified_answer']}"
        VERIFIED METHODOLOGY: {problem['verified_methodology']}
        CHAT HISTORY (User and your previous responses): {json.dumps(chat_history, indent=2)}
        
        {emotional_context}
        
        {misconception_context}
        --- END CONTEXT ---

        --- YOUR TASK ---
        Analyze all the information above.
        1.  Determine if the student's conversation and latest input prove they have fully solved the problem and arrived at the verified answer. They do not need to have typed the answer verbatim, but their reasoning and result must be correct.
        2.  Based on your determination, generate a JSON response with two keys:
            - "is_final_answer_correct": A boolean (true or false).
            - "feedback": An object containing your response, with keys "encouragement" and "socratic_question".
        3.  If the student is correct, set "is_final_answer_correct" to true, and write a varied, positive congratulatory message in the "encouragement" field. The "socratic_question" should be an empty string.
        4.  If the student is NOT correct, set "is_final_answer_correct" to false, and generate an encouraging, Socratic hint to guide them to their *next* logical step based on where they are in the methodology.

        IMPORTANT: Your entire response must be ONLY the single, valid JSON object.
        """

        try:
            response = self.model.generate_content(examiner_prompt)
            ai_response_json = json.loads(response.text.replace('```json', '').replace('```', '').strip())
            
            # Trust the AI's judgment on correctness
            is_correct = ai_response_json.get("is_final_answer_correct", False)
            
            return {
                "is_correct": is_correct,
                "feedback": ai_response_json.get("feedback", {})
            }

        except Exception as e:
            print(f"An error occurred during AI generation: {e}")
            # Return a fallback response
            return {
                "is_correct": False,
                "feedback": {
                    "encouragement": "I'm having a little trouble thinking.",
                    "socratic_question": "Can you try rephrasing?"
                }
            }
    
    def format_feedback_for_history(self, feedback: Dict, is_correct: bool) -> Dict:
        """Format feedback for saving to chat history."""
        if is_correct:
            return {
                'role': 'model',
                'parts': [feedback['encouragement']]
            }
        else:
            return {
                'role': 'model',
                'parts': [json.dumps(feedback)]
            }
    
    def _build_emotional_context_for_practice(self, emotional_intelligence: Dict) -> str:
        """Build emotional intelligence context for practice mode AI prompt"""
        if not emotional_intelligence:
            return ""
        
        # Extract emotional intelligence data
        response_time = emotional_intelligence.get('response_time')
        consecutive_errors = emotional_intelligence.get('consecutive_errors', 0)
        confidence = emotional_intelligence.get('confidence_indicators', {})
        struggling = emotional_intelligence.get('struggling_pattern', False)
        
        # Build context based on emotional state
        context_parts = ["EMOTIONAL INTELLIGENCE DATA:"]
        
        # Response time analysis
        if response_time:
            if response_time > 45000:  # >45 seconds
                context_parts.append("⏰ SLOW RESPONSE: Student took over 45 seconds - likely struggling or overthinking")
                context_parts.append("→ ADAPTATION: Use more encouragement, simpler language, break down steps")
            elif response_time < 5000:  # <5 seconds
                context_parts.append("⚡ QUICK RESPONSE: Student answered very quickly - might be guessing")
                context_parts.append("→ ADAPTATION: Ask follow-up questions to verify understanding")
        
        # Error pattern analysis
        if consecutive_errors >= 3:
            context_parts.append("❌ HIGH ERROR RATE: Student has made 3+ consecutive errors")
            context_parts.append("→ ADAPTATION: Use maximum encouragement, consider reviewing fundamentals")
        elif consecutive_errors >= 2:
            context_parts.append("⚠️ MULTIPLE ERRORS: Student struggling with current concept")
            context_parts.append("→ ADAPTATION: Provide gentler hints, use different examples")
        
        # Confidence analysis
        confidence_level = confidence.get('level', 'medium')
        if confidence_level == 'low':
            indicators = ', '.join(confidence.get('indicators', []))
            context_parts.append(f"😰 LOW CONFIDENCE: Student used uncertain language: {indicators}")
            context_parts.append("→ ADAPTATION: Build confidence with process praise, celebrate attempts")
        elif confidence_level == 'high':
            context_parts.append("😊 HIGH CONFIDENCE: Student seems confident in their response")
            context_parts.append("→ ADAPTATION: If correct, celebrate; if wrong, gently correct misconceptions")
        
        # Struggling pattern
        if struggling:
            context_parts.append("🆘 STRUGGLING PATTERN: Combination of slow responses and multiple errors")
            context_parts.append("→ CRITICAL: Use maximum encouragement, simplify approach, focus on building confidence")
        
        if len(context_parts) == 1:  # Only header
            return ""
        
        return "\n".join(context_parts) + "\n"
    
    def _predict_misconceptions_ai(self, student_response: str, problem: Dict, chat_history: List[Dict]) -> str:
        """AI-powered misconception prediction for practice problems"""
        if not student_response or not self.model:
            return ""
        
        try:
            # AI prompt for misconception prediction
            misconception_prompt = f"""You are an expert mathematics educator analyzing potential student misconceptions.

PROBLEM: {problem['problem_text']}
CORRECT ANSWER: {problem['verified_answer']}
STUDENT'S LATEST RESPONSE: "{student_response}"
CHAT HISTORY: {json.dumps(chat_history[-3:], indent=2) if chat_history else 'No previous responses'}

Analyze the student's response for potential misconceptions or error patterns.

Common math misconceptions to look for:
- Computational errors (arithmetic mistakes)
- Conceptual misunderstandings 
- Procedural errors (wrong method)
- Language/interpretation issues
- Order of operations mistakes
- Unit conversion errors
- Pattern recognition issues

Respond with ONLY a JSON object:
{{
    "misconceptions_detected": ["list of specific misconceptions"],
    "risk_level": "low" | "medium" | "high",
    "preventive_guidance": "specific advice for addressing these misconceptions",
    "intervention_needed": true | false
}}

If no concerning patterns detected, return:
{{"misconceptions_detected": [], "risk_level": "low", "preventive_guidance": "", "intervention_needed": false}}
"""

            response = self.model.generate_content(misconception_prompt)
            
            # Parse response
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            misconception_result = json.loads(response_text)
            
            # Debug logging
            if misconception_result.get('misconceptions_detected'):
                print(f"🚨 AI MISCONCEPTION PREDICTION:")
                print(f"   Student Response: '{student_response}'")
                print(f"   Detected Issues: {misconception_result.get('misconceptions_detected')}")
                print(f"   Risk Level: {misconception_result.get('risk_level')}")
                print(f"   Intervention Needed: {misconception_result.get('intervention_needed')}")
            else:
                print(f"✅ AI MISCONCEPTION PREDICTION: No concerning patterns detected")
            
            # Build context for main AI
            if misconception_result.get('misconceptions_detected'):
                context_parts = ["MISCONCEPTION PREDICTION ANALYSIS:"]
                context_parts.append(f"🚨 DETECTED ISSUES: {', '.join(misconception_result['misconceptions_detected'])}")
                context_parts.append(f"⚠️ RISK LEVEL: {misconception_result['risk_level'].upper()}")
                context_parts.append(f"→ PREVENTIVE GUIDANCE: {misconception_result['preventive_guidance']}")
                
                if misconception_result.get('intervention_needed'):
                    context_parts.append("🚨 INTERVENTION RECOMMENDED: Address misconceptions proactively")
                
                return "\n".join(context_parts) + "\n"
            
            return ""
            
        except Exception as e:
            print(f"Error in AI misconception prediction: {e}")
            return ""


# Global instance
tutor_service = TutorService()