"""
SevaHealth - Pydantic Request & Response Schemas
Structured data validation models with FHIR/ABDM-ready resource mapping.
"""

from typing import List, Optional, Any
from pydantic import BaseModel, Field


# --- Health & Auth ---
class HealthResponse(BaseModel):
    status: str = "ok"
    message: str = "SevaHealth backend is running"
    version: str = "1.0.0-SIH2026"


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    user_id: int
    name: str
    username: str
    role: str
    facility: str
    message: str


class RegisterRequest(BaseModel):
    name: str = Field(..., description="Full Name of the Healthcare Personnel")
    username: str = Field(..., description="Unique Username for Login")
    password: str = Field(..., description="Account Password")
    role: str = Field(..., description="Role: Health Worker, Doctor, Specialist, Administrator")
    facility: Optional[str] = Field("Chirala Primary Health Centre", description="Assigned Health Centre or Hospital")
    phone: Optional[str] = Field(None, description="Contact Phone Number")


class RegisterResponse(BaseModel):
    success: bool
    user_id: int
    name: str
    username: str
    role: str
    facility: str
    message: str


# --- Vitals & Symptoms ---
class VitalsInput(BaseModel):
    temperature: Optional[float] = Field(None, description="Body Temperature in °F")
    heart_rate: Optional[int] = Field(None, description="Heart Rate in bpm")
    bp_systolic: Optional[int] = Field(None, description="Systolic Blood Pressure in mmHg")
    bp_diastolic: Optional[int] = Field(None, description="Diastolic Blood Pressure in mmHg")
    spo2: Optional[int] = Field(None, description="Blood Oxygen Saturation percentage")
    blood_sugar: Optional[float] = Field(None, description="Random Blood Glucose in mg/dL")


class SymptomsInput(BaseModel):
    symptoms_text: str = Field(..., description="Description of chief complaints")
    duration_days: Optional[int] = Field(1, description="Duration in days")
    emergency_flags: Optional[str] = Field(None, description="Comma-separated emergency flags")


# --- Smart Triage ---
class TriageRequest(BaseModel):
    patient_id: str
    vitals: VitalsInput
    symptoms: SymptomsInput
    age: Optional[int] = 30
    gender: Optional[str] = "Other"
    existing_conditions: Optional[str] = None
    triaged_by: Optional[str] = "Health Worker"


class TriageResponse(BaseModel):
    patient_id: str
    risk_level: str  # RED, YELLOW, GREEN
    action_recommended: str
    rule_triggered: str
    routed_to: str
    triage_id: Optional[int] = None
    triaged_at: Optional[str] = None


# --- Patient Registration & Records ---
class PatientCreate(BaseModel):
    name: str
    age: int
    gender: str
    phone: str
    village: str
    aadhaar_last4: Optional[str] = None
    registered_by: Optional[str] = "Health Worker"
    initial_vitals: Optional[VitalsInput] = None
    initial_symptoms: Optional[SymptomsInput] = None
    run_triage: Optional[bool] = True


class PatientSummary(BaseModel):
    id: int
    patient_id: str
    name: str
    age: int
    gender: str
    phone: str
    village: str
    aadhaar_last4: Optional[str] = None
    registered_by: Optional[str] = None
    created_at: str
    latest_risk_level: Optional[str] = "GREEN"
    latest_spo2: Optional[int] = None
    latest_bp: Optional[str] = None
    queue_status: Optional[str] = "Registered"
    has_referral: Optional[bool] = False
    referral_id: Optional[str] = None
    referral_to_facility: Optional[str] = None
    referral_priority: Optional[str] = None
    referral_status: Optional[str] = None
    referral_created_by: Optional[str] = None


class LongitudinalTimelineEvent(BaseModel):
    event_type: str  # 'Registration', 'Vitals', 'Triage', 'Consultation', 'Referral', 'Followup', 'Diagnostic'
    title: str
    subtitle: Optional[str] = None
    timestamp: str
    details: dict
    badge_type: Optional[str] = "primary"  # danger, warning, success, info, purple


class PatientDetailResponse(BaseModel):
    patient: PatientSummary
    vitals_history: List[dict] = []
    symptoms_history: List[dict] = []
    triage_history: List[dict] = []
    consultations: List[dict] = []
    referrals: List[dict] = []
    followups: List[dict] = []
    diagnostics: List[dict] = []
    timeline: List[LongitudinalTimelineEvent] = []
    fhir_bundle_preview: Optional[dict] = None  # FHIR/ABDM-ready sample export preview


# --- Consultations ---
class ConsultationCreate(BaseModel):
    patient_id: str
    doctor_name: str
    symptoms_summary: Optional[str] = None
    clinical_notes: str
    prescription: Optional[str] = None
    diagnosis_summary: Optional[str] = None
    followup_date: Optional[str] = None


class ConsultationResponse(BaseModel):
    id: int
    patient_id: str
    doctor_name: str
    clinical_notes: str
    prescription: Optional[str]
    diagnosis_summary: Optional[str]
    followup_date: Optional[str]
    consulted_at: str


# --- Referrals ---
class ReferralCreate(BaseModel):
    patient_id: str
    from_facility: str
    to_facility: str
    reason: str
    priority: str = "Priority"  # Emergency, Priority, Routine
    notes: Optional[str] = None
    created_by: Optional[str] = "Doctor"


class ReferralStatusUpdate(BaseModel):
    status: str  # Created, Sent, Accepted, In Progress, Completed
    notes: Optional[str] = None


class SpecialistReviewRequest(BaseModel):
    status: str = "Accepted"  # Accepted, In Progress, Completed, Admitted, Discharged
    specialist_name: Optional[str] = "Dr. Priya Sharma"
    specialist_notes: str
    recommended_action: Optional[str] = None


class ReferralResponse(BaseModel):
    id: int
    referral_id: str
    patient_id: str
    patient_name: Optional[str] = None
    from_facility: str
    to_facility: str
    reason: str
    priority: str
    status: str
    notes: Optional[str] = None
    created_by: str
    created_at: str
    updated_at: str


# --- Follow-ups ---
class FollowupCreate(BaseModel):
    patient_id: str
    reason: str
    due_date: str
    assigned_worker: str
    notes: Optional[str] = None


class FollowupStatusUpdate(BaseModel):
    status: str  # Due, Scheduled, Completed
    sms_reminder_sent: Optional[bool] = None


class FollowupResponse(BaseModel):
    id: int
    patient_id: str
    patient_name: Optional[str] = None
    reason: str
    due_date: str
    assigned_worker: str
    status: str
    sms_reminder_sent: bool
    notes: Optional[str] = None
    created_at: str


# --- Dashboard ---
class DashboardResponse(BaseModel):
    total_patients: int
    today_visits: int
    waiting_patients: int
    high_risk_patients: int
    pending_referrals: int
    followups_due: int
    offline_records: int
    sync_pending: int
    recent_patients: List[PatientSummary] = []
    doctor_queue: List[dict] = []
    referral_stats: dict = {}
    medicine_inventory: List[dict] = []


# --- Batch Offline Sync Request ---
class OfflineRecordItem(BaseModel):
    id: Optional[Any] = None
    type: str  # 'patient', 'vitals', 'triage', 'consultation', 'referral', 'followup', 'followup_status'
    client_temp_id: Optional[str] = None
    data: dict
    timestamp: Optional[str] = None

    class Config:
        extra = "ignore"


class BatchSyncRequest(BaseModel):
    records: List[OfflineRecordItem]
    synced_by: Optional[str] = "Health Worker"

    class Config:
        extra = "ignore"


class BatchSyncResponse(BaseModel):
    success: bool
    synced_count: int
    failed_count: int
    message: str
    mapping: dict = {}  # temporary client ID -> server ID

