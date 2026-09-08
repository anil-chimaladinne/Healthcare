/**
 * SevaHealth - Doctor Workspace & Tele-Consultation Controller
 * Manages priority-sorted patient queues (RED -> YELLOW -> GREEN), tele-consultations, and Rx.
 */

let activeConsultPatient = null;

document.addEventListener("DOMContentLoaded", () => {
  loadDoctorQueue();
  loadCompletedConsultations();
  setupConsultationForm();
  setupReferralModalForm();
});

function switchDoctorTab(tabName) {
  const queueView = document.getElementById("doctor-queue-view");
  const completedView = document.getElementById("doctor-completed-view");
  const queueBtn = document.getElementById("tab-waiting-queue");
  const completedBtn = document.getElementById("tab-completed-consults");

  if (tabName === "waiting") {
    if (queueView) queueView.style.display = "block";
    if (completedView) completedView.style.display = "none";
    if (queueBtn) { queueBtn.className = "btn btn-primary btn-sm"; }
    if (completedBtn) { completedBtn.className = "btn btn-outline btn-sm"; }
    loadDoctorQueue();
  } else {
    if (queueView) queueView.style.display = "none";
    if (completedView) completedView.style.display = "block";
    if (queueBtn) { queueBtn.className = "btn btn-outline btn-sm"; }
    if (completedBtn) { completedBtn.className = "btn btn-primary btn-sm"; }
    loadCompletedConsultations();
  }
}

async function loadCompletedConsultations() {
  const container = document.getElementById("completed-consultations-body");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE_URL}/consultations`);
    if (!res.ok) throw new Error("Failed to load completed consultations");
    const consults = await res.json();

    if (consults.length === 0) {
      container.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--slate-500);">No completed consultations yet.</td></tr>`;
      return;
    }

    container.innerHTML = consults.map((c) => {
      return `
        <tr>
          <td>
            <strong>${c.patient_name || 'Patient'}</strong> (${c.age || '--'}y / ${c.gender || '--'})<br>
            <small class="code-font">${c.patient_id}</small> &bull; <small class="text-muted">📍 ${c.village || '--'}</small>
          </td>
          <td><strong style="color: #0f172a;">${c.diagnosis_summary || 'Clinical Review'}</strong></td>
          <td><small>${c.clinical_notes}</small></td>
          <td><span style="color: #0d9488; font-weight: 600;"><small>${c.prescription || 'Standard supportive care'}</small></span></td>
          <td><strong>${c.followup_date ? '📅 ' + c.followup_date : 'None'}</strong></td>
          <td><small class="text-muted">${(c.consulted_at || '').split('T')[0] || c.consulted_at}</small></td>
          <td>
            <a href="patient.html?id=${c.patient_id}" class="btn btn-outline btn-sm">
              📖 Full EHR
            </a>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading completed consultations:", err);
    container.innerHTML = `<tr><td colspan="7" class="text-danger" style="text-align:center;">Error loading records</td></tr>`;
  }
}

/**
 * Fetch and render the Doctor Queue sorted by triage acuity
 */
async function loadDoctorQueue() {
  const container = document.getElementById("doctor-queue-container");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE_URL}/dashboard`);
    if (!res.ok) throw new Error("Failed to load queue");
    const data = await res.json();
    const queue = data.doctor_queue || [];

    if (queue.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; background: var(--white); border-radius: var(--radius-lg); border: 1px dashed var(--slate-300);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
          <h3>Doctor Queue is Clear</h3>
          <p style="color: var(--slate-500);">No patients are currently waiting for consultation.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = queue.map((item) => {
      const riskClass = item.risk_level === 'RED' ? 'badge-risk-red' : (item.risk_level === 'YELLOW' ? 'badge-risk-yellow' : 'badge-risk-green');
      const isRed = item.risk_level === 'RED';

      return `
        <div class="doctor-queue-card ${isRed ? 'queue-card-red' : (item.risk_level === 'YELLOW' ? 'queue-card-yellow' : '')}">
          <div class="queue-card-top">
            <div class="queue-patient-meta">
              <span class="badge ${riskClass}">
                ${isRed ? '🚨 EMERGENCY' : (item.risk_level === 'YELLOW' ? '⚠️ PRIORITY' : '✅ ROUTINE')}
              </span>
              <strong class="code-font">${item.patient_id}</strong>
              <span class="queue-patient-name">${item.patient_name} (${item.age}y / ${item.gender})</span>
              <span class="queue-village">📍 ${item.village}</span>
            </div>
            <div class="queue-actions">
              <button class="btn btn-primary btn-sm" onclick='openTeleConsultModal(${JSON.stringify(item)})'>
                🩺 Start Tele-Consult
              </button>
            </div>
          </div>

          <div class="queue-vitals-row">
            <div class="v-pill">SpO2: <strong>${item.spo2 ? item.spo2 + '%' : '--'}</strong></div>
            <div class="v-pill">BP: <strong>${item.bp_systolic ? item.bp_systolic + '/' + item.bp_diastolic : '--'}</strong></div>
            <div class="v-pill">Temp: <strong>${item.temperature ? item.temperature + '°F' : '--'}</strong></div>
            <div class="v-pill">HR: <strong>${item.heart_rate ? item.heart_rate + ' bpm' : '--'}</strong></div>
            <div class="v-pill">Sugar: <strong>${item.blood_sugar ? item.blood_sugar + ' mg/dL' : '--'}</strong></div>
          </div>

          <div class="queue-symptoms-snippet">
            <strong>Symptoms:</strong> ${item.symptoms_text || 'None specified'}
            ${item.emergency_flags ? `<br><span style="color: var(--status-danger); font-weight: 600;">⚠️ Flags: ${item.emergency_flags}</span>` : ''}
          </div>

          <div class="queue-card-footer">
            <small>⚡ Triggered: <em>${item.rule_triggered || 'Normal criteria'}</em> &bull; Action: ${item.action_recommended}</small>
          </div>
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error("Queue load error:", e);
    container.innerHTML = `<div class="alert alert-danger">Unable to load doctor queue: ${e.message}</div>`;
  }
}

/**
 * Open Tele-Consultation Modal Prototype
 */
function openTeleConsultModal(patientData) {
  activeConsultPatient = patientData;
  const modal = document.getElementById("teleconsult-modal");
  if (!modal) return;

  document.getElementById("tc-patient-id").textContent = patientData.patient_id;
  document.getElementById("tc-patient-name").textContent = `${patientData.patient_name} (${patientData.age}y / ${patientData.gender})`;
  document.getElementById("tc-patient-village").textContent = patientData.village;
  document.getElementById("tc-patient-phone").textContent = patientData.phone;
  document.getElementById("tc-symptoms").textContent = patientData.symptoms_text || "None";
  
  document.getElementById("tc-vitals-summary").textContent = `SpO2: ${patientData.spo2 || '--'}% | BP: ${patientData.bp_systolic || '--'}/${patientData.bp_diastolic || '--'} | Temp: ${patientData.temperature || '--'}°F | HR: ${patientData.heart_rate || '--'} bpm`;

  const riskBadge = document.getElementById("tc-risk-badge");
  if (riskBadge) {
    riskBadge.textContent = `Triage Risk: ${patientData.risk_level}`;
    riskBadge.className = `badge ${patientData.risk_level === 'RED' ? 'badge-risk-red' : (patientData.risk_level === 'YELLOW' ? 'badge-risk-yellow' : 'badge-risk-green')}`;
  }

  // Pre-fill doctor name from session
  const user = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
  const docNameInput = document.getElementById("tc-doc-name");
  if (docNameInput) {
    docNameInput.value = (user && user.role.includes("Doctor")) ? user.name : "Dr. Suresh Kumar (Medical Officer)";
  }

  // Set default follow-up date to +3 days
  const followupInput = document.getElementById("tc-followup-date");
  if (followupInput) {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    followupInput.value = d.toISOString().split("T")[0];
  }

  modal.style.display = "flex";
}

function closeTeleConsultModal() {
  const modal = document.getElementById("teleconsult-modal");
  if (modal) modal.style.display = "none";
}

/**
 * Handle Tele-Consultation Form Submission
 */
function setupConsultationForm() {
  const form = document.getElementById("teleconsult-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeConsultPatient) {
      showToast("No active patient selected for consultation", "warning");
      return;
    }

    const docNameInput = document.getElementById("tc-doc-name");
    const diagnosisInput = document.getElementById("tc-diagnosis");
    const notesInput = document.getElementById("tc-clinical-notes");
    const prescriptionInput = document.getElementById("tc-prescription");
    const followupDateInput = document.getElementById("tc-followup-date");

    const docName = docNameInput ? docNameInput.value.trim() : "Dr. Suresh Kumar";
    const diagnosis = diagnosisInput ? diagnosisInput.value.trim() : "";
    const notes = notesInput ? notesInput.value.trim() : "";
    const prescription = prescriptionInput ? prescriptionInput.value.trim() : "";
    const followupDate = followupDateInput ? followupDateInput.value : "";

    if (!diagnosis) {
      showToast("Please enter a Provisional Diagnosis before completing consultation", "warning");
      if (diagnosisInput) diagnosisInput.focus();
      return;
    }

    if (!notes) {
      showToast("Please enter Doctor Clinical Consultation Notes", "warning");
      if (notesInput) notesInput.focus();
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";
    }

    const payload = {
      patient_id: activeConsultPatient.patient_id,
      doctor_name: docName || "Dr. Suresh Kumar",
      symptoms_summary: activeConsultPatient.symptoms_text || "",
      clinical_notes: notes,
      prescription: prescription || "Standard supportive care advised.",
      diagnosis_summary: diagnosis,
      followup_date: followupDate || null
    };

    try {
      const res = await fetch(`${API_BASE_URL}/consultations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned HTTP ${res.status}`);
      }

      showToast(`✅ Consultation Completed for ${activeConsultPatient.patient_name}!`);
      closeTeleConsultModal();
      form.reset();
      switchDoctorTab("completed");
    } catch (err) {
      console.error("Consultation submit error:", err);
      showToast(`Error saving consultation: ${err.message}`, "danger");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Complete Consultation →";
      }
    }
  });
}

/**
 * Open Specialist Referral Modal
 */
function openReferralModalFromConsult() {
  if (!activeConsultPatient) return;
  const refModal = document.getElementById("create-referral-modal");
  if (!refModal) return;

  document.getElementById("ref-patient-id-disp").textContent = activeConsultPatient.patient_id;
  document.getElementById("ref-patient-name-disp").textContent = activeConsultPatient.patient_name;
  
  const prioSelect = document.getElementById("ref-priority");
  if (prioSelect) {
    prioSelect.value = activeConsultPatient.risk_level === 'RED' ? 'Emergency' : 'Priority';
  }

  refModal.style.display = "flex";
}

function closeReferralModal() {
  const refModal = document.getElementById("create-referral-modal");
  if (refModal) refModal.style.display = "none";
}

function setupReferralModalForm() {
  const form = document.getElementById("referral-create-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeConsultPatient) return;

    const fromFacility = document.getElementById("ref-from-facility").value;
    const toFacility = document.getElementById("ref-to-facility").value;
    const reason = document.getElementById("ref-reason").value.trim();
    const priority = document.getElementById("ref-priority").value;
    const notes = document.getElementById("ref-notes").value.trim();

    if (!reason) {
      showToast("Please provide the referral reason / clinical justification", "warning");
      return;
    }

    const payload = {
      patient_id: activeConsultPatient.patient_id,
      from_facility: fromFacility,
      to_facility: toFacility,
      reason: reason,
      priority: priority,
      notes: notes,
      created_by: "Dr. Suresh Kumar"
    };

    try {
      const res = await fetch(`${API_BASE_URL}/referrals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to create referral");

      const data = await res.json();
      showToast(`🚑 Referral ${data.referral_id} Created Successfully! Escalated to ${toFacility}.`);
      closeReferralModal();
      form.reset();
    } catch (err) {
      showToast(`Error creating referral: ${err.message}`, "danger");
    }
  });
}
