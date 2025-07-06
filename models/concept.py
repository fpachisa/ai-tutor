"""
Concept model for AI-guided learning pathways.
"""
import datetime
from typing import Dict, List, Optional
from models.base import BaseModel


class Concept(BaseModel):
    """Model for mathematical concepts that students learn before solving problems."""
    
    _kind = 'Concept'
    
    @classmethod
    def _get_required_fields(cls) -> List[str]:
        """Return list of required fields for this model."""
        return ['concept_id', 'title', 'topic', 'grade']
    
    @classmethod
    def _get_excluded_indexes(cls) -> List[str]:
        """Return list of fields to exclude from Datastore indexes."""
        return ['description', 'visual_elements', 'real_world_examples', 'interactive_activities']
    
    def __init__(self, concept_id: str = None, title: str = None, topic: str = None,
                 grade: str = None, description: str = None, prerequisites: List[str] = None,
                 learning_objectives: List[str] = None, difficulty_level: int = 1,
                 visual_elements: Dict = None, real_world_examples: List[str] = None,
                 interactive_activities: List[Dict] = None, **kwargs):
        super().__init__(**kwargs)
        self.concept_id = concept_id
        self.title = title
        self.topic = topic
        self.grade = grade
        self.description = description
        self.prerequisites = prerequisites or []
        self.learning_objectives = learning_objectives or []
        self.difficulty_level = difficulty_level
        self.visual_elements = visual_elements or {}
        self.real_world_examples = real_world_examples or []
        self.interactive_activities = interactive_activities or []
        self.created_at = datetime.datetime.now().isoformat()
    
    @classmethod
    def get_by_concept_id(cls, concept_id: str) -> Optional['Concept']:
        """Get a concept by its concept_id."""
        query = cls.query()
        query.add_filter('concept_id', '=', concept_id)
        entities = list(query.fetch(limit=1))
        if entities:
            return cls._from_entity(entities[0])
        return None
    
    @classmethod
    def get_concepts_by_topic(cls, topic: str, grade: str = 'p6') -> List['Concept']:
        """Get all concepts for a specific topic and grade."""
        query = cls.query()
        query.add_filter('topic', '=', topic)
        query.add_filter('grade', '=', grade)
        query.order = ['difficulty_level']
        
        entities = list(query.fetch())
        return [cls._from_entity(entity) for entity in entities]
    
    @classmethod
    def get_prerequisite_concepts(cls, concept_id: str) -> List['Concept']:
        """Get all prerequisite concepts for a given concept."""
        # First get the concept to find its prerequisites
        concept = cls.get_by_concept_id(concept_id)
        if not concept or not concept.prerequisites:
            return []
        
        # Fetch all prerequisite concepts
        concepts = []
        for prereq_id in concept.prerequisites:
            prereq_concept = cls.get_by_concept_id(prereq_id)
            if prereq_concept:
                concepts.append(prereq_concept)
        
        return concepts
    
    @classmethod
    def get_concepts_requiring_prerequisite(cls, concept_id: str) -> List['Concept']:
        """Get all concepts that require this concept as a prerequisite."""
        query = cls.query()
        # Note: This would require a more complex query in production
        # For now, we'll fetch all and filter in memory
        all_concepts = list(query.fetch())
        
        requiring_concepts = []
        for entity in all_concepts:
            concept = cls._from_entity(entity)
            if concept_id in concept.prerequisites:
                requiring_concepts.append(concept)
        
        return requiring_concepts
    
    def to_dict(self) -> Dict:
        """Convert concept to dictionary for API responses."""
        return {
            'concept_id': self.concept_id,
            'title': self.title,
            'topic': self.topic,
            'grade': self.grade,
            'description': self.description,
            'prerequisites': self.prerequisites,
            'learning_objectives': self.learning_objectives,
            'difficulty_level': self.difficulty_level,
            'visual_elements': self.visual_elements,
            'real_world_examples': self.real_world_examples,
            'interactive_activities': self.interactive_activities,
            'created_at': self.created_at
        }


class ConceptProgress(BaseModel):
    """Model for tracking student progress through concepts."""
    
    _kind = 'ConceptProgress'
    
    @classmethod
    def _get_required_fields(cls) -> List[str]:
        """Return list of required fields for this model."""
        return ['user_id', 'concept_id', 'understanding_level']
    
    @classmethod
    def _get_excluded_indexes(cls) -> List[str]:
        """Return list of fields to exclude from Datastore indexes."""
        return ['notes']
    
    def __init__(self, user_id: int = None, concept_id: str = None, 
                 understanding_level: str = 'not_started', confidence_score: int = 0,
                 time_spent_minutes: int = 0, attempts_count: int = 0,
                 last_interaction: str = None, notes: str = None, **kwargs):
        super().__init__(**kwargs)
        self.user_id = user_id
        self.concept_id = concept_id
        self.understanding_level = understanding_level  # not_started, exploring, understood, mastered
        self.confidence_score = confidence_score  # 0-100
        self.time_spent_minutes = time_spent_minutes
        self.attempts_count = attempts_count
        self.last_interaction = last_interaction or datetime.datetime.now().isoformat()
        self.notes = notes or ""
        self.updated_at = datetime.datetime.now().isoformat()
    
    @classmethod
    def get_user_concept_progress(cls, user_id: int, concept_id: str) -> Optional['ConceptProgress']:
        """Get progress for a specific user and concept."""
        query = cls.query()
        query.add_filter('user_id', '=', user_id)
        query.add_filter('concept_id', '=', concept_id)
        entities = list(query.fetch(limit=1))
        if entities:
            return cls._from_entity(entities[0])
        return None
    
    @classmethod
    def get_user_topic_progress(cls, user_id: int, topic: str) -> List['ConceptProgress']:
        """Get all concept progress for a user within a topic."""
        # This would require joining with Concepts table
        # For now, we'll implement a simpler version
        query = cls.query()
        query.add_filter('user_id', '=', user_id)
        entities = list(query.fetch())
        
        # Filter by topic (requires concept lookup)
        progress_list = []
        for entity in entities:
            progress = cls._from_entity(entity)
            concept = Concept.get_by_concept_id(progress.concept_id)
            if concept and concept.topic == topic:
                progress_list.append(progress)
        
        return progress_list
    
    @classmethod
    def create_or_update_progress(cls, user_id: int, concept_id: str, 
                                understanding_level: str, confidence_score: int = None,
                                time_spent_minutes: int = None) -> 'ConceptProgress':
        """Create or update concept progress for a user."""
        existing = cls.get_user_concept_progress(user_id, concept_id)
        
        if existing:
            # Update existing progress
            existing.understanding_level = understanding_level
            if confidence_score is not None:
                existing.confidence_score = confidence_score
            if time_spent_minutes is not None:
                existing.time_spent_minutes += time_spent_minutes
            existing.attempts_count += 1
            existing.last_interaction = datetime.datetime.now().isoformat()
            existing.updated_at = datetime.datetime.now().isoformat()
            existing.save()
            return existing
        else:
            # Create new progress
            progress = cls(
                user_id=user_id,
                concept_id=concept_id,
                understanding_level=understanding_level,
                confidence_score=confidence_score or 0,
                time_spent_minutes=time_spent_minutes or 0,
                attempts_count=1
            )
            progress.save()
            return progress
    
    def to_dict(self) -> Dict:
        """Convert progress to dictionary for API responses."""
        return {
            'user_id': self.user_id,
            'concept_id': self.concept_id,
            'understanding_level': self.understanding_level,
            'confidence_score': self.confidence_score,
            'time_spent_minutes': self.time_spent_minutes,
            'attempts_count': self.attempts_count,
            'last_interaction': self.last_interaction,
            'notes': self.notes,
            'updated_at': self.updated_at
        }