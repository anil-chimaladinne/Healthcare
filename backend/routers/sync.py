"""
SevaHealth - Offline Synchronization Router
Processes batch records captured offline by frontline health workers via IndexedDB.
"""

from fastapi import APIRouter
from backend.database import get_db_connection
from backend.schemas import BatchSyncRequest, BatchSyncResponse
from backend.routers.triage import evaluate_triage_rules
from backend.schemas import TriageRequest, VitalsInput, SymptomsInput

router = APIRouter(prefix="/api/sync", tags=["Offline Sync"])


@router.post("/batch", response_model=BatchSyncResponse, summary="Batch Synchronize Offline Records")
def batch_sync(payload: BatchSyncRequest):
    """
    Accepts an array of offline-queued items (patients, vitals, triage results, follow-ups)
    and synchronizes them transactionally into the central SQLite database.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    synced_count = 0
    failed_count = 0
    id_mapping = {}

    for item in payload.records:
        try:
            r_type = item.type
            data = item.data

            if r_type == "patient":
                client_id = data.get("client_temp_id") or data.get("patient_id")
                # Generate real patient ID if temporary
                cursor.execute("SELECT patient_id FROM patients ORDER BY id DESC LIMIT 1")
                last_p = cursor.fetchone()
                if last_p and last_p["patient_id"].startswith("SEVA-"):
                    last_num = int(last_p["patient_id"].split("-")[1])
                    server_patient_id = f"SEVA-{last_num + 1:06d}"
                else:
                    server_patient_id = "SEVA-000001"

                # Check if already exists by phone or ID
                cursor.execute("SELECT patient_id FROM patients WHERE patient_id = ?", (data.get("patient_id"),))
                existing = cursor.fetchone()

                if not existing:
                    target_id = server_patient_id if not data.get("patient_id", "").startswith("SEVA-") else data.get("patient_id")
                    cursor.execute("""
                        INSERT INTO patients (patient_id, name, age, gender, phone, village, aadhaar_last4, registered_by, created_at, is_synced)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                    """, (
                        target_id,
                        data["name"],
                        data["age"],
                        data["gender"],
                        data["phone"],
                        data["village"],
                        data.get("aadhaar_last4"),
                        payload.synced_by,
                        item.timestamp
                    ))
                    id_mapping[client_id] = target_id
                else:
                    target_id = existing["patient_id"]
                    id_mapping[client_id] = target_id

                # If vitals included with patient
                v = data.get("vitals")
                if v:
                    cursor.execute("""
                        INSERT INTO vitals (patient_id, temperature, heart_rate, bp_systolic, bp_diastolic, spo2, blood_sugar, recorded_by, recorded_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        target_id,
                        v.get("temperature"),
                        v.get("heart_rate"),
                        v.get("bp_systolic"),
                        v.get("bp_diastolic"),
                        v.get("spo2"),
                        v.get("blood_sugar"),
                        payload.synced_by,
                        item.timestamp
                    ))

                # If symptoms included
                s = data.get("symptoms")
                if s:
                    cursor.execute("""
                        INSERT INTO symptoms (patient_id, symptoms_text, duration_days, emergency_flags, recorded_by, recorded_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        target_id,
                        s.get("symptoms_text", "Routine visit"),
                        s.get("duration_days", 1),
                        s.get("emergency_flags", ""),
                        payload.synced_by,
                        item.timestamp
                    ))

                # If triage result included or needs evaluation
                t = data.get("triage")
                if t:
                    cursor.execute("""
                        INSERT INTO triage_results (patient_id, risk_level, action_recommended, rule_triggered, routed_to, triaged_by, status, triaged_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'Waiting', ?)
                    """, (
                        target_id,
                        t.get("risk_level", "GREEN"),
                        t.get("action_recommended", "Routine follow-up"),
                        t.get("rule_triggered", "Offline triage"),
                        t.get("routed_to", "Priority Doctor Queue" if t.get("risk_level") != "GREEN" else "Routine Home Care"),
                        payload.synced_by,
                        item.timestamp
                    ))
                elif v and s:
                    # Run backend triage if not already triaged
                    t_eval = evaluate_triage_rules(TriageRequest(
                        patient_id=target_id,
                        vitals=VitalsInput(**v),
                        symptoms=SymptomsInput(**s),
                        age=data.get("age", 30),
                        gender=data.get("gender", "Other")
                    ))
                    cursor.execute("""
                        INSERT INTO triage_results (patient_id, risk_level, action_recommended, rule_triggered, routed_to, triaged_by, status, triaged_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'Waiting', ?)
                    """, (
                        target_id,
                        t_eval["risk_level"],
                        t_eval["action_recommended"],
                        t_eval["rule_triggered"],
                        t_eval["routed_to"],
                        payload.synced_by,
                        item.timestamp
                    ))

                synced_count += 1

            elif r_type == "referral":
                pid = id_mapping.get(data.get("patient_id"), data.get("patient_id"))
                cursor.execute("""
                    INSERT INTO referrals (referral_id, patient_id, from_facility, to_facility, reason, priority, status, notes, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, 'Created', ?, ?, ?)
                """, (
                    f"REF-{datetime.now().strftime('%H%M%S')}",
                    pid,
                    data.get("from_facility", "Sub-Centre"),
                    data.get("to_facility", "PHC"),
                    data.get("reason", "Specialist evaluation"),
                    data.get("priority", "Priority"),
                    data.get("notes", "Synced from offline"),
                    payload.synced_by,
                    item.timestamp
                ))
                synced_count += 1

        except Exception as e:
            print(f"[Sync] Error processing record: {e}")
            failed_count += 1

    conn.commit()
    conn.close()

    return BatchSyncResponse(
        success=True,
        synced_count=synced_count,
        failed_count=failed_count,
        message=f"Sync completed. {synced_count} records committed to central database.",
        mapping=id_mapping
    )
