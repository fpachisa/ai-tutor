"""
Content management service for dashboard and topics.
"""
import random
from typing import Dict, List
from config.settings import Config
from models.user import User
from models.problem_progress import ProblemProgress
from services.bulk_operations import bulk_operations


class ContentService:
    """Service class for content management operations."""
    
    def __init__(self):
        pass
    
    def get_dashboard_data(self, user_id: int) -> Dict:
        """
        Get dashboard data for a user including recommended and all topics.
        
        Returns:
            Dict containing recommended_topics and all_topics lists
        """
        try:
            # Use optimized single-query approach
            session_data = bulk_operations.preload_user_session_data(user_id)
            user = session_data['user']

            if user and user.recommended_topic:
                recommended_topic = user.recommended_topic
            else:
                # If no recommendation exists, default to a random topic
                recommended_topic = random.choice(Config.P6_TOPICS)

            # The 'all_topics' list should not contain any recommended topics
            browse_topics = [topic for topic in Config.P6_TOPICS if topic != recommended_topic]

            print("Final Recommendations: ", recommended_topic)

            # Construct and Return the Final Dashboard Data
            dashboard_data = {
                "recommended_topics": [recommended_topic],
                "all_topics": browse_topics
            }
            return dashboard_data

        except Exception as e:
            print(f"An error occurred fetching dashboard data: {e}")
            # On error, return all topics in the main list
            return {
                "recommended_topics": [],
                "all_topics": Config.P6_TOPICS
            }
    
    def get_filtered_problems(self, user_id: int, topic: str, filter_type: str, 
                            problem_ids: List[str], practice_problems: Dict) -> List[Dict]:
        """
        Get filtered problems for a topic based on user progress.
        
        Args:
            user_id: The user ID
            topic: The topic name
            filter_type: 'in_progress', 'mastered', or 'next'
            problem_ids: List of problem IDs for the topic
            practice_problems: Dictionary of all practice problems
            
        Returns:
            List of problem data dictionaries
        """
        # Get progress for the specific problems using ProblemProgress model
        progress_map = ProblemProgress.get_progress_for_problems(user_id, problem_ids)

        # Apply the requested filter
        filtered_problem_ids = []
        if filter_type == 'in_progress':
            filtered_problem_ids = [pid for pid in problem_ids if pid in progress_map and progress_map[pid].status == 'in_progress']
        elif filter_type == 'mastered':
            filtered_problem_ids = [pid for pid in problem_ids if pid in progress_map and progress_map[pid].status == 'mastered']
        else:  # Default case is to find the 'next' unseen problem
            unseen_problem_ids = [pid for pid in problem_ids if pid not in progress_map]
            if unseen_problem_ids:
                # Return just the first unseen problem
                filtered_problem_ids = [unseen_problem_ids[0]]

        # Fetch the full problem data for the filtered IDs
        final_problem_list = []
        for pid in filtered_problem_ids:
            problem_data = practice_problems.get(pid)
            if problem_data:
                final_problem_list.append({
                    "id": problem_data.get("id"),
                    "title": problem_data.get("title", "Untitled"),
                    "topic": problem_data.get("topic")
                })

        return final_problem_list


# Global instance
content_service = ContentService()