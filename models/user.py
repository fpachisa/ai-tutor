"""
User model for authentication and user management.
"""
import datetime
from typing import List, Optional
from werkzeug.security import generate_password_hash, check_password_hash
from .base import BaseModel


class User(BaseModel):
    """User model for managing user data and authentication."""
    
    _kind = 'User'
    
    def __init__(self, **kwargs):
        """Initialize User model."""
        super().__init__(**kwargs)
        
        # User-specific fields
        self.email: str = kwargs.get('email')
        self.password_hash: str = kwargs.get('password_hash')
        self.first_name: str = kwargs.get('first_name')
        self.last_name: str = kwargs.get('last_name', '')
        self.recommended_topic: Optional[str] = kwargs.get('recommended_topic')
        self.is_new_user: bool = kwargs.get('is_new_user', True)
    
    @classmethod
    def _get_required_fields(cls) -> List[str]:
        """Return list of required field names."""
        return ['email', 'password_hash', 'first_name']
    
    @classmethod
    def _get_excluded_indexes(cls) -> List[str]:
        """Return list of fields to exclude from Datastore indexes."""
        return ['password_hash']  # Don't index sensitive data
    
    def set_password(self, password: str) -> None:
        """Set password hash from plain text password."""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password: str) -> bool:
        """Check if provided password matches stored hash."""
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)
    
    @classmethod
    def get_by_email(cls, email: str) -> Optional['User']:
        """Get user by email address."""
        query = cls.query()
        query.add_filter('email', '=', email)
        
        results = list(query.fetch(limit=1))
        if results:
            return cls._from_entity(results[0])
        return None
    
    @classmethod
    def create_user(cls, email: str, password: str, first_name: str, 
                   last_name: str = '', recommended_topic: str = None) -> 'User':
        """Create a new user with password hashing."""
        # Check if user already exists
        if cls.get_by_email(email):
            raise ValueError("Email already exists")
        
        user = cls(
            email=email,
            first_name=first_name,
            last_name=last_name,
            recommended_topic=recommended_topic,
            is_new_user=True
        )
        user.set_password(password)
        return user.save()
    
    def mark_as_returning_user(self) -> 'User':
        """Mark user as no longer new."""
        self.is_new_user = False
        self.updated_at = datetime.datetime.now(datetime.timezone.utc)
        return self.save()
    
    def update_recommended_topic(self, topic: str) -> 'User':
        """Update user's recommended topic."""
        self.recommended_topic = topic
        self.updated_at = datetime.datetime.now(datetime.timezone.utc)
        return self.save()
    
    def get_full_name(self) -> str:
        """Get user's full name."""
        if self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name
    
    def to_dict(self, include_sensitive: bool = False) -> dict:
        """Convert user to dictionary for API responses."""
        data = {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'recommended_topic': self.recommended_topic,
            'is_new_user': self.is_new_user,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_sensitive:
            data['password_hash'] = self.password_hash
            
        return data
    
    def __repr__(self) -> str:
        """String representation of the user."""
        return f"User(id={self.id}, email={self.email}, name={self.get_full_name()})"