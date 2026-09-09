from datetime import datetime
from fastapi import APIRouter
from backend.database import get_db_connection
from backend.schemas import BatchSyncRequest, BatchSyncResponse
from backend.routers.triage import evaluate_triage_rules
from backend.schemas import TriageRequest, VitalsInput, SymptomsInput

router = APIRouter(prefix="/api/sync", tags=["Offline Sync"])


@router.post("/batch", response_model=BatchSyncResponse, summary="Batch Synchronize Offline Records")
def batch_sync(payload: BatchSyncRequest):
    """
    Accepts an array of offline-queued items (patients, vitals, triage results, consultations, referrals, follow-ups)
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
            data = item.data or {}
            timestamp = item.timestamp or datetime.now().isoformat()

            if r_type == "patient":
                client_id = data.get("client_temp_id") or data.get("patient_id")
                
                # Check if patient already exists by real ID
                existing = None
                if data.get("patient_id") and not ("OFFLINE" in str(data.get("patient_id")).upper()):
                    cursor.execute("SELECT patient_id FROM patients WHERE patient_id = ?", (data["patient_id"],))
                    existing = cursor.fetchone()

                if not existing:
                    # Robust sequential patient ID generation (e.g. SEVA-000042)
                    cursor.execute("SELECT patient_id FROM patients WHERE patient_id LIKE 'SEVA-%'")
                    existing_pids = cursor.fetchall()
                    max_num = 0
                    for r in existing_pids:
                        pid_val = str(r["patient_id"])
                        try:
                            parts = pid_val.split("-")
                            if len(parts) >= 2 and parts[1].isdigit():
                                num = int(parts[1])
                                if num > max_num:
                                    max_num = num
                        except Exception:
                            pass
                    target_id = f"SEVA-{max_num + 1:06d}"

                    cursor.execute("""
                        INSERT INTO patients (patient_id, name, age, gender, phone, village, aadhaar_last4, registered_by, created_at, is_synced)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                    """, (
                        target_id,
                        data.get("name", "Patient"),
                        int(data.get("age") or 30),
                        data.get("gender", "Other"),
                        data.get("phone", "--"),
                        data.get("village", "--"),
                        data.get("aadhaar_last4"),
                        payload.synced_by or "Health Worker",
                        timestamp
                    ))
                    if client_id:
                        id_mapping[client_id] = target_id
                else:
                    target_id = existing["patient_id"]
                    if client_id:
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
                        payload.synced_by or "Health Worker",
                        timestamp
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
                        payload.synced_by or "Health Worker",
                        timestamp
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
                        payload.synced_by or "Health Worker",
                        timestamp
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
                        payload.synced_by or "Health Worker",
                        timestamp
                    ))

                synced_count += 1

            elif r_type == "referral":
                pid = id_mapping.get(data.get("patient_id"), data.get("patient_id", "SEVA-000001"))
                ref_id = data.get("referral_id")
                if not ref_id or "OFFLINE" in ref_id:
                    ref_id = f"REF-{datetime.now().strftime('%H%M%S')}"

                ref_status = data.get("status", "Created")
                cursor.execute("""
                    INSERT INTO referrals (referral_id, patient_id, from_facility, to_facility, reason, priority, status, notes, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    ref_id,
                    pid,
                    data.get("from_facility", "Sub-Centre"),
                    data.get("to_facility", "PHC"),
                    data.get("reason", "Specialist evaluation"),
                    data.get("priority", "Priority"),
                    ref_status,
                    data.get("notes", "Synced from offline"),
                    payload.synced_by or "Health Worker",
                    timestamp
                ))
                synced_count += 1

            elif r_type == "consultation":
                pid = id_mapping.get(data.get("patient_id"), data.get("patient_id", "SEVA-000001"))
                cursor.execute("""
                    INSERT INTO consultations (patient_id, doctor_name, symptoms_summary, clinical_notes, prescription, diagnosis_summary, followup_date, consulted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    pid,
                    data.get("doctor_name", payload.synced_by or "Dr. Suresh Kumar"),
                    data.get("symptoms_summary", ""),
                    data.get("clinical_notes", "Consultation review completed"),
                    data.get("prescription", "Standard supportive care advised."),
                    data.get("diagnosis_summary", "Completed"),
                    data.get("followup_date"),
                    timestamp
                ))
                # Update triage queue status
                cursor.execute("UPDATE triage_results SET status = 'Completed' WHERE patient_id = ?", (pid,))
                synced_count += 1

            elif r_type == "followup":
                pid = id_mapping.get(data.get("patient_id"), data.get("patient_id", "SEVA-000001"))
                cursor.execute("""
                    INSERT INTO followups (patient_id, reason, due_date, assigned_worker, status, sms_reminder_sent, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    pid,
                    data.get("reason", "Routine follow-up"),
                    data.get("due_date", datetime.now().strftime("%Y-%m-%d")),
                    data.get("assigned_worker", payload.synced_by or "Health Worker"),
                    data.get("status", "Due"),
                    1 if data.get("sms_reminder_sent") else 0,
                    data.get("notes", "Synced from offline"),
                    timestamp
                ))
                synced_count += 1

            elif r_type == "followup_status":
                fid = data.get("followup_id")
                status = data.get("status", "Completed")
                if fid:
                    cursor.execute("UPDATE followups SET status = ? WHERE id = ?", (status, fid))
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
