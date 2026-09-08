"""
SevaHealth - Data Models
Internal data structures representing entities in the SevaHealth platform.
"""

from typing import Optional


class User:
    """
    User entity model representing platform operators:
    - Health Worker
    - Doctor
    - Administrator
    """
    def __init__(self, id: int, name: str, username: str, role: str, password: Optional[str] = None):
        self.id = id
        self.name = name
        self.username = username
        self.role = role
        self.password = password

    def to_dict(self, include_password: bool = False) -> dict:
        data = {
            "id": self.id,
            "name": self.name,
            "username": self.username,
            "role": self.role
        }
        if include_password:
            data["password"] = self.password
        return data
