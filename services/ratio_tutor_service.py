"""
Ratio Tutor Service - Inherits from LearningTutorService
Topic-specific implementation for ratio learning
"""

from services.learning_tutor_service import LearningTutorService

class RatioTutorService(LearningTutorService):
    """
    Ratio-specific learning tutor service
    Inherits all functionality from LearningTutorService
    """
    
    def __init__(self):
        super().__init__("ratio")
        print(f"✅ Ratio tutor service initialized")