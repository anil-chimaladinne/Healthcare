"""
SevaHealth - Diagnostics & Medicine Inventory Router
Manages point-of-care rapid tests and PHC essential medicine stock availability.
"""

from fastapi import APIRouter
from typing import List
from backend.database import get_db_connection

router = APIRouter(prefix="/api/inventory", tags=["Diagnostics & Medicines"])


@router.get("/medicines", summary="Get Essential Medicines Availability")
def get_medicines():
    """Returns essential medicine stocks at Primary Health Centre / Sub-Centres."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM medicines ORDER BY status ASC, stock_count ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/diagnostics", summary="Get Diagnostic Tests Log")
def get_diagnostics():
    """Returns recent point-of-care and laboratory test orders."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT d.*, p.name as patient_name, p.village
        FROM diagnostics d
        LEFT JOIN patients p ON d.patient_id = p.patient_id
        ORDER BY d.id DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
