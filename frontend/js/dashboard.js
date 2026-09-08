/**
 * SevaHealth - Main Dashboard Controller
 * Aggregates live KPI cards, role-based workflows, and quick actions.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const user = requireAuth();
  if (!user) return;

  renderUserInfo(user);
  setupHeaderEvents();
  await loadDashboardMetrics();
});

function setupHeaderEvents() {
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => logout());
  }

  const syncBtn = document.getElementById("btn-sync-now");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => syncPendingRecords());
  }

  const offlineToggleBtn = document.getElementById("btn-toggle-offline-demo");
  if (offlineToggleBtn) {
    offlineToggleBtn.addEventListener("click", () => toggleSimulatedOffline());
  }
}

function renderUserInfo(user) {
  const userNameEl = document.getElementById("user-name-display");
  const userRoleEl = document.getElementById("user-role-badge");
  const bannerNameEl = document.getElementById("banner-user-name");
  const bannerRoleEl = document.getElementById("banner-user-role");
  const bannerFacilityEl = document.getElementById("banner-facility");

  if (userNameEl) userNameEl.textContent = user.name || user.username;
  if (bannerNameEl) bannerNameEl.textContent = user.name || user.username;
  if (bannerFacilityEl) bannerFacilityEl.textContent = user.facility || "Chirala PHC";

  if (userRoleEl) {
    userRoleEl.textContent = user.role;
    userRoleEl.className = "badge";
    if (user.role.includes("Health Worker")) {
      userRoleEl.classList.add("badge-healthworker");
    } else if (user.role.includes("Doctor")) {
      userRoleEl.classList.add("badge-doctor");
    } else {
      userRoleEl.classList.add("badge-admin");
    }
  }

  if (bannerRoleEl) {
    bannerRoleEl.textContent = `Role: ${user.role}`;
  }

  // Show/Hide Role-Specific Dashboard Sections & Cards
  const ashaSection = document.getElementById("asha-quick-actions");
  const doctorSection = document.getElementById("doctor-quick-actions");
  const adminQuickSection = document.getElementById("admin-quick-actions");
  const adminSection = document.getElementById("admin-inventory-section");

  const isAsha = user.role.includes("Health Worker") || user.role.includes("ASHA");
  const isDoctor = user.role.includes("Doctor");
  const isAdmin = user.role.includes("Administrator") || user.role.includes("Admin");

  if (ashaSection) ashaSection.style.display = isAsha ? "block" : "none";
  if (doctorSection) doctorSection.style.display = isDoctor ? "block" : "none";
  if (adminQuickSection) adminQuickSection.style.display = isAdmin ? "block" : "none";
  if (adminSection) adminSection.style.display = isAdmin ? "block" : "none";

  // Filter KPI Cards strictly by role
  document.querySelectorAll(".stat-card").forEach((card) => {
    if (isAsha) {
      card.style.display = card.classList.contains("card-asha") ? "block" : "none";
    } else if (isDoctor) {
      card.style.display = card.classList.contains("card-doctor") ? "block" : "none";
    } else if (isAdmin) {
      card.style.display = card.classList.contains("card-admin") ? "block" : "none";
    } else {
      card.style.display = "block";
    }
  });
}

/**
 * Fetch dashboard data from backend API
 */
async function loadDashboardMetrics() {
  try {
    const data = await getDashboardData();

    // Update KPI Card Numbers
    updateStat("stat-total-patients", data.total_patients ?? 0);
    updateStat("stat-today-visits", data.today_visits ?? 0);
    updateStat("stat-waiting-patients", data.waiting_patients ?? 0);
    updateStat("stat-high-risk", data.high_risk_patients ?? 0);
    updateStat("stat-pending-referrals", data.pending_referrals ?? 0);
    updateStat("stat-followups-due", data.followups_due ?? 0);

    // Update Recent Patients Table
    renderRecentPatients(data.recent_patients || []);

    // Update Inventory Widget if present
    renderInventoryWidget(data.medicine_inventory || []);

    // Update pending sync count from IndexedDB
    if (typeof updateSyncStatusUI === "function") {
      updateSyncStatusUI();
    }
  } catch (err) {
    console.error("Dashboard metrics failed:", err);
  }
}

function updateStat(elementId, val) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = val;
}

function renderRecentPatients(patients) {
  const container = document.getElementById("recent-patients-body");
  if (!container) return;

  if (patients.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 1.5rem; color: var(--slate-500);">No patients registered yet.</td></tr>`;
    return;
  }

  container.innerHTML = patients.map((p) => {
    const riskClass = p.latest_risk_level === 'RED' ? 'badge-risk-red' : (p.latest_risk_level === 'YELLOW' ? 'badge-risk-yellow' : 'badge-risk-green');
    return `
      <tr>
        <td><strong class="code-font">${p.patient_id}</strong></td>
        <td><strong>${p.name}</strong><br><small class="text-muted">${p.age}y &bull; ${p.gender}</small></td>
        <td>${p.village}</td>
        <td><span class="badge ${riskClass}">${p.latest_risk_level}</span></td>
        <td><small>SpO2: <strong>${p.latest_spo2 ? p.latest_spo2 + '%' : '--'}</strong></small></td>
        <td>
          <a href="patient.html?id=${p.patient_id}" class="btn btn-outline btn-sm">
            EHR &rarr;
          </a>
        </td>
      </tr>
    `;
  }).join("");
}

function renderInventoryWidget(meds) {
  const container = document.getElementById("admin-meds-body");
  if (!container) return;

  container.innerHTML = meds.map((m) => {
    const isLow = m.status === 'Low Stock' || m.status === 'Unavailable';
    return `
      <tr>
        <td><strong>${m.name}</strong><br><small class="text-muted">${m.category}</small></td>
        <td>${m.stock_count}</td>
        <td>
          <span class="badge ${m.status === 'Available' ? 'badge-primary' : (m.status === 'Low Stock' ? 'badge-warning' : 'badge-danger')}">
            ${m.status}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}
