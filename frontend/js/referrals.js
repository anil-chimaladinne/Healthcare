/**
 * SevaHealth - Tracked Referral Loop Controller
 * Displays referral lifecycle: Created -> Sent -> Accepted -> In Progress -> Completed
 */

document.addEventListener("DOMContentLoaded", () => {
  loadReferralsList();
  setupCreateReferralForm();
});

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
    try {
      const res = await fetch(`${API_BASE_URL}/patients`);
      if (res.ok) {
        const patients = await res.json();
        select.innerHTML = `<option value="">-- Choose Patient --</option>` + patients.map((p) => {
          return `<option value="${p.patient_id}">${p.name} (${p.patient_id}) - ${p.village}</option>`;
        }).join("");
      }
    } catch (e) {
      select.innerHTML = `<option value="">Error loading patients</option>`;
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

    const patientId = document.getElementById("pref-patient-id").value;
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
      patient_id: patientId,
      from_facility: fromFacility || "Sub-Centre",
      to_facility: toFacility,
      reason: reason,
      priority: priority,
      notes: notes,
      created_by: createdBy
    };

    try {
      const res = await fetch(`${API_BASE_URL}/referrals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to create referral");
      const data = await res.json();

      showToast(`🚑 Referral ${data.referral_id} created successfully!`);
      closeCreateReferralModal();
      form.reset();
      loadReferralsList();
    } catch (err) {
      showToast(`Error creating referral: ${err.message}`, "danger");
    }
  });
}

async function loadReferralsList() {
  const container = document.getElementById("referrals-list-body");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE_URL}/referrals`);
    if (!res.ok) throw new Error("Failed to load referrals");
    const referrals = await res.json();

    if (referrals.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2rem; color: var(--slate-500);">
            No active referrals found. Referrals created during doctor consults will appear here.
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
            <strong>${r.patient_name}</strong><br>
            <small class="code-font">${r.patient_id}</small>
          </td>
          <td><small>${r.from_facility}</small></td>
          <td><strong>${r.to_facility}</strong></td>
          <td>${r.reason}</td>
          <td>
            <span class="badge ${isEmergency ? 'badge-risk-red' : 'badge-risk-yellow'}">
              ${r.priority}
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
          <td><small>${r.created_at.split(' ')[0]}</small></td>
        </tr>
      `;
    }).join("");

  } catch (e) {
    console.error("Referrals load error:", e);
    container.innerHTML = `<tr><td colspan="8" class="text-danger" style="text-align: center;">Error loading referrals</td></tr>`;
  }
}

async function updateReferralStatus(referralId, newStatus) {
  try {
    const res = await fetch(`${API_BASE_URL}/referrals/${referralId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });

    if (!res.ok) throw new Error("Failed to update status");
    showToast(`Referral ${referralId} marked as ${newStatus}`);
  } catch (err) {
    showToast(`Error updating status: ${err.message}`, "danger");
  }
}
