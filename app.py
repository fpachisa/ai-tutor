"""
Main application factory for the AI Tutor Flask app.
"""
import os
from flask import Flask
from flask_cors import CORS

from config.settings import config
from routes.auth import auth_bp
from routes.content import content_bp
from routes.diagnostic import diagnostic_bp
from routes.tutor import tutor_bp
from routes.concepts import concepts_bp
from routes.progress import progress_bp
from routes.session import session_bp
from routes.algebra_tutor import algebra_tutor_bp
from routes.fractions_tutor import fractions_tutor_bp
from routes.learning_tutor import learning_tutor_bp
from routes.ai_analysis import ai_analysis_bp

# Import services to initialize them
from services import problem_service

def create_app(config_name='default'):
    """Application factory pattern."""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config[config_name])
    
    # Initialize CORS
    CORS(app, origins=app.config.get('CORS_ORIGINS', ["*"]))
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(content_bp)
    app.register_blueprint(diagnostic_bp)
    app.register_blueprint(tutor_bp)
    app.register_blueprint(concepts_bp)
    app.register_blueprint(progress_bp)
    app.register_blueprint(session_bp)
    app.register_blueprint(algebra_tutor_bp)
    app.register_blueprint(fractions_tutor_bp)
    app.register_blueprint(learning_tutor_bp)
    app.register_blueprint(ai_analysis_bp)
    
    @app.route('/health')
    def health_check():
        """Health check endpoint."""
        return {
            "status": "healthy", 
            "problems_loaded": len(problem_service.get_practice_problems_dict())
        }
    
    return app

# Create the app instance
app = create_app()

if __name__ == "__main__":
    # Use the PORT environment variable if it's set (for App Engine),
    # otherwise default to 8080 for local development.
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port, debug=True)