# SevaHealth

> **Offline-First Smart Healthcare for Rural India**  
> *Smart India Hackathon (SIH 2026) Student Prototype MVP*  
> **Core Concept:** *"Care continues even when the internet does not."*

---

## 1. Project Description & SIH Problem Statement

In rural and remote tribal regions across India, frontline health workers (ASHA and ANM workers) provide vital doorstep healthcare. However, **unreliable, intermittent, or completely absent internet connectivity** prevents timely patient intake, risk screening, triage, and doctor coordination. As a result, critical cases are delayed, patient histories are lost across disconnected paper registers, and follow-ups fall through the cracks.

**SevaHealth** solves this by delivering an **Offline-First Smart Healthcare Support Platform**. Frontline workers can register patients, record symptoms and vital signs, and execute a local **Rule-Based Smart Triage Engine** directly on their mobile device without an active internet connection. As soon as connectivity is restored, records automatically synchronize with Primary Health Centres (PHCs) and medical officers.

---

## 2. Key Innovation: The Closed-Loop Rural Care Journey

```
Doorstep Patient Intake (Offline)
         ↓
  ASHA Health Worker
         ↓
  Smart Triage Engine (RED / YELLOW / GREEN)
         ↓
  Doctor Tele-Consultation (Priority Queue)
         ↓
  Tracked Specialist Referral Loop
         ↓
  Community Follow-up & Bilingual SMS Reminders
```

---

## 3. Features Implemented in this MVP

1. **Offline-First PWA & IndexedDB**: Web application works 100% offline using Service Workers and IndexedDB. Frontline workers can capture data anywhere.
2. **Interactive Offline Simulation Toggle**: Includes a one-click *"Simulate Offline / Go Online"* button in the top bar so students can seamlessly demonstrate offline intake and automatic batch synchronization to SIH judges.
3. **Transparent Rule-Based Smart Triage**: Evaluates vitals (SpO2, BP, Pulse, Temperature, Blood Glucose) and emergency signs to classify risk into **RED (Emergency)**, **YELLOW (Priority)**, or **GREEN (Routine)** with clear reasoning and routing guidance.
4. **Longitudinal Patient EHR Timeline**: Continuous chronological timeline indexed under unique Patient IDs (`SEVA-000001`) tracking intake, vitals, triage history, consultations, prescriptions, referrals, and lab tests.
5. **Doctor Priority Workspace**: Real-time queue sorted by acuity (`RED > YELLOW > GREEN`) with a **Tele-Consultation Prototype**, clinical note editor, e-prescription writer, and follow-up scheduler.
6. **Specialist Referral Tracking Loop**: Full lifecycle status tracking (`Created -> Sent -> Accepted -> In Progress -> Completed`) from Sub-Centres to District Specialty Hospitals.
7. **Care Continuity & Follow-ups**: Follow-up visit scheduler with one-click **Bilingual (Telugu & English) Demo SMS Reminder preview**.
8. **Telugu (తెలుగు) / English Localization**: Built-in instant translation engine for all navigation, clinical forms, triage cards, and instructions.
9. **Voice Input Prototype**: Browser Web Speech API integration (`webkitSpeechRecognition`) for voice-to-text symptom capture.
10. **FHIR / ABDM-Ready Architecture**: Structured JSON schema preview aligning with national digital health standards (Bundle, Patient, Encounter, Observation).
11. **Multi-Role Dashboards**: Tailored operational views for **Health Workers**, **Doctors**, and **Administrators** with real-time KPI metrics and medicine inventory tracking.

---

## 4. Smart Triage Engine (Transparent Rule Logic)

The triage engine uses transparent medical decision rules (no black-box AI):

| Risk Level | Visual Badge | Criteria Triggered | Smart Routing Action |
| :--- | :--- | :--- | :--- |
| **RED** | 🚨 **Emergency** | Critical Hypoxia (SpO2 < 90%), Severe Hypertensive Crisis (BP ≥ 180/110), Critical Heart Rate (>130 or <40 bpm), High Fever (≥103.5°F), or Emergency Warning Signs (Severe chest pain, respiratory distress, altered consciousness). | **Immediate PHC / Specialist Attention** & 108 Ambulance Coordination |
| **YELLOW** | ⚠️ **Priority** | Moderate Oxygen Saturation (SpO2 90–94%), Elevated BP (140–179/90–109), Moderate Fever (100.4–103.4°F), Tachycardia (100–130 bpm), Abnormal Glucose, or symptoms lasting ≥ 5 days. | **Priority Doctor Queue** for tele-consultation within 24 hours |
| **GREEN** | ✅ **Routine** | Normal vitals (SpO2 ≥ 95%, Normal BP & Temp) with minor seasonal symptoms. | **Routine Home Care Guidance** & standard ASHA follow-up |

---

## 5. Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Responsive Healthcare Design System), Vanilla JavaScript (ES6+), PWA (`manifest.json`, `service-worker.js`), Browser IndexedDB.
- **Backend**: Python 3.10+, FastAPI, Pydantic v2, Uvicorn.
- **Database**: SQLite (built-in Python `sqlite3`).
- **Communication**: REST API / JSON with batch sync endpoint.

---

## 6. Project Structure

```
Healthcare/
├── backend/
│   ├── main.py              # FastAPI app, CORS, static routes, and lifespan handler
│   ├── database.py          # SQLite schema, tables, and pre-seeded demo records
│   ├── models.py            # User and data entity representations
│   ├── schemas.py           # Pydantic request/response models & FHIR structures
│   └── routers/
│       ├── auth.py          # POST /api/auth/login
│       ├── dashboard.py     # GET /api/dashboard
│       ├── patients.py      # GET/POST /api/patients, longitudinal EHR timeline
│       ├── triage.py        # POST /api/triage rule engine
│       ├── consultations.py # POST /api/consultations (Tele-Consult notes & Rx)
│       ├── referrals.py     # GET/POST/PATCH /api/referrals (Tracked loop)
│       ├── followups.py     # GET/POST/PATCH /api/followups & Demo SMS trigger
│       ├── sync.py          # POST /api/sync/batch (IndexedDB offline synchronizer)
│       └── inventory.py     # GET /api/inventory/medicines & diagnostics
│
├── frontend/
│   ├── index.html           # Landing page with Care Journey visual diagram
│   ├── login.html           # Authentication portal with SIH demo role autofill
│   ├── dashboard.html       # Responsive multi-role operational dashboard
│   ├── patient.html         # ASHA Doorstep visit, voice input, triage, and EHR
│   ├── doctor.html          # Doctor priority queue, tele-consult modal, Rx writer
│   ├── referrals.html       # Tracked specialist referral lifecycle
│   ├── followups.html       # Follow-up scheduler & bilingual SMS modal
│   │
│   ├── css/
│   │   └── style.css        # Responsive healthcare design system
│   │
│   ├── js/
│   │   ├── api.js           # REST API client
│   │   ├── auth.js          # Role session state and route guards
│   │   ├── i18n.js          # Telugu & English localization engine
│   │   ├── offline.js       # IndexedDB manager, offline sync queue & simulation
│   │   ├── triage.js        # Client-side smart triage rule evaluator
│   │   ├── patient.js       # Doorstep intake, voice recognition & timeline view
│   │   ├── doctor.js        # Doctor queue controller & tele-consult modal
│   │   ├── referrals.js     # Referral status manager
│   │   ├── followups.js     # Follow-up actions & SMS reminder previews
│   │   └── dashboard.js     # Dashboard state & KPI loaders
│   │
│   ├── manifest.json        # PWA manifest
│   └── service-worker.js    # PWA offline cache worker
│
├── requirements.txt         # Minimal backend dependencies (fastapi, uvicorn, pydantic)
├── README.md                # Complete documentation and SIH presentation guide
├── .gitignore               # Python and environment ignores
└── test_backend.py          # Automated verification test suite (9 test suites)
```

---

## 7. How to Run the Project

### Step 1: Install Dependencies
```powershell
pip install -r requirements.txt
```

### Step 2: Start the FastAPI Backend Server
```powershell
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### Step 3: Access the Application
- **Main Portal**: Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in any modern web browser.
- **Interactive Swagger API Docs**: **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**
- **Health Endpoint**: **[http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)**

---

## 8. Demo Login Credentials

On the login screen, click the quick autofill buttons to immediately populate credentials:

| Role | Username | Password | Assigned Health Centre | Primary Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Health Worker (ASHA)** | `healthworker` | `health123` | Ramapuram Sub-Centre | Doorstep intake, vitals, offline triage |
| **Doctor** | `doctor` | `doctor123` | Chirala Primary Health Centre | Queue review, tele-consult, prescriptions |
| **Administrator** | `admin` | `admin123` | Chirala PHC Block | System KPIs, medicine inventory, sync stats |

---

## 9. SIH 2026 Step-by-Step Presentation & Demo Script

When demonstrating the project to evaluators, follow this 3-minute sequence:

1. **Step 1: Introduction & Landing Page (`index.html`)**
   - Show the Care Journey diagram: *Doorstep Patient &rarr; ASHA &rarr; Triage &rarr; Doctor &rarr; Referral &rarr; Follow-up*.
   - Toggle language to **తెలుగు (Telugu)** to showcase regional accessibility for frontline village workers.
2. **Step 2: Sign In as ASHA Health Worker**
   - Click *"🏥 ASHA / HW"* autofill and sign in.
   - Show the live dashboard with KPI metrics.
3. **Step 3: Demonstrate Offline Mode (`patient.html`)**
   - Click the **"📡 Simulate Offline"** button in the top bar. The badge changes to `📴 OFFLINE MODE`.
   - Start a Doorstep Visit: Enter patient name, age, village, and use the **🎤 Voice Input** button to dictate symptoms.
   - Enter vitals (e.g. SpO2 `88%`, BP `180/110`).
   - Observe the **Live Smart Triage** evaluate locally in real-time to **🚨 RED — Emergency**.
   - Click **"Save Record"**. The notification confirms: *"Saved Locally in IndexedDB (Offline Mode)"*.
   - Notice the sync indicator updates to: `⏳ 1 pending sync`.
4. **Step 4: Demonstrate Automatic Synchronization**
   - Click **"📶 Go Online"** (or click **"Sync Now"**).
   - Watch the sync engine batch commit the record to the backend and update to `☁️ All synced`.
5. **Step 5: Sign In as Doctor (`doctor.html`)**
   - Switch to the Doctor role (`doctor` / `doctor123`).
   - Open the **Doctor Priority Queue**. The newly triaged emergency patient appears highlighted at the very top.
   - Click **"🩺 Start Tele-Consult"**.
   - Review patient vitals, type provisional diagnosis & e-prescription, set a follow-up date, and click **"Complete Consultation"**.
6. **Step 6: Escalate Referral & Follow-up (`referrals.html` & `followups.html`)**
   - Demonstrate the **Tracked Referral Loop** (updating status from `Sent` to `Accepted`).
   - Open **Follow-ups** and click **"📲 Send Demo SMS"** to display the automated bilingual SMS reminder in English and Telugu.
7. **Step 7: View Longitudinal EHR**
   - Open the patient's record to display the full **Care Journey Timeline** and the **FHIR / ABDM JSON structure**.

---

## 10. Prototype Disclaimers & What is Demo-Only

> [!IMPORTANT]
> - **Student Hackathon MVP**: This application is a prototype developed for Smart India Hackathon (SIH 2026) concept evaluation and is **not intended for real clinical diagnostic or emergency decision-making**.
> - **Authentication**: Simplified plain-text demo credentials for easy judging evaluation (in production, will use salted bcrypt hashing, JWT tokens, and OAuth2).
> - **SMS & Video**: Tele-consultation and SMS reminders use prototype demonstration interfaces without billable third-party SMS/telecom gateways.
> - **Synthetic Data**: All pre-seeded and demo patient records are completely fictional.

---

## 11. Future Roadmap

- **ABDM Milestone 1–3 Integration**: Full integration with Ayushman Bharat Digital Mission (ABDM) Health Facility Registry (HFR) and ABHA ID creation.
- **Edge AI / On-Device Voice Processing**: Offline Telugu speech-to-text models running directly via WebAssembly/TensorFlow.js on entry-level Android smartphones.
- **Bluetooth IoT Diagnostic Integration**: Direct pairing with digital pulse oximeters and BP cuffs via Web Bluetooth API.
- **Automated USSD / IVR Voice Reminders**: Automated voice call reminders in regional dialects for illiterate patients.