"""
Problem progress model for tracking user progress on problems.
"""
import datetime
from typing import Dict, List, Optional
from .base import BaseModel


class ProblemProgress(BaseModel):
    """Model for tracking user progress on individual problems."""
    
    _kind = 'ProblemProgress'
    
    def __init__(self, **kwargs):
        """Initialize ProblemProgress model."""
        super().__init__(**kwargs)
        
        # Progress-specific fields
        self.user_id: int = kwargs.get('user_id')
        self.problem_id: str = kwargs.get('problem_id')
        self.status: str = kwargs.get('status')  # 'in_progress', 'mastered'
        self.attempts: int = kwargs.get('attempts', 0)
        self.last_attempt_at: Optional[datetime.datetime] = kwargs.get('last_attempt_at')
    
    @classmethod
    def _get_required_fields(cls) -> List[str]:
        """Return list of required field names."""
        return ['user_id', 'problem_id', 'status']
    
    @classmethod
    def _get_excluded_indexes(cls) -> List[str]:
        """Return list of fields to exclude from Datastore indexes."""
        return []  # Index all fields for querying
    
    @classmethod
    def _generate_key_name(cls, user_id: int, problem_id: str) -> str:
        """Generate unique key name for user-problem combination."""
        return f"{user_id}-{problem_id}"
    
    @classmethod
    def get_user_progress(cls, user_id: int, problem_id: str) -> Optional['ProblemProgress']:
        """Get progress for a specific user and problem."""
        key_name = cls._generate_key_name(user_id, problem_id)
        return cls.get_by_key(key_name)
    
    @classmethod
    def get_all_user_progress(cls, user_id: int) -> List['ProblemProgress']:
        """Get all progress records for a user."""
        query = cls.query()
        query.add_filter('user_id', '=', user_id)
        
        entities = list(query.fetch())
        return [cls._from_entity(entity) for entity in entities]
    
    @classmethod
    def get_user_progress_by_status(cls, user_id: int, status: str) -> List['ProblemProgress']:
        """Get user progress filtered by status."""
        query = cls.query()
        query.add_filter('user_id', '=', user_id)
        query.add_filter('status', '=', status)
        
        entities = list(query.fetch())
        return [cls._from_entity(entity) for entity in entities]
    
    @classmethod
    def get_recent_user_progress(cls, user_id: int, limit: int = 5) -> List['ProblemProgress']:
        """Get recent progress for a user."""
        query = cls.query()
        query.add_filter('user_id', '=', user_id)
        query.order = ['-updated_at']
        
        entities = list(query.fetch(limit=limit))
        return [cls._from_entity(entity) for entity in entities]
    
    @classmethod
    def get_progress_for_problems(cls, user_id: int, problem_ids: List[str]) -> Dict[str, 'ProblemProgress']:
        """Get progress for multiple problems."""
        key_names = [cls._generate_key_name(user_id, pid) for pid in problem_ids]
        progress_list = cls.get_multi(key_names)
        
        # Create a mapping of problem_id to progress
        progress_map = {}
        for i, progress in enumerate(progress_list):
            if progress:
                progress_map[problem_ids[i]] = progress
        
        return progress_map
    
    @classmethod
    def create_or_update_progress(cls, user_id: int, problem_id: str, status: str) -> 'ProblemProgress':
        """Create new progress or update existing one."""
        key_name = cls._generate_key_name(user_id, problem_id)
        
        # Try to get existing progress
        progress = cls.get_by_key(key_name)
        
        if progress:
            # Update existing progress
            progress.status = status
            progress.attempts += 1
            progress.last_attempt_at = datetime.datetime.now(datetime.timezone.utc)
            progress.updated_at = datetime.datetime.now(datetime.timezone.utc)
        else:
            # Create new progress
            progress = cls(
                user_id=user_id,
                problem_id=problem_id,
                status=status,
                attempts=1,
                last_attempt_at=datetime.datetime.now(datetime.timezone.utc)
            )
            # Set the ID to the key name for composite key
            progress.id = key_name
        
        return progress.save()
    
    @classmethod
    def get_topic_summary(cls, user_id: int, problem_ids: List[str]) -> Dict[str, int]:
        """Get progress summary for a list of problems (typically a topic)."""
        progress_map = cls.get_progress_for_problems(user_id, problem_ids)
        
        summary = {
            'total_problems': len(problem_ids),
            'mastered_count': 0,
            'in_progress_count': 0,
            'not_started_count': 0
        }
        
        for problem_id in problem_ids:
            if problem_id in progress_map:
                status = progress_map[problem_id].status
                if status == 'mastered':
                    summary['mastered_count'] += 1
                elif status == 'in_progress':
                    summary['in_progress_count'] += 1
            else:
                summary['not_started_count'] += 1
        
        return summary
    
    def save(self) -> 'ProblemProgress':
        """Override save to handle composite key."""
        if not self.id:
            self.id = self._generate_key_name(self.user_id, self.problem_id)
        return super().save()
    
    def to_dict(self) -> dict:
        """Convert progress to dictionary for API responses."""
        return {
            'user_id': self.user_id,
            'problem_id': self.problem_id,
            'status': self.status,
            'attempts': self.attempts,
            'last_attempt_at': self.last_attempt_at.isoformat() if self.last_attempt_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def __repr__(self) -> str:
        """String representation of the progress."""
        return f"ProblemProgress(user_id={self.user_id}, problem_id={self.problem_id}, status={self.status})"