"""
Vercel Serverless Function Entrypoint
Exposes FastAPI application instance for Vercel Python runtime.
"""
import sys
from pathlib import Path

# Add workspace root to sys.path so backend module can be imported
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.main import app
