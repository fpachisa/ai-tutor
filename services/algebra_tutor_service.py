"""
Algebra Tutor Service - Inherits from LearningTutorService
Topic-specific implementation for algebra learning
"""

from services.learning_tutor_service import LearningTutorService

class AlgebraTutorService(LearningTutorService):
    """
    Algebra-specific learning tutor service
    Inherits all functionality from LearningTutorService
    """
    
    def __init__(self):
        super().__init__("algebra")
        print(f"✅ Algebra tutor service initialized")