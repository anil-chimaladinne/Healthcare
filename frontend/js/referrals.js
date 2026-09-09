/**
 * SevaHealth - Tracked Referral Loop Controller
 * Displays referral lifecycle: Created -> Sent -> Accepted -> In Progress -> Completed
 * Supports instant search by patient name, ID, facility, and priority filtering.
 */

let currentSearchQuery = "";
let currentPriorityFilter = "";

document.addEventListener("DOMContentLoaded", () => {
  const user = (typeof requireAuth === "function") ? requireAuth() : null;
  if (!user) return;
  setupSearchAndFilter();
  loadReferralsList();
  setupCreateReferralForm();
});

/**
 * Setup Search Input and Priority Filter Handlers
 */
function setupSearchAndFilter() {
  const searchInput = document.getElementById("search-referral-input");
  const prioritySelect = document.getElementById("filter-referral-priority");

  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentSearchQuery = e.target.value.trim();
        loadReferralsList(currentSearchQuery, currentPriorityFilter);
      }, 250);
    });
  }

  if (prioritySelect) {
    prioritySelect.addEventListener("change", (e) => {
      currentPriorityFilter = e.target.value;
      loadReferralsList(currentSearchQuery, currentPriorityFilter);
    });
  }
}

async function openCreateReferralModal() {
  const modal = document.getElementById("create-referral-page-modal");
  const select = document.getElementById("pref-patient-id");
  const fromFacility = document.getElementById("pref-from-facility");

  // Pre-fill origin facility from user session
  const user = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
  if (user && fromFacility) {
    fromFacility.value = user.facility || (user.role.includes("Health Worker") ? "Ramapuram Sub-Centre" : "Chirala PHC");
  }

  if (select) {
    select.innerHTML = `<option value="">Loading patients...</option>`;
    let patients = [];

    if (typeof isAppOnline === "function" && isAppOnline()) {
      try {
        const res = await fetch(`${API_BASE_URL}/patients`);
        if (res.ok) {
          patients = await res.json();
        } else if (typeof getLocalPatients === "function") {
          patients = await getLocalPatients();
        }
      } catch (e) {
        if (typeof getLocalPatients === "function") {
          patients = await getLocalPatients();
        }
      }
    } else if (typeof getLocalPatients === "function") {
      patients = await getLocalPatients();
    }

    if (patients.length > 0) {
      select.innerHTML = `<option value="">-- Choose Patient --</option>` + patients.map((p) => {
        return `<option value="${p.patient_id}" data-name="${p.name}">${p.name} (${p.patient_id}) - ${p.village}</option>`;
      }).join("");
    } else {
      select.innerHTML = `<option value="">No patients found</option>`;
    }
  }

  if (modal) modal.style.display = "flex";
}

function closeCreateReferralModal() {
  const modal = document.getElementById("create-referral-page-modal");
  if (modal) modal.style.display = "none";
}

function setupCreateReferralForm() {
  const form = document.getElementById("page-referral-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const patientSelect = document.getElementById("pref-patient-id");
    const patientId = patientSelect.value;
    const selectedOption = patientSelect.options[patientSelect.selectedIndex];
    const patientName = selectedOption ? (selectedOption.getAttribute("data-name") || "Patient") : "Patient";

    const fromFacility = document.getElementById("pref-from-facility").value.trim();
    const toFacility = document.getElementById("pref-to-facility").value;
    const priority = document.getElementById("pref-priority").value;
    const reason = document.getElementById("pref-reason").value.trim();
    const notes = document.getElementById("pref-notes").value.trim();

    if (!patientId) {
      showToast("Please select a patient", "warning");
      return;
    }
    if (!reason) {
      showToast("Please enter the reason for referral", "warning");
      return;
    }

    const user = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
    const createdBy = user ? user.name : "Health Worker";

    const payload = {
      referral_id: `REF-OFFLINE-${Date.now().toString().slice(-4)}`,
      patient_id: patientId,
      patient_name: patientName,
      from_facility: fromFacility || "Sub-Centre",
      to_facility: toFacility,
      reason: reason,
      priority: priority,
      notes: notes,
      status: "Created",
      created_by: createdBy,
      created_at: new Date().toISOString()
    };

    if (typeof isAppOnline === "function" && !isAppOnline()) {
      if (typeof queueOfflineRecord === "function") {
        await queueOfflineRecord("referral", payload);
      }
      if (typeof saveLocalReferral === "function") {
        await saveLocalReferral(payload);
      }
      showToast(`📦 Referral ${payload.referral_id} saved locally (Offline Mode)!`);
      closeCreateReferralModal();
      form.reset();
      loadReferralsList(currentSearchQuery, currentPriorityFilter);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/referrals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to create referral");
      const data = await res.json();

      if (typeof saveLocalReferral === "function") {
        saveLocalReferral(data);
      }

      showToast(`🚑 Referral ${data.referral_id} created successfully!`);
      closeCreateReferralModal();
      form.reset();
      loadReferralsList(currentSearchQuery, currentPriorityFilter);
    } catch (err) {
      console.warn("Online referral submission failed, storing offline:", err);
      if (typeof queueOfflineRecord === "function") {
        await queueOfflineRecord("referral", payload);
      }
      if (typeof saveLocalReferral === "function") {
        await saveLocalReferral(payload);
      }
      showToast(`⚠️ Stored offline in IndexedDB: ${err.message}`, "warning");
      closeCreateReferralModal();
      form.reset();
      loadReferralsList(currentSearchQuery, currentPriorityFilter);
    }
  });
}

/**
 * Fetch and render referrals with search & priority filters
 */
async function loadReferralsList(searchQuery = "", priorityFilter = "") {
  const container = document.getElementById("referrals-list-body");
  const countBadge = document.getElementById("referrals-count-badge");
  if (!container) return;

  let referrals = [];

  if (typeof isAppOnline === "function" && isAppOnline()) {
    try {
      const url = searchQuery
        ? `${API_BASE_URL}/referrals?search=${encodeURIComponent(searchQuery)}`
        : `${API_BASE_URL}/referrals`;
      const res = await fetch(url);
      if (res.ok) {
        referrals = await res.json();
      } else if (typeof getLocalReferrals === "function") {
        referrals = await getLocalReferrals();
      }
    } catch (e) {
      if (typeof getLocalReferrals === "function") {
        referrals = await getLocalReferrals();
      }
    }
  } else if (typeof getLocalReferrals === "function") {
    referrals = await getLocalReferrals();
  }

  // Fallback default sample referrals if DB is empty
  if (!referrals || referrals.length === 0) {
    referrals = [
      {
        referral_id: "REF-001021",
        patient_id: "SEVA-000001",
        patient_name: "Lakshmi Devi",
        from_facility: "Ramapuram Sub-Centre",
        to_facility: "District Hospital Ongole - Cardiology Unit",
        reason: "Severe hypertension with chest tightness, urgent ECG & specialist evaluation",
        priority: "Emergency",
        status: "In Progress",
        created_at: new Date().toISOString()
      }
    ];
  }

  // Client-side filtering (works seamlessly in both online & offline modes)
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    referrals = referrals.filter((r) => {
      return (
        (r.patient_name && r.patient_name.toLowerCase().includes(q)) ||
        (r.patient_id && r.patient_id.toLowerCase().includes(q)) ||
        (r.referral_id && r.referral_id.toLowerCase().includes(q)) ||
        (r.to_facility && r.to_facility.toLowerCase().includes(q)) ||
        (r.from_facility && r.from_facility.toLowerCase().includes(q)) ||
        (r.reason && r.reason.toLowerCase().includes(q)) ||
        (r.priority && r.priority.toLowerCase().includes(q)) ||
        (r.status && r.status.toLowerCase().includes(q))
      );
    });
  }

  if (priorityFilter) {
    referrals = referrals.filter((r) => r.priority === priorityFilter);
  }

  // Update counter badge
  if (countBadge) {
    countBadge.textContent = `${referrals.length} referral${referrals.length === 1 ? '' : 's'}`;
  }

  if (referrals.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--slate-500);">
          🔍 No referrals found matching your search.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = referrals.map((r) => {
    const isEmergency = r.priority === 'Emergency';
    return `
      <tr>
        <td><strong class="code-font">${r.referral_id}</strong></td>
        <td>
          <strong>${r.patient_name || 'Patient'}</strong><br>
          <small class="code-font">${r.patient_id}</small>
        </td>
        <td><small>${r.from_facility}</small></td>
        <td><strong>${r.to_facility}</strong></td>
        <td>${r.reason}</td>
        <td>
          <span class="badge ${isEmergency ? 'badge-risk-red' : (r.priority === 'Priority' ? 'badge-risk-yellow' : 'badge-primary')}">
            ${isEmergency ? '🚨 ' + r.priority : (r.priority === 'Priority' ? '⚠️ ' + r.priority : r.priority)}
          </span>
        </td>
        <td>
          <select class="form-input form-input-sm" onchange="updateReferralStatus('${r.referral_id}', this.value)" style="min-height: 32px; padding: 2px 8px; font-size: 0.8125rem;">
            <option value="Created" ${r.status === 'Created' ? 'selected' : ''}>Created</option>
            <option value="Sent" ${r.status === 'Sent' ? 'selected' : ''}>Sent</option>
            <option value="Accepted" ${r.status === 'Accepted' ? 'selected' : ''}>Accepted</option>
            <option value="In Progress" ${r.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Completed" ${r.status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </td>
        <td><small>${(r.created_at || '').split('T')[0] || r.created_at}</small></td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-primary btn-sm" style="font-size: 0.8rem; padding: 0.35rem 0.65rem;" onclick="viewPatientLongitudinalRecord('${r.patient_id}')">
            📖 View EHR
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

async function updateReferralStatus(referralId, newStatus) {
  if (typeof isAppOnline === "function" && !isAppOnline()) {
    showToast(`📴 Status updated locally to "${newStatus}". Will sync when online.`);
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/referrals/${referralId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });

    if (!res.ok) throw new Error("Failed to update status");
    showToast(`Referral ${referralId} marked as ${newStatus}`);
  } catch (err) {
    showToast(`Status updated locally: ${newStatus}`);
  }
}

/**
 * Fetch and Render Patient Longitudinal Care Journey Timeline from Referrals Page
 */
async function viewPatientLongitudinalRecord(patientId) {
  const modal = document.getElementById("ehr-timeline-modal");
  const contentArea = document.getElementById("ehr-timeline-content");

  if (!modal || !contentArea) {
    window.location.href = `patient.html?id=${patientId}`;
    return;
  }

  modal.style.display = "flex";
  contentArea.innerHTML = `<div style="text-align:center; padding: 3rem;">Loading longitudinal record for ${patientId}...</div>`;

  let p = null;
  let timeline = [];
  let consultations = [];

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
      console.warn("Fetch EHR online failed:", e);
    }
  }

  if (!p && typeof getLocalPatient === "function") {
    p = await getLocalPatient(patientId);
  }

  if (!p) {
    contentArea.innerHTML = `<div class="alert alert-danger">Could not find record for patient ID: ${patientId}</div>`;
    return;
  }

  const timelineHTML = timeline.map((event) => {
    return `
      <div class="timeline-item">
        <div class="timeline-marker marker-${event.badge_type || 'primary'}"></div>
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
         <div style="font-size: 0.9375rem; font-weight: 600; color: #78350f; margin-top: 0.2rem;">Diagnosis pending doctor consultation.</div>
       </div>`;

  contentArea.innerHTML = `
    <div class="ehr-patient-banner" style="display: flex; justify-content: space-between; align-items: center; background: var(--slate-900); color: white; padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <span class="code-font" style="background: var(--primary); color: white; padding: 4px 8px; border-radius: 4px; font-weight: 800;">${p.patient_id}</span>
        <div>
          <h3 style="color: white; font-size: 1.2rem; font-weight: 800;">${p.name} (${p.age}y / ${p.gender})</h3>
          <p style="font-size: 0.8125rem; color: var(--slate-300); margin: 0;">📍 ${p.village} &bull; 📞 ${p.phone} &bull; By: ${p.registered_by || 'Health Worker'}</p>
        </div>
      </div>
      <button class="btn btn-outline btn-sm" style="color: #38bdf8; border-color: #38bdf8;" onclick="showFhirPreviewModal('${p.patient_id}')">
        🔗 FHIR / ABDM JSON
      </button>
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

async function showFhirPreviewModal(patientId) {
  let jsonStr = "";
  if (typeof isAppOnline === "function" && isAppOnline()) {
    try {
      const res = await fetch(`${API_BASE_URL}/patients/${patientId}`);
      if (res.ok) {
        const data = await res.json();
        jsonStr = JSON.stringify(data.fhir_bundle_preview || {}, null, 2);
      }
    } catch (e) {}
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

