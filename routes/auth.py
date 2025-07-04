"""
Authentication routes blueprint.
"""
from flask import Blueprint, request, jsonify
from functools import wraps

from services.auth_service import auth_service

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

def token_required(f):
    """Decorator for routes that require authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]

        if not token:
            return jsonify({'message': 'Authentication Token is missing!'}), 401

        try:
            data = auth_service.verify_token(token)
            current_user_id = data['user_id']
        except ValueError as e:
            return jsonify({'message': str(e)}), 401

        return f(current_user_id, *args, **kwargs)
    return decorated

@auth_bp.route('/signup', methods=['POST'])
def signup():
    """User registration endpoint."""
    try:
        data = request.get_json()
        result = auth_service.create_user(
            email=data.get('email'),
            password=data.get('password'),
            first_name=data.get('firstName'),
            last_name=data.get('lastName'),
            quiz_results=data.get('quiz_results'),
            recommended_topic=data.get('recommended_topic')
        )
        return jsonify(result), 201
    except ValueError as e:
        if "already exists" in str(e):
            return jsonify({"error": str(e)}), 409
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "Registration failed"}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint."""
    try:
        data = request.get_json()
        result = auth_service.authenticate_user(
            email=data.get('email'),
            password=data.get('password')
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 401
    except Exception as e:
        return jsonify({"error": "Login failed"}), 500