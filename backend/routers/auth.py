"""
SevaHealth - Authentication Router
Handles role-based demo logins for Health Worker, Doctor, and Administrator.
"""

from fastapi import APIRouter, HTTPException, status
from backend.database import get_db_connection
from backend.schemas import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse, summary="Demo Login")
def login(request: LoginRequest):
    """
    Authenticate demo user against SQLite database.
    Supports Health Worker, Doctor, and Administrator roles.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, name, username, password, role, facility FROM users WHERE username = ?",
        (request.username.strip(),)
    )
    user = cursor.fetchone()
    conn.close()

    if not user or user["password"] != request.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password."
        )

    return LoginResponse(
        success=True,
        user_id=user["id"],
        name=user["name"],
        username=user["username"],
        role=user["role"],
        facility=user["facility"] or "Primary Health Centre",
        message="Login successful"
    )
