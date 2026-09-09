/**
 * SevaHealth - REST API Client Wrapper & Offline Fallbacks
 * Centralized fetch functions for communication with FastAPI backend,
 * with graceful offline fallbacks via IndexedDB and local storage.
 */

function determineApiBaseUrl() {
  if (typeof window === "undefined" || !window.location) return "http://127.0.0.1:8000/api";
  const { protocol, hostname, port, origin } = window.location;
  if (!protocol || !protocol.startsWith("http")) {
    return "http://127.0.0.1:8000/api";
  }
  // If running on local static dev server like VS Code Live Server (port 5500, 5501, 3000, 8080, etc.)
  if ((hostname === "localhost" || hostname === "127.0.0.1") && port && port !== "8000") {
    return `http://${hostname}:8000/api`;
  }
  return `${origin}/api`;
}

const API_BASE_URL = determineApiBaseUrl();

/**
 * Standard frontline demo accounts for offline authentication
 */
const OFFLINE_DEMO_ACCOUNTS = {
  "healthworker": {
    password: "health123",
    data: {
      success: true,
      user_id: 1,
      name: "Anitha Rao (ANM / ASHA)",
      username: "healthworker",
      role: "Health Worker (ASHA / ANM)",
      facility: "Ramapuram Sub-Centre"
    }
  },
  "doctor": {
    password: "doctor123",
    data: {
      success: true,
      user_id: 2,
      name: "Dr. Suresh Kumar",
      username: "doctor",
      role: "Doctor (Medical Officer)",
      facility: "Chirala PHC"
    }
  },
  "admin": {
    password: "admin123",
    data: {
      success: true,
      user_id: 3,
      name: "Dr. K. V. Sharma",
      username: "admin",
      role: "Administrator (District Health Officer)",
      facility: "Prakasam DMHO"
    }
  }
};

/**
 * Check backend health
 */
async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return { status: "offline", message: "Server offline. Operating in local IndexedDB mode.", offline: true };
  }
}

/**
 * Authenticate user credentials with offline fallback
 */
async function loginUser(username, password) {
  const cleanUser = username.trim().toLowerCase();

  // If offline or simulated offline, perform instant local authentication
  if (typeof isAppOnline === "function" && !isAppOnline()) {
    return authenticateOffline(cleanUser, password);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanUser, password: password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Invalid username or password.");
    }
    return data;
  } catch (e) {
    // If network failure occurs, fall back to offline credentials
    if (e.message.includes("Failed to fetch") || e.message.includes("NetworkError") || e.message.includes("fetch")) {
      return authenticateOffline(cleanUser, password);
    }
    throw e;
  }
}

function authenticateOffline(cleanUser, password) {
  const account = OFFLINE_DEMO_ACCOUNTS[cleanUser];
  if (account && account.password === password) {
    if (typeof showToast === "function") {
      showToast("📴 Offline Login: Authenticated locally in offline mode.");
    }
    return account.data;
  }
  throw new Error("Invalid username or password. Demo passwords: health123, doctor123, admin123");
}

/**
 * Get dashboard metrics with dynamic offline calculation
 */
async function getDashboardData() {
  if (typeof isAppOnline === "function" && !isAppOnline()) {
    return getOfflineDashboardMetrics();
  }

  try {
    const res = await fetch(`${API_BASE_URL}/dashboard`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Cache recent data in local storage
    localStorage.setItem("sevahealth_cached_dashboard", JSON.stringify(data));
    return data;
  } catch (e) {
    return getOfflineDashboardMetrics();
  }
}

async function getOfflineDashboardMetrics() {
  let patients = [];
  if (typeof getLocalPatients === "function") {
    patients = await getLocalPatients();
  }

  let pendingSyncCount = 0;
  if (typeof getPendingSyncCount === "function") {
    pendingSyncCount = await getPendingSyncCount();
  }

  const redCount = patients.filter(p => p.latest_risk_level === "RED" || (p.triage && p.triage.risk_level === "RED")).length;
  const waitingPatients = patients.filter(p => p.queue_status === "Waiting" || p.latest_risk_level === "RED" || p.latest_risk_level === "YELLOW");

  return {
    total_patients: patients.length,
    today_visits: patients.length,
    waiting_patients: waitingPatients.length,
    high_risk_patients: redCount,
    pending_referrals: 1,
    followups_due: 2,
    pending_sync_count: pendingSyncCount,
    recent_patients: patients.slice(0, 5),
    doctor_queue: waitingPatients.map(p => ({
      patient_id: p.patient_id,
      patient_name: p.name,
      age: p.age,
      gender: p.gender,
      village: p.village,
      phone: p.phone,
      risk_level: p.latest_risk_level || (p.triage ? p.triage.risk_level : "GREEN"),
      spo2: p.latest_spo2 || (p.vitals ? p.vitals.spo2 : null),
      bp_systolic: p.vitals ? p.vitals.bp_systolic : null,
      bp_diastolic: p.vitals ? p.vitals.bp_diastolic : null,
      temperature: p.vitals ? p.vitals.temperature : null,
      heart_rate: p.vitals ? p.vitals.heart_rate : null,
      blood_sugar: p.vitals ? p.vitals.blood_sugar : null,
      symptoms_text: p.symptoms ? p.symptoms.symptoms_text : "Offline intake",
      emergency_flags: p.symptoms ? p.symptoms.emergency_flags : "",
      action_recommended: p.triage ? p.triage.action_recommended : "Consultation advised",
      rule_triggered: p.triage ? p.triage.rule_triggered : "Local offline evaluation"
    })),
    medicine_inventory: [
      { name: "Paracetamol 500mg", category: "Analgesic / Antipyretic", stock_count: 1420, status: "Available" },
      { name: "Amoxicillin 500mg", category: "Antibiotic", stock_count: 85, status: "Low Stock" },
      { name: "ORS Sachets (WHO formula)", category: "Rehydration", stock_count: 530, status: "Available" },
      { name: "Metformin 500mg", category: "Anti-Diabetic", stock_count: 240, status: "Available" },
      { name: "Amlodipine 5mg", category: "Anti-Hypertensive", stock_count: 180, status: "Available" }
    ]
  };
}
