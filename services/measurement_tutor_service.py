"""
Measurement Tutor Service - Inherits from LearningTutorService
Topic-specific implementation for measurement learning
"""

from services.learning_tutor_service import LearningTutorService

class MeasurementTutorService(LearningTutorService):
    """
    Measurement-specific learning tutor service
    Inherits all functionality from LearningTutorService
    """
    
    def __init__(self):
        super().__init__("measurement")
        print(f"✅ Measurement tutor service initialized")