"""
Data Analysis Tutor Service - Inherits from LearningTutorService
Topic-specific implementation for data analysis learning
"""

from services.learning_tutor_service import LearningTutorService

class DataAnalysisTutorService(LearningTutorService):
    """
    Data Analysis-specific learning tutor service
    Inherits all functionality from LearningTutorService
    """
    
    def __init__(self):
        super().__init__("data_analysis")
        print(f"✅ Data Analysis tutor service initialized")