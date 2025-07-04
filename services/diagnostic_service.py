"""
Diagnostic quiz service.
"""
import json
import random
from typing import Dict, List
import google.generativeai as genai
from config.settings import Config


class DiagnosticService:
    """Service class for managing diagnostic quizzes."""
    
    def __init__(self):
        genai.configure(api_key=Config.GOOGLE_API_KEY)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
    
    def generate_quiz(self, grade: str = 'p6', subject: str = 'math') -> List[Dict]:
        """Generate a balanced diagnostic quiz using stratified sampling."""
        # Handle the actual filename which uses "maths" instead of "math"
        subject_name = 'maths' if subject == 'math' else subject
        quiz_file_path = f'problems/{grade}/{grade}_{subject_name}_diagnostic_quiz.json'
        
        try:
            with open(quiz_file_path, 'r', encoding='utf-8') as f:
                all_diagnostic_questions = json.load(f)

            # Step 1: Group questions by topic
            questions_by_topic = {}
            for q in all_diagnostic_questions:
                topic = q.get('topic', 'Unknown')
                if topic not in questions_by_topic:
                    questions_by_topic[topic] = []
                questions_by_topic[topic].append(q)

            final_quiz_questions = []
            topics_with_questions = list(questions_by_topic.keys())

            # Step 2: Randomly pick one question from each topic that has questions
            for topic in topics_with_questions:
                if questions_by_topic[topic]:
                    question = random.choice(questions_by_topic[topic])
                    final_quiz_questions.append(question)
            
            # Step 3: If we need more questions to reach 10, add more from any topic, ensuring no duplicates
            all_q_ids = {q['id'] for q in final_quiz_questions}
            while len(final_quiz_questions) < 10 and len(final_quiz_questions) < len(all_diagnostic_questions):
                # Pick a random question from the full list
                random_question = random.choice(all_diagnostic_questions)
                if random_question['id'] not in all_q_ids:
                    final_quiz_questions.append(random_question)
                    all_q_ids.add(random_question['id'])
            
            # Step 4: Shuffle the final list and return it
            random.shuffle(final_quiz_questions)
            
            return final_quiz_questions

        except Exception as e:
            print(f"An error occurred generating diagnostic quiz: {e}")
            raise
    
    def analyze_results(self, user_answers: List[Dict], grade: str = 'p6', subject: str = 'math') -> Dict:
        """Analyze diagnostic quiz results and provide personalized report."""
        if not user_answers:
            raise ValueError("No answers provided")

        # Handle the actual filename which uses "maths" instead of "math"
        subject_name = 'maths' if subject == 'math' else subject
        quiz_file_path = f'problems/{grade}/{grade}_{subject_name}_diagnostic_quiz.json'
        
        try:
            # Get the full question details for context
            with open(quiz_file_path, 'r', encoding='utf-8') as f:
                all_diagnostic_questions = {q['id']: q for q in json.load(f)}

            # Enrich the answers with question details
            detailed_results = []
            for answer in user_answers:
                question = all_diagnostic_questions.get(answer['question_id'])
                if question:
                    detailed_results.append({
                        "question": question.get('question'),
                        "topic": question.get('topic'),
                        "difficulty": question.get('difficulty'),
                        "is_correct": answer.get('is_correct')
                    })

            # Create the prompt for our AI Analyst
            report_generator_prompt = f"""
            You are an encouraging and insightful PSLE (Singapore Primary 6) Math educator.
            A student has just completed a 10-question diagnostic quiz.
            Your task is to analyze their results and provide a short, personalized report to encourage them to sign up.

            RULES:
            1. Be encouraging, even if the score is low but don't be overly sycophantic and zealous.
            2. Identify 1-2 topics as strengths (where the user answered correctly).
            3. Identify 1-2 topics as areas for improvement (where the user answered incorrectly).
            4. Provide a single, concise summary message.
            5. Recommend the single most important topic to start with.
            6. Your entire response MUST be a single, valid JSON object with no other text.

            Here are the student's detailed results:
            --- STUDENT RESULTS ---
            {json.dumps(detailed_results, indent=2)}
            --- END RESULTS ---

            Now, generate the personalized report JSON object with the following keys:
            - "score_text": string (e.g., "You answered 7 out of 10 questions correctly.")
            - "strengths": array of strings (e.g., ["Algebra", "Ratio"])
            - "weaknesses": array of strings (e.g., ["Speed", "Geometry"])
            - "summary_message": string (e.g., "This is a great starting point! You have a solid grasp of core concepts, and with some focused practice on Speed, you'll see great improvement.")
            - "recommended_topic": string (e.g., "Speed")
            """

            response = self.model.generate_content(report_generator_prompt)
            cleaned_response_text = response.text.replace('```json', '').replace('```', '').strip()
            analysis_json = json.loads(cleaned_response_text)

            return analysis_json

        except Exception as e:
            print(f"An error occurred during quiz analysis: {e}")
            raise


# Global instance
diagnostic_service = DiagnosticService()