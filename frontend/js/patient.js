/**
 * SevaHealth - Patient Intake, Doorstep Visit, and Longitudinal Record Controller
 * Full offline-first support via IndexedDB & local Smart Triage engine.
 */

let currentSelectedPatientId = null;
let lastEvaluatedTriage = null;

document.addEventListener("DOMContentLoaded", () => {
  const user = (typeof requireAuth === "function") ? requireAuth() : getCurrentUser();
  if (!user) return;
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
    recognition.lang = (typeof getCurrentLanguage === "function" && getCurrentLanguage() === "te") ? "te-IN" : "en-IN";

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
    temperature: parseFloat(document.getElementById("p_temp")?.value) || null,
    heart_rate: parseInt(document.getElementById("p_hr")?.value, 10) || null,
    bp_systolic: parseInt(document.getElementById("p_bp_sys")?.value, 10) || null,
    bp_diastolic: parseInt(document.getElementById("p_bp_dia")?.value, 10) || null,
    spo2: parseInt(document.getElementById("p_spo2")?.value, 10) || null,
    blood_sugar: parseFloat(document.getElementById("p_sugar")?.value) || null
  };

  const selectedFlags = [];
  document.querySelectorAll(".emergency-flag-chk:checked").forEach((chk) => {
    selectedFlags.push(chk.value);
  });

  const symptoms = {
    symptoms_text: document.getElementById("p_symptoms")?.value || "Doorstep routine check",
    duration_days: parseInt(document.getElementById("p_duration")?.value, 10) || 1,
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

      const submitBtn = document.getElementById("btn-submit-patient");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";
      }

      // Check offline mode
      if (typeof isAppOnline === "function" && !isAppOnline()) {
        const tempId = `SEVA-OFFLINE-${Date.now().toString().slice(-4)}`;
        const localRecord = {
          patient_id: tempId,
          client_temp_id: tempId,
          name,
          age,
          gender,
          phone,
          village,
          aadhaar_last4: aadhaar || null,
          registered_by: registeredBy,
          latest_risk_level: triageResult.risk_level,
          latest_spo2: vitals.spo2,
          latest_bp: (vitals.bp_systolic && vitals.bp_diastolic) ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : null,
          queue_status: "Waiting",
          vitals,
          symptoms,
          triage: triageResult,
          created_at: new Date().toISOString()
        };

        await queueOfflineRecord("patient", localRecord);
        await saveLocalPatient(localRecord);

        showToast(`📦 Saved Locally (Offline Mode)! Temp ID: ${tempId}. Will sync when online.`);
        form.reset();
        const previewEl = document.getElementById("live-triage-preview");
        if (previewEl) previewEl.style.display = "none";
        loadPatientsList();
        viewPatientLongitudinalRecord(tempId);

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Save Record (Offline/Online)";
        }
        return;
      }

      // Online API save
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
        
        // Cache newly registered patient into IndexedDB as well
        if (typeof saveLocalPatient === "function") {
          saveLocalPatient({
            patient_id: data.patient.patient_id,
            name,
            age,
            gender,
            phone,
            village,
            aadhaar_last4: aadhaar || null,
            registered_by: registeredBy,
            latest_risk_level: triageResult.risk_level,
            latest_spo2: vitals.spo2,
            latest_bp: (vitals.bp_systolic && vitals.bp_diastolic) ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : null,
            queue_status: "Waiting",
            vitals,
            symptoms,
            triage: triageResult,
            created_at: new Date().toISOString()
          });
        }

        showToast(`🎉 Patient Registered Successfully! ID: ${data.patient.patient_id} (${triageResult.risk_level})`);

        form.reset();
        const previewEl = document.getElementById("live-triage-preview");
        if (previewEl) previewEl.style.display = "none";
        loadPatientsList();
        viewPatientLongitudinalRecord(data.patient.patient_id);
      } catch (err) {
        console.warn("Online registration failed, queueing offline:", err);
        // Fallback to local storage in offline mode
        const tempId = `SEVA-OFFLINE-${Date.now().toString().slice(-4)}`;
        const localRecord = {
          patient_id: tempId,
          client_temp_id: tempId,
          name,
          age,
          gender,
          phone,
          village,
          aadhaar_last4: aadhaar || null,
          registered_by: registeredBy,
          latest_risk_level: triageResult.risk_level,
          latest_spo2: vitals.spo2,
          latest_bp: (vitals.bp_systolic && vitals.bp_diastolic) ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : null,
          queue_status: "Waiting",
          vitals,
          symptoms,
          triage: triageResult,
          created_at: new Date().toISOString()
        };

        await queueOfflineRecord("patient", localRecord);
        await saveLocalPatient(localRecord);

        showToast("⚠️ Network issue: Record queued in IndexedDB for automatic sync.", "warning");
        form.reset();
        loadPatientsList();
        viewPatientLongitudinalRecord(tempId);
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
 * Load and render Patients table with offline-first caching
 */
async function loadPatientsList(searchQuery = "") {
  const container = document.getElementById("patients-list-body");
  if (!container) return;

  let patients = [];

  if (typeof isAppOnline === "function" && !isAppOnline()) {
    // Offline mode: load from IndexedDB
    patients = await getLocalPatients();
  } else {
    try {
      const url = searchQuery ? `${API_BASE_URL}/patients?search=${encodeURIComponent(searchQuery)}` : `${API_BASE_URL}/patients`;
      const res = await fetch(url);
      if (res.ok) {
        patients = await res.json();
        // Cache to local IndexedDB for future offline usage
        if (typeof saveLocalPatients === "function") {
          saveLocalPatients(patients);
        }
      } else {
        patients = await getLocalPatients();
      }
    } catch (e) {
      console.warn("Fetching patients from server failed, reading IndexedDB:", e);
      patients = await getLocalPatients();
    }
  }

  // Filter if search query is provided
  if (searchQuery && Array.isArray(patients)) {
    const q = searchQuery.toLowerCase();
    patients = patients.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.patient_id && p.patient_id.toLowerCase().includes(q)) ||
      (p.village && p.village.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q))
    );
  }

  if (!patients || patients.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--slate-500);">
          No patient records found. Start a doorstep visit to register patients.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = patients.map((p) => {
    const risk = p.latest_risk_level || (p.triage ? p.triage.risk_level : "GREEN");
    const riskClass = risk === 'RED' ? 'badge-risk-red' : (risk === 'YELLOW' ? 'badge-risk-yellow' : 'badge-risk-green');
    const isOffline = p.patient_id && p.patient_id.includes("OFFLINE");

    // Doctor Referral status badge
    let referralBadge = `<span class="badge" style="background: var(--slate-100); color: var(--slate-500); border: 1px solid var(--slate-200); font-size: 0.75rem; font-weight: 500;">— None</span>`;
    if (p.has_referral || p.referral_id) {
      const isEmerg = p.referral_priority === 'Emergency';
      const facilityShort = (p.referral_to_facility || 'Hospital').split('-')[0].trim();
      referralBadge = `
        <span class="badge ${isEmerg ? 'badge-risk-red' : 'badge-risk-yellow'}" title="${p.referral_to_facility || 'Referred'}">
          🚑 ${facilityShort}
        </span>
        <br><small class="text-muted" style="font-size:0.72rem;">${p.referral_created_by ? 'By: ' + p.referral_created_by.split('(')[0].trim() : 'By Doctor'}</small>
      `;
    }

    return `
      <tr>
        <td>
          <strong class="code-font">${p.patient_id}</strong>
          ${isOffline ? `<br><span class="badge badge-warning" style="font-size:0.65rem; padding: 1px 4px;">⏳ Unsynced</span>` : ''}
        </td>
        <td><strong>${p.name}</strong><br><small class="text-muted">${p.age}y &bull; ${p.gender}</small></td>
        <td>${p.village}<br><small class="text-muted">${p.phone}</small></td>
        <td>
          <span class="badge ${riskClass}">${risk}</span>
        </td>
        <td>
          <small>SpO2: <strong>${p.latest_spo2 ? p.latest_spo2 + '%' : '--'}</strong></small><br>
          <small>BP: <strong>${p.latest_bp || '--'}</strong></small>
        </td>
        <td><span class="badge badge-primary">${p.queue_status || 'Waiting'}</span></td>
        <td>${referralBadge}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="viewPatientLongitudinalRecord('${p.patient_id}')">
            📖 View EHR
          </button>
        </td>
      </tr>
    `;
  }).join("");
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
 * Fetch and Render Patient Longitudinal Care Journey Timeline (Online & Offline)
 */
async function viewPatientLongitudinalRecord(patientId) {
  currentSelectedPatientId = patientId;
  const modal = document.getElementById("ehr-timeline-modal");
  const contentArea = document.getElementById("ehr-timeline-content");

  if (!modal || !contentArea) return;

  modal.style.display = "flex";
  contentArea.innerHTML = `<div style="text-align:center; padding: 3rem;">Loading longitudinal record for ${patientId}...</div>`;

  let p = null;
  let timeline = [];
  let consultations = [];

  // If online, fetch from backend
  if (typeof isAppOnline === "function" && isAppOnline()) {
    try {
      const res = await fetch(`${API_BASE_URL}/patients/${patientId}`);
      if (res.ok) {
        const data = await res.json();
        p = data.patient;
        timeline = data.timeline || [];
        consultations = data.consultations || [];
      }
    } catch (e) {
      console.warn("Fetch EHR online failed, falling back to IndexedDB:", e);
    }
  }

  // If offline or online fetch failed, load from local IndexedDB
  if (!p && typeof getLocalPatient === "function") {
    p = await getLocalPatient(patientId);
    if (p) {
      // Build offline timeline
      timeline = [
        {
          title: "Doorstep Health Intake & Vitals Captured",
          timestamp: p.created_at || "Recent",
          subtitle: `Captured by ${p.registered_by || 'Frontline Health Worker'}. SpO2: ${p.latest_spo2 || '--'}% | BP: ${p.latest_bp || '--'}`,
          badge_type: "primary"
        },
        {
          title: `Smart Rule Triage: Risk Category ${p.latest_risk_level || 'GREEN'}`,
          timestamp: p.created_at || "Recent",
          subtitle: (p.triage ? p.triage.action_recommended : "Routine monitoring advised"),
          badge_type: (p.latest_risk_level === 'RED' ? 'danger' : (p.latest_risk_level === 'YELLOW' ? 'warning' : 'success'))
        }
      ];
    }
  }

  if (!p) {
    contentArea.innerHTML = `<div class="alert alert-danger">Could not find record for patient ID: ${patientId}</div>`;
    return;
  }

  const timelineHTML = timeline.map((event) => {
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

  const latestConsultation = consultations.length > 0 ? consultations[consultations.length - 1] : null;
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
}

function closeEhrModal() {
  const modal = document.getElementById("ehr-timeline-modal");
  if (modal) modal.style.display = "none";
}

/**
 * Display sample FHIR R4 / ABDM JSON structure
 */
async function showFhirPreviewModal(patientId) {
  let jsonStr = "";
  if (typeof isAppOnline === "function" && isAppOnline()) {
    try {
      const res = await fetch(`${API_BASE_URL}/patients/${patientId}`);
      if (res.ok) {
        const data = await res.json();
        jsonStr = JSON.stringify(data.fhir_bundle_preview || {}, null, 2);
      }
    } catch (e) {
      console.warn("FHIR online fetch failed:", e);
    }
  }

  if (!jsonStr && typeof getLocalPatient === "function") {
    const p = await getLocalPatient(patientId);
    if (p) {
      jsonStr = JSON.stringify({
        resourceType: "Bundle",
        id: `abdm-bundle-${p.patient_id}`,
        type: "document",
        timestamp: new Date().toISOString(),
        entry: [
          {
            resource: {
              resourceType: "Patient",
              id: p.patient_id,
              name: [{ text: p.name }],
              gender: p.gender.toLowerCase(),
              address: [{ city: p.village, country: "India" }]
            }
          },
          {
            resource: {
              resourceType: "Observation",
              code: { text: "Pulse Oximetry / SpO2" },
              valueQuantity: { value: p.latest_spo2 || 98, unit: "%" }
            }
          }
        ]
      }, null, 2);
    }
  }

  const fhirModal = document.getElementById("fhir-preview-modal");
  const jsonEl = document.getElementById("fhir-json-code");
  if (fhirModal && jsonEl) {
    jsonEl.textContent = jsonStr || "{}";
    fhirModal.style.display = "flex";
  }
}

function closeFhirModal() {
  const modal = document.getElementById("fhir-preview-modal");
  if (modal) modal.style.display = "none";
}
