import os
import json
import pathlib
import datetime
import jwt
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
from google.cloud import datastore
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import re

# --- CONFIGURATION ---
load_dotenv()
app = Flask(__name__)
CORS(app)


# --- DECORATOR FOR AUTHENTICATION ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Check if 'Authorization' header is in the request
        if 'Authorization' in request.headers:
            # The header should be in the format 'Bearer <token>'
            token = request.headers['Authorization'].split(" ")[1]

        if not token:
            return jsonify({'message': 'Authentication Token is missing!'}), 401

        try:
            # Decode the token using our secret key
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            # The user_id is now in the 'data' payload
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401

        # Pass the user_id to the wrapped function
        return f(current_user_id, *args, **kwargs)
    return decorated

# Your secret key for signing JWTs. In a real app, get this from environment variables.
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "your-default-super-secret-key")

# --- DATABASE CLIENT ---
# Initialize the Datastore client. It will automatically use the credentials
# you set up with 'gcloud auth application-default login'.
datastore_client = datastore.Client()

# --- LOAD PROBLEMS FROM JSON FILE ---
def load_problems():
    """
    Scans the problems/p6 directory, loads all .json files, 
    and maps the problems by their ID.
    """
    all_problems = {}
    # Define the path to the problems directory
    problem_dir = pathlib.Path('problems/p6')

    if not problem_dir.is_dir():
        print(f"ERROR: Problem directory not found at {problem_dir}")
        return {}

    # Iterate over all .json files in the directory
    for json_file in problem_dir.glob('*.json'):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                problems_list = json.load(f)
                # Add the problems from this file to our main dictionary
                for problem in problems_list:
                    all_problems[problem['id']] = problem
        except json.JSONDecodeError:
            print(f"ERROR: Could not decode {json_file}. Check for syntax errors.")
        except Exception as e:
            print(f"An error occurred loading {json_file}: {e}")

    if not all_problems:
        print("WARNING: No problems were loaded.")
        
    return all_problems


# Load problems into a global variable when the app starts
PROBLEMS = load_problems()

# --- GEMINI API CONFIGURATION ---
try:
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
    model = genai.GenerativeModel('gemini-2.5-flash')
except Exception as e:
    print(f"Error configuring Gemini API: {e}")
    model = None

# --- API ENDPOINTS ---
@app.route("/api/auth/signup", methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    # Check if user already exists
    query = datastore_client.query(kind='User')
    query.add_filter('email', '=', email)
    existing_user = list(query.fetch(limit=1))
    if existing_user:
        return jsonify({"error": "Email already exists"}), 409

    # Hash the password for security
    password_hash = generate_password_hash(password)

    # Create a new User entity
    key = datastore_client.key('User')
    user_entity = datastore.Entity(key)
    user_entity.update({
        'email': email,
        'password_hash': password_hash,
        'created_at': datetime.datetime.now(datetime.timezone.utc)
    })
    datastore_client.put(user_entity)

    return jsonify({"message": "User created successfully"}), 201


@app.route("/api/auth/login", methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    # Find the user by email
    query = datastore_client.query(kind='User')
    query.add_filter('email', '=', email)
    user_results = list(query.fetch(limit=1))
    if not user_results:
        return jsonify({"error": "Invalid credentials"}), 401

    user = user_results[0]
    
    # Check the password hash
    if not check_password_hash(user['password_hash'], password):
        return jsonify({"error": "Invalid credentials"}), 401

    # If credentials are valid, create a JWT
    token = jwt.encode({
        'user_id': user.key.id, # Get the unique ID generated by Datastore
        'email': user['email'],
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")

    return jsonify({"message": "Login successful", "token": token}), 200


@app.route("/api/problems")
def get_all_problems():
    """Endpoint to get a list of all available problems (without full methodology)."""
    # We only send basic info to the dashboard, not the full solution
    problem_list = [
        {"id": p["id"], "title": p["title"], "topic": p["topic"]}
        for p in PROBLEMS.values()
    ]
    return jsonify(problem_list)


@app.route("/api/problems/<problem_id>")
def get_problem(problem_id):
    """Endpoint to get the full details for a single problem."""
    problem = PROBLEMS.get(problem_id)
    if not problem:
        return jsonify({"error": "Problem not found"}), 404
    return jsonify(problem)



@app.route("/api/tutor/submit_answer", methods=['POST'])
@token_required
def submit_answer(current_user_id):
    # 1. Initial validation
    if not model:
        return jsonify({"error": "AI Model not configured"}), 503

    # 2. Get and sanitize data from the frontend request
    data = request.get_json()
    problem_id = data.get("problem_id")
    raw_answer = data.get("student_answer", "")
    student_answer = raw_answer.replace('\n', ' ').replace('\r', ' ').strip()
    chat_history = data.get("chat_history", []) # This includes the user's latest message

    problem = PROBLEMS.get(problem_id)
    if not problem:
        return jsonify({"error": "Problem not found"}), 404

    # 3. Determine if the answer is correct and build the appropriate AI prompt

    verified_answer = problem["verified_answer"]
    # We use a regular expression to find the verified answer as a whole word in the student's submission.
    # This is more flexible than a direct string comparison.
    is_correct = bool(re.search(r'\b' + re.escape(verified_answer) + r'\b', student_answer))

    prompt = ""

    if is_correct:
        # Prompt for when the user gets the final answer right
        prompt = f"""
        You are the 'PSLE AI Math Tutor'. The user has just submitted the CORRECT final answer.
        Your task is to provide a single, short, positive, and varied congratulatory message. Do not be repetitive.
        Keep it concise and encouraging. For example: "That's exactly right! Great job." or "Perfect! You've mastered this."
        Your final output MUST be a single, valid JSON object with two keys: "encouragement" and "socratic_question". The "socratic_question" should be an empty string.
        Example format: {{"encouragement": "That's it! Fantastic work!", "socratic_question": ""}}
        """
    else:
        # Prompt for when the user's answer is incorrect
        prompt = f"""
        You are the 'PSLE AI Math Tutor'. Your role is to be an expert, encouraging Socratic guide for a 12-year-old student in Singapore.
        Your personality is patient and encouraging. Never give the direct answer.
        You have been given a problem, the correct answer, and the step-by-step solution.
        The user has submitted an incorrect answer. Your goal is to guide them to find their own mistake.
        Always respond in the required JSON format: {{"encouragement": "...", "socratic_question": "..."}}.

        Here is the problem context:
        Problem: {problem['problem_text']}
        Verified Answer: {problem['verified_answer']}
        Verified Methodology: {problem['verified_methodology']}
        
        The user's incorrect answer is: "{student_answer}"
        
        Now, generate the JSON output to guide the student.
        """

    # 4. Call the AI and handle the response
    final_response = {}
    try:
        # We start a new chat session for each turn to ensure context is clean.
        # The prompt contains all necessary context.
        chat = model.start_chat(history=[])
        response = chat.send_message(prompt)

        cleaned_response_text = response.text.replace('```json', '').replace('```', '').strip()
        ai_feedback_json = json.loads(cleaned_response_text)
        final_response = {"is_correct": is_correct, "feedback": ai_feedback_json}

    except Exception as e:
        print(f"An error occurred during AI generation: {e}")
        final_response = {
            "is_correct": False,
            "feedback": {
                "encouragement": "I'm having a little trouble thinking at the moment.",
                "socratic_question": "Could you please try that again?"
            }
        }

    # 5. Save progress and history to Datastore
    if final_response.get("feedback"):
        # The chat_history from the frontend already includes the user's latest message.
        # We just need to add the AI's response to complete the turn.
        model_response_for_history = {'role': 'model', 'parts': [json.dumps(final_response['feedback'])]}
        if is_correct:
            # For correct answers, we store the simpler text response in history
             model_response_for_history = {'role': 'model', 'parts': [final_response['feedback']['encouragement']]}

        history_to_save = chat_history + [model_response_for_history]

        # Save the full chat history
        chat_key = datastore_client.key('ChatHistory', f"{current_user_id}-{problem_id}")
        chat_entity = datastore.Entity(key=chat_key, exclude_from_indexes=['history'])
        chat_entity.update({
            'user_id': current_user_id,
            'problem_id': problem_id,
            'history': history_to_save,
            'updated_at': datetime.datetime.now(datetime.timezone.utc)
        })
        datastore_client.put(chat_entity)

        # Save the problem's current status
        progress_key = datastore_client.key('ProblemProgress', f"{current_user_id}-{problem_id}")
        progress_entity = datastore.Entity(key=progress_key)
        progress_entity.update({
            'user_id': current_user_id,
            'problem_id': problem_id,
            'status': 'mastered' if is_correct else 'in_progress',
            'updated_at': datetime.datetime.now(datetime.timezone.utc)
        })
        datastore_client.put(progress_entity)

    # 6. Return the AI's response to the frontend
    return jsonify(final_response)


@app.route("/api/progress/<problem_id>", methods=['GET'])
@token_required
def get_progress(current_user_id, problem_id):
    # Create the unique key to find the chat history
    chat_key = datastore_client.key('ChatHistory', f"{current_user_id}-{problem_id}")
    chat_entity = datastore_client.get(chat_key)

    if chat_entity:
        # If history exists, return it
        return jsonify({"chat_history": chat_entity.get('history', [])})
    else:
        # If no history exists, return an empty list
        return jsonify({"chat_history": []})
    
# In app.py

@app.route("/api/progress/all", methods=['GET'])
@token_required
def get_all_progress(current_user_id):
    """Fetches all problem statuses for the current user."""
    try:
        query = datastore_client.query(kind='ProblemProgress')
        query.add_filter('user_id', '=', current_user_id)
        results = list(query.fetch())

        # Create a dictionary mapping problem_id to its status
        progress_map = {entity['problem_id']: entity['status'] for entity in results}
        return jsonify(progress_map)
    except Exception as e:
        print(f"An error occurred fetching all progress: {e}")
        return jsonify({}), 500 # Return empty object on error

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080, debug=True)