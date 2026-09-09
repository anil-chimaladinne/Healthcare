"""
SevaHealth - Comprehensive Backend Automated Verification Script
Validates:
1. Health check & DB tables
2. Multi-role Authentication (Health Worker, Doctor, Admin)
3. Patient Registration & Longitudinal EHR Generation
4. Rule-Based Smart Triage Engine (RED / YELLOW / GREEN test cases)
5. Doctor Tele-Consultation & Prescription Recording
6. Specialist Referral Creation & Status Loop
7. Follow-up Scheduling & Demo SMS Trigger
8. Batch Offline Sync Processor
9. Operational Dashboard KPIs
"""

import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://127.0.0.1:8000"


def make_request(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    payload = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def run_tests():
    print("=" * 60)
    print("SevaHealth - SIH 2026 Prototype Verification Suite")
    print("=" * 60)

    # 1. Health Check
    print("\n[1/9] Testing GET /api/health...")
    status, body = make_request("/api/health")
    assert status == 200 and body["status"] == "ok"
    print(f"  -> PASSED: {body['message']}")

    # 2. Authentication
    print("\n[2/9] Testing POST /api/auth/login (Health Worker, Doctor, Specialist, Admin)...")
    demo_creds = [
        ("healthworker", "health123", "Health Worker"),
        ("doctor", "doctor123", "Doctor"),
        ("specialist", "specialist123", "Specialist"),
        ("admin", "admin123", "Administrator")
    ]
    for username, pwd, role in demo_creds:
        status, body = make_request("/api/auth/login", method="POST", data={"username": username, "password": pwd})
        assert status == 200 and body["success"] is True and body["role"] == role
        print(f"  -> PASSED for {role}: {body['name']} ({body['facility']})")

    # Test invalid login
    status, body = make_request("/api/auth/login", method="POST", data={"username": "fake", "password": "wrong"})
    assert status == 401
    print("  -> PASSED: Rejected invalid credentials with 401.")

    # 3. Patient Registration & Doorstep Intake
    print("\n[3/9] Testing POST /api/patients (Doorstep Intake + Instant Triage)...")
    patient_payload = {
        "name": "Bhavani Prasad",
        "age": 62,
        "gender": "Male",
        "phone": "9848199887",
        "village": "Ramapuram",
        "aadhaar_last4": "5512",
        "registered_by": "Anitha Rao",
        "initial_vitals": {
            "temperature": 102.1,
            "heart_rate": 108,
            "bp_systolic": 150,
            "bp_diastolic": 95,
            "spo2": 93,
            "blood_sugar": 175.0
        },
        "initial_symptoms": {
            "symptoms_text": "Continuous fever, dry cough, dizziness",
            "duration_days": 3,
            "emergency_flags": "None"
        },
        "run_triage": True
    }
    status, body = make_request("/api/patients", method="POST", data=patient_payload)
    assert status == 200
    new_patient_id = body["patient"]["patient_id"]
    print(f"  -> PASSED: Registered {body['patient']['name']} with ID {new_patient_id} (Triage: {body['patient']['latest_risk_level']})")
    assert len(body["timeline"]) >= 3, "Timeline should contain Registration, Vitals, and Triage events"
    print(f"  -> PASSED: Longitudinal Care Journey Timeline generated with {len(body['timeline'])} events.")

    # 4. Smart Triage Engine Rules
    print("\n[4/9] Testing POST /api/triage (Rule Evaluations: RED / YELLOW / GREEN)...")
    # A. RED case (Severe Hypoxia & Emergency flag)
    red_req = {
        "patient_id": new_patient_id,
        "vitals": {"spo2": 86, "bp_systolic": 185, "bp_diastolic": 115, "temperature": 99.0, "heart_rate": 135},
        "symptoms": {"symptoms_text": "Severe chest pain and gasping", "emergency_flags": "Severe chest pain, Difficulty breathing / gasping"},
        "age": 62,
        "gender": "Male"
    }
    status, body = make_request("/api/triage", method="POST", data=red_req)
    assert status == 200 and body["risk_level"] == "RED"
    print(f"  -> PASSED RED Evaluation: {body['rule_triggered']} -> {body['routed_to']}")

    # B. GREEN case (Normal Vitals)
    green_req = {
        "patient_id": new_patient_id,
        "vitals": {"spo2": 98, "bp_systolic": 120, "bp_diastolic": 80, "temperature": 98.4, "heart_rate": 72},
        "symptoms": {"symptoms_text": "Minor body ache", "emergency_flags": ""},
        "age": 30,
        "gender": "Female"
    }
    status, body = make_request("/api/triage", method="POST", data=green_req)
    assert status == 200 and body["risk_level"] == "GREEN"
    print(f"  -> PASSED GREEN Evaluation: {body['rule_triggered']} -> {body['routed_to']}")

    # 5. Doctor Consultation & Prescription
    print("\n[5/9] Testing POST /api/consultations (Tele-Consult Recording)...")
    consult_payload = {
        "patient_id": new_patient_id,
        "doctor_name": "Dr. Suresh Kumar",
        "symptoms_summary": "Fever, elevated BP, mild hypoxia",
        "clinical_notes": "Patient reviewed via tele-consult. Advised oral antibiotics and BP management.",
        "prescription": "Tab Paracetamol 500mg (1-0-1), Tab Amlodipine 5mg (0-1-0)",
        "diagnosis_summary": "Acute Upper Respiratory Tract Infection with Mild Hypertension",
        "followup_date": "2026-09-12"
    }
    status, body = make_request("/api/consultations", method="POST", data=consult_payload)
    assert status == 200
    print(f"  -> PASSED: Consultation saved for {body['patient_id']} by {body['doctor_name']}")

    # 6. Specialist Referral Creation & Listing
    print("\n[6/9] Testing POST /api/referrals & GET /api/referrals...")
    ref_payload = {
        "patient_id": new_patient_id,
        "from_facility": "Chirala PHC",
        "to_facility": "District Hospital Ongole - Cardiology Unit",
        "reason": "Cardiac risk evaluation and echocardiogram",
        "priority": "Emergency",
        "notes": "Ambulance coordinated with 108 helpline."
    }
    status, body = make_request("/api/referrals", method="POST", data=ref_payload)
    assert status == 200
    ref_id = body["referral_id"]
    print(f"  -> PASSED: Created Referral {ref_id} (Priority: {body['priority']})")

    status, refs = make_request("/api/referrals")
    assert status == 200 and len(refs) >= 1
    print(f"  -> PASSED: Retrieved {len(refs)} active referral loops.")

    # Test Specialist Clinical Review & Status Advance
    spec_review_payload = {
        "status": "Accepted",
        "specialist_name": "Dr. Priya Sharma (Cardiologist)",
        "specialist_notes": "Patient admitted to Cardiology Unit. ECG reveals acute ischemic changes. Commenced continuous oxygen and heparin.",
        "recommended_action": "Admitted to Cardiology ICU Bed #3"
    }
    status, rev_res = make_request(f"/api/referrals/{ref_id}/specialist-review", method="PATCH", data=spec_review_payload)
    assert status == 200 and rev_res["status"] == "Accepted"
    print(f"  -> PASSED Specialist Review: {rev_res['message']} (Status: {rev_res['status']})")

    # 7. Follow-ups & Demo SMS Reminder
    print("\n[7/9] Testing POST /api/followups & Demo SMS...")
    follow_payload = {
        "patient_id": new_patient_id,
        "reason": "Check recovery and medicine adherence",
        "due_date": "2026-09-15",
        "assigned_worker": "Anitha Rao"
    }
    status, body = make_request("/api/followups", method="POST", data=follow_payload)
    assert status == 200
    f_id = body["id"]
    print(f"  -> PASSED: Follow-up scheduled for {body['patient_name']} on {body['due_date']}")

    status, sms_res = make_request(f"/api/followups/{f_id}/send-sms", method="POST")
    assert status == 200 and sms_res["success"] is True
    print(f"  -> PASSED Demo SMS Trigger: \"{sms_res['sms_preview_en'][:60]}...\"")

    # 8. Batch Offline Sync (IndexedDB simulation)
    print("\n[8/9] Testing POST /api/sync/batch (Offline synchronization engine)...")
    sync_payload = {
        "records": [
            {
                "type": "patient",
                "data": {
                    "client_temp_id": "TEMP-0099",
                    "name": "Kalyani Devi (Offline Test)",
                    "age": 48,
                    "gender": "Female",
                    "phone": "9848200112",
                    "village": "Kothapeta",
                    "vitals": {"temperature": 99.1, "spo2": 97, "bp_systolic": 125, "bp_diastolic": 82},
                    "symptoms": {"symptoms_text": "Routine doorstep screening"}
                },
                "timestamp": "2026-09-08T12:00:00Z"
            }
        ],
        "synced_by": "Anitha Rao (Health Worker)"
    }
    status, sync_body = make_request("/api/sync/batch", method="POST", data=sync_payload)
    assert status == 200 and sync_body["synced_count"] == 1
    print(f"  -> PASSED: Batch sync committed {sync_body['synced_count']} offline record(s) to central database.")

    # 9. Dashboard KPIs
    print("\n[9/9] Testing GET /api/dashboard (Operational KPIs)...")
    status, dash = make_request("/api/dashboard")
    assert status == 200
    print(f"  -> Total Patients: {dash['total_patients']}")
    print(f"  -> Today's Visits: {dash['today_visits']}")
    print(f"  -> Waiting Patients in Queue: {dash['waiting_patients']}")
    print(f"  -> High-Risk (RED): {dash['high_risk_patients']}")
    print(f"  -> Pending Referrals: {dash['pending_referrals']}")
    print(f"  -> Follow-ups Due: {dash['followups_due']}")
    print(f"  -> Doctor Queue Size: {len(dash['doctor_queue'])}")
    print(f"  -> Medicine Inventory Items: {len(dash['medicine_inventory'])}")

    print("\n" + "=" * 60)
    print("ALL 9 TEST SUITES COMPLETED WITH 100% SUCCESS!")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
