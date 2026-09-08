"""
SevaHealth - Tele-Consultation & Prescription Router
Manages doctor clinical reviews, tele-consultation notes, e-prescriptions, and care continuum updates.
"""

from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime

from backend.database import get_db_connection
from backend.schemas import ConsultationCreate, ConsultationResponse, FollowupCreate
from backend.routers.followups import schedule_followup

router = APIRouter(prefix="/api/consultations", tags=["Consultations"])


@router.post("", response_model=ConsultationResponse, summary="Record Doctor Consultation")
def record_consultation(payload: ConsultationCreate):
    """
    Saves doctor tele-consultation notes, diagnosis, and prescription.
    Updates patient triage queue status to 'Completed'.
    If follow-up date is provided, automatically schedules a follow-up.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO consultations (patient_id, doctor_name, symptoms_summary, clinical_notes, prescription, diagnosis_summary, followup_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Completed')
    """, (
        payload.patient_id,
        payload.doctor_name,
        payload.symptoms_summary or "",
        payload.clinical_notes,
        payload.prescription or "",
        payload.diagnosis_summary or "Clinical Consultation",
        payload.followup_date
    ))

    consult_id = cursor.lastrowid

    # Update triage queue status to completed
    cursor.execute("""
        UPDATE triage_results SET status = 'Completed' WHERE patient_id = ?
    """, (payload.patient_id,))

    # If follow-up date specified, schedule follow-up
    if payload.followup_date:
        cursor.execute("SELECT registered_by FROM patients WHERE patient_id = ?", (payload.patient_id,))
        p_row = cursor.fetchone()
        worker = p_row["registered_by"] if p_row and p_row["registered_by"] else "Anitha Rao"

        cursor.execute("""
            INSERT INTO followups (patient_id, reason, due_date, assigned_worker, status, sms_reminder_sent, notes)
            VALUES (?, ?, ?, ?, 'Due', 1, ?)
        """, (
            payload.patient_id,
            f"Post-consultation check for {payload.diagnosis_summary or 'treatment response'}",
            payload.followup_date,
            worker,
            f"Prescription compliance check prescribed by {payload.doctor_name}"
        ))

    conn.commit()

    cursor.execute("SELECT * FROM consultations WHERE id = ?", (consult_id,))
    row = cursor.fetchone()
    conn.close()

    return ConsultationResponse(
        id=row["id"],
        patient_id=row["patient_id"],
        doctor_name=row["doctor_name"],
        clinical_notes=row["clinical_notes"],
        prescription=row["prescription"],
        diagnosis_summary=row["diagnosis_summary"],
        followup_date=row["followup_date"],
        consulted_at=str(row["consulted_at"])
    )


@router.get("", summary="List All Completed Consultations")
def list_consultations():
    """Returns all completed doctor consultations with patient details."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT c.*, p.name as patient_name, p.age, p.gender, p.village, p.phone
        FROM consultations c
        LEFT JOIN patients p ON c.patient_id = p.patient_id
        ORDER BY c.id DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    return [dict(r) for r in rows]

