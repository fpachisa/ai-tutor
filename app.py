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
import random

# --- CONFIGURATION ---
load_dotenv()
app = Flask(__name__)
CORS(app)

# This is our definitive list of topics for the P6 curriculum.
ALL_P6_TOPICS = [
    "Algebra", "Fractions", "Speed", "Ratio", "Measurement",
    "Data Analysis", "Percentage", "Geometry"
]

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
    """Scans problem directories, loads all non-diagnostic .json files."""
    all_problems = {}
    problem_base_dir = pathlib.Path('problems')
    if not problem_base_dir.is_dir():
        return {}

    for problem_dir in problem_base_dir.iterdir():
        if problem_dir.is_dir():
            for json_file in problem_dir.glob('*.json'):
                # This check ensures we don't load quiz files into the main problem set
                if 'diagnostic' in json_file.name:
                    continue
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        problems_list = json.load(f)
                        for problem in problems_list:
                            all_problems[problem['id']] = problem
                except Exception as e:
                    print(f"Error loading {json_file}: {e}")
    if not all_problems:
        print("WARNING: No regular problems were loaded.")
    return all_problems

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
    recommended_topic = data.get('recommended_topic')

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
        'created_at': datetime.datetime.now(datetime.timezone.utc),
        'recommended_topic': recommended_topic
    })
    datastore_client.put(user_entity)

    # After creating the user, generate a token for them to log them in automatically
    token = jwt.encode({
        'user_id': user_entity.key.id, # Use the new user's ID
        'email': user_entity['email'],
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
    }, app.config['SECRET_KEY'], algorithm="HS256")

    return jsonify({"message": "User created successfully", "token": token}), 201


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
@token_required
def get_problems_by_topic(current_user_id):
    """
    Endpoint to get a list of practice problems, filtered by topic.
    If no topic is provided, it returns all problems.
    """
    topic = request.args.get('topic')

    # Filter problems based on the provided topic
    filtered_problems = []
    for p in PROBLEMS.values():
        # Exclude diagnostic quiz questions
        if p.get("is_diagnostic"):
            continue
        
        problem_topic = p.get("topic", p.get("topic", "General"))
        
        # If a topic is specified, only include problems from that topic
        if topic and topic.lower() != problem_topic.lower():
            continue
            
        filtered_problems.append({
            "id": p.get("id"),
            "title": p.get("title", p.get("question", "Untitled Problem")),
            "topic": problem_topic
        })

    return jsonify(filtered_problems)


@app.route("/api/problems/<problem_id>")
def get_problem(problem_id):
    """Endpoint to get the full details for a single problem."""
    problem = PROBLEMS.get(problem_id)
    if not problem:
        return jsonify({"error": "Problem not found"}), 404
    return jsonify(problem)

@app.route("/api/dashboard", methods=['GET'])
@token_required
def get_dashboard_data(current_user_id):
    """
    Analyzes user progress to provide data for a personalized dashboard,
    using a fixed list of all available topics.
    """
    try:
        # --- 1. Check for a persistent recommended topic from the diagnostic quiz ---
        user_key = datastore_client.key('User', current_user_id)
        user = datastore_client.get(user_key)

        # Check if user has a diagnostic recommendation that should persist
        diagnostic_recommendation = None
        if user and user.get('recommended_topic'):
            diagnostic_recommendation = user['recommended_topic']

        # --- 2. Optimized Progress Analysis ---
        # Try optimized query first, fallback to original if index doesn't exist

        # Use projection query to only fetch needed fields
        query = datastore_client.query(kind='ProblemProgress')
        query.add_filter('user_id', '=', current_user_id)
        query.add_filter('status', '=', 'in_progress')  
        in_progress_items = list(query.fetch())
        problem_ids = [item['problem_id'] for item in in_progress_items]

        
        weaknesses = {}
        if problem_ids:
            
            for problem_id in problem_ids:
                problem = PROBLEMS.get(problem_id)
                if problem:
                    topic = problem.get('topic', 'Unknown')
                    weaknesses[topic] = weaknesses.get(topic, 0) + 1
        
        # Sort topics by the number of 'in_progress' problems to find recommendations
        recommended_topics = sorted(weaknesses, key=weaknesses.get, reverse=True)

        # --- 3. Combine diagnostic recommendation with progress-based recommendations ---
        # Start with diagnostic recommendation if it exists
        final_recommendations = []
        if diagnostic_recommendation and diagnostic_recommendation in ALL_P6_TOPICS:
            final_recommendations.append(diagnostic_recommendation)
        
        # Add progress-based recommendations (avoiding duplicates)
        valid_recommendations = [topic for topic in recommended_topics 
                               if topic in ALL_P6_TOPICS and topic not in final_recommendations]
        final_recommendations.extend(valid_recommendations)
        
        # The 'all_topics' list should not contain any recommended topics
        browse_topics = [topic for topic in ALL_P6_TOPICS if topic not in final_recommendations]

        print("Final Recommendations: ", final_recommendations )

        # --- 4. Construct and Return the Final Dashboard Data ---
        dashboard_data = {
            "recommended_topics": final_recommendations[:3], # Return the top 3 recommendations
            "all_topics": browse_topics
        }
        return jsonify(dashboard_data)

    except Exception as e:
        print(f"An error occurred fetching dashboard data: {e}")
        # On error, return all topics in the main list
        return jsonify({
            "recommended_topics": [],
            "all_topics": ALL_P6_TOPICS
        })
    
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


@app.route("/api/diagnostic/start", methods=['GET'])
def start_diagnostic_quiz():
    """
    Builds a balanced 10-question quiz using stratified sampling to ensure
    all topics are covered.
    """
    try:
        with open('problems/p6/p6_maths_diagnostic_quiz.json', 'r', encoding='utf-8') as f:
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
        
        return jsonify(final_quiz_questions)

    except Exception as e:
        print(f"An error occurred fetching diagnostic quiz: {e}")
        return jsonify({"error": "Could not retrieve diagnostic quiz"}), 500
    
# In app.py

@app.route("/api/diagnostic/analyze", methods=['POST'])
def analyze_diagnostic_results():
    """
    Receives raw quiz answers, uses GenAI to analyze them, and returns
    a structured, personalized report.
    """
    try:
        data = request.get_json()
        user_answers = data.get("user_answers", [])

        if not user_answers:
            return jsonify({"error": "No answers provided"}), 400

        # We need the full question details to provide context to the AI
        with open('problems/p6/p6_maths_diagnostic_quiz.json', 'r', encoding='utf-8') as f:
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
        1. Be positive and encouraging, even if the score is low.
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

        response = model.generate_content(report_generator_prompt)
        cleaned_response_text = response.text.replace('```json', '').replace('```', '').strip()
        analysis_json = json.loads(cleaned_response_text)

        return jsonify(analysis_json)

    except Exception as e:
        print(f"An error occurred during quiz analysis: {e}")
        return jsonify({"error": "Could not analyze quiz results"}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080, debug=True)
