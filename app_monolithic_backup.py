import os
import json
import pathlib
import datetime
import jwt
from flask import Flask, jsonify, request
from flask_cors import CORS, cross_origin
from dotenv import load_dotenv
import google.generativeai as genai
from google.cloud import datastore
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import re
import random
from google.cloud import texttospeech

# --- CONFIGURATION ---
load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}   )


# This is our definitive list of topics for the P6 curriculum.
ALL_P6_TOPICS = [
    "Algebra", "Fractions", "Speed", "Ratio", "Measurement",
    "Data Analysis", "Percentage", "Geometry"
]
tts_client = texttospeech.TextToSpeechClient()

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

def load_all_problems():
    """
    Loads all problems from all JSON files at startup and separates them
    into practice and diagnostic sets for efficient access.
    """
    practice_problems = {}
    diagnostic_problems = {}
    problem_base_dir = pathlib.Path('problems')

    if not problem_base_dir.is_dir():
        print("WARNING: 'problems' directory not found.")
        return {}, {}

    for problem_dir in problem_base_dir.iterdir():
        if problem_dir.is_dir():
            for json_file in problem_dir.glob('*.json'):
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        problems_list = json.load(f)
                        # Check if the filename indicates it's a diagnostic quiz
                        is_diagnostic = 'diagnostic' in json_file.name.lower()
                        for problem in problems_list:
                            if is_diagnostic:
                                diagnostic_problems[problem['id']] = problem
                            else:
                                practice_problems[problem['id']] = problem
                except Exception as e:
                    print(f"Error loading {json_file}: {e}")
    
    print(f"Loaded {len(practice_problems)} practice problems and {len(diagnostic_problems)} diagnostic questions.")
    # This function now correctly returns TWO separate dictionaries
    return practice_problems, diagnostic_problems

# This section now correctly calls the function and creates all the necessary global variables
PRACTICE_PROBLEMS, DIAGNOSTIC_PROBLEMS = load_all_problems()
ALL_PROBLEMS_MAP = {**PRACTICE_PROBLEMS, **DIAGNOSTIC_PROBLEMS}
ALL_P6_TOPICS = sorted(list(set(p.get("topic") for p in PRACTICE_PROBLEMS.values() if p.get("topic"))))


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
    firstName = data.get('firstName') # Get the new fields
    lastName = data.get('lastName')   # Get the new fields
    recommended_topic = data.get('recommended_topic')

    if not email or not password or not firstName:
        return jsonify({"error": "First name, email and password are required"}), 400

    query = datastore_client.query(kind='User')
    query.add_filter('email', '=', email)
    if list(query.fetch(limit=1)):
        return jsonify({"error": "Email already exists"}), 409

    password_hash = generate_password_hash(password)

    user_key = datastore_client.key('User')
    user_entity = datastore.Entity(key=user_key)
    user_entity.update({
        'email': email,
        'password_hash': password_hash,
        'first_name': firstName, # Save to database
        'last_name': lastName,   # Save to database
        'created_at': datetime.datetime.now(datetime.timezone.utc),
        'recommended_topic': recommended_topic,
        'is_new_user': True
    })
    datastore_client.put(user_entity)
    user_id = user_entity.key.id

    token = jwt.encode({
        'user_id': user_id,
        'email': email,
        'first_name': firstName,
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


@app.route("/api/grades/<grade>/subjects/<subject>/topics/<topic>/problems", methods=['GET'])
@token_required
def get_problems_by_topic(current_user_id, grade, subject, topic):
    """
    Get practice problems for a specific grade/subject/topic.
    Accepts query parameter: ?filter=...
    filter can be 'in_progress', 'mastered', or 'next' (default).
    """
    # Validate grade and subject
    if grade != 'p6' or subject != 'math':
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    try:
        filter_type = request.args.get('filter')

        # 1. Get all problem IDs for the requested topic
        all_problem_ids_in_topic = {
            pid for pid, p in PRACTICE_PROBLEMS.items() if p.get('topic') == topic
        }

        # 2. Get ALL of the user's progress entities in one go
        query = datastore_client.query(kind='ProblemProgress')
        query.add_filter('user_id', '=', current_user_id)
        all_user_progress = list(query.fetch())
        
        # Create a map of problem_id -> status for easy lookup
        progress_map = {item['problem_id']: item['status'] for item in all_user_progress}

        # 3. Apply the requested filter
        filtered_problem_ids = []
        if filter_type == 'in_progress':
            filtered_problem_ids = [pid for pid in all_problem_ids_in_topic if progress_map.get(pid) == 'in_progress']
        elif filter_type == 'mastered':
            filtered_problem_ids = [pid for pid in all_problem_ids_in_topic if progress_map.get(pid) == 'mastered']
        else: # Default case is to find the 'next' unseen problem
            unseen_problem_ids = [pid for pid in all_problem_ids_in_topic if pid not in progress_map]
            if unseen_problem_ids:
                # Return just the first unseen problem
                filtered_problem_ids = [unseen_problem_ids[0]]

        # 4. Fetch the full problem data for the filtered IDs
        final_problem_list = []
        for pid in filtered_problem_ids:
            problem_data = PRACTICE_PROBLEMS.get(pid)
            if problem_data:
                final_problem_list.append({
                    "id": problem_data.get("id"),
                    "title": problem_data.get("title", "Untitled"),
                    "topic": problem_data.get("topic")
                })

        return jsonify(final_problem_list)

    except Exception as e:
        print(f"An error occurred in get_problems_by_topic: {e}")
        return jsonify({"error": "Could not retrieve problems for topic"}), 500



@app.route("/api/grades/<grade>/subjects/<subject>/problems/<problem_id>")
def get_problem(grade, subject, problem_id):
    """Get the full details for a single problem."""
    # Validate grade and subject
    if grade != 'p6' or subject != 'math':
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    problem = PRACTICE_PROBLEMS.get(problem_id)
    if not problem:
        return jsonify({"error": "Problem not found"}), 404
    return jsonify(problem)

@app.route("/api/grades/<grade>/subjects/<subject>/dashboard", methods=['GET'])
@token_required
def get_dashboard_data(current_user_id, grade, subject):
    """Get dashboard data for a specific grade and subject."""
    # Validate grade and subject
    if grade != 'p6' or subject != 'math':
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    # Analyze user progress to provide data for a personalized dashboard
    try:
        # --- 1. Check for a persistent recommended topic from the diagnostic quiz ---
        user_key = datastore_client.key('User', current_user_id)
        user = datastore_client.get(user_key)

        if user and user.get('recommended_topic'):
            recommended_topic = user['recommended_topic']
        else:
            # If no recommendation exists, default to a random topic
            recommended_topic = random.choice(ALL_P6_TOPICS)

        # The 'all_topics' list should not contain any recommended topics
        browse_topics = [topic for topic in ALL_P6_TOPICS if topic != recommended_topic]

        print("Final Recommendations: ", recommended_topic )

        # --- 4. Construct and Return the Final Dashboard Data ---
        dashboard_data = {
            "recommended_topics": [recommended_topic],
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
    

@app.route("/api/grades/<grade>/subjects/<subject>/tutor/submit_answer", methods=['POST'])
@token_required
def submit_answer(current_user_id, grade, subject):
    """AI tutor answer submission for a specific grade and subject."""
    # Validate grade and subject
    if grade != 'p6' or subject != 'math':
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    # AI tutor answer submission implementation
    if not model:
        return jsonify({"error": "AI Model not configured"}), 503

    # 1. Get all necessary data
    data = request.get_json()
    problem_id = data.get("problem_id")
    chat_history = data.get("chat_history", [])
    problem = PRACTICE_PROBLEMS.get(problem_id)
    
    if not problem:
        return jsonify({"error": "Problem not found"}), 404

    # 2. Construct the new "AI Examiner" Prompt
    # We give the AI all context and ask it to make the judgment call.
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

    # 3. Call the AI and process the response
    final_response = {}
    try:
        response = model.generate_content(examiner_prompt)
        ai_response_json = json.loads(response.text.replace('```json', '').replace('```', '').strip())
        
        # We now trust the AI's judgment on correctness
        is_correct = ai_response_json.get("is_final_answer_correct", False)
        
        final_response = {
            "is_correct": is_correct,
            "feedback": ai_response_json.get("feedback", {})
        }

    except Exception as e:
        print(f"An error occurred during AI generation: {e}")
        final_response = { "is_correct": False, "feedback": { "encouragement": "I'm having a little trouble thinking.", "socratic_question": "Can you try rephrasing?" } }

    # 4. Save progress to the database (this logic is now driven by the AI's response)
    if final_response.get("feedback"):
        is_correct_from_ai = final_response.get("is_correct", False)
        model_response_for_history = {'role': 'model', 'parts': [json.dumps(final_response['feedback'])] if not is_correct_from_ai else [final_response['feedback']['encouragement']]}
        history_to_save = chat_history + [model_response_for_history]

        progress_key = datastore_client.key('ProblemProgress', f"{current_user_id}-{problem_id}")
        chat_key = datastore_client.key('ChatHistory', f"{current_user_id}-{problem_id}")
        progress_entity = datastore.Entity(key=progress_key)
        chat_entity = datastore.Entity(key=chat_key, exclude_from_indexes=['history'])
        progress_entity.update({ 'user_id': current_user_id, 'problem_id': problem_id, 'status': 'mastered' if is_correct_from_ai else 'in_progress', 'updated_at': datetime.datetime.now(datetime.timezone.utc) })
        chat_entity.update({ 'user_id': current_user_id, 'problem_id': problem_id, 'history': history_to_save, 'updated_at': datetime.datetime.now(datetime.timezone.utc) })
        datastore_client.put_multi([progress_entity, chat_entity])

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


@app.route("/api/grades/<grade>/subjects/<subject>/diagnostic/start", methods=['GET'])
def start_diagnostic_quiz(grade, subject):
    """Start diagnostic quiz for a specific grade and subject."""
    # Validate grade and subject
    if grade != 'p6' or subject != 'math':
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    # Build a balanced 10-question quiz using stratified sampling to ensure all topics are covered
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

@app.route("/api/grades/<grade>/subjects/<subject>/diagnostic/analyze", methods=['POST'])
def analyze_diagnostic_results(grade, subject):
    """Analyze diagnostic results for a specific grade and subject."""
    # Validate grade and subject
    if grade != 'p6' or subject != 'math':
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    # Receive raw quiz answers, use GenAI to analyze them, and return a structured, personalized report
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

        response = model.generate_content(report_generator_prompt)
        cleaned_response_text = response.text.replace('```json', '').replace('```', '').strip()
        analysis_json = json.loads(cleaned_response_text)

        return jsonify(analysis_json)

    except Exception as e:
        print(f"An error occurred during quiz analysis: {e}")
        return jsonify({"error": "Could not analyze quiz results"}), 500

@app.route("/api/grades/<grade>/subjects/<subject>/topics/<topic_name>/progress/summary", methods=['GET'])
@token_required
def get_topic_summary(current_user_id, grade, subject, topic_name):
    """Get topic progress summary for a specific grade, subject, and topic."""
    # Validate grade and subject
    if grade != 'p6' or subject != 'math':
        return jsonify({"error": "Grade/subject combination not supported"}), 400
    
    # Calculate and return a user's progress summary for a specific topic, considering only the main practice problems
    try:
        # Step 1: Find all practice problem IDs that belong to the requested topic.
        # This correctly uses the PRACTICE_PROBLEMS dictionary only.
        problem_ids_in_topic = {
            pid for pid, p in PRACTICE_PROBLEMS.items() if p.get('topic') == topic_name
        }
        total_problems = len(problem_ids_in_topic)

        if total_problems == 0:
            return jsonify({
                "topic": topic_name, "total_problems": 0,
                "mastered_count": 0, "in_progress_count": 0
            })

        # Step 2: Efficiently fetch only the relevant progress entities from Datastore.
        # We build the specific keys we need and use a single get_multi call.
        progress_keys = [
            datastore_client.key('ProblemProgress', f"{current_user_id}-{pid}")
            for pid in problem_ids_in_topic
        ]
        progress_entities = datastore_client.get_multi(progress_keys)

        # Step 3: Calculate stats from the fetched entities.
        mastered_count = 0
        in_progress_count = 0
        for entity in progress_entities:
            # The get_multi result includes placeholders, so we check if the entity exists.
            if entity:
                if entity.get("status") == "mastered":
                    mastered_count += 1
                elif entity.get("status") == "in_progress":
                    in_progress_count += 1
        
        summary = {
            "topic": topic_name,
            "total_problems": total_problems,
            "mastered_count": mastered_count,
            "in_progress_count": in_progress_count
        }
        return jsonify(summary)

    except Exception as e:
        print(f"An error occurred fetching topic summary for {topic_name}: {e}")
        return jsonify({"error": "Could not retrieve topic summary"}), 500

@app.route("/api/session/start", methods=['POST'])
def session_start():
    """
    This is the first call the frontend makes. It checks for a valid token
    and returns either a personalized greeting for a returning user or a
    generic welcome for a new user.
    """
    token = None
    if 'Authorization' in request.headers:
        try:
            token = request.headers['Authorization'].split(" ")[1]
            token_data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_id = token_data['user_id']
            
            # --- LOGGED-IN USER FLOW ---
            user_key = datastore_client.key('User', current_user_id)
            user = datastore_client.get(user_key)
            if not user:
                raise jwt.InvalidTokenError("User not found in database")
            
            first_name = user.get('first_name', '')
            message = ""
            suggested_actions = []
            ai_prompt = ""

            if user.get('is_new_user'):
                if user.get('recommended_topic'):
                    recommended_topic = user.get('recommended_topic')
                else:
                    # If no recommended topic, default to a key topic
                    recommended_topic = random.choice(ALL_P6_TOPICS)
                
                suggested_actions = [
                    {"text": f"Start '{recommended_topic}' Practice", "action_id": "continue_topic", "context": recommended_topic},
                    {"text": "Browse All Topics", "action_id": "browse_topics"}
                ]
                ai_prompt = f"""
                You are TutorAI, a friendly and insightful PSLE Math tutor.
                A new user named '{first_name}' has just signed up after a quiz. Their recommended starting topic is '{recommended_topic}'.
                Your task is to write a single, short, welcoming paragraph that greets them by name and presents their recommendation.
                """
                
                # Generate AI response for new user
                response = model.generate_content(ai_prompt)
                message = response.text.strip()
                
                user['is_new_user'] = False
                datastore_client.put(user)

            else:
                # 1. Fetch user's recent progress to create a summary
                query = datastore_client.query(kind='ProblemProgress')
                query.add_filter('user_id', '=', current_user_id)
                query.order = ['-updated_at'] # Order by most recent
                recent_progress = list(query.fetch(limit=5))
                
                progress_summary = []
                for item in recent_progress:
                    problem = PRACTICE_PROBLEMS.get(item['problem_id'])
                    if problem:
                        progress_summary.append(f"- Worked on '{problem.get('title')}' in topic '{problem.get('topic')}' (Status: {item.get('status')})")

                # 2. Create a personalized prompt for the AI
                ai_prompt = f"""
                You are TutorAI, a friendly and encouraging PSLE Math tutor.
                A user has just returned to the app. Your task is to generate a short, friendly, and context-aware welcome back message based on their recent activity.
                Also, provide a list of suggested action buttons for the user.

                USER'S RECENT ACTIVITY:
                {chr(10).join(progress_summary) if progress_summary else "This user has not attempted any practice problems yet."}

                YOUR TASK:
                Generate a JSON object with the following keys:
                - "message": A personalized welcome message (1-2 sentences). If they have progress, reference it. If not, encourage them to start. The tone should not be overly formal and sycophatic, but rather friendly and to the point without being too verbose or going overboard with the encouragement.
                - "recommended_topic": A topic name from this list {ALL_P6_TOPICS} based on the user's progress whether they should conitnue with the same topic or switch to a different one.
                

                Example for a user with progress:
                {{
                    "message": "Welcome back! It looks like you were making good progress on Ratio problems. Ready to keep going?",
                    "recommended_topic": "Ratio"
                }}
                """
                
                # 3. Get the personalized response from the AI
                response = model.generate_content(ai_prompt)
                try:
                    ai_response = json.loads(response.text.strip())
                    message = ai_response['message']
                    recommended_topic = ai_response['recommended_topic']
                except (json.JSONDecodeError, KeyError) as e:
                    # Fallback in case AI response parsing fails
                    message = f"Welcome back, {first_name}! Ready to continue your math practice?"
                    recommended_topic = random.choice(ALL_P6_TOPICS)
                
                suggested_actions = [
                    {"text": f"Practice '{recommended_topic}'", "action_id": "continue_topic", "context": recommended_topic},
                    {"text": "Browse All Topics", "action_id": "browse_topics"}
                ]
                user['recommended_topic'] = recommended_topic
                datastore_client.put(user)
            # Return response for logged-in users
            return jsonify({
                "is_authenticated": True,
                "message": message,
                "suggested_actions": suggested_actions
            })

        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            # If token is present but invalid, treat as a new user
            pass

    # --- NEW / LOGGED-OUT USER FLOW ---
    # If no token or an invalid token, return a standard welcome message
    return jsonify({
        "is_authenticated": False,
        # The key is now "message_lines" and it holds a list
        "message_lines": [
            "Hello! I'm TutorAI, your personal math tutor.",
            "To get started, I can give you a short diagnostic quiz to find your strengths,",
            "or you can log in to an existing account."
        ],
        "suggested_actions": [
            {"text": "Take Diagnostic Quiz", "action_id": "start_quiz"},
            {"text": "Login", "action_id": "show_login"}
        ]
    })

@app.route("/api/tts/generate", methods=['POST'])
def generate_tts():
    """
    Takes text in a POST request and returns MP3 audio data generated by Google Cloud TTS.
    """
    data = request.get_json()
    text_to_speak = data.get("text")

    if not text_to_speak:
        return jsonify({"error": "No text provided"}), 400

    synthesis_input = texttospeech.SynthesisInput(text=text_to_speak)

    # Configure the voice request. You can experiment with different voices.
    # A list of voices is available here: https://cloud.google.com/text-to-speech/docs/voices
    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        name="en-US-Studio-O" # A high-quality, friendly female voice
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    try:
        response = tts_client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )
        
        # Return the audio content directly with the correct MIME type
        return response.audio_content, 200, {'Content-Type': 'audio/mpeg'}

    except Exception as e:
        print(f"An error occurred during TTS generation: {e}")
        return jsonify({"error": "Failed to generate audio"}), 500

if __name__ == "__main__":
    # Use the PORT environment variable if it's set (for App Engine),
    # otherwise default to 8080 for local development.
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port, debug=True)
