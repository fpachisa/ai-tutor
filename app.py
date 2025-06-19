import os
from flask import Flask, jsonify, request
from dotenv import load_dotenv
import google.generativeai as genai
import json
from flask_cors import CORS

load_dotenv() # Loads the .env file

# Temporary content store
PROBLEMS = {
    "1": {
        "id": "1",
        "topic": "Ratio",
        "title": "Ali and Ben's Money",
        "problem_text": "Ali and Ben had some money. Ali had $200 more than Ben. After Ali spent 1/5 of his money and Ben spent 1/3 of his money, Ali still had $240 more than Ben. How much money did Ali have at first?",
        "verified_answer": "$800",
        "verified_methodology": [
            "Step 1: Represent the initial amounts using a model. Ben = [Unit Block], Ali = [Unit Block] + $200.",
            "Step 2: Recognize that spending 1/5 and 1/3 requires finding a common multiple for the units. The common multiple of 5 and 3 is 15. Let the 'Unit Block' be 15u.",
            "Step 3: Define the 'at first' amounts in terms of units. Ben = 15u. Ali = 15u + $200.",
            "Step 4: Calculate the 'remaining' amounts. Ali spent 1/5, so he has 4/5 left. Ben spent 1/3, so he has 2/3 left.",
            "Step 5: Calculate Ali's remaining amount: (4/5) * (15u + $200) = 12u + $160.",
            "Step 6: Calculate Ben's remaining amount: (2/3) * 15u = 10u.",
            "Step 7: Use the final clue to form an equation: (Ali's remaining) - (Ben's remaining) = $240.",
            "Step 8: Substitute the expressions: (12u + $160) - 10u = $240.",
            "Step 9: Solve the equation: 2u = $80, so 1u = $40.",
            "Step 10: Answer the original question. Ali's initial amount = 15u + $200 = (15 * 40) + 200 = $600 + $200 = $800."
        ]
    }
}

# Configure the Gemini API
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash')

# Create an instance of the Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Define a route for the homepage
@app.route("/")
def hello_world():
    return "PSLE AI Tutor Backend is running!"

# Define an API endpoint to get a specific problem
@app.route("/api/problems/<problem_id>")
def get_problem(problem_id):
    problem = PROBLEMS.get(problem_id)
    if not problem:
        return jsonify({"error": "Problem not found"}), 404
    return jsonify(problem)

@app.route("/api/tutor/submit_answer", methods=['POST'])
def submit_answer():
    # 1. Get data from the frontend, now including chat_history
    data = request.get_json()
    problem_id = data.get("problem_id")
    student_answer = data.get("student_answer")
    # chat_history is a list of previous turns in the conversation
    chat_history = data.get("chat_history", [])

    problem = PROBLEMS.get(problem_id)
    if not problem:
        return jsonify({"error": "Problem not found"}), 404

    # 2. Quick check for the final correct answer.
    # This check happens outside the AI conversation.
    if student_answer == problem["verified_answer"]:
        return jsonify({
            "is_correct": True,
            "feedback": {
                "encouragement": "That's it, you've got it!",
                "socratic_question": "Excellent work solving this tricky problem."
            }
        })

    # 3. Define the initial system prompt that sets the AI's persona and rules.
    # This is sent only once at the beginning of a new chat.
    system_prompt = f"""
    You are the 'PSLE AI Math Tutor'. Your role is to be an expert, encouraging Socratic guide for a 12-year-old student in Singapore.
    Your personality is patient, calm, and encouraging. Never be condescending.
    You have been given a problem and the step-by-step solution. The user will provide their answers.
    Your goal is to guide them to the correct answer without ever giving away the solution steps or the final answer directly.
    Always respond in the required JSON format: {{"encouragement": "...", "socratic_question": "..."}}.

    Here is the problem context:
    Problem: {problem['problem_text']}
    Verified Answer: {problem['verified_answer']}
    Verified Methodology: {problem['verified_methodology']}
    """

    # 4. Construct the full history for the AI.
    # The Gemini API expects history in a specific format: {'role': 'user'/'model', 'parts': [...]}
    # We prepend the system prompt to the existing chat history.
    full_history = [
        # The system prompt sets the context for the entire conversation
        {'role': 'user', 'parts': [system_prompt]},
        {'role': 'model', 'parts': ["OK, I am ready to help the student. I will follow all instructions and respond in the required JSON format."]},
    ]
    # Add the previous turns from the frontend
    full_history.extend(chat_history)
    
    # 5. Start a new chat session with the full history and send the new message
    try:
        # Start the chat with the history we've built
        chat = model.start_chat(history=full_history)
        
        # Send the student's latest answer as the new message
        response = chat.send_message(f"Here is my latest answer: {student_answer}")

        # Clean and parse the AI's JSON response
        cleaned_response_text = response.text.replace('```json', '').replace('```', '').strip()
        ai_feedback_json = json.loads(cleaned_response_text)
        
        final_response = {
            "is_correct": False,
            "feedback": ai_feedback_json
        }

    except Exception as e:
        print(f"An error occurred during AI generation: {e}")
        final_response = {
            "is_correct": False,
            "feedback": {
                "encouragement": "I'm having a little trouble thinking.",
                "socratic_question": "Could you please rephrase or try again?"
            }
        }

    return jsonify(final_response)

# This allows you to run the app directly
if __name__ == "__main__":
    app.run(debug=True)