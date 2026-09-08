"""
SevaHealth - Database Initialization & Seeding
SQLite database schema supporting longitudinal patient EHR, triage, consultations,
referrals, follow-ups, diagnostics, medicines, and demo users.
"""

import sqlite3
from pathlib import Path
from datetime import datetime, timedelta

BASE_DIR = Path(__file__).resolve().parent.parent
DB_FILE = BASE_DIR / "sevahealth.db"


def get_db_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with dict-like row access."""
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes all required tables and seeds initial demo data."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            facility TEXT DEFAULT 'Chirala Primary Health Centre'
        )
    """)

    # 2. Patients Table (FHIR/ABDM-ready schema structure)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            gender TEXT NOT NULL,
            phone TEXT NOT NULL,
            village TEXT NOT NULL,
            aadhaar_last4 TEXT,
            registered_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_synced INTEGER DEFAULT 1
        )
    """)

    # 3. Vitals Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vitals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            temperature REAL,
            heart_rate INTEGER,
            bp_systolic INTEGER,
            bp_diastolic INTEGER,
            spo2 INTEGER,
            blood_sugar REAL,
            recorded_by TEXT,
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
        )
    """)

    # 4. Symptoms Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS symptoms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            symptoms_text TEXT NOT NULL,
            duration_days INTEGER DEFAULT 1,
            emergency_flags TEXT,
            recorded_by TEXT,
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
        )
    """)

    # 5. Smart Triage Results Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS triage_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            risk_level TEXT NOT NULL, -- RED, YELLOW, GREEN
            action_recommended TEXT NOT NULL,
            rule_triggered TEXT,
            routed_to TEXT NOT NULL, -- Emergency PHC, Priority Doctor Queue, Routine Home Care
            triaged_by TEXT,
            status TEXT DEFAULT 'Waiting', -- Waiting, In-Consultation, Completed
            triaged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
        )
    """)

    # 6. Consultations Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS consultations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            doctor_name TEXT NOT NULL,
            symptoms_summary TEXT,
            clinical_notes TEXT NOT NULL,
            prescription TEXT,
            diagnosis_summary TEXT,
            followup_date TEXT,
            status TEXT DEFAULT 'Completed',
            consulted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
        )
    """)

    # 7. Referrals Table (Full Loop Tracking)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referral_id TEXT UNIQUE NOT NULL,
            patient_id TEXT NOT NULL,
            from_facility TEXT NOT NULL,
            to_facility TEXT NOT NULL,
            reason TEXT NOT NULL,
            priority TEXT NOT NULL, -- Emergency, Priority, Routine
            status TEXT NOT NULL DEFAULT 'Created', -- Created, Sent, Accepted, In Progress, Completed
            notes TEXT,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
        )
    """)

    # 8. Follow-ups Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS followups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            due_date TEXT NOT NULL,
            assigned_worker TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Due', -- Due, Scheduled, Completed
            sms_reminder_sent INTEGER DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
        )
    """)

    # 9. Diagnostics Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS diagnostics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            test_name TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Completed', -- Pending, Completed
            result_summary TEXT,
            ordered_by TEXT,
            ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
        )
    """)

    # 10. Medicine Availability Inventory Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            dosage_form TEXT NOT NULL,
            category TEXT NOT NULL,
            stock_count INTEGER NOT NULL,
            min_threshold INTEGER DEFAULT 20,
            status TEXT NOT NULL, -- Available, Low Stock, Unavailable
            facility TEXT DEFAULT 'Chirala PHC'
        )
    """)

    conn.commit()

    # Seed demo users
    seed_demo_data(cursor, conn)

    conn.close()
    print("[Database] SQLite SevaHealth tables initialized and verified.")


def seed_demo_data(cursor, conn):
    """Seeds demo users, pre-existing patients, triage records, referrals and medicine stock."""
    # 1. Users
    demo_users = [
        ("Anitha Rao", "healthworker", "health123", "Health Worker", "Ramapuram Sub-Centre"),
        ("Dr. Suresh Kumar", "doctor", "doctor123", "Doctor", "Chirala Primary Health Centre"),
        ("Ramesh Patel", "admin", "admin123", "Administrator", "Chirala PHC Block"),
    ]
    for name, username, password, role, facility in demo_users:
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO users (name, username, password, role, facility) VALUES (?, ?, ?, ?, ?)",
                (name, username, password, role, facility)
            )

    # 2. Pre-seeded Demo Patients representing the Care Journey
    sample_patients = [
        ("SEVA-000001", "Lakshmi Devi", 58, "Female", "9848022334", "Ramapuram", "4123", "Anitha Rao"),
        ("SEVA-000002", "Venkatesh Rao", 64, "Male", "9848033445", "Kothapeta", "8821", "Anitha Rao"),
        ("SEVA-000003", "Sunitha Reddy", 32, "Female", "9848044556", "Peddapalli", "1094", "Anitha Rao"),
        ("SEVA-000004", "Raju Nayak", 45, "Male", "9848055667", "Ramapuram", "7320", "Anitha Rao"),
    ]

    for p_id, name, age, gender, phone, village, a4, reg_by in sample_patients:
        cursor.execute("SELECT id FROM patients WHERE patient_id = ?", (p_id,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO patients (patient_id, name, age, gender, phone, village, aadhaar_last4, registered_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (p_id, name, age, gender, phone, village, a4, reg_by)
            )

    # 3. Sample Vitals & Triage (1 RED emergency, 1 YELLOW priority, 2 GREEN routine)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # SEVA-000001: RED Emergency (Low SpO2 & High BP)
    cursor.execute("SELECT id FROM triage_results WHERE patient_id = 'SEVA-000001'")
    if not cursor.fetchone():
        cursor.execute("""
            INSERT INTO vitals (patient_id, temperature, heart_rate, bp_systolic, bp_diastolic, spo2, blood_sugar, recorded_by)
            VALUES ('SEVA-000001', 99.2, 115, 175, 105, 87, 190.0, 'Anitha Rao')
        """)
        cursor.execute("""
            INSERT INTO symptoms (patient_id, symptoms_text, duration_days, emergency_flags, recorded_by)
            VALUES ('SEVA-000001', 'Severe shortness of breath, chest tightness, dizziness', 2, 'Difficulty breathing / gasping, Chest tightness', 'Anitha Rao')
        """)
        cursor.execute("""
            INSERT INTO triage_results (patient_id, risk_level, action_recommended, rule_triggered, routed_to, triaged_by, status)
            VALUES ('SEVA-000001', 'RED', 'Immediate PHC / Medical Officer Evaluation. Provide supplemental oxygen and prepare referral.', 'Critical SpO2 < 90% (87%) & High BP', 'Emergency PHC Queue', 'Anitha Rao', 'Waiting')
        """)

    # SEVA-000002: YELLOW Priority (Moderate Fever & Elevated BP)
    cursor.execute("SELECT id FROM triage_results WHERE patient_id = 'SEVA-000002'")
    if not cursor.fetchone():
        cursor.execute("""
            INSERT INTO vitals (patient_id, temperature, heart_rate, bp_systolic, bp_diastolic, spo2, blood_sugar, recorded_by)
            VALUES ('SEVA-000002', 101.4, 98, 148, 92, 94, 160.0, 'Anitha Rao')
        """)
        cursor.execute("""
            INSERT INTO symptoms (patient_id, symptoms_text, duration_days, emergency_flags, recorded_by)
            VALUES ('SEVA-000002', 'High fever for 4 days, persistent dry cough, body aches', 4, 'None', 'Anitha Rao')
        """)
        cursor.execute("""
            INSERT INTO triage_results (patient_id, risk_level, action_recommended, rule_triggered, routed_to, triaged_by, status)
            VALUES ('SEVA-000002', 'YELLOW', 'Add to Priority Doctor Queue for tele-consultation or PHC visit within 24 hours.', 'Moderate SpO2 (94%) & Fever > 101°F', 'Priority Doctor Queue', 'Anitha Rao', 'Waiting')
        """)

    # SEVA-000003: GREEN Routine (Minor allergy)
    cursor.execute("SELECT id FROM triage_results WHERE patient_id = 'SEVA-000003'")
    if not cursor.fetchone():
        cursor.execute("""
            INSERT INTO vitals (patient_id, temperature, heart_rate, bp_systolic, bp_diastolic, spo2, blood_sugar, recorded_by)
            VALUES ('SEVA-000003', 98.4, 76, 118, 78, 98, 95.0, 'Anitha Rao')
        """)
        cursor.execute("""
            INSERT INTO symptoms (patient_id, symptoms_text, duration_days, emergency_flags, recorded_by)
            VALUES ('SEVA-000003', 'Mild seasonal rhinitis, sneezing', 3, 'None', 'Anitha Rao')
        """)
        cursor.execute("""
            INSERT INTO triage_results (patient_id, risk_level, action_recommended, rule_triggered, routed_to, triaged_by, status)
            VALUES ('SEVA-000003', 'GREEN', 'Routine follow-up / Home care hydration and OTC antihistamine guidance.', 'Normal Vitals (SpO2 98%, BP Normal)', 'Routine Home Care', 'Anitha Rao', 'Completed')
        """)

    # 4. Sample Referrals
    cursor.execute("SELECT id FROM referrals WHERE referral_id = 'REF-001'")
    if not cursor.fetchone():
        cursor.execute("""
            INSERT INTO referrals (referral_id, patient_id, from_facility, to_facility, reason, priority, status, notes, created_by)
            VALUES ('REF-001', 'SEVA-000001', 'Ramapuram Sub-Centre', 'District Hospital Ongole - Cardiology Unit', 'Severe hypoxic distress and uncontrolled hypertension', 'Emergency', 'Sent', 'Transport arranged via 108 Ambulance. IV line established.', 'Dr. Suresh Kumar')
        """)

    # 5. Sample Follow-ups
    cursor.execute("SELECT id FROM followups WHERE patient_id = 'SEVA-000002'")
    if not cursor.fetchone():
        due_tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        cursor.execute("""
            INSERT INTO followups (patient_id, reason, due_date, assigned_worker, status, sms_reminder_sent, notes)
            VALUES ('SEVA-000002', 'Check fever progression, medicine compliance and repeat SpO2 reading', ?, 'Anitha Rao', 'Due', 1, 'Patient advised to isolate in well-ventilated room.')
        """, (due_tomorrow,))

    # 6. Sample Diagnostics
    cursor.execute("SELECT id FROM diagnostics WHERE patient_id = 'SEVA-000002'")
    if not cursor.fetchone():
        cursor.execute("""
            INSERT INTO diagnostics (patient_id, test_name, category, status, result_summary, ordered_by)
            VALUES ('SEVA-000002', 'Rapid Malaria Antigen (RDT)', 'Point-of-Care Lab', 'Completed', 'Negative for P. falciparum and P. vivax', 'Dr. Suresh Kumar')
        """)
        cursor.execute("""
            INSERT INTO diagnostics (patient_id, test_name, category, status, result_summary, ordered_by)
            VALUES ('SEVA-000002', 'Complete Blood Count (CBC)', 'Laboratory', 'Pending', 'Sample dispatched to PHC lab', 'Dr. Suresh Kumar')
        """)

    # 7. Sample Medicines
    sample_meds = [
        ("Paracetamol 500mg", "Tablet", "Analgesic / Antipyretic", 450, 50, "Available"),
        ("Amoxicillin 500mg", "Capsule", "Antibiotic", 18, 30, "Low Stock"),
        ("ORS (Oral Rehydration Salts)", "Sachet", "Electrolytes", 220, 40, "Available"),
        ("Amlodipine 5mg", "Tablet", "Antihypertensive", 120, 25, "Available"),
        ("Metformin 500mg", "Tablet", "Antidiabetic", 85, 30, "Available"),
        ("Azithromycin 500mg", "Tablet", "Antibiotic", 0, 20, "Unavailable"),
        ("Salbutamol Inhaler", "Inhaler", "Bronchodilator", 14, 15, "Low Stock"),
        ("Iron & Folic Acid", "Tablet", "Maternal Health", 310, 50, "Available"),
    ]
    for name, form, cat, stock, thresh, stat in sample_meds:
        cursor.execute("SELECT id FROM medicines WHERE name = ?", (name,))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO medicines (name, dosage_form, category, stock_count, min_threshold, status, facility)
                VALUES (?, ?, ?, ?, ?, ?, 'Chirala PHC')
            """, (name, form, cat, stock, thresh, stat))

    conn.commit()
