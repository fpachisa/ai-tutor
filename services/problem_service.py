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
                        with open(json_file, 'r', encoding='utf-8') as f:
                            problems_list = json.load(f)
                            # Check if the filename indicates it's a diagnostic quiz
                            is_diagnostic = 'diagnostic' in json_file.name.lower()
                            for problem in problems_list:
                                if is_diagnostic:
                                    diagnostic_problems[problem['id']] = problem
                                else:
                                    practice_problems[problem['id']] = problem
                    except Exception as e:
                        print(f"Error loading {json_file}: {e}")
        
        self.practice_problems = practice_problems
        self.diagnostic_problems = diagnostic_problems
        self.all_problems_map = {**practice_problems, **diagnostic_problems}
        self.all_topics = sorted(list(set(p.get("topic") for p in practice_problems.values() if p.get("topic"))))
        
        # Build topic cache for faster lookups
        self._build_topic_cache()
        
        print(f"Loaded {len(practice_problems)} practice problems and {len(diagnostic_problems)} diagnostic questions.")
    
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
    
    def get_practice_problems_dict(self) -> Dict:
        """Get the practice problems dictionary."""
        return self.practice_problems
    
    def get_diagnostic_problems_dict(self) -> Dict:
        """Get the diagnostic problems dictionary."""
        return self.diagnostic_problems


# Global instance
problem_service = ProblemService()