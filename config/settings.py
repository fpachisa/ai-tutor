"""
Configuration settings for the AI Tutor application.
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Base configuration."""
    
    # Flask settings
    SECRET_KEY = os.getenv("SECRET_KEY", "your-default-super-secret-key")
    
    # Google Cloud settings
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    
    # Curriculum configuration
    SUPPORTED_GRADES = ["p6"]
    SUPPORTED_SUBJECTS = ["math"]
    
    # P6 Math topics - easily expandable
    P6_TOPICS = [
        "Algebra", "Fractions", "Speed", "Ratio", "Measurement",
        "Data Analysis", "Percentage", "Geometry"
    ]
    
    # File paths
    PROBLEMS_BASE_DIR = "problems"
    P6_DIAGNOSTIC_FILE = "problems/p6/p6_maths_diagnostic_quiz.json"
    
    # CORS settings
    CORS_ORIGINS = ["https://tutorai.web.app", "http://127.0.0.1:5500"]
    
    @classmethod
    def validate_grade_subject(cls, grade, subject):
        """Validate grade and subject combination."""
        return grade in cls.SUPPORTED_GRADES and subject in cls.SUPPORTED_SUBJECTS
    
    @classmethod
    def get_topics_for_grade_subject(cls, grade, subject):
        """Get topics for a specific grade and subject."""
        if grade == "p6" and subject == "math":
            return cls.P6_TOPICS
        return []

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True

class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False

# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}