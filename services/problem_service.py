"""
Problem management service.
"""
import json
import pathlib
import random
from typing import Dict, List, Optional, Tuple


class ProblemService:
    """Service class for managing problems and problem-related operations."""
    
    def __init__(self):
        self.practice_problems = {}
        self.diagnostic_problems = {}
        self.all_problems_map = {}
        self.all_topics = []
        self._problems_by_topic_cache = {}  # Cache for faster topic lookups
        self._load_all_problems()
    
    def _load_all_problems(self) -> None:
        """
        Loads all problems from all JSON files at startup and separates them
        into practice and diagnostic sets for efficient access.
        """
        practice_problems = {}
        diagnostic_problems = {}
        problem_base_dir = pathlib.Path('problems')

        if not problem_base_dir.is_dir():
            print("WARNING: 'problems' directory not found.")
            return

        for problem_dir in problem_base_dir.iterdir():
            if problem_dir.is_dir():
                for json_file in problem_dir.glob('*.json'):
                    try:
                        # Skip learning curriculum files (they have different structure)
                        if '_learn.json' in json_file.name:
                            continue
                            
                        with open(json_file, 'r', encoding='utf-8') as f:
                            problems_list = json.load(f)
                            # Check if the filename indicates it's a diagnostic quiz
                            is_diagnostic = 'diagnostic' in json_file.name.lower()
                            for problem in problems_list:
                                # Normalize problem data to ensure learn_step field exists
                                normalized_problem = self._normalize_problem(problem)
                                
                                if is_diagnostic:
                                    diagnostic_problems[problem['id']] = normalized_problem
                                else:
                                    practice_problems[problem['id']] = normalized_problem
                    except Exception as e:
                        print(f"Error loading {json_file}: {e}")
        
        self.practice_problems = practice_problems
        self.diagnostic_problems = diagnostic_problems
        self.all_problems_map = {**practice_problems, **diagnostic_problems}
        self.all_topics = sorted(list(set(p.get("topic") for p in practice_problems.values() if p.get("topic"))))
        
        # Build topic cache for faster lookups
        self._build_topic_cache()
        
        print(f"Loaded {len(practice_problems)} practice problems and {len(diagnostic_problems)} diagnostic questions.")
    
    def _normalize_problem(self, problem: Dict) -> Dict:
        """
        Normalize problem data to ensure all required fields exist.
        Adds learn_step field with default value if not present.
        """
        normalized = problem.copy()
        
        # Add learn_step field with default value if not present
        # None = problem can be practiced without specific learning step completion
        if 'learn_step' not in normalized:
            normalized['learn_step'] = None
            
        return normalized
    
    def _build_topic_cache(self) -> None:
        """Build cache of problems by topic for faster lookups."""
        for pid, problem in self.practice_problems.items():
            topic = problem.get('topic')
            if topic:
                if topic not in self._problems_by_topic_cache:
                    self._problems_by_topic_cache[topic] = []
                self._problems_by_topic_cache[topic].append(pid)
    
    def get_practice_problem(self, problem_id: str) -> Optional[Dict]:
        """Get a practice problem by ID."""
        return self.practice_problems.get(problem_id)
    
    def get_diagnostic_problem(self, problem_id: str) -> Optional[Dict]:
        """Get a diagnostic problem by ID."""
        return self.diagnostic_problems.get(problem_id)
    
    def get_any_problem(self, problem_id: str) -> Optional[Dict]:
        """Get any problem (practice or diagnostic) by ID."""
        return self.all_problems_map.get(problem_id)
    
    def get_problems_by_topic(self, topic: str) -> List[str]:
        """Get all practice problem IDs for a specific topic using cache."""
        return self._problems_by_topic_cache.get(topic, [])
    
    def get_all_topics(self) -> List[str]:
        """Get all available topics."""
        return self.all_topics.copy()
    
    def get_problems_by_learning_step(self, topic: str, max_step: Optional[int] = None) -> List[str]:
        """
        Get practice problem IDs for a specific topic filtered by learning step.
        
        Args:
            topic: The topic to filter by
            max_step: Maximum learning step (inclusive). If None, returns all problems.
                     Problems with learn_step=None are always included.
        
        Returns:
            List of problem IDs appropriate for the learning step
        """
        topic_problems = self.get_problems_by_topic(topic)
        
        if max_step is None:
            return topic_problems
        
        filtered_problems = []
        for problem_id in topic_problems:
            problem = self.get_practice_problem(problem_id)
            if problem:
                problem_step = problem.get('learn_step')
                # Include problems with no step requirement or step <= max_step
                if problem_step is None or problem_step <= max_step:
                    filtered_problems.append(problem_id)
        
        return filtered_problems
    
    def get_problems_for_specific_step(self, topic: str, step: int) -> List[str]:
        """
        Get practice problems specifically designed for a particular learning step.
        
        Args:
            topic: The topic to filter by
            step: The specific learning step number
        
        Returns:
            List of problem IDs for that specific step
        """
        topic_problems = self.get_problems_by_topic(topic)
        
        step_problems = []
        for problem_id in topic_problems:
            problem = self.get_practice_problem(problem_id)
            if problem and problem.get('learn_step') == step:
                step_problems.append(problem_id)
        
        return step_problems
    
    def get_practice_problems_dict(self) -> Dict:
        """Get the practice problems dictionary."""
        return self.practice_problems
    
    def get_diagnostic_problems_dict(self) -> Dict:
        """Get the diagnostic problems dictionary."""
        return self.diagnostic_problems


# Global instance
problem_service = ProblemService()