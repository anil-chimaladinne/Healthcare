"""
SevaHealth - Smart Triage Rule Engine
Rule-based risk stratification and smart routing for rural healthcare frontline workers.
Transparent triage: RED (Emergency), YELLOW (Priority), GREEN (Routine).
Note: Prototype demonstration logic for SIH 2026.
"""

from fastapi import APIRouter, HTTPException
from backend.database import get_db_connection
from backend.schemas import TriageRequest, TriageResponse

router = APIRouter(prefix="/api/triage", tags=["Smart Triage"])


def evaluate_triage_rules(req: TriageRequest) -> dict:
    """
    Transparent rule-based triage classifier.
    Returns risk level, triggered reason, recommendation, and routing destination.
    """
    v = req.vitals
    s = req.symptoms
    flags = (s.emergency_flags or "").lower()
    symptoms_txt = (s.symptoms_text or "").lower()

    # --- 1. RED (Emergency) Criteria ---
    red_reasons = []

    # A. Emergency Warning Flags
    if any(k in flags for k in ["severe chest pain", "difficulty breathing", "unconscious", "altered mental", "severe bleeding", "convulsions", "seizure", "collapse"]):
        red_reasons.append("Emergency warning signs detected")

    # B. Critical Oxygen Saturation
    if v.spo2 is not None and v.spo2 < 90:
        red_reasons.append(f"Critical Hypoxia (SpO2 {v.spo2}% < 90%)")

    # C. Hypertensive Emergency
    if (v.bp_systolic is not None and v.bp_systolic >= 180) or (v.bp_diastolic is not None and v.bp_diastolic >= 110):
        red_reasons.append(f"Severe Hypertensive Crisis (BP {v.bp_systolic}/{v.bp_diastolic})")

    # D. Severe Tachycardia or Bradycardia
    if v.heart_rate is not None and (v.heart_rate > 130 or v.heart_rate < 40):
        red_reasons.append(f"Critical Heart Rate ({v.heart_rate} bpm)")

    # E. Severe Hyperthermia / High fever in elderly/child
    if v.temperature is not None and v.temperature >= 103.5:
        red_reasons.append(f"Severe High Fever ({v.temperature}°F)")

    if red_reasons:
        return {
            "risk_level": "RED",
            "rule_triggered": " | ".join(red_reasons),
            "action_recommended": "Immediate PHC / Medical Officer Evaluation. Administer emergency first-aid, prepare high-flow oxygen, and coordinate 108 Ambulance referral.",
            "routed_to": "Emergency PHC Attention"
        }

    # --- 2. YELLOW (Priority) Criteria ---
    yellow_reasons = []

    # A. Moderate Oxygen Depletion
    if v.spo2 is not None and 90 <= v.spo2 <= 94:
        yellow_reasons.append(f"Moderate Oxygen Saturation (SpO2 {v.spo2}%)")

    # B. Moderate Hypertension (Stage 1 / 2)
    if (v.bp_systolic is not None and 140 <= v.bp_systolic < 180) or (v.bp_diastolic is not None and 90 <= v.bp_diastolic < 110):
        yellow_reasons.append(f"Elevated Blood Pressure (BP {v.bp_systolic}/{v.bp_diastolic})")

    # C. Moderate Fever
    if v.temperature is not None and 100.4 <= v.temperature < 103.5:
        yellow_reasons.append(f"Fever detected ({v.temperature}°F)")

    # D. Tachycardia (100 - 130 bpm)
    if v.heart_rate is not None and 100 <= v.heart_rate <= 130:
        yellow_reasons.append(f"Elevated Heart Rate ({v.heart_rate} bpm)")

    # E. Diabetic Warning
    if v.blood_sugar is not None and (v.blood_sugar > 200 or v.blood_sugar < 70):
        yellow_reasons.append(f"Abnormal Blood Sugar ({v.blood_sugar} mg/dL)")

    # F. Prolonged Symptom Duration
    if s.duration_days and s.duration_days >= 5:
        yellow_reasons.append(f"Persistent symptoms for {s.duration_days} days")

    if any(k in symptoms_txt for k in ["chest pain", "shortness of breath", "dizziness", "vomiting", "dehydration"]):
        yellow_reasons.append("Moderate risk symptoms noted")

    if yellow_reasons:
        return {
            "risk_level": "YELLOW",
            "rule_triggered": " | ".join(yellow_reasons),
            "action_recommended": "Add to Priority Doctor Queue for Tele-Consultation or PHC consultation within 24 hours.",
            "routed_to": "Priority Doctor Queue"
        }

    # --- 3. GREEN (Routine) Criteria ---
    return {
        "risk_level": "GREEN",
        "rule_triggered": f"Normal vital signs (SpO2: {v.spo2 or 'Normal'}%, Temp: {v.temperature or 'Normal'}°F, BP: {v.bp_systolic or 'Normal'}/{v.bp_diastolic or 'Normal'})",
        "action_recommended": "Routine follow-up / Home care guidance. Maintain hydration, rest, and schedule standard ASHA check-in if symptoms persist.",
        "routed_to": "Routine Home Care"
    }


@router.post("", response_model=TriageResponse, summary="Execute Smart Triage")
def execute_triage(req: TriageRequest):
    """
    Evaluates symptoms and vitals to produce a transparent RED/YELLOW/GREEN risk level
    and persists the triage outcome into the SQLite database.
    """
    result = evaluate_triage_rules(req)

    conn = get_db_connection()
    cursor = conn.cursor()

    # Save Vitals
    cursor.execute("""
        INSERT INTO vitals (patient_id, temperature, heart_rate, bp_systolic, bp_diastolic, spo2, blood_sugar, recorded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        req.patient_id,
        req.vitals.temperature,
        req.vitals.heart_rate,
        req.vitals.bp_systolic,
        req.vitals.bp_diastolic,
        req.vitals.spo2,
        req.vitals.blood_sugar,
        req.triaged_by or "Health Worker"
    ))

    # Save Symptoms
    cursor.execute("""
        INSERT INTO symptoms (patient_id, symptoms_text, duration_days, emergency_flags, recorded_by)
        VALUES (?, ?, ?, ?, ?)
    """, (
        req.patient_id,
        req.symptoms.symptoms_text,
        req.symptoms.duration_days or 1,
        req.symptoms.emergency_flags or "",
        req.triaged_by or "Health Worker"
    ))

    # Save Triage Result
    cursor.execute("""
        INSERT INTO triage_results (patient_id, risk_level, action_recommended, rule_triggered, routed_to, triaged_by, status)
        VALUES (?, ?, ?, ?, ?, ?, 'Waiting')
    """, (
        req.patient_id,
        result["risk_level"],
        result["action_recommended"],
        result["rule_triggered"],
        result["routed_to"],
        req.triaged_by or "Health Worker"
    ))

    triage_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT triaged_at FROM triage_results WHERE id = ?", (triage_id,))
    row = cursor.fetchone()
    triaged_at = row["triaged_at"] if row else ""
    conn.close()

    return TriageResponse(
        patient_id=req.patient_id,
        risk_level=result["risk_level"],
        action_recommended=result["action_recommended"],
        rule_triggered=result["rule_triggered"],
        routed_to=result["routed_to"],
        triage_id=triage_id,
        triaged_at=triaged_at
    )


@router.get("/{patient_id}", summary="Get Patient Triage History")
def get_patient_triage_history(patient_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM triage_results WHERE patient_id = ? ORDER BY id DESC
    """, (patient_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
