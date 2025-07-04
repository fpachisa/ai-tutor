"""
Base model class for data access layer.
"""
import datetime
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Type, TypeVar
from google.cloud import datastore

# Type variable for generic model operations
ModelType = TypeVar('ModelType', bound='BaseModel')

# Shared Datastore client for performance
_datastore_client = None

def get_datastore_client():
    """Get shared Datastore client instance."""
    global _datastore_client
    if _datastore_client is None:
        _datastore_client = datastore.Client()
    return _datastore_client


class BaseModel(ABC):
    """Base class for all data models with common CRUD operations."""
    
    # Subclasses must define the Datastore kind
    _kind: str = None
    
    def __init__(self, **kwargs):
        """Initialize model with provided data."""
        self.id: Optional[int] = kwargs.get('id')
        self.created_at: Optional[datetime.datetime] = kwargs.get('created_at')
        self.updated_at: Optional[datetime.datetime] = kwargs.get('updated_at')
        
        # Set additional attributes from kwargs
        for key, value in kwargs.items():
            if not key.startswith('_') and key not in ['id', 'created_at', 'updated_at']:
                setattr(self, key, value)
    
    @classmethod
    @abstractmethod
    def _get_required_fields(cls) -> List[str]:
        """Return list of required field names for validation."""
        pass
    
    @classmethod
    @abstractmethod
    def _get_excluded_indexes(cls) -> List[str]:
        """Return list of fields to exclude from Datastore indexes."""
        pass
    
    def _validate_required_fields(self) -> None:
        """Validate that all required fields are present."""
        required_fields = self._get_required_fields()
        for field in required_fields:
            if not hasattr(self, field) or getattr(self, field) is None:
                raise ValueError(f"Required field '{field}' is missing or None")
    
    def _to_entity_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary for Datastore entity."""
        data = {}
        for key, value in self.__dict__.items():
            if not key.startswith('_') and key != 'id':
                data[key] = value
        
        # Set timestamps
        now = datetime.datetime.now(datetime.timezone.utc)
        if not self.created_at:
            data['created_at'] = now
        if not self.updated_at:
            data['updated_at'] = now
        
        return data
    
    @classmethod
    def _from_entity(cls: Type[ModelType], entity: datastore.Entity) -> ModelType:
        """Create model instance from Datastore entity."""
        if not entity:
            return None
        
        data = dict(entity)
        data['id'] = entity.key.id or entity.key.name
        return cls(**data)
    
    def save(self) -> 'BaseModel':
        """Save the model to Datastore."""
        if not self._kind:
            raise NotImplementedError("Model must define _kind class attribute")
        
        self._validate_required_fields()
        
        client = get_datastore_client()
        
        # Create or update entity
        if self.id:
            key = client.key(self._kind, self.id)
        else:
            key = client.key(self._kind)
        
        entity = datastore.Entity(key=key, exclude_from_indexes=self._get_excluded_indexes())
        entity.update(self._to_entity_dict())
        
        client.put(entity)
        
        # Update the model with the generated ID
        if not self.id:
            self.id = entity.key.id
        
        return self
    
    @classmethod
    def get_by_id(cls: Type[ModelType], model_id: int) -> Optional[ModelType]:
        """Get model by ID."""
        if not cls._kind:
            raise NotImplementedError("Model must define _kind class attribute")
        
        client = get_datastore_client()
        key = client.key(cls._kind, model_id)
        entity = client.get(key)
        return cls._from_entity(entity)
    
    @classmethod
    def get_by_key(cls: Type[ModelType], key_name: str) -> Optional[ModelType]:
        """Get model by key name."""
        if not cls._kind:
            raise NotImplementedError("Model must define _kind class attribute")
        
        client = get_datastore_client()
        key = client.key(cls._kind, key_name)
        entity = client.get(key)
        return cls._from_entity(entity)
    
    @classmethod
    def query(cls: Type[ModelType]) -> datastore.Query:
        """Create a query for this model kind."""
        if not cls._kind:
            raise NotImplementedError("Model must define _kind class attribute")
        
        client = get_datastore_client()
        return client.query(kind=cls._kind)
    
    @classmethod
    def get_multi(cls: Type[ModelType], keys: List[str]) -> List[Optional[ModelType]]:
        """Get multiple models by keys."""
        if not cls._kind:
            raise NotImplementedError("Model must define _kind class attribute")
        
        client = get_datastore_client()
        datastore_keys = [client.key(cls._kind, key) for key in keys]
        entities = client.get_multi(datastore_keys)
        
        return [cls._from_entity(entity) for entity in entities]
    
    def delete(self) -> None:
        """Delete the model from Datastore."""
        if not self.id:
            raise ValueError("Cannot delete model without ID")
        
        client = get_datastore_client()
        key = client.key(self._kind, self.id)
        client.delete(key)
    
    def __repr__(self) -> str:
        """String representation of the model."""
        return f"{self.__class__.__name__}(id={self.id})"