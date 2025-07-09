"""
Concept service for AI-guided learning pathways.
"""
import json
import pathlib
from typing import Dict, List, Optional, Tuple
from models.concept import Concept, ConceptProgress
from models.problem_progress import ProblemProgress
from services.tutor_service import tutor_service


class ConceptService:
    """Service class for managing concepts and learning pathways."""
    
    def __init__(self):
        self.concepts_cache = {}
        self.topic_concepts_cache = {}
        self.problem_mappings = {}
        self._load_concepts()
        self._load_problem_mappings()
    
    def _load_concepts(self) -> None:
        """Load all concepts from JSON files into cache."""
        concepts_dir = pathlib.Path('data/concepts')
        
        if not concepts_dir.exists():
            print("WARNING: Concepts directory not found.")
            return
        
        for json_file in concepts_dir.glob('*.json'):
            # Skip problem mapping files
            if 'mapping' in json_file.name:
                continue
                
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    concepts_list = json.load(f)
                    
                for concept_data in concepts_list:
                    concept = Concept(**concept_data)
                    self.concepts_cache[concept.concept_id] = concept
                    
                    # Build topic cache
                    topic = concept.topic
                    if topic not in self.topic_concepts_cache:
                        self.topic_concepts_cache[topic] = []
                    self.topic_concepts_cache[topic].append(concept)
                    
            except Exception as e:
                print(f"Error loading concepts from {json_file}: {e}")
        
        # Sort concepts in each topic by difficulty level
        for topic in self.topic_concepts_cache:
            self.topic_concepts_cache[topic].sort(key=lambda c: c.difficulty_level)
        
        print(f"Loaded {len(self.concepts_cache)} concepts across {len(self.topic_concepts_cache)} topics.")
    
    def _load_problem_mappings(self) -> None:
        """Load problem-to-concept mappings for better integration."""
        mapping_files = [
            'data/concepts/algebra_problem_mapping.json',
            'data/concepts/fractions_problem_mapping.json'
            # Add more mapping files for other topics as needed
        ]
        
        for mapping_file in mapping_files:
            mapping_path = pathlib.Path(mapping_file)
            if mapping_path.exists():
                try:
                    with open(mapping_path, 'r', encoding='utf-8') as f:
                        mapping_data = json.load(f)
                        # Extract the topic from filename (e.g., algebra_problem_mapping.json -> algebra)
                        topic = mapping_path.stem.split('_')[0].title()
                        self.problem_mappings[topic] = mapping_data
                        print(f"Loaded problem mappings for {topic}")
                except Exception as e:
                    print(f"Error loading problem mappings from {mapping_file}: {e}")
            else:
                print(f"Problem mapping file not found: {mapping_file}")
    
    def get_concept_by_id(self, concept_id: str) -> Optional[Concept]:
        """Get a concept by its ID."""
        return self.concepts_cache.get(concept_id)
    
    def get_concepts_for_topic(self, topic: str) -> List[Concept]:
        """Get all concepts for a specific topic, ordered by difficulty."""
        return self.topic_concepts_cache.get(topic, [])
    
    def get_learning_pathway(self, user_id: int, topic: str) -> Dict:
        """
        Generate a personalized learning pathway for a user and topic.
        
        Returns:
            Dict containing recommended concepts, progress summary, and next steps
        """
        concepts = self.get_concepts_for_topic(topic)
        if not concepts:
            return {"error": f"No concepts found for topic: {topic}"}
        
        # Get user's progress on all concepts in this topic
        concept_progress = {}
        for concept in concepts:
            progress = ConceptProgress.get_user_concept_progress(user_id, concept.concept_id)
            concept_progress[concept.concept_id] = progress
        
        # Determine learning pathway
        pathway = self._analyze_learning_pathway(concepts, concept_progress)
        
        return {
            "topic": topic,
            "total_concepts": len(concepts),
            "user_progress": self._summarize_progress(concept_progress),
            "recommended_pathway": pathway,
            "next_concept": self._get_next_concept(concepts, concept_progress),
            "ready_for_problems": self._assess_readiness_for_problems(concepts, concept_progress)
        }
    
    def _analyze_learning_pathway(self, concepts: List[Concept], 
                                concept_progress: Dict) -> List[Dict]:
        """Analyze and create a learning pathway based on user progress."""
        pathway = []
        
        for concept in concepts:
            progress = concept_progress.get(concept.concept_id)
            
            # Check prerequisite readiness
            prereq_status = self._check_prerequisites(concept, concept_progress)
            
            status = "locked"
            if prereq_status["ready"]:
                if not progress:
                    status = "available"
                elif progress.understanding_level == "not_started":
                    status = "available"
                elif progress.understanding_level in ["exploring", "understood"]:
                    status = "in_progress"
                elif progress.understanding_level == "mastered":
                    status = "completed"
            
            pathway.append({
                "concept_id": concept.concept_id,
                "title": concept.title,
                "difficulty_level": concept.difficulty_level,
                "status": status,
                "prerequisites_met": prereq_status["ready"],
                "missing_prerequisites": prereq_status["missing"],
                "confidence_score": progress.confidence_score if progress else 0,
                "time_spent": progress.time_spent_minutes if progress else 0
            })
        
        return pathway
    
    def _check_prerequisites(self, concept: Concept, 
                           concept_progress: Dict) -> Dict:
        """Check if user has mastered all prerequisites for a concept."""
        if not concept.prerequisites:
            return {"ready": True, "missing": []}
        
        missing_prereqs = []
        for prereq_id in concept.prerequisites:
            progress = concept_progress.get(prereq_id)
            if not progress or progress.understanding_level != "mastered":
                missing_prereqs.append(prereq_id)
        
        return {
            "ready": len(missing_prereqs) == 0,
            "missing": missing_prereqs
        }
    
    def _summarize_progress(self, concept_progress: Dict) -> Dict:
        """Summarize user's overall progress across concepts."""
        total = len(concept_progress)
        not_started = sum(1 for p in concept_progress.values() 
                         if p is None or p.understanding_level == "not_started")
        exploring = sum(1 for p in concept_progress.values() 
                       if p and p.understanding_level == "exploring")
        understood = sum(1 for p in concept_progress.values() 
                        if p and p.understanding_level == "understood")
        mastered = sum(1 for p in concept_progress.values() 
                      if p and p.understanding_level == "mastered")
        
        return {
            "total_concepts": total,
            "not_started": not_started,
            "exploring": exploring,
            "understood": understood,
            "mastered": mastered,
            "completion_percentage": round((mastered / total) * 100) if total > 0 else 0
        }
    
    def _get_next_concept(self, concepts: List[Concept], 
                         concept_progress: Dict) -> Optional[Dict]:
        """Determine the next concept the user should learn."""
        for concept in concepts:  # Already sorted by difficulty
            progress = concept_progress.get(concept.concept_id)
            prereq_status = self._check_prerequisites(concept, concept_progress)
            
            # Find first available or in-progress concept
            if prereq_status["ready"]:
                if not progress or progress.understanding_level in ["not_started", "exploring"]:
                    return {
                        "concept_id": concept.concept_id,
                        "title": concept.title,
                        "description": concept.description,
                        "difficulty_level": concept.difficulty_level,
                        "reason": "Next in sequence" if not progress else "Continue learning"
                    }
        
        return None
    
    def _assess_readiness_for_problems(self, concepts: List[Concept], 
                                     concept_progress: Dict) -> Dict:
        """Assess if user is ready to start practicing problems."""
        essential_concepts = [c for c in concepts if c.difficulty_level <= 2]  # Basic concepts
        
        ready_count = 0
        for concept in essential_concepts:
            progress = concept_progress.get(concept.concept_id)
            if progress and progress.understanding_level in ["understood", "mastered"]:
                ready_count += 1
        
        readiness_percentage = (ready_count / len(essential_concepts)) * 100 if essential_concepts else 100
        
        return {
            "ready": readiness_percentage >= 70,  # Need 70% of basic concepts understood
            "readiness_percentage": round(readiness_percentage),
            "essential_concepts_ready": ready_count,
            "essential_concepts_total": len(essential_concepts),
            "recommendation": self._get_readiness_recommendation(readiness_percentage)
        }
    
    def _get_readiness_recommendation(self, readiness_percentage: float) -> str:
        """Get recommendation based on readiness percentage."""
        if readiness_percentage >= 90:
            return "You're ready for challenging problems! Let's practice!"
        elif readiness_percentage >= 70:
            return "You understand the basics well. Try some practice problems!"
        elif readiness_percentage >= 50:
            return "Learn a few more concepts, then you'll be ready for problems."
        else:
            return "Focus on understanding the core concepts first."
    
    def start_concept_learning(self, user_id: int, concept_id: str) -> Dict:
        """Start learning a specific concept for a user."""
        concept = self.get_concept_by_id(concept_id)
        if not concept:
            return {"error": f"Concept {concept_id} not found"}
        
        # Check prerequisites
        all_concept_progress = {}
        for topic_concepts in self.topic_concepts_cache.values():
            for c in topic_concepts:
                progress = ConceptProgress.get_user_concept_progress(user_id, c.concept_id)
                all_concept_progress[c.concept_id] = progress
        
        prereq_status = self._check_prerequisites(concept, all_concept_progress)
        if not prereq_status["ready"]:
            return {
                "error": "Prerequisites not met",
                "missing_prerequisites": prereq_status["missing"],
                "suggested_action": "Complete prerequisite concepts first"
            }
        
        # Create or update progress
        progress = ConceptProgress.create_or_update_progress(
            user_id=user_id,
            concept_id=concept_id,
            understanding_level="exploring",
            confidence_score=10  # Starting confidence
        )
        
        return {
            "concept": concept.to_dict(),
            "progress": progress.to_dict(),
            "learning_session": self._create_learning_session(concept)
        }
    
    def _create_learning_session(self, concept: Concept) -> Dict:
        """Create a structured learning session for a concept."""
        return {
            "session_id": f"session_{concept.concept_id}",
            "phases": [
                {
                    "phase": "introduction",
                    "title": f"What is {concept.title}?",
                    "content": concept.description,
                    "visual": concept.visual_elements,
                    "duration_minutes": 3
                },
                {
                    "phase": "exploration",
                    "title": "Let's Explore Together",
                    "activities": concept.interactive_activities,
                    "duration_minutes": 5
                },
                {
                    "phase": "real_world",
                    "title": "See It in Real Life",
                    "examples": concept.real_world_examples,
                    "duration_minutes": 3
                },
                {
                    "phase": "practice",
                    "title": "Quick Check",
                    "type": "mini_assessment",
                    "duration_minutes": 4
                }
            ],
            "total_duration_minutes": 15,
            "learning_objectives": concept.learning_objectives
        }
    
    def update_concept_progress(self, user_id: int, concept_id: str, 
                              understanding_level: str, confidence_score: int,
                              time_spent_minutes: int) -> Dict:
        """Update user's progress on a specific concept."""
        progress = ConceptProgress.create_or_update_progress(
            user_id=user_id,
            concept_id=concept_id,
            understanding_level=understanding_level,
            confidence_score=confidence_score,
            time_spent_minutes=time_spent_minutes
        )
        
        return {
            "updated_progress": progress.to_dict(),
            "next_recommendation": self._get_next_recommendation(user_id, concept_id)
        }
    
    def assess_concept_understanding(self, user_id: int, concept_id: str, 
                                   user_responses: List[Dict]) -> Dict:
        """Use Gemini AI to assess user's understanding of a concept."""
        concept = self.get_concept_by_id(concept_id)
        if not concept:
            return {"error": "Concept not found"}
        
        # Create assessment prompt
        assessment_prompt = self._create_assessment_prompt(concept, user_responses)
        
        # Get AI assessment
        ai_response = tutor_service.get_ai_response(assessment_prompt)
        
        # Parse AI response and update progress
        assessment_result = self._parse_ai_assessment(ai_response)
        
        # Update progress based on AI assessment
        new_progress = ConceptProgress.create_or_update_progress(
            user_id=user_id,
            concept_id=concept_id,
            understanding_level=assessment_result["understanding_level"],
            confidence_score=assessment_result["confidence_score"],
            time_spent_minutes=assessment_result.get("time_spent", 0)
        )
        
        return {
            "assessment": assessment_result,
            "updated_progress": new_progress.to_dict(),
            "ai_feedback": assessment_result["feedback"],
            "next_steps": assessment_result["next_steps"]
        }
    
    def _create_assessment_prompt(self, concept: Concept, user_responses: List[Dict]) -> str:
        """Create a prompt for AI assessment of concept understanding."""
        prompt = f"""
You are an expert Primary 6 mathematics tutor specializing in {concept.topic}. 
You need to assess a student's understanding of the concept: "{concept.title}".

CONCEPT DETAILS:
- Title: {concept.title}
- Description: {concept.description}
- Learning Objectives: {', '.join(concept.learning_objectives)}
- Difficulty Level: {concept.difficulty_level}/5
- Common Misconceptions: {', '.join(concept.common_misconceptions)}

STUDENT RESPONSES:
"""
        
        for i, response in enumerate(user_responses, 1):
            prompt += f"\nQuestion {i}: {response.get('question', 'N/A')}"
            prompt += f"\nStudent Answer: {response.get('answer', 'N/A')}"
            prompt += f"\nCorrect Answer: {response.get('correct_answer', 'N/A')}"
            prompt += f"\nTime Taken: {response.get('time_seconds', 0)} seconds"
            prompt += "\n---"
        
        prompt += """

ASSESSMENT TASK:
Based on the student's responses, assess their understanding level and provide specific feedback.

Please respond in the following JSON format:
{
    "understanding_level": "not_started|exploring|understood|mastered",
    "confidence_score": 0-100,
    "strengths": ["specific strength 1", "specific strength 2"],
    "areas_for_improvement": ["specific area 1", "specific area 2"],
    "feedback": "Personalized feedback for the student (2-3 sentences)",
    "next_steps": "Specific recommendation for what to do next",
    "misconceptions_detected": ["any misconceptions observed"],
    "readiness_for_problems": true/false
}

ASSESSMENT CRITERIA:
- not_started: Student shows no understanding
- exploring: Student shows basic awareness but makes significant errors
- understood: Student demonstrates good understanding with minor gaps
- mastered: Student shows complete understanding and can apply concepts confidently

Be encouraging but honest. Focus on Singapore P6 mathematics standards.
"""
        
        return prompt
    
    def _parse_ai_assessment(self, ai_response: str) -> Dict:
        """Parse AI assessment response."""
        try:
            # Try to extract JSON from the response
            import re
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                assessment_data = json.loads(json_match.group())
                return assessment_data
            else:
                # Fallback parsing
                return {
                    "understanding_level": "exploring",
                    "confidence_score": 50,
                    "strengths": ["Attempted the questions"],
                    "areas_for_improvement": ["Need more practice"],
                    "feedback": "Keep practicing! You're making good progress.",
                    "next_steps": "Continue with more practice questions",
                    "misconceptions_detected": [],
                    "readiness_for_problems": False
                }
        except Exception as e:
            print(f"Error parsing AI assessment: {e}")
            return {
                "understanding_level": "exploring",
                "confidence_score": 50,
                "strengths": ["Attempted the questions"],
                "areas_for_improvement": ["Need more practice"],
                "feedback": "Keep practicing! You're making good progress.",
                "next_steps": "Continue with more practice questions",
                "misconceptions_detected": [],
                "readiness_for_problems": False
            }
    
    def generate_personalized_practice(self, user_id: int, concept_id: str, 
                                     difficulty_preference: str = "adaptive") -> Dict:
        """Generate personalized practice questions using Gemini AI."""
        concept = self.get_concept_by_id(concept_id)
        if not concept:
            return {"error": "Concept not found"}
        
        # Get user's current progress
        progress = ConceptProgress.get_user_concept_progress(user_id, concept_id)
        
        # Create practice generation prompt
        practice_prompt = self._create_practice_prompt(concept, progress, difficulty_preference)
        
        # Get AI-generated practice questions
        ai_response = tutor_service.get_ai_response(practice_prompt)
        
        # Parse and return practice questions
        practice_questions = self._parse_practice_questions(ai_response)
        
        return {
            "concept_id": concept_id,
            "concept_title": concept.title,
            "difficulty_level": difficulty_preference,
            "practice_questions": practice_questions,
            "estimated_time_minutes": len(practice_questions) * 2
        }
    
    def _create_practice_prompt(self, concept: Concept, progress: ConceptProgress, 
                               difficulty: str) -> str:
        """Create prompt for generating practice questions."""
        current_level = progress.understanding_level if progress else "not_started"
        confidence = progress.confidence_score if progress else 0
        
        prompt = f"""
You are creating practice questions for a Primary 6 student learning {concept.topic}.

CONCEPT: {concept.title}
DESCRIPTION: {concept.description}
LEARNING OBJECTIVES: {', '.join(concept.learning_objectives)}
STUDENT'S CURRENT LEVEL: {current_level}
STUDENT'S CONFIDENCE: {confidence}%

DIFFICULTY PREFERENCE: {difficulty}
- If "adaptive": Match the student's current level
- If "easy": Focus on basic understanding
- If "medium": Standard P6 level
- If "hard": Challenge the student

REQUIREMENTS:
1. Create 3-5 practice questions
2. Include step-by-step solutions
3. Provide helpful hints
4. Use Singapore P6 mathematics context
5. Make questions engaging and relevant

Please respond in the following JSON format:
{
    "questions": [
        {
            "question_id": "q1",
            "question_text": "Question text here",
            "question_type": "multiple_choice|short_answer|word_problem",
            "options": ["A", "B", "C", "D"] // for multiple choice only
            "correct_answer": "Answer here",
            "hints": ["hint1", "hint2"],
            "solution_steps": ["step1", "step2", "step3"],
            "difficulty_level": 1-5,
            "estimated_time_seconds": 60
        }
    ]
}

Make questions that are:
- Clear and age-appropriate
- Culturally relevant to Singapore
- Progressive in difficulty
- Engaging with real-world contexts
"""
        
        return prompt
    
    def _parse_practice_questions(self, ai_response: str) -> List[Dict]:
        """Parse AI-generated practice questions."""
        try:
            import re
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                questions_data = json.loads(json_match.group())
                return questions_data.get("questions", [])
            else:
                # Fallback - return empty list
                return []
        except Exception as e:
            print(f"Error parsing practice questions: {e}")
            return []
    
    def get_recommended_problems_for_concept(self, user_id: int, concept_id: str) -> Dict:
        """Get recommended problems for a specific concept based on user's progress."""
        concept = self.get_concept_by_id(concept_id)
        if not concept:
            return {"error": "Concept not found"}
        
        # Get problem mappings for this topic
        topic_mappings = self.problem_mappings.get(concept.topic, {})
        concept_to_problems = topic_mappings.get("concept_to_problems", {})
        problem_to_concepts = topic_mappings.get("problem_to_concepts", {})
        
        # Get related problem IDs for this concept
        concept_data = concept_to_problems.get(concept_id, {})
        related_problem_ids = concept_data.get("related_problems", [])
        
        if not related_problem_ids:
            return {
                "concept_id": concept_id,
                "concept_title": concept.title,
                "recommended_problems": [],
                "message": "No specific problems mapped to this concept yet. Try AI-generated practice questions instead."
            }
        
        # Get full problem data from problem service
        from services.problem_service import problem_service
        all_problems = problem_service.get_problems_for_topic(concept.topic)
        
        # Filter to get the recommended problems
        recommended_problems = []
        for problem in all_problems:
            if problem.get('id') in related_problem_ids:
                # Add concept-specific metadata
                problem_id = problem.get('id')
                problem_mapping = problem_to_concepts.get(problem_id, {})
                
                problem_with_metadata = problem.copy()
                problem_with_metadata['concept_metadata'] = {
                    "primary_concept": problem_mapping.get("primary_concept"),
                    "difficulty_alignment": problem_mapping.get("difficulty_alignment"),
                    "skills_reinforced": problem_mapping.get("skills_reinforced", []),
                    "prerequisite_concepts": problem_mapping.get("prerequisite_concepts", [])
                }
                recommended_problems.append(problem_with_metadata)
        
        # Sort by complexity/difficulty
        recommended_problems.sort(key=lambda p: p.get('complexity', 3))
        
        return {
            "concept_id": concept_id,
            "concept_title": concept.title,
            "recommended_problems": recommended_problems,
            "total_problems": len(recommended_problems),
            "practice_types": concept_data.get("practice_types", []),
            "next_steps": self._get_problem_practice_guidance(user_id, concept_id, recommended_problems)
        }
    
    def _get_problem_practice_guidance(self, user_id: int, concept_id: str, problems: List[Dict]) -> Dict:
        """Provide guidance on how to approach the recommended problems."""
        # Get user's progress on this concept
        progress = ConceptProgress.get_user_concept_progress(user_id, concept_id)
        
        if not progress or progress.understanding_level in ["not_started", "exploring"]:
            return {
                "recommendation": "Start with the easiest problems and focus on understanding the steps",
                "suggested_order": "sequential",
                "support_level": "high",
                "message": "Take your time with each problem and ask for help if needed"
            }
        elif progress.understanding_level == "understood":
            return {
                "recommendation": "Try a mix of problems to reinforce your understanding",
                "suggested_order": "mixed",
                "support_level": "medium", 
                "message": "You're doing well! These problems will help solidify your knowledge"
            }
        else:  # mastered
            return {
                "recommendation": "Challenge yourself with the harder problems in this set",
                "suggested_order": "reverse",  # Start with harder ones
                "support_level": "low",
                "message": "You've mastered the concept! Use these to maintain your skills"
            }
    
    def get_adaptive_learning_path(self, user_id: int, topic: str) -> Dict:
        """Get an adaptive learning path that adjusts based on user's performance."""
        # Get current pathway
        pathway = self.get_learning_pathway(user_id, topic)
        
        # Get problem mappings for adaptive recommendations
        topic_mappings = self.problem_mappings.get(topic, {})
        adaptive_recs = topic_mappings.get("adaptive_recommendations", {})
        learning_progression = topic_mappings.get("learning_progression", {})
        
        # Analyze user's current state and provide adaptive guidance
        user_progress = pathway["user_progress"]
        next_concept = pathway["next_concept"]
        
        # Determine if user is struggling based on progress patterns
        struggling_areas = self._detect_struggling_areas(user_id, topic, user_progress)
        
        adaptive_path = {
            "current_pathway": pathway,
            "struggling_areas": struggling_areas,
            "adaptive_recommendations": [],
            "suggested_interventions": []
        }
        
        # Add specific recommendations based on struggling areas
        for area in struggling_areas:
            if area in adaptive_recs:
                adaptive_path["adaptive_recommendations"].append({
                    "struggling_with": area,
                    "go_back_to": adaptive_recs[area].get("go_back_to"),
                    "extra_practice": adaptive_recs[area].get("extra_practice"),
                    "support_needed": adaptive_recs[area].get("support_needed")
                })
        
        return adaptive_path
    
    def _detect_struggling_areas(self, user_id: int, topic: str, user_progress: Dict) -> List[str]:
        """Detect areas where the user might be struggling."""
        struggling_areas = []
        
        # Get all user's concept progress for this topic
        concepts = self.get_concepts_for_topic(topic)
        
        for concept in concepts:
            progress = ConceptProgress.get_user_concept_progress(user_id, concept.concept_id)
            
            if progress:
                # Check for signs of struggle
                if progress.understanding_level == "exploring" and progress.attempts_count > 3:
                    struggling_areas.append(f"struggling_with_{concept.concept_id.split('_')[-1]}")
                elif progress.confidence_score < 40:
                    struggling_areas.append(f"low_confidence_in_{concept.concept_id.split('_')[-1]}")
                elif progress.time_spent_minutes > (concept.estimated_minutes * 2):
                    struggling_areas.append(f"taking_too_long_on_{concept.concept_id.split('_')[-1]}")
        
        return struggling_areas
    
    def _get_next_recommendation(self, user_id: int, concept_id: str) -> Dict:
        """Get recommendation for what to do next after completing a concept."""
        concept = self.get_concept_by_id(concept_id)
        if not concept:
            return {"error": "Concept not found"}
        
        # Check if ready for problems in this topic
        pathway = self.get_learning_pathway(user_id, concept.topic)
        
        if pathway["ready_for_problems"]["ready"]:
            return {
                "type": "practice_problems",
                "message": "Great job! You're ready to practice problems.",
                "action": "start_practice"
            }
        else:
            next_concept = pathway["next_concept"]
            if next_concept:
                return {
                    "type": "next_concept",
                    "message": f"Ready for the next concept: {next_concept['title']}",
                    "concept_id": next_concept["concept_id"],
                    "action": "learn_concept"
                }
            else:
                return {
                    "type": "topic_complete",
                    "message": "Congratulations! You've mastered this topic!",
                    "action": "choose_new_topic"
                }


# Global instance
concept_service = ConceptService()