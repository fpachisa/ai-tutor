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
    
    def evaluate_answer(self, problem: Dict, chat_history: List[Dict]) -> Dict:
        """
        Evaluate a student's answer using AI and provide appropriate feedback.
        
        Args:
            problem: The problem data including problem_text, verified_answer, etc.
            chat_history: The conversation history between student and tutor
            
        Returns:
            Dict containing is_correct boolean and feedback object
        """
        if not self.model:
            raise RuntimeError("AI Model not configured")

        # Construct the AI examiner prompt
        examiner_prompt = f"""
        You are an expert PSLE Mathematics examiner and tutor. Your task is to analyze a student's conversation and determine if they have solved the problem correctly, then provide the appropriate response.

        --- CONTEXT ---
        PROBLEM: {problem['problem_text']}
        VERIFIED ANSWER: "{problem['verified_answer']}"
        VERIFIED METHODOLOGY: {problem['verified_methodology']}
        CHAT HISTORY (User and your previous responses): {json.dumps(chat_history, indent=2)}
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


# Global instance
tutor_service = TutorService()