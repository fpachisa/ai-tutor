"""
Speed Tutor Service - Inherits from LearningTutorService
Topic-specific implementation for speed learning
"""

from services.learning_tutor_service import LearningTutorService

class SpeedTutorService(LearningTutorService):
    """
    Speed-specific learning tutor service
    Inherits all functionality from LearningTutorService
    """
    
    def __init__(self):
        super().__init__("speed")
        print(f"✅ Speed tutor service initialized")