"""
Percentage Tutor Service - Inherits from LearningTutorService
Topic-specific implementation for percentage learning
"""

from services.learning_tutor_service import LearningTutorService

class PercentageTutorService(LearningTutorService):
    """
    Percentage-specific learning tutor service
    Inherits all functionality from LearningTutorService
    """
    
    def __init__(self):
        super().__init__("percentage")
        print(f"✅ Percentage tutor service initialized")