"""
Tutor Service Factory - Creates appropriate tutor service for each topic
"""

from services.fractions_tutor_service import FractionsTutorService
from services.algebra_tutor_service import AlgebraTutorService
from services.speed_tutor_service import SpeedTutorService
from services.ratio_tutor_service import RatioTutorService
from services.percentage_tutor_service import PercentageTutorService
from services.measurement_tutor_service import MeasurementTutorService
from services.data_analysis_tutor_service import DataAnalysisTutorService
from services.geometry_tutor_service import GeometryTutorService

class TutorServiceFactory:
    """Factory class to create appropriate tutor services for different topics"""
    
    # Registry of available tutor services
    _services = {
        'fractions': FractionsTutorService,
        'algebra': AlgebraTutorService,
        'speed': SpeedTutorService,
        'ratio': RatioTutorService,
        'percentage': PercentageTutorService,
        'measurement': MeasurementTutorService,
        'data_analysis': DataAnalysisTutorService,
        'geometry': GeometryTutorService,
    }
    
    @classmethod
    def get_service(cls, topic: str):
        """
        Get the appropriate tutor service for a topic
        
        Args:
            topic: The topic name (e.g., 'fractions', 'algebra')
            
        Returns:
            Instance of the appropriate tutor service
            
        Raises:
            ValueError: If topic is not supported
        """
        if topic not in cls._services:
            available_topics = list(cls._services.keys())
            raise ValueError(f"Topic '{topic}' is not supported. Available topics: {available_topics}")
        
        service_class = cls._services[topic]
        return service_class()
    
    @classmethod
    def get_available_topics(cls):
        """Get list of all available topics"""
        return list(cls._services.keys())
    
    @classmethod
    def is_topic_supported(cls, topic: str):
        """Check if a topic is supported"""
        return topic in cls._services
    
    @classmethod
    def register_service(cls, topic: str, service_class):
        """Register a new tutor service (for future use)"""
        cls._services[topic] = service_class
        print(f"✅ Registered {topic} tutor service")

# Convenience function for easy access
def get_tutor_service(topic: str):
    """Convenience function to get a tutor service"""
    return TutorServiceFactory.get_service(topic)