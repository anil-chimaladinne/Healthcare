/**
 * SevaHealth - Patient Intake, Doorstep Visit, and Longitudinal Record Controller
 */

let currentSelectedPatientId = null;
let lastEvaluatedTriage = null;

document.addEventListener("DOMContentLoaded", () => {
  const user = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
  const isDoctor = user && user.role.includes("Doctor");

  // If Doctor is viewing patient.html, hide ASHA doorstep form to focus on Patient Records & EHR
  const doorstepSection = document.getElementById("patient-intake-form")?.closest(".doorstep-intake-card");
  if (isDoctor && doorstepSection) {
    doorstepSection.style.display = "none";
  }

  setupPatientIntakeForm();
  setupVoiceInput();
  setupSearch();
  loadPatientsList();

  // Check if a specific patient ID was passed via query param (e.g. ?id=SEVA-000001)
  const urlParams = new URLSearchParams(window.location.search);
  const pid = urlParams.get("id");
  if (pid) {
    viewPatientLongitudinalRecord(pid);
  }
});

/**
 * Setup Voice-to-Text Input Prototype for Symptoms / Notes
 */
function setupVoiceInput() {
  const voiceBtn = document.getElementById("btn-voice-symptoms");
  const symptomsInput = document.getElementById("p_symptoms");

  if (!voiceBtn || !symptomsInput) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = getCurrentLanguage() === "te" ? "te-IN" : "en-IN";

    let isListening = false;

    voiceBtn.addEventListener("click", () => {
      if (!isListening) {
        try {
          recognition.start();
          isListening = true;
          voiceBtn.classList.add("voice-recording");
          voiceBtn.innerHTML = "🎙️ <em>Listening...</em>";
        } catch (e) {
          console.warn("Speech recognition error:", e);
        }
      } else {
        recognition.stop();
        isListening = false;
        voiceBtn.classList.remove("voice-recording");
        voiceBtn.innerHTML = "🎤 Voice Input";
      }
    });

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const current = symptomsInput.value;
      symptomsInput.value = current ? `${current} ${transcript}` : transcript;
      showToast(`🎤 Voice captured: "${transcript}"`);
      // Re-trigger live triage
      triggerLiveTriage();
    };

    recognition.onend = () => {
      isListening = false;
      voiceBtn.classList.remove("voice-recording");
      voiceBtn.innerHTML = "🎤 Voice Input";
    };

    recognition.onerror = () => {
      isListening = false;
      voiceBtn.classList.remove("voice-recording");
      voiceBtn.innerHTML = "🎤 Voice Input";
    };
  } else {
    voiceBtn.title = "Browser voice recognition not supported on this browser (fallback to text)";
    voiceBtn.addEventListener("click", () => {
      showToast("Voice input is a demo prototype. Please type symptoms directly.", "warning");
    });
  }
}

/**
 * Live Triage Trigger as ASHA types vitals & symptoms
 */
function triggerLiveTriage() {
  const vitals = {
    temperature: document.getElementById("p_temp")?.value,
    heart_rate: document.getElementById("p_hr")?.value,
    bp_systolic: document.getElementById("p_bp_sys")?.value,
    bp_diastolic: document.getElementById("p_bp_dia")?.value,
    spo2: document.getElementById("p_spo2")?.value,
    blood_sugar: document.getElementById("p_sugar")?.value
  };

  const selectedFlags = [];
  document.querySelectorAll(".emergency-flag-chk:checked").forEach((chk) => {
    selectedFlags.push(chk.value);
  });

  const symptoms = {
    symptoms_text: document.getElementById("p_symptoms")?.value || "Doorstep routine check",
    duration_days: document.getElementById("p_duration")?.value || 1,
    emergency_flags: selectedFlags.join(", ")
  };

  const result = runLocalSmartTriage(vitals, symptoms);
  lastEvaluatedTriage = result;

  const resultBox = document.getElementById("live-triage-preview");
  if (resultBox) {
    resultBox.innerHTML = renderTriageCardHTML(result);
    resultBox.style.display = "block";
  }
}

/**
 * Setup Doorstep Intake Form Handlers
 */
function setupPatientIntakeForm() {
  const form = document.getElementById("patient-intake-form");
  const runTriageBtn = document.getElementById("btn-eval-triage");

  // Inputs for live triage preview
  const inputsToWatch = ["p_temp", "p_hr", "p_bp_sys", "p_bp_dia", "p_spo2", "p_sugar", "p_symptoms", "p_duration"];
  inputsToWatch.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", triggerLiveTriage);
    }
  });

  document.querySelectorAll(".emergency-flag-chk").forEach((chk) => {
    chk.addEventListener("change", triggerLiveTriage);
  });

  if (runTriageBtn) {
    runTriageBtn.addEventListener("click", triggerLiveTriage);
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("p_name").value.trim();
      const age = parseInt(document.getElementById("p_age").value, 10);
      const gender = document.getElementById("p_gender").value;
      const phone = document.getElementById("p_phone").value.trim();
      const village = document.getElementById("p_village").value.trim();
      const aadhaar = document.getElementById("p_aadhaar")?.value.trim();

      if (!name || isNaN(age) || !phone || !village) {
        showToast("Please fill in required fields: Name, Age, Phone, and Village", "danger");
        return;
      }

      // Collect vitals & symptoms
      const vitals = {
        temperature: parseFloat(document.getElementById("p_temp").value) || null,
        heart_rate: parseInt(document.getElementById("p_hr").value, 10) || null,
        bp_systolic: parseInt(document.getElementById("p_bp_sys").value, 10) || null,
        bp_diastolic: parseInt(document.getElementById("p_bp_dia").value, 10) || null,
        spo2: parseInt(document.getElementById("p_spo2").value, 10) || null,
        blood_sugar: parseFloat(document.getElementById("p_sugar").value) || null
      };

      const selectedFlags = [];
      document.querySelectorAll(".emergency-flag-chk:checked").forEach((chk) => {
        selectedFlags.push(chk.value);
      });

      const symptoms = {
        symptoms_text: document.getElementById("p_symptoms").value.trim() || "Routine doorstep intake",
        duration_days: parseInt(document.getElementById("p_duration").value, 10) || 1,
        emergency_flags: selectedFlags.join(", ")
      };

      const triageResult = lastEvaluatedTriage || runLocalSmartTriage(vitals, symptoms);

      const user = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
      const registeredBy = user ? user.name : "Anitha Rao (Health Worker)";

      const patientPayload = {
        name,
        age,
        gender,
        phone,
        village,
        aadhaar_last4: aadhaar || null,
        registered_by: registeredBy,
        initial_vitals: vitals,
        initial_symptoms: symptoms,
        run_triage: true
      };

      const submitBtn = document.getElementById("btn-submit-patient");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";
      }

      // Check offline or online mode
      if (!isAppOnline()) {
        // Save in IndexedDB offline queue
        const tempId = `OFFLINE-${Date.now().toString().slice(-4)}`;
        await queueOfflineRecord("patient", {
          client_temp_id: tempId,
          patient_id: tempId,
          ...patientPayload,
          vitals,
          symptoms,
          triage: triageResult
        });

        showToast(`📦 Saved Locally (Offline Mode)! Temp ID: ${tempId}. Will sync when online.`);
        form.reset();
        document.getElementById("live-triage-preview").style.display = "none";
        loadPatientsList();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Save Record (Offline/Online)";
        }
        return;
      }

      // Online API save
      try {
        const response = await fetch(`${API_BASE_URL}/patients`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patientPayload)
        });

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }

        const data = await response.json();
        showToast(`🎉 Patient Registered Successfully! ID: ${data.patient.patient_id} (${triageResult.risk_level})`);

        form.reset();
        document.getElementById("live-triage-preview").style.display = "none";
        loadPatientsList();

        // Switch to longitudinal view of new patient
        viewPatientLongitudinalRecord(data.patient.patient_id);
      } catch (err) {
        console.warn("Online registration failed, queueing offline:", err);
        // Fallback to offline queue
        await queueOfflineRecord("patient", patientPayload);
        showToast("⚠️ Network issue: Record queued in IndexedDB for automatic sync.", "warning");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Save Record (Offline/Online)";
        }
      }
    });
  }
}

/**
 * Load and render Patients table / cards
 */
async function loadPatientsList(searchQuery = "") {
  const container = document.getElementById("patients-list-body");
  if (!container) return;

  try {
    const url = searchQuery ? `${API_BASE_URL}/patients?search=${encodeURIComponent(searchQuery)}` : `${API_BASE_URL}/patients`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch patients");
    const patients = await res.json();

    if (patients.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--slate-500);">
            No patient records found. Start a doorstep visit to register patients.
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = patients.map((p) => {
      const riskClass = p.latest_risk_level === 'RED' ? 'badge-risk-red' : (p.latest_risk_level === 'YELLOW' ? 'badge-risk-yellow' : 'badge-risk-green');
      return `
        <tr>
          <td><strong class="code-font">${p.patient_id}</strong></td>
          <td><strong>${p.name}</strong><br><small class="text-muted">${p.age}y &bull; ${p.gender}</small></td>
          <td>${p.village}<br><small class="text-muted">${p.phone}</small></td>
          <td>
            <span class="badge ${riskClass}">${p.latest_risk_level}</span>
          </td>
          <td>
            <small>SpO2: <strong>${p.latest_spo2 ? p.latest_spo2 + '%' : '--'}</strong></small><br>
            <small>BP: <strong>${p.latest_bp || '--'}</strong></small>
          </td>
          <td><span class="badge badge-primary">${p.queue_status}</span></td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="viewPatientLongitudinalRecord('${p.patient_id}')">
              📖 View EHR
            </button>
          </td>
        </tr>
      `;
    }).join("");
  } catch (e) {
    console.error("Error loading patients:", e);
    container.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 1.5rem; color: var(--status-danger);">
          Unable to load patient records. Server may be offline.
        </td>
      </tr>
    `;
  }
}

/**
 * Search Bar Handler
 */
function setupSearch() {
  const searchInput = document.getElementById("search-patient-input");
  if (!searchInput) return;

  let debounceTimer;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      loadPatientsList(e.target.value.trim());
    }, 300);
  });
}

/**
 * Fetch and Render Patient Longitudinal Care Journey Timeline
 */
async function viewPatientLongitudinalRecord(patientId) {
  currentSelectedPatientId = patientId;
  const modal = document.getElementById("ehr-timeline-modal");
  const contentArea = document.getElementById("ehr-timeline-content");

  if (!modal || !contentArea) return;

  modal.style.display = "flex";
  contentArea.innerHTML = `<div style="text-align:center; padding: 3rem;">Loading longitudinal record for ${patientId}...</div>`;

  try {
    const res = await fetch(`${API_BASE_URL}/patients/${patientId}`);
    if (!res.ok) throw new Error("Could not load EHR");
    const data = await res.json();
    const p = data.patient;

    const timelineHTML = data.timeline.map((event) => {
      return `
        <div class="timeline-item">
          <div class="timeline-marker marker-${event.badge_type}"></div>
          <div class="timeline-card">
            <div class="timeline-header">
              <h4>${event.title}</h4>
              <span class="timeline-time">${event.timestamp}</span>
            </div>
            ${event.subtitle ? `<p class="timeline-subtitle">${event.subtitle}</p>` : ''}
          </div>
        </div>
      `;
    }).join("");

    // Check if doctor has completed consultation
    const latestConsultation = data.consultations && data.consultations.length > 0 ? data.consultations[data.consultations.length - 1] : null;
    const diagnosisStatusHTML = latestConsultation
      ? `<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-md); padding: 0.875rem 1rem; margin-top: 1rem;">
           <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #1e40af; font-weight: 700;">👨‍⚕️ Doctor Clinical Diagnosis</div>
           <div style="font-size: 1rem; font-weight: 700; color: #0f172a; margin-top: 0.2rem;">${latestConsultation.diagnosis_summary || 'Clinical Consultation Completed'}</div>
           <div style="font-size: 0.8125rem; color: #3b82f6; margin-top: 0.2rem;">Consulted by: ${latestConsultation.doctor_name} &bull; Rx: ${latestConsultation.prescription || 'Standard supportive care'}</div>
         </div>`
      : `<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-md); padding: 0.875rem 1rem; margin-top: 1rem;">
           <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #92400e; font-weight: 700;">⏳ Diagnosis Status</div>
           <div style="font-size: 0.9375rem; font-weight: 600; color: #78350f; margin-top: 0.2rem;" data-i18n="diagnosis_pending">Diagnosis pending doctor consultation.</div>
           <div style="font-size: 0.75rem; color: #b45309; margin-top: 0.2rem;">ASHA worker assessment captures symptoms and vitals. Formal medical diagnosis is performed by the Doctor in the consultation queue.</div>
         </div>`;

    contentArea.innerHTML = `
      <div class="ehr-patient-banner">
        <div class="ehr-patient-id-badge">${p.patient_id}</div>
        <div class="ehr-patient-info">
          <h3>${p.name} (${p.age}y / ${p.gender})</h3>
          <p>📍 ${p.village} &bull; 📞 ${p.phone} &bull; Registered by: ${p.registered_by || 'Health Worker'}</p>
        </div>
        <div class="ehr-actions">
          <button class="btn btn-outline btn-sm" onclick="showFhirPreviewModal('${p.patient_id}')">
            🔗 FHIR / ABDM JSON Preview
          </button>
        </div>
      </div>

      ${diagnosisStatusHTML}

      <h4 style="margin: 1.5rem 0 1rem; color: var(--slate-800);">🌟 Continuous Care Journey Timeline</h4>
      <div class="timeline-container">
        ${timelineHTML}
      </div>
    `;
  } catch (e) {
    contentArea.innerHTML = `<div class="alert alert-danger">Failed to load longitudinal record: ${e.message}</div>`;
  }
}

function closeEhrModal() {
  const modal = document.getElementById("ehr-timeline-modal");
  if (modal) modal.style.display = "none";
}

/**
 * Display sample FHIR R4 / ABDM JSON structure
 */
async function showFhirPreviewModal(patientId) {
  try {
    const res = await fetch(`${API_BASE_URL}/patients/${patientId}`);
    const data = await res.json();
    const jsonStr = JSON.stringify(data.fhir_bundle_preview || {}, null, 2);

    const fhirModal = document.getElementById("fhir-preview-modal");
    const jsonEl = document.getElementById("fhir-json-code");
    if (fhirModal && jsonEl) {
      jsonEl.textContent = jsonStr;
      fhirModal.style.display = "flex";
    }
  } catch (e) {
    showToast("Could not generate FHIR preview", "warning");
  }
}

function closeFhirModal() {
  const modal = document.getElementById("fhir-preview-modal");
  if (modal) modal.style.display = "none";
}
