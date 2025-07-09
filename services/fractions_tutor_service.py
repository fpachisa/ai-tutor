"""
Fractions Tutor Service - Inherits from LearningTutorService
Topic-specific implementation for fractions learning
"""

from services.learning_tutor_service import LearningTutorService

class FractionsTutorService(LearningTutorService):
    """
    Fractions-specific learning tutor service
    Inherits all functionality from LearningTutorService
    """
    
    def __init__(self):
        super().__init__("fractions")
        print(f"✅ Fractions tutor service initialized")