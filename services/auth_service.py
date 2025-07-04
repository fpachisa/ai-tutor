"""
Authentication service.
"""
import datetime
import jwt
from typing import Dict, List, Optional
from config.settings import Config
from models.user import User


class AuthService:
    """Service class for authentication operations."""
    
    def __init__(self):
        pass
    
    def create_user(self, email: str, password: str, first_name: str, 
                   last_name: str = None, quiz_results: List[Dict] = None, 
                   recommended_topic: str = None) -> Dict:
        """
        Create a new user account.
        
        Returns:
            Dict containing success message and JWT token
        """
        try:
            # Create user using the User model
            user = User.create_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name or '',
                recommended_topic=recommended_topic
            )

            # Generate JWT token
            token = self._generate_token(user.id, user.email, user.first_name)

            return {"message": "User created successfully", "token": token}
        except ValueError as e:
            # Re-raise ValueError from User model
            raise e
    
    def authenticate_user(self, email: str, password: str) -> Dict:
        """
        Authenticate a user with email and password.
        
        Returns:
            Dict containing success message and JWT token
        """
        if not email or not password:
            raise ValueError("Email and password are required")

        # Find the user by email using User model
        user = User.get_by_email(email)
        if not user:
            raise ValueError("Invalid credentials")
        
        # Check the password
        if not user.check_password(password):
            raise ValueError("Invalid credentials")

        # Generate JWT token
        token = self._generate_token(user.id, user.email, user.first_name)

        return {"message": "Login successful", "token": token}
    
    def verify_token(self, token: str) -> Dict:
        """
        Verify a JWT token and return user data.
        
        Returns:
            Dict containing user_id and other token data
        """
        try:
            data = jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
            return data
        except jwt.ExpiredSignatureError:
            raise ValueError("Token has expired")
        except jwt.InvalidTokenError:
            raise ValueError("Token is invalid")
    
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get a user by ID."""
        return User.get_by_id(user_id)
    
    def _generate_token(self, user_id: int, email: str, first_name: str = '') -> str:
        """Generate a JWT token for a user."""
        return jwt.encode({
            'user_id': user_id,
            'email': email,
            'first_name': first_name,
            'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
        }, Config.SECRET_KEY, algorithm="HS256")


# Global instance
auth_service = AuthService()