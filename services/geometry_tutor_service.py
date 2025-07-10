"""
Geometry Tutor Service - Inherits from LearningTutorService
Topic-specific implementation for geometry learning
"""

from services.learning_tutor_service import LearningTutorService

class GeometryTutorService(LearningTutorService):
    """
    Geometry-specific learning tutor service
    Inherits all functionality from LearningTutorService
    """
    
    def __init__(self):
        super().__init__("geometry")
        print(f"✅ Geometry tutor service initialized")