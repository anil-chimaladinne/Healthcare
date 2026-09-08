/**
 * SevaHealth - Telugu / English Multilingual Localization Engine
 * Supports seamless bilingual switching for rural healthcare workers and medical officers.
 */

const I18N_STORAGE_KEY = "sevahealth_lang";

const TRANSLATIONS = {
  en: {
    // Brand & Topbar
    app_title: "SevaHealth",
    app_subtitle: "Offline-First Smart Healthcare",
    lang_en: "English",
    lang_te: "తెలుగు",
    sign_in: "Sign In",
    sign_out: "Sign Out",
    welcome: "Welcome",
    logged_in_as: "Logged in as",
    offline_mode: "Offline Mode",
    online_mode: "Online",
    sync_now: "Sync Now",
    all_synced: "All records synced",
    syncing: "Syncing records...",
    pending_sync: "records waiting to sync",

    // Navigation
    nav_dashboard: "Dashboard",
    nav_patients: "Patients & Doorstep",
    nav_doctor_queue: "Doctor Queue",
    nav_referrals: "Referrals",
    nav_followups: "Follow-ups",
    nav_inventory: "Medicines & Labs",

    // Dashboard Cards
    stat_total_patients: "Total Patients",
    stat_today_visits: "Today's Visits",
    stat_waiting_patients: "Waiting Patients",
    stat_high_risk: "High-Risk (RED)",
    stat_pending_referrals: "Pending Referrals",
    stat_followups_due: "Follow-ups Due",

    // ASHA Doorstep & Patient Intake
    btn_start_doorstep: "Start Doorstep Visit",
    btn_register_patient: "Register Patient",
    patient_id: "Patient ID",
    name: "Full Name",
    age: "Age",
    gender: "Gender",
    phone: "Phone Number",
    village: "Village / Hamlet",
    aadhaar_optional: "Aadhaar (Last 4 Digits)",
    symptoms_label: "Symptoms / Chief Complaints",
    duration_days: "Duration (Days)",
    vitals_section: "Vitals Signs Assessment",
    temp_label: "Temperature (°F)",
    hr_label: "Heart Rate (bpm)",
    bp_label: "Blood Pressure (Systolic / Diastolic)",
    spo2_label: "SpO2 Oxygen (%)",
    sugar_label: "Random Glucose (mg/dL)",
    emergency_flags: "Emergency Warning Signs",
    btn_run_triage: "Run Smart Triage",
    btn_save_offline: "Save Record (Offline/Online)",
    voice_input_tip: "Voice Input – Prototype",

    // Triage Results
    triage_title: "Smart Triage Result",
    risk_level: "Risk Level",
    risk_red: "RED - Emergency",
    risk_yellow: "YELLOW - Priority",
    risk_green: "GREEN - Routine",
    action_plan: "Recommended Action",
    routing_dest: "Smart Routing",

    // Doctor & Tele-Consult
    doctor_workspace: "Doctor Consultation Workspace",
    btn_open_teleconsult: "Start Tele-Consult (Demo)",
    clinical_notes: "Doctor Clinical Notes",
    prescription_label: "E-Prescription / Medications",
    diagnosis_label: "Provisional Diagnosis",
    followup_date_label: "Follow-up Date",
    btn_submit_consultation: "Complete Consultation",
    btn_create_referral: "Create Referral",
    diagnosis_pending: "Diagnosis pending doctor consultation.",

    // Referrals & Followups
    from_facility: "From Facility",
    to_facility: "To Facility / Specialty Hospital",
    priority: "Priority",
    referral_status: "Status",
    btn_send_sms: "Send Demo SMS Reminder",
    timeline_title: "Longitudinal Care Journey Timeline",
    fhir_preview: "FHIR / ABDM Record Preview"
  },
  te: {
    // Brand & Topbar
    app_title: "సేవాహెల్త్",
    app_subtitle: "గ్రామీణ ఆఫ్లైన్ స్మార్ట్ హెల్త్కేర్",
    lang_en: "English",
    lang_te: "తెలుగు",
    sign_in: "లాగిన్ అవ్వండి",
    sign_out: "లాగౌట్",
    welcome: "స్వాగతం",
    logged_in_as: "లాగిన్ చేసిన పాత్ర",
    offline_mode: "ఆఫ్లైన్ మోడ్",
    online_mode: "ఆన్లైన్",
    sync_now: "సింక్ చేయండి",
    all_synced: "అన్ని రికార్డులు సింక్ అయ్యాయి",
    syncing: "సింక్ అవుతోంది...",
    pending_sync: "రికార్డులు సింక్ చేయాల్సి ఉంది",

    // Navigation
    nav_dashboard: "డాష్‌బోర్డ్",
    nav_patients: "రోగులు & ఇంటి వద్ద తనిఖీ",
    nav_doctor_queue: "డాక్టర్ క్యూ",
    nav_referrals: "రిఫరల్స్",
    nav_followups: "ఫాలో-అప్స్",
    nav_inventory: "మందులు & ల్యాబ్స్",

    // Dashboard Cards
    stat_total_patients: "మొత్తం రోగులు",
    stat_today_visits: "నేటి సందర్శనలు",
    stat_waiting_patients: "వేచి ఉన్న రోగులు",
    stat_high_risk: "అత్యవసర (రెడ్)",
    stat_pending_referrals: "పెండింగ్ రిఫరల్స్",
    stat_followups_due: "రాబోయే ఫాలో-అప్స్",

    // ASHA Doorstep & Patient Intake
    btn_start_doorstep: "ఇంటి వద్ద తనిఖీ ప్రారంభించండి",
    btn_register_patient: "రోగి నమోదు",
    patient_id: "రోగి ఐడి",
    name: "పూర్తి పేరు",
    age: "వయస్సు",
    gender: "లింగం",
    phone: "ఫోన్ నంబర్",
    village: "గ్రామం / నివాసం",
    aadhaar_optional: "ఆధార్ (చివరి 4 అంకెలు)",
    symptoms_label: "లక్షణాలు / సమస్యలు",
    duration_days: "వ్యవధి (రోజులు)",
    vitals_section: "వైటల్స్ పరీక్ష (రక్తపోటు, ఆక్సిజన్)",
    temp_label: "ఉష్ణోగ్రత (°F)",
    hr_label: "హృదయ స్పందన (bpm)",
    bp_label: "రక్తపోటు (సిస్టోలిక్ / డయాస్టోలిక్)",
    spo2_label: "ఆక్సిజన్ లెవల్ SpO2 (%)",
    sugar_label: "బ్లడ్ షుగర్ (mg/dL)",
    emergency_flags: "అత్యవసర హెచ్చరిక సంకేతాలు",
    btn_run_triage: "స్మార్ట్ ట్రయేజ్ అమలు చేయండి",
    btn_save_offline: "రికార్డును భద్రపరచండి (ఆఫ్లైన్/ఆన్లైన్)",
    voice_input_tip: "వాయిస్ ఇన్పుట్ – నమూనా",

    // Triage Results
    triage_title: "స్మార్ట్ ట్రయేజ్ ఫలితం",
    risk_level: "ప్రమాద స్థాయి",
    risk_red: "రెడ్ - అత్యవసరం (తక్షణ వైద్యం)",
    risk_yellow: "ఎల్లో - ప్రాధాన్యత (డాక్టర్ సమీక్ష)",
    risk_green: "గ్రీన్ - సాధారణం (ఇంటి వద్ద సంరక్షణ)",
    action_plan: "సిఫార్సు చేసిన చర్య",
    routing_dest: "స్మార్ట్ రూటింగ్",

    // Doctor & Tele-Consult
    doctor_workspace: "డాక్టర్ కన్సల్టేషన్ వర్క్‌స్పేస్",
    btn_open_teleconsult: "టెలి-కన్సల్ట్ ప్రారంభించండి (డెమో)",
    clinical_notes: "డాక్టర్ క్లినికల్ గమనికలు",
    prescription_label: "ఈ-ప్రిస్క్రిప్షన్ / మందులు",
    diagnosis_label: "రోగ నిర్ధారణ సారాంశం",
    followup_date_label: "ఫాలో-అప్ తేదీ",
    btn_submit_consultation: "కన్సల్టేషన్ పూర్తి చేయండి",
    btn_create_referral: "రిఫరల్ సృష్టించండి",
    diagnosis_pending: "వైద్యుల కన్సల్టేషన్ కోసం రోగ నిర్ధారణ వేచి ఉంది.",

    // Referrals & Followups
    from_facility: "ప్రాథమిక కేంద్రం",
    to_facility: "రిఫరల్ ఆసుపత్రి",
    priority: "ప్రాధాన్యత",
    referral_status: "స్థితి",
    btn_send_sms: "డెమో SMS రిమైండర్ పంపండి",
    timeline_title: "రోగి సంరక్షణ ప్రయాణ కాలక్రమం (EHR)",
    fhir_preview: "FHIR / ABDM రికార్డ్ ప్రివ్యూ"
  }
};

/**
 * Get current active language code ('en' or 'te')
 */
function getCurrentLanguage() {
  return localStorage.getItem(I18N_STORAGE_KEY) || "en";
}

/**
 * Set active language and refresh DOM elements
 */
function setLanguage(lang) {
  if (lang !== "en" && lang !== "te") lang = "en";
  localStorage.setItem(I18N_STORAGE_KEY, lang);
  applyTranslations();
  
  // Update language selector dropdown or buttons if present
  const langSelect = document.getElementById("lang-select");
  if (langSelect) {
    langSelect.value = lang;
  }
}

/**
 * Translate a single key
 */
function t(key, defaultVal = "") {
  const lang = getCurrentLanguage();
  return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || (TRANSLATIONS["en"] && TRANSLATIONS["en"][key]) || defaultVal || key;
}

/**
 * Apply translations to all DOM elements with data-i18n attribute
 */
function applyTranslations() {
  const lang = getCurrentLanguage();
  const dict = TRANSLATIONS[lang] || TRANSLATIONS["en"];

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      if (el.tagName === "INPUT" && el.hasAttribute("placeholder")) {
        el.setAttribute("placeholder", dict[key]);
      } else {
        el.textContent = dict[key];
      }
    }
  });

  // Update html lang attribute
  document.documentElement.setAttribute("lang", lang);
}

// Auto-init on page load
document.addEventListener("DOMContentLoaded", () => {
  applyTranslations();
  const langSelect = document.getElementById("lang-select");
  if (langSelect) {
    langSelect.value = getCurrentLanguage();
    langSelect.addEventListener("change", (e) => {
      setLanguage(e.target.value);
    });
  }
});
