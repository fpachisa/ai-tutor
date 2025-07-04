"""
Bulk operations service for performance optimization.
"""
from typing import Dict, List, Optional, Tuple
from models.base import get_datastore_client
from models.problem_progress import ProblemProgress
from models.user import User


class BulkOperationsService:
    """Service for high-performance bulk operations."""
    
    def __init__(self):
        self.client = get_datastore_client()
    
    def get_user_dashboard_data_optimized(self, user_id: int, all_topics: List[str], 
                                         all_problem_ids_by_topic: Dict[str, List[str]]) -> Dict:
        """
        Optimized dashboard data loading with minimal database calls.
        
        Args:
            user_id: The user ID
            all_topics: List of all topic names
            all_problem_ids_by_topic: Map of topic -> list of problem IDs
            
        Returns:
            Dict with recommended topic and progress summary
        """
        # 1. Get user data in single call
        user = User.get_by_id(user_id)
        recommended_topic = user.recommended_topic if user else None
        
        if not recommended_topic:
            recommended_topic = all_topics[0] if all_topics else None
        
        # 2. Get ALL user progress in single query (instead of per-topic queries)
        query = self.client.query(kind='ProblemProgress')
        query.add_filter('user_id', '=', user_id)
        all_progress_entities = list(query.fetch())
        
        # 3. Build progress map once
        progress_map = {entity['problem_id']: entity['status'] for entity in all_progress_entities}
        
        # 4. Calculate topic summaries efficiently
        topic_summaries = {}
        for topic, problem_ids in all_problem_ids_by_topic.items():
            mastered = sum(1 for pid in problem_ids if progress_map.get(pid) == 'mastered')
            in_progress = sum(1 for pid in problem_ids if progress_map.get(pid) == 'in_progress')
            
            topic_summaries[topic] = {
                'total_problems': len(problem_ids),
                'mastered_count': mastered,
                'in_progress_count': in_progress,
                'completion_percentage': round((mastered / len(problem_ids)) * 100) if problem_ids else 0
            }
        
        return {
            'user': user,
            'recommended_topic': recommended_topic,
            'progress_map': progress_map,
            'topic_summaries': topic_summaries
        }
    
    def get_filtered_problems_optimized(self, user_id: int, topic: str, filter_type: str,
                                       problem_ids: List[str], progress_map: Dict[str, str] = None) -> List[str]:
        """
        Optimized problem filtering using pre-loaded progress map.
        
        Args:
            user_id: The user ID
            topic: Topic name
            filter_type: 'in_progress', 'mastered', or 'next'
            problem_ids: List of problem IDs for the topic
            progress_map: Pre-loaded progress map (optional, will fetch if not provided)
            
        Returns:
            List of filtered problem IDs
        """
        # Use provided progress map or fetch if not provided
        if progress_map is None:
            progress_entities = ProblemProgress.get_progress_for_problems(user_id, problem_ids)
            progress_map = {pid: prog.status for pid, prog in progress_entities.items()}
        
        # Apply filter efficiently
        if filter_type == 'in_progress':
            return [pid for pid in problem_ids if progress_map.get(pid) == 'in_progress']
        elif filter_type == 'mastered':
            return [pid for pid in problem_ids if progress_map.get(pid) == 'mastered']
        else:  # 'next' - find first unseen problem
            unseen = [pid for pid in problem_ids if pid not in progress_map]
            return [unseen[0]] if unseen else []
    
    def batch_get_topic_data(self, user_id: int, topics: List[str], 
                           problem_ids_by_topic: Dict[str, List[str]]) -> Dict[str, Dict]:
        """
        Batch load topic data for multiple topics efficiently.
        
        Args:
            user_id: The user ID
            topics: List of topic names to load
            problem_ids_by_topic: Map of topic -> problem IDs
            
        Returns:
            Dict mapping topic name to topic data
        """
        # Get all progress in one query
        all_problem_ids = []
        for topic in topics:
            all_problem_ids.extend(problem_ids_by_topic.get(topic, []))
        
        progress_entities = ProblemProgress.get_progress_for_problems(user_id, all_problem_ids)
        progress_map = {pid: prog.status for pid, prog in progress_entities.items()}
        
        # Build topic data efficiently
        topic_data = {}
        for topic in topics:
            problem_ids = problem_ids_by_topic.get(topic, [])
            
            mastered = sum(1 for pid in problem_ids if progress_map.get(pid) == 'mastered')
            in_progress = sum(1 for pid in problem_ids if progress_map.get(pid) == 'in_progress')
            
            # Get next problem efficiently
            unseen = [pid for pid in problem_ids if pid not in progress_map]
            next_problem_id = unseen[0] if unseen else None
            
            topic_data[topic] = {
                'total_problems': len(problem_ids),
                'mastered_count': mastered,
                'in_progress_count': in_progress,
                'next_problem_id': next_problem_id,
                'completion_percentage': round((mastered / len(problem_ids)) * 100) if problem_ids else 0
            }
        
        return topic_data
    
    def preload_user_session_data(self, user_id: int) -> Dict:
        """
        Preload all user session data in minimal database calls.
        
        Args:
            user_id: The user ID
            
        Returns:
            Dict with user data, all progress, and summary stats
        """
        # Single user query
        user = User.get_by_id(user_id)
        
        # Single progress query for all user progress
        query = self.client.query(kind='ProblemProgress')
        query.add_filter('user_id', '=', user_id)
        all_progress_entities = list(query.fetch())
        
        # Build maps
        progress_map = {entity['problem_id']: entity['status'] for entity in all_progress_entities}
        
        # Calculate overall stats
        total_problems_attempted = len(progress_map)
        mastered_total = sum(1 for status in progress_map.values() if status == 'mastered')
        in_progress_total = sum(1 for status in progress_map.values() if status == 'in_progress')
        
        return {
            'user': user,
            'progress_map': progress_map,
            'stats': {
                'total_attempted': total_problems_attempted,
                'total_mastered': mastered_total,
                'total_in_progress': in_progress_total,
                'mastery_rate': round((mastered_total / total_problems_attempted) * 100) if total_problems_attempted else 0
            }
        }


# Global instance
bulk_operations = BulkOperationsService()