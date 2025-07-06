"""
AI Analysis Routes - Pure AI-driven analysis endpoints
"""
from flask import Blueprint, request, jsonify
import google.generativeai as genai
from config.settings import Config
import json

ai_analysis_bp = Blueprint('ai_analysis', __name__, url_prefix='/api/ai')

# Configure AI model
genai.configure(api_key=Config.GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

@ai_analysis_bp.route('/analyze-confidence', methods=['POST'])
def analyze_confidence():
    """
    AI-powered confidence analysis of student responses.
    No hardcoded rules - pure AI intelligence.
    """
    try:
        data = request.get_json()
        user_response = data.get('user_response', '').strip()
        
        if not user_response:
            return jsonify({'error': 'User response is required'}), 400
        
        # AI prompt for confidence analysis
        prompt = f"""You are an expert educational psychologist analyzing student confidence levels.

STUDENT RESPONSE: "{user_response}"

Analyze this student's response and determine their confidence level in their answer.

Consider:
- Language patterns (uncertainty vs certainty)
- Hedging words and qualifiers
- Question marks or tentative phrasing
- Emotional indicators
- Directness vs hesitation

Respond with ONLY a JSON object:
{{
    "confidence_level": "low" | "medium" | "high",
    "reasoning": ["specific phrase or pattern that indicates confidence level"],
    "analysis": "Brief explanation of why you classified it this way"
}}

Examples:
- "I don't know" → {{"confidence_level": "low", "reasoning": ["explicit uncertainty"], "analysis": "Direct statement of not knowing"}}
- "15" → {{"confidence_level": "high", "reasoning": ["direct numerical answer"], "analysis": "Confident, direct answer without qualifiers"}}
- "Maybe 15?" → {{"confidence_level": "low", "reasoning": ["maybe", "?"], "analysis": "Tentative language with questioning tone"}}
- "I think it's 10" → {{"confidence_level": "medium", "reasoning": ["I think"], "analysis": "Some uncertainty but attempting an answer"}}
"""

        # Get AI analysis
        response = model.generate_content(prompt)
        
        # Parse AI response
        response_text = response.text.strip()
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        ai_result = json.loads(response_text)
        
        # Debug logging
        print(f"🤖 AI CONFIDENCE ANALYSIS:")
        print(f"   Student Response: '{user_response}'")
        print(f"   AI Confidence Level: {ai_result.get('confidence_level')}")
        print(f"   AI Reasoning: {ai_result.get('reasoning')}")
        print(f"   AI Analysis: {ai_result.get('analysis')}")
        
        return jsonify(ai_result)
        
    except json.JSONDecodeError as e:
        print(f"JSON parsing error in AI confidence analysis: {e}")
        print(f"Raw AI response: {response.text if 'response' in locals() else 'No response'}")
        return jsonify({
            'confidence_level': 'medium',
            'reasoning': ['json_parse_error'],
            'analysis': 'AI response could not be parsed'
        })
        
    except Exception as e:
        print(f"Error in AI confidence analysis: {e}")
        return jsonify({
            'confidence_level': 'medium',
            'reasoning': ['analysis_error'],
            'analysis': 'AI analysis failed'
        })