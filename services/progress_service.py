"""
Progress tracking service.
"""
import datetime
from typing import Dict, List, Optional
from models.problem_progress import ProblemProgress
from models.chat_history import ChatHistory


class ProgressService:
    """Service class for managing user progress and chat history."""
    
    def __init__(self):
        pass
    
    def get_chat_history(self, user_id: int, problem_id: str) -> List[Dict]:
        """Get chat history for a specific user and problem."""
        chat_history = ChatHistory.get_chat_history(user_id, problem_id)
        if chat_history:
            return chat_history.history
        return []
    
    def save_progress(self, user_id: int, problem_id: str, status: str, chat_history: List[Dict]) -> None:
        """Save user progress and chat history for a problem."""
        # Save progress using ProblemProgress model
        ProblemProgress.create_or_update_progress(user_id, problem_id, status)
        
        # Save chat history - APPEND new messages instead of replacing
        if chat_history:  # Only save if there are new messages
            existing_chat = ChatHistory.get_chat_history(user_id, problem_id)
            if existing_chat and existing_chat.history:
                # Append new messages to existing history
                combined_history = existing_chat.history + chat_history
                print(f"💾 APPEND: Adding {len(chat_history)} messages to existing {len(existing_chat.history)} → Total: {len(combined_history)}")
            else:
                # No existing history, use new messages
                combined_history = chat_history
                print(f"💾 CREATE: Creating new history with {len(chat_history)} messages")
            
            ChatHistory.create_or_update_history(user_id, problem_id, combined_history)
    
    def get_all_user_progress(self, user_id: int) -> Dict[str, str]:
        """Get all progress for a user as a map of problem_id -> status."""
        progress_list = ProblemProgress.get_all_user_progress(user_id)
        return {progress.problem_id: progress.status for progress in progress_list}
    
    def get_user_progress_for_topic(self, user_id: int, problem_ids: List[str]) -> Dict[str, str]:
        """Get user progress for specific problem IDs."""
        progress_map = ProblemProgress.get_progress_for_problems(user_id, problem_ids)
        return {problem_id: progress.status for problem_id, progress in progress_map.items()}
    
    def get_topic_summary(self, user_id: int, problem_ids: List[str]) -> Dict[str, int]:
        """Get progress summary for a topic using optimized bulk operations."""
        # Use bulk operations for better performance
        from services.bulk_operations import bulk_operations
        
        # Get progress map efficiently
        progress_entities = ProblemProgress.get_progress_for_problems(user_id, problem_ids)
        progress_map = {pid: prog.status for pid, prog in progress_entities.items()}
        
        # Calculate summary
        mastered_count = sum(1 for pid in problem_ids if progress_map.get(pid) == 'mastered')
        in_progress_count = sum(1 for pid in problem_ids if progress_map.get(pid) == 'in_progress')
        
        return {
            "total_problems": len(problem_ids),
            "mastered_count": mastered_count,
            "in_progress_count": in_progress_count
        }
    
    def get_recent_progress(self, user_id: int, limit: int = 5) -> List[ProblemProgress]:
        """Get recent progress for a user."""
        return ProblemProgress.get_recent_user_progress(user_id, limit)
    
    def save_multiple_progress(self, save_operations: List[Dict]) -> None:
        """
        Save multiple progress updates efficiently.
        
        Args:
            save_operations: List of dicts with keys:
                - user_id: int
                - problem_id: str  
                - status: str
                - chat_history: List[Dict] (optional)
        """
        for operation in save_operations:
            user_id = operation['user_id']
            problem_id = operation['problem_id']
            status = operation['status']
            chat_history = operation.get('chat_history', [])
            
            # Use existing save_progress method to maintain all current logic
            self.save_progress(user_id, problem_id, status, chat_history)


# Global instance
progress_service = ProgressService()