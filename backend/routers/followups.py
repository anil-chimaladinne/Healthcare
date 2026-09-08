"""
SevaHealth - Follow-up Management Router
Schedules, tracks, and manages community post-consultation health worker visits and SMS reminders.
"""

from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime

from backend.database import get_db_connection
from backend.schemas import FollowupCreate, FollowupResponse, FollowupStatusUpdate

router = APIRouter(prefix="/api/followups", tags=["Follow-ups"])


@router.post("", response_model=FollowupResponse, summary="Schedule Follow-up")
def schedule_followup(payload: FollowupCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO followups (patient_id, reason, due_date, assigned_worker, status, sms_reminder_sent, notes)
        VALUES (?, ?, ?, ?, 'Due', 0, ?)
    """, (
        payload.patient_id,
        payload.reason,
        payload.due_date,
        payload.assigned_worker,
        payload.notes or ""
    ))

    followup_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT name FROM patients WHERE patient_id = ?", (payload.patient_id,))
    p_row = cursor.fetchone()
    patient_name = p_row["name"] if p_row else "Patient"

    cursor.execute("SELECT * FROM followups WHERE id = ?", (followup_id,))
    row = cursor.fetchone()
    conn.close()

    return FollowupResponse(
        id=row["id"],
        patient_id=row["patient_id"],
        patient_name=patient_name,
        reason=row["reason"],
        due_date=row["due_date"],
        assigned_worker=row["assigned_worker"],
        status=row["status"],
        sms_reminder_sent=bool(row["sms_reminder_sent"]),
        notes=row["notes"],
        created_at=str(row["created_at"])
    )


@router.get("", response_model=List[FollowupResponse], summary="List Follow-ups")
def list_followups():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT f.*, p.name as patient_name
        FROM followups f
        LEFT JOIN patients p ON f.patient_id = p.patient_id
        ORDER BY f.due_date ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    return [
        FollowupResponse(
            id=r["id"],
            patient_id=r["patient_id"],
            patient_name=r["patient_name"] or "Patient",
            reason=r["reason"],
            due_date=r["due_date"],
            assigned_worker=r["assigned_worker"],
            status=r["status"],
            sms_reminder_sent=bool(r["sms_reminder_sent"]),
            notes=r["notes"],
            created_at=str(r["created_at"])
        )
        for r in rows
    ]


@router.post("/{followup_id}/send-sms", summary="Trigger Demo SMS Reminder")
def trigger_demo_sms(followup_id: int):
    """
    Simulates sending an automated SMS reminder in Telugu/English to the patient & ASHA worker.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT f.*, p.name as patient_name, p.phone, p.village
        FROM followups f
        JOIN patients p ON f.patient_id = p.patient_id
        WHERE f.id = ?
    """, (followup_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Followup not found")

    cursor.execute("UPDATE followups SET sms_reminder_sent = 1 WHERE id = ?", (followup_id,))
    conn.commit()
    conn.close()

    sms_text_en = f"Dear {row['patient_name']}, this is a reminder from SevaHealth. Your health follow-up with ASHA {row['assigned_worker']} is scheduled for {row['due_date']}. Please keep your medicines ready."
    sms_text_te = f"ప్రియమైన {row['patient_name']} గారు, SevaHealth నుండి రిమైండర్. మీ ఆరోగ్య ఫాలో-అప్ {row['due_date']} తేదీన ఆశా వర్కర్ {row['assigned_worker']} తో ఉంది."

    return {
        "success": True,
        "message": "SMS Reminder: Demo Sent Successfully",
        "recipient_phone": row["phone"],
        "sms_preview_en": sms_text_en,
        "sms_preview_te": sms_text_te
    }


@router.patch("/{followup_id}/status", summary="Update Followup Status")
def update_followup_status(followup_id: int, payload: FollowupStatusUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE followups 
        SET status = ?
        WHERE id = ?
    """, (payload.status, followup_id))

    conn.commit()
    conn.close()
    return {"success": True, "followup_id": followup_id, "status": payload.status}
