"""
SevaHealth - Authentication Router
Handles role-based demo logins for Health Worker, Doctor, and Administrator.
"""

from fastapi import APIRouter, HTTPException, status
from backend.database import get_db_connection
from backend.schemas import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse, summary="Demo Login")
def login(request: LoginRequest):
    """
    Authenticate demo user against SQLite database.
    Supports Health Worker, Doctor, Specialist, and Administrator roles.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, name, username, password, role, facility FROM users WHERE LOWER(username) = LOWER(?)",
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


@router.post("/register", response_model=RegisterResponse, summary="Register New User Account")
def register(request: RegisterRequest):
    """
    Create a new account for Health Worker (ASHA / ANM), Doctor, Specialist, or Administrator.
    Saves user in SQLite users table and returns user profile.
    """
    name = request.name.strip()
    username = request.username.strip()
    password = request.password
    role = request.role.strip()
    facility = (request.facility or "Chirala Primary Health Centre").strip()

    if not name or not username or not password or not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All fields (Name, Username, Password, Role) are required."
        )

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check for existing username (case-insensitive)
    cursor.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (username,))
    existing_user = cursor.fetchone()

    if existing_user:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{username}' is already registered. Please choose a different username."
        )

    # Insert new user
    cursor.execute(
        "INSERT INTO users (name, username, password, role, facility) VALUES (?, ?, ?, ?, ?)",
        (name, username, password, role, facility)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    return RegisterResponse(
        success=True,
        user_id=new_id,
        name=name,
        username=username,
        role=role,
        facility=facility,
        message="Account created successfully! Welcome to SevaHealth."
    )

