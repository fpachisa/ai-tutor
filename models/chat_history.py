"""
Chat history model for storing conversation history between user and AI tutor.
"""
import datetime
from typing import Dict, List, Optional
from .base import BaseModel


class ChatHistory(BaseModel):
    """Model for storing chat history between user and AI tutor."""
    
    _kind = 'ChatHistory'
    
    def __init__(self, **kwargs):
        """Initialize ChatHistory model."""
        super().__init__(**kwargs)
        
        # Chat history specific fields
        self.user_id: int = kwargs.get('user_id')
        self.problem_id: str = kwargs.get('problem_id')
        self.history: List[Dict] = kwargs.get('history', [])
        self.message_count: int = kwargs.get('message_count', 0)
        self.last_message_at: Optional[datetime.datetime] = kwargs.get('last_message_at')
    
    @classmethod
    def _get_required_fields(cls) -> List[str]:
        """Return list of required field names."""
        return ['user_id', 'problem_id']
    
    @classmethod
    def _get_excluded_indexes(cls) -> List[str]:
        """Return list of fields to exclude from Datastore indexes."""
        return ['history']  # Don't index large chat history data
    
    @classmethod
    def _generate_key_name(cls, user_id: int, problem_id: str) -> str:
        """Generate unique key name for user-problem combination."""
        return f"{user_id}-{problem_id}"
    
    @classmethod
    def get_chat_history(cls, user_id: int, problem_id: str) -> Optional['ChatHistory']:
        """Get chat history for a specific user and problem."""
        key_name = cls._generate_key_name(user_id, problem_id)
        return cls.get_by_key(key_name)
    
    @classmethod
    def get_user_chat_histories(cls, user_id: int, limit: int = 10) -> List['ChatHistory']:
        """Get recent chat histories for a user."""
        query = cls.query()
        query.add_filter('user_id', '=', user_id)
        query.order = ['-last_message_at']
        
        entities = list(query.fetch(limit=limit))
        return [cls._from_entity(entity) for entity in entities]
    
    @classmethod
    def create_or_update_history(cls, user_id: int, problem_id: str, 
                                history: List[Dict]) -> 'ChatHistory':
        """Create new chat history or update existing one."""
        key_name = cls._generate_key_name(user_id, problem_id)
        
        # Try to get existing history
        chat_history = cls.get_by_key(key_name)
        
        if chat_history:
            # Update existing history
            chat_history.history = history
            chat_history.message_count = len(history)
            chat_history.last_message_at = datetime.datetime.now(datetime.timezone.utc)
            chat_history.updated_at = datetime.datetime.now(datetime.timezone.utc)
        else:
            # Create new history
            chat_history = cls(
                user_id=user_id,
                problem_id=problem_id,
                history=history,
                message_count=len(history),
                last_message_at=datetime.datetime.now(datetime.timezone.utc)
            )
            # Set the ID to the key name for composite key
            chat_history.id = key_name
        
        return chat_history.save()
    
    def add_message(self, message: Dict) -> 'ChatHistory':
        """Add a single message to the chat history."""
        self.history.append(message)
        self.message_count = len(self.history)
        self.last_message_at = datetime.datetime.now(datetime.timezone.utc)
        self.updated_at = datetime.datetime.now(datetime.timezone.utc)
        return self.save()
    
    def add_user_message(self, message: str) -> 'ChatHistory':
        """Add a user message to the chat history."""
        user_message = {
            'role': 'user',
            'parts': [message],
            'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        return self.add_message(user_message)
    
    def add_model_response(self, response: str, is_correct: bool = False) -> 'ChatHistory':
        """Add a model response to the chat history."""
        model_message = {
            'role': 'model',
            'parts': [response],
            'is_correct': is_correct,
            'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        return self.add_message(model_message)
    
    def get_conversation_summary(self) -> Dict:
        """Get a summary of the conversation."""
        user_messages = [msg for msg in self.history if msg.get('role') == 'user']
        model_messages = [msg for msg in self.history if msg.get('role') == 'model']
        correct_responses = [msg for msg in model_messages if msg.get('is_correct')]
        
        return {
            'total_messages': self.message_count,
            'user_messages': len(user_messages),
            'model_responses': len(model_messages),
            'correct_responses': len(correct_responses),
            'first_message_at': self.created_at.isoformat() if self.created_at else None,
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None,
        }
    
    def clear_history(self) -> 'ChatHistory':
        """Clear the chat history."""
        self.history = []
        self.message_count = 0
        self.last_message_at = None
        self.updated_at = datetime.datetime.now(datetime.timezone.utc)
        return self.save()
    
    def save(self) -> 'ChatHistory':
        """Override save to handle composite key."""
        if not self.id:
            self.id = self._generate_key_name(self.user_id, self.problem_id)
        return super().save()
    
    def to_dict(self, include_history: bool = True) -> dict:
        """Convert chat history to dictionary for API responses."""
        data = {
            'user_id': self.user_id,
            'problem_id': self.problem_id,
            'message_count': self.message_count,
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_history:
            data['history'] = self.history
        
        return data
    
    def __repr__(self) -> str:
        """String representation of the chat history."""
        return f"ChatHistory(user_id={self.user_id}, problem_id={self.problem_id}, messages={self.message_count})"