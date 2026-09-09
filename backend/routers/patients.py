"""
SevaHealth - Patient Registration & Longitudinal EHR Router
Manages demographic intake, digital patient IDs (SEVA-XXXXXX), and full care journey timeline.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime

from backend.database import get_db_connection
from backend.schemas import (
    PatientCreate, PatientSummary, PatientDetailResponse, LongitudinalTimelineEvent,
    TriageRequest
)
from backend.routers.triage import evaluate_triage_rules

router = APIRouter(prefix="/api/patients", tags=["Patients"])


def generate_next_patient_id(cursor) -> str:
    """Generates sequential demo patient ID in SEVA-000001 format."""
    cursor.execute("SELECT patient_id FROM patients ORDER BY id DESC LIMIT 1")
    last_p = cursor.fetchone()
    if not last_p or not last_p["patient_id"].startswith("SEVA-"):
        return "SEVA-000001"
    try:
        last_num = int(last_p["patient_id"].split("-")[1])
        return f"SEVA-{last_num + 1:06d}"
    except Exception:
        return f"SEVA-{datetime.now().strftime('%H%M%S')}"


@router.post("", response_model=PatientDetailResponse, summary="Register New Patient")
def register_patient(payload: PatientCreate):
    """
    Registers a new rural patient, assigns a unique Patient ID (SEVA-XXXXXX),
    records initial vitals/symptoms if provided, and optionally runs instant smart triage.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    patient_id = generate_next_patient_id(cursor)

    cursor.execute("""
        INSERT INTO patients (patient_id, name, age, gender, phone, village, aadhaar_last4, registered_by, is_synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    """, (
        patient_id,
        payload.name.strip(),
        payload.age,
        payload.gender,
        payload.phone.strip(),
        payload.village.strip(),
        payload.aadhaar_last4,
        payload.registered_by or "Health Worker"
    ))

    # If initial vitals and symptoms were captured during ASHA doorstep intake
    if payload.initial_vitals:
        cursor.execute("""
            INSERT INTO vitals (patient_id, temperature, heart_rate, bp_systolic, bp_diastolic, spo2, blood_sugar, recorded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            patient_id,
            payload.initial_vitals.temperature,
            payload.initial_vitals.heart_rate,
            payload.initial_vitals.bp_systolic,
            payload.initial_vitals.bp_diastolic,
            payload.initial_vitals.spo2,
            payload.initial_vitals.blood_sugar,
            payload.registered_by or "Health Worker"
        ))

    if payload.initial_symptoms:
        cursor.execute("""
            INSERT INTO symptoms (patient_id, symptoms_text, duration_days, emergency_flags, recorded_by)
            VALUES (?, ?, ?, ?, ?)
        """, (
            patient_id,
            payload.initial_symptoms.symptoms_text,
            payload.initial_symptoms.duration_days or 1,
            payload.initial_symptoms.emergency_flags or "",
            payload.registered_by or "Health Worker"
        ))

    # If triage is requested on registration
    if payload.run_triage and payload.initial_vitals and payload.initial_symptoms:
        triage_req = TriageRequest(
            patient_id=patient_id,
            vitals=payload.initial_vitals,
            symptoms=payload.initial_symptoms,
            age=payload.age,
            gender=payload.gender,
            triaged_by=payload.registered_by
        )
        triage_eval = evaluate_triage_rules(triage_req)
        cursor.execute("""
            INSERT INTO triage_results (patient_id, risk_level, action_recommended, rule_triggered, routed_to, triaged_by, status)
            VALUES (?, ?, ?, ?, ?, ?, 'Waiting')
        """, (
            patient_id,
            triage_eval["risk_level"],
            triage_eval["action_recommended"],
            triage_eval["rule_triggered"],
            triage_eval["routed_to"],
            payload.registered_by or "Health Worker"
        ))

    conn.commit()
    conn.close()

    return get_patient_by_id(patient_id)


@router.get("", response_model=List[PatientSummary], summary="List All Patients")
def list_patients(search: Optional[str] = Query(None, description="Search by name, ID, village, or phone")):
    """
    Returns a list of patients along with their latest triage risk level and vital signs.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT p.id, p.patient_id, p.name, p.age, p.gender, p.phone, p.village, 
               p.aadhaar_last4, p.registered_by, p.created_at,
               t.risk_level as latest_risk_level, t.routed_to as queue_status,
               v.spo2 as latest_spo2, 
               v.bp_systolic || '/' || v.bp_diastolic as latest_bp,
               ref.referral_id, ref.to_facility as referral_to_facility,
               ref.priority as referral_priority, ref.status as referral_status,
               ref.created_by as referral_created_by
        FROM patients p
        LEFT JOIN (
            SELECT t1.patient_id, t1.risk_level, t1.routed_to 
            FROM triage_results t1 
            INNER JOIN (
                SELECT patient_id, MAX(id) as max_id FROM triage_results GROUP BY patient_id
            ) t2 ON t1.id = t2.max_id
        ) t ON p.patient_id = t.patient_id
        LEFT JOIN (
            SELECT v1.patient_id, v1.spo2, v1.bp_systolic, v1.bp_diastolic
            FROM vitals v1
            INNER JOIN (
                SELECT patient_id, MAX(id) as max_id FROM vitals GROUP BY patient_id
            ) v2 ON v1.id = v2.max_id
        ) v ON p.patient_id = v.patient_id
        LEFT JOIN (
            SELECT r1.patient_id, r1.referral_id, r1.to_facility, r1.priority, r1.status, r1.created_by
            FROM referrals r1
            INNER JOIN (
                SELECT patient_id, MAX(id) as max_id FROM referrals GROUP BY patient_id
            ) r2 ON r1.id = r2.max_id
        ) ref ON p.patient_id = ref.patient_id
    """

    params = []
    if search and isinstance(search, str) and search.strip():
        s = f"%{search.strip()}%"
        query += " WHERE p.name LIKE ? OR p.patient_id LIKE ? OR p.village LIKE ? OR p.phone LIKE ?"
        params = [s, s, s, s]

    query += " ORDER BY p.id DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [
        PatientSummary(
            id=r["id"],
            patient_id=r["patient_id"],
            name=r["name"],
            age=r["age"],
            gender=r["gender"],
            phone=r["phone"],
            village=r["village"],
            aadhaar_last4=r["aadhaar_last4"],
            registered_by=r["registered_by"],
            created_at=str(r["created_at"]),
            latest_risk_level=r["latest_risk_level"] or "GREEN",
            latest_spo2=r["latest_spo2"],
            latest_bp=r["latest_bp"] if r["latest_bp"] != "/" else None,
            queue_status=r["queue_status"] or "Registered",
            has_referral=bool(r["referral_id"]),
            referral_id=r["referral_id"],
            referral_to_facility=r["referral_to_facility"],
            referral_priority=r["referral_priority"],
            referral_status=r["referral_status"],
            referral_created_by=r["referral_created_by"]
        )
        for r in rows
    ]


@router.get("/{patient_id}", response_model=PatientDetailResponse, summary="Get Longitudinal Patient EHR")
def get_patient_by_id(patient_id: str):
    """
    Returns the comprehensive longitudinal record for a patient, including
    the chronologically sorted Care Journey Timeline and FHIR-ready JSON preview.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM patients WHERE patient_id = ?", (patient_id,))
    p = cursor.fetchone()
    if not p:
        conn.close()
        raise HTTPException(status_code=404, detail="Patient not found")

    # Fetch all clinical components
    cursor.execute("SELECT * FROM vitals WHERE patient_id = ? ORDER BY id ASC", (patient_id,))
    vitals = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM symptoms WHERE patient_id = ? ORDER BY id ASC", (patient_id,))
    symptoms = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM triage_results WHERE patient_id = ? ORDER BY id ASC", (patient_id,))
    triage = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM consultations WHERE patient_id = ? ORDER BY id ASC", (patient_id,))
    consultations = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM referrals WHERE patient_id = ? ORDER BY id ASC", (patient_id,))
    referrals = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM followups WHERE patient_id = ? ORDER BY id ASC", (patient_id,))
    followups = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM diagnostics WHERE patient_id = ? ORDER BY id ASC", (patient_id,))
    diagnostics = [dict(r) for r in cursor.fetchall()]

    conn.close()

    # Build Care Journey Timeline Events
    timeline: List[LongitudinalTimelineEvent] = []

    # 1. Registration Event
    timeline.append(LongitudinalTimelineEvent(
        event_type="Registration",
        title="Patient Registered at Sub-Centre",
        subtitle=f"By {p['registered_by'] or 'Health Worker'} in {p['village']}",
        timestamp=str(p["created_at"]),
        details={"village": p["village"], "phone": p["phone"], "age": p["age"]},
        badge_type="info"
    ))

    # 2. Vitals Events
    for v in vitals:
        timeline.append(LongitudinalTimelineEvent(
            event_type="Vitals",
            title="Doorstep Vitals Captured",
            subtitle=f"SpO2: {v.get('spo2') or 'N/A'}% | BP: {v.get('bp_systolic') or 'N/A'}/{v.get('bp_diastolic') or 'N/A'} | Temp: {v.get('temperature') or 'N/A'}°F",
            timestamp=str(v.get("recorded_at") or p["created_at"]),
            details=v,
            badge_type="primary"
        ))

    # 3. Triage Events
    for t in triage:
        badge = "danger" if t["risk_level"] == "RED" else ("warning" if t["risk_level"] == "YELLOW" else "success")
        timeline.append(LongitudinalTimelineEvent(
            event_type="Triage",
            title=f"Smart Triage Risk: {t['risk_level']}",
            subtitle=f"Routed To: {t['routed_to']} — {t['rule_triggered']}",
            timestamp=str(t.get("triaged_at") or p["created_at"]),
            details=t,
            badge_type=badge
        ))

    # 4. Consultation Events
    for c in consultations:
        timeline.append(LongitudinalTimelineEvent(
            event_type="Consultation",
            title=f"Doctor Consultation by {c['doctor_name']}",
            subtitle=f"Diagnosis: {c.get('diagnosis_summary') or 'Clinical Review'}",
            timestamp=str(c.get("consulted_at") or p["created_at"]),
            details=c,
            badge_type="primary"
        ))

    # 5. Diagnostic Events
    for d in diagnostics:
        timeline.append(LongitudinalTimelineEvent(
            event_type="Diagnostic",
            title=f"Lab Test: {d['test_name']}",
            subtitle=f"Status: {d['status']} | Result: {d.get('result_summary') or 'Pending'}",
            timestamp=str(d.get("ordered_at") or p["created_at"]),
            details=d,
            badge_type="purple"
        ))

    # 6. Referral Events
    for r in referrals:
        timeline.append(LongitudinalTimelineEvent(
            event_type="Referral",
            title=f"Specialist Referral ({r['priority']})",
            subtitle=f"From {r['from_facility']} -> {r['to_facility']} [{r['status']}]",
            timestamp=str(r.get("created_at") or p["created_at"]),
            details=r,
            badge_type="danger" if r["priority"] == "Emergency" else "warning"
        ))

    # 7. Follow-up Events
    for f in followups:
        timeline.append(LongitudinalTimelineEvent(
            event_type="Followup",
            title=f"Follow-up Scheduled (Due: {f['due_date']})",
            subtitle=f"Assigned to {f['assigned_worker']} [{f['status']}]",
            timestamp=str(f.get("created_at") or p["created_at"]),
            details=f,
            badge_type="info"
        ))

    # Build FHIR/ABDM Sample Bundle Preview
    # Note: FHIR R4 / ABDM Care-Context compliant prototype schema structure
    fhir_bundle_preview = {
        "resourceType": "Bundle",
        "type": "document",
        "id": f"bundle-{p['patient_id']}",
        "meta": {"lastUpdated": str(p["created_at"])},
        "identifier": {"system": "https://abdm.gov.in/demo-hip", "value": p["patient_id"]},
        "entry": [
            {
                "resourceType": "Patient",
                "id": p["patient_id"],
                "name": [{"text": p["name"]}],
                "telecom": [{"system": "phone", "value": p["phone"]}],
                "gender": p["gender"].lower(),
                "address": [{"city": p["village"], "country": "IND"}]
            },
            {
                "resourceType": "Encounter",
                "id": f"enc-{p['patient_id']}-01",
                "status": "finished",
                "class": {"code": "AMB", "display": "Ambulatory Rural Care"}
            }
        ]
    }

    latest_risk = triage[-1]["risk_level"] if triage else "GREEN"
    latest_spo2 = vitals[-1]["spo2"] if vitals else None
    latest_bp = f"{vitals[-1]['bp_systolic']}/{vitals[-1]['bp_diastolic']}" if vitals and vitals[-1].get("bp_systolic") else None

    return PatientDetailResponse(
        patient=PatientSummary(
            id=p["id"],
            patient_id=p["patient_id"],
            name=p["name"],
            age=p["age"],
            gender=p["gender"],
            phone=p["phone"],
            village=p["village"],
            aadhaar_last4=p["aadhaar_last4"],
            registered_by=p["registered_by"],
            created_at=str(p["created_at"]),
            latest_risk_level=latest_risk,
            latest_spo2=latest_spo2,
            latest_bp=latest_bp,
            queue_status="Active"
        ),
        vitals_history=vitals,
        symptoms_history=symptoms,
        triage_history=triage,
        consultations=consultations,
        referrals=referrals,
        followups=followups,
        diagnostics=diagnostics,
        timeline=timeline,
        fhir_bundle_preview=fhir_bundle_preview
    )
