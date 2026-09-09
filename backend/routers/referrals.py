"""
SevaHealth - Referral Management Router
Tracks full-loop referrals from ASHA / Sub-Centres to Primary Health Centres and District Specialty Hospitals.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime

from backend.database import get_db_connection
from backend.schemas import ReferralCreate, ReferralResponse, ReferralStatusUpdate, SpecialistReviewRequest

router = APIRouter(prefix="/api/referrals", tags=["Referrals"])


def generate_next_referral_id(cursor) -> str:
    cursor.execute("SELECT referral_id FROM referrals ORDER BY id DESC LIMIT 1")
    last_r = cursor.fetchone()
    if not last_r or not last_r["referral_id"].startswith("REF-"):
        return "REF-001"
    try:
        last_num = int(last_r["referral_id"].split("-")[1])
        return f"REF-{last_num + 1:03d}"
    except Exception:
        return f"REF-{datetime.now().strftime('%H%M%S')}"


@router.post("", response_model=ReferralResponse, summary="Create Referral")
def create_referral(payload: ReferralCreate):
    """Creates a tracked specialist referral."""
    conn = get_db_connection()
    cursor = conn.cursor()

    referral_id = generate_next_referral_id(cursor)

    cursor.execute("""
        INSERT INTO referrals (referral_id, patient_id, from_facility, to_facility, reason, priority, status, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 'Created', ?, ?)
    """, (
        referral_id,
        payload.patient_id,
        payload.from_facility,
        payload.to_facility,
        payload.reason,
        payload.priority,
        payload.notes or "",
        payload.created_by or "Doctor"
    ))

    ref_db_id = cursor.lastrowid
    conn.commit()

    # Fetch patient name
    cursor.execute("SELECT name FROM patients WHERE patient_id = ?", (payload.patient_id,))
    p_row = cursor.fetchone()
    patient_name = p_row["name"] if p_row else "Patient"

    cursor.execute("SELECT * FROM referrals WHERE id = ?", (ref_db_id,))
    row = cursor.fetchone()
    conn.close()

    return ReferralResponse(
        id=row["id"],
        referral_id=row["referral_id"],
        patient_id=row["patient_id"],
        patient_name=patient_name,
        from_facility=row["from_facility"],
        to_facility=row["to_facility"],
        reason=row["reason"],
        priority=row["priority"],
        status=row["status"],
        notes=row["notes"],
        created_by=row["created_by"],
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"])
    )


@router.get("", response_model=List[ReferralResponse], summary="List All Referrals")
def list_referrals(search: Optional[str] = None):
    """Returns all active and historical referrals with patient names, with optional search filter."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if search and isinstance(search, str) and search.strip():
        s = f"%{search.strip()}%"
        cursor.execute("""
            SELECT r.*, p.name as patient_name
            FROM referrals r
            LEFT JOIN patients p ON r.patient_id = p.patient_id
            WHERE r.referral_id LIKE ? OR r.patient_id LIKE ? OR p.name LIKE ? OR r.to_facility LIKE ? OR r.from_facility LIKE ? OR r.reason LIKE ?
            ORDER BY r.id DESC
        """, (s, s, s, s, s, s))
    else:
        cursor.execute("""
            SELECT r.*, p.name as patient_name
            FROM referrals r
            LEFT JOIN patients p ON r.patient_id = p.patient_id
            ORDER BY r.id DESC
        """)
    rows = cursor.fetchall()
    conn.close()

    return [
        ReferralResponse(
            id=r["id"],
            referral_id=r["referral_id"],
            patient_id=r["patient_id"],
            patient_name=r["patient_name"] or "Patient",
            from_facility=r["from_facility"],
            to_facility=r["to_facility"],
            reason=r["reason"],
            priority=r["priority"],
            status=r["status"],
            notes=r["notes"],
            created_by=r["created_by"],
            created_at=str(r["created_at"]),
            updated_at=str(r["updated_at"])
        )
        for r in rows
    ]


@router.patch("/{referral_id}/status", summary="Update Referral Status")
def update_referral_status(referral_id: str, payload: ReferralStatusUpdate):
    """Updates referral status (Created -> Sent -> Accepted -> In Progress -> Completed)."""
    conn = get_db_connection()
    cursor = conn.cursor()

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        UPDATE referrals 
        SET status = ?, notes = COALESCE(?, notes), updated_at = ?
        WHERE referral_id = ?
    """, (payload.status, payload.notes, now_str, referral_id))

    conn.commit()
    conn.close()
    return {"success": True, "referral_id": referral_id, "status": payload.status}


@router.patch("/{referral_id}/specialist-review", summary="Submit Specialist Clinical Review & Feedback")
def submit_specialist_review(referral_id: str, payload: SpecialistReviewRequest):
    """
    Hospital specialist records clinical evaluation notes, admission/treatment advice,
    and advances the referral lifecycle status.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if referral exists
    cursor.execute("SELECT * FROM referrals WHERE referral_id = ?", (referral_id,))
    ref = cursor.fetchone()
    if not ref:
        conn.close()
        raise HTTPException(status_code=404, detail="Referral not found")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    specialist_entry = f" [Specialist Review by {payload.specialist_name or 'Specialist'} ({now_str})]: {payload.specialist_notes}"
    if payload.recommended_action:
        specialist_entry += f" | Action Plan: {payload.recommended_action}"

    existing_notes = ref["notes"] or ""
    updated_notes = (existing_notes + "\n" + specialist_entry).strip()

    cursor.execute("""
        UPDATE referrals 
        SET status = ?, notes = ?, updated_at = ?
        WHERE referral_id = ?
    """, (payload.status, updated_notes, now_str, referral_id))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "referral_id": referral_id,
        "status": payload.status,
        "specialist_notes": updated_notes,
        "message": "Specialist clinical review recorded successfully."
    }
