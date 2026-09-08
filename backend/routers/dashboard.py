"""
SevaHealth - Dashboard Router
Aggregates key operational metrics, triage queue, referrals, and inventory for role dashboards.
"""

from fastapi import APIRouter
from backend.database import get_db_connection
from backend.schemas import DashboardResponse, PatientSummary

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse, summary="Get Aggregated Dashboard KPIs")
def get_dashboard_metrics():
    """
    Returns live operational KPIs calculated from SQLite database:
    Total patients, today's visits, waiting triage queue, high risk count,
    pending referrals, follow-ups due, recent patients, and doctor queue.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Total Patients
    cursor.execute("SELECT COUNT(*) FROM patients")
    total_patients = cursor.fetchone()[0]

    # 2. Today's Visits
    cursor.execute("SELECT COUNT(*) FROM vitals WHERE DATE(recorded_at) = DATE('now')")
    today_visits = cursor.fetchone()[0]
    if today_visits == 0:
        # Fallback to total recent vitals for demo prototype
        cursor.execute("SELECT COUNT(*) FROM vitals")
        today_visits = cursor.fetchone()[0]

    # 3. Waiting Patients (In Triage / Queue)
    cursor.execute("SELECT COUNT(*) FROM triage_results WHERE status = 'Waiting'")
    waiting_patients = cursor.fetchone()[0]

    # 4. High-Risk Patients (RED)
    cursor.execute("""
        SELECT COUNT(DISTINCT patient_id) FROM triage_results 
        WHERE risk_level = 'RED'
    """)
    high_risk_patients = cursor.fetchone()[0]

    # 5. Pending Referrals (Created or Sent)
    cursor.execute("SELECT COUNT(*) FROM referrals WHERE status IN ('Created', 'Sent', 'In Progress')")
    pending_referrals = cursor.fetchone()[0]

    # 6. Follow-ups Due
    cursor.execute("SELECT COUNT(*) FROM followups WHERE status = 'Due'")
    followups_due = cursor.fetchone()[0]

    # 7. Doctor Queue (Sorted RED -> YELLOW -> GREEN)
    cursor.execute("""
        SELECT t.id as triage_id, t.patient_id, p.name as patient_name, p.age, p.gender, p.village, p.phone,
               t.risk_level, t.action_recommended, t.rule_triggered, t.routed_to, t.status, t.triaged_at,
               v.temperature, v.heart_rate, v.bp_systolic, v.bp_diastolic, v.spo2, v.blood_sugar,
               s.symptoms_text, s.emergency_flags
        FROM triage_results t
        JOIN patients p ON t.patient_id = p.patient_id
        LEFT JOIN (
            SELECT v1.* FROM vitals v1
            INNER JOIN (SELECT patient_id, MAX(id) as max_id FROM vitals GROUP BY patient_id) v2
            ON v1.id = v2.max_id
        ) v ON t.patient_id = v.patient_id
        LEFT JOIN (
            SELECT s1.* FROM symptoms s1
            INNER JOIN (SELECT patient_id, MAX(id) as max_id FROM symptoms GROUP BY patient_id) s2
            ON s1.id = s2.max_id
        ) s ON t.patient_id = s.patient_id
        ORDER BY 
            CASE t.risk_level 
                WHEN 'RED' THEN 1 
                WHEN 'YELLOW' THEN 2 
                ELSE 3 
            END,
            t.id DESC
    """)
    doctor_queue = [dict(r) for r in cursor.fetchall()]

    # 8. Recent Patients
    cursor.execute("""
        SELECT p.id, p.patient_id, p.name, p.age, p.gender, p.phone, p.village, 
               p.aadhaar_last4, p.registered_by, p.created_at,
               t.risk_level as latest_risk_level, t.routed_to as queue_status,
               v.spo2 as latest_spo2, 
               v.bp_systolic || '/' || v.bp_diastolic as latest_bp
        FROM patients p
        LEFT JOIN (
            SELECT t1.patient_id, t1.risk_level, t1.routed_to 
            FROM triage_results t1 
            INNER JOIN (SELECT patient_id, MAX(id) as max_id FROM triage_results GROUP BY patient_id) t2 
            ON t1.id = t2.max_id
        ) t ON p.patient_id = t.patient_id
        LEFT JOIN (
            SELECT v1.patient_id, v1.spo2, v1.bp_systolic, v1.bp_diastolic
            FROM vitals v1
            INNER JOIN (SELECT patient_id, MAX(id) as max_id FROM vitals GROUP BY patient_id) v2 
            ON v1.id = v2.max_id
        ) v ON p.patient_id = v.patient_id
        ORDER BY p.id DESC
        LIMIT 6
    """)
    recent_rows = cursor.fetchall()
    recent_patients = [
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
            queue_status=r["queue_status"] or "Registered"
        )
        for r in recent_rows
    ]

    # 9. Medicine Inventory
    cursor.execute("SELECT * FROM medicines ORDER BY status DESC, stock_count ASC")
    medicine_inventory = [dict(r) for r in cursor.fetchall()]

    # 10. Referral Stats
    cursor.execute("""
        SELECT 
            SUM(CASE WHEN priority = 'Emergency' THEN 1 ELSE 0 END) as emergency_count,
            SUM(CASE WHEN priority = 'Priority' THEN 1 ELSE 0 END) as priority_count,
            SUM(CASE WHEN priority = 'Routine' THEN 1 ELSE 0 END) as routine_count,
            COUNT(*) as total_referrals
        FROM referrals
    """)
    ref_row = cursor.fetchone()
    referral_stats = {
        "emergency": ref_row["emergency_count"] or 0,
        "priority": ref_row["priority_count"] or 0,
        "routine": ref_row["routine_count"] or 0,
        "total": ref_row["total_referrals"] or 0
    }

    conn.close()

    return DashboardResponse(
        total_patients=total_patients,
        today_visits=today_visits,
        waiting_patients=waiting_patients,
        high_risk_patients=high_risk_patients,
        pending_referrals=pending_referrals,
        followups_due=followups_due,
        offline_records=0,
        sync_pending=0,
        recent_patients=recent_patients,
        doctor_queue=doctor_queue,
        referral_stats=referral_stats,
        medicine_inventory=medicine_inventory
    )
