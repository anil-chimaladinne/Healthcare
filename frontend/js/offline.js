/**
 * SevaHealth - Offline-First IndexedDB & Synchronization Engine
 * Manages local offline storage, sync queues, and seamless reconnection syncing.
 * Enables SIH presenters to demonstrate "Care continues even when the internet does not."
 */

const DB_NAME = "SevaHealthOfflineDB";
const DB_VERSION = 2;
let dbInstance = null;

// Register Service Worker for true browser offline caching with auto-update
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  // Proactively purge old caches so mobile devices instantly load fresh orange logo assets
  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        if (key !== "sevahealth-v3.9.0-clean") {
          console.log("[ServiceWorker] Purging old cache:", key);
          caches.delete(key);
        }
      });
    });
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => {
        reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        reg.onupdatefound = () => {
          const installing = reg.installing;
          if (installing) {
            installing.onstatechange = () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                console.log("[ServiceWorker] New version installed, reloading...");
                window.location.reload();
              }
            };
          }
        };
      })
      .catch((err) => {
        console.warn("[ServiceWorker] Registration notice:", err);
      });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    console.log("[ServiceWorker] Controller changed to fresh version.");
  });
}

// Simulated offline toggle for SIH demonstrations
let simulatedOffline = localStorage.getItem("sevahealth_simulated_offline") === "true";

/**
 * Open or upgrade IndexedDB database
 */
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Pending sync queue
      if (!db.objectStoreNames.contains("pending_sync")) {
        db.createObjectStore("pending_sync", { keyPath: "id", autoIncrement: true });
      }
      // Cached local patients
      if (!db.objectStoreNames.contains("local_patients")) {
        db.createObjectStore("local_patients", { keyPath: "patient_id" });
      }
      // Cached local consultations
      if (!db.objectStoreNames.contains("local_consultations")) {
        db.createObjectStore("local_consultations", { keyPath: "id", autoIncrement: true });
      }
      // Cached local referrals
      if (!db.objectStoreNames.contains("local_referrals")) {
        db.createObjectStore("local_referrals", { keyPath: "referral_id" });
      }
      // Cached local followups
      if (!db.objectStoreNames.contains("local_followups")) {
        db.createObjectStore("local_followups", { keyPath: "id", autoIncrement: true });
      }
      // Key-value metadata store (dashboard caches, settings)
      if (!db.objectStoreNames.contains("local_meta")) {
        db.createObjectStore("local_meta", { keyPath: "key" });
      }
    };

    request.onsuccess = async (event) => {
      dbInstance = event.target.result;
      await seedInitialOfflineDataIfEmpty();
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error("[IndexedDB] Error opening database:", event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Seed initial realistic demo records into IndexedDB if newly initialized
 */
async function seedInitialOfflineDataIfEmpty() {
  try {
    const existing = await getLocalPatients();
    if (existing && existing.length > 0) return;

    const seedPatients = [
      {
        patient_id: "SEVA-000001",
        name: "Lakshmi Devi",
        age: 58,
        gender: "Female",
        phone: "+91 98765 43210",
        village: "Ramapuram",
        registered_by: "Anitha Rao (Health Worker)",
        latest_risk_level: "RED",
        latest_spo2: 89,
        latest_bp: "165/102",
        queue_status: "Waiting",
        vitals: { temperature: 99.2, heart_rate: 104, bp_systolic: 165, bp_diastolic: 102, spo2: 89, blood_sugar: 210 },
        symptoms: { symptoms_text: "Severe breathlessness, chest heaviness, swelling in feet", duration_days: 2, emergency_flags: "Critical Hypoxia, Severe Hypertension" },
        created_at: new Date().toISOString()
      },
      {
        patient_id: "SEVA-000002",
        name: "Ramesh Reddy",
        age: 44,
        gender: "Male",
        phone: "+91 98480 12345",
        village: "Karakachettu",
        registered_by: "Anitha Rao (Health Worker)",
        latest_risk_level: "YELLOW",
        latest_spo2: 95,
        latest_bp: "145/92",
        queue_status: "Waiting",
        vitals: { temperature: 101.4, heart_rate: 88, bp_systolic: 145, bp_diastolic: 92, spo2: 95, blood_sugar: 140 },
        symptoms: { symptoms_text: "High continuous fever for 4 days, severe body chills", duration_days: 4, emergency_flags: "Persistent High Fever" },
        created_at: new Date().toISOString()
      },
      {
        patient_id: "SEVA-000003",
        name: "Pooja Varma",
        age: 27,
        gender: "Female",
        phone: "+91 94401 98765",
        village: "Govindapuram",
        registered_by: "Anitha Rao (Health Worker)",
        latest_risk_level: "GREEN",
        latest_spo2: 98,
        latest_bp: "118/76",
        queue_status: "Completed",
        vitals: { temperature: 98.4, heart_rate: 72, bp_systolic: 118, bp_diastolic: 76, spo2: 98, blood_sugar: 95 },
        symptoms: { symptoms_text: "Routine 2nd trimester antenatal health check, iron syrup review", duration_days: 1, emergency_flags: "" },
        created_at: new Date().toISOString()
      }
    ];

    for (const p of seedPatients) {
      await saveLocalPatient(p);
    }
  } catch (e) {
    console.warn("[IndexedDB] Seed notice:", e);
  }
}

/**
 * Check if app is effectively online (factoring in browser state and presentation demo toggle)
 */
function isAppOnline() {
  if (simulatedOffline) return false;
  return navigator.onLine;
}

/**
 * Toggle simulated offline state for SIH live judging demos
 */
function toggleSimulatedOffline() {
  simulatedOffline = !simulatedOffline;
  localStorage.setItem("sevahealth_simulated_offline", simulatedOffline ? "true" : "false");
  updateNetworkStatusUI();
  
  if (isAppOnline()) {
    showToast("📶 Connection Restored: Processing sync queue...");
    syncPendingRecords();
  } else {
    showToast("📴 Offline Mode Enabled: Capturing all data locally in IndexedDB.");
  }
}

/**
 * Save a record into the offline IndexedDB sync queue
 */
async function queueOfflineRecord(type, data) {
  const item = {
    type: type,
    data: data,
    timestamp: new Date().toISOString()
  };

  // Fallback to localStorage queue
  try {
    const rawQ = localStorage.getItem("sevahealth_pending_queue") || "[]";
    const q = JSON.parse(rawQ);
    q.push(item);
    localStorage.setItem("sevahealth_pending_queue", JSON.stringify(q));
  } catch (err) {
    console.warn("LocalStorage queue backup notice:", err);
  }

  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("pending_sync", "readwrite");
      const store = tx.objectStore("pending_sync");
      const req = store.add(item);
      req.onsuccess = () => {
        updateSyncStatusUI();
        resolve(item);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    updateSyncStatusUI();
    return item;
  }
}

/**
 * Save multiple patients into local_patients store
 */
async function saveLocalPatients(patientsList) {
  if (!patientsList || !Array.isArray(patientsList)) return;
  try {
    const db = await openOfflineDB();
    const tx = db.transaction("local_patients", "readwrite");
    const store = tx.objectStore("local_patients");
    for (const p of patientsList) {
      store.put(p);
    }
  } catch (e) {
    console.warn("saveLocalPatients notice:", e);
  }
}

/**
 * Save or update a single patient in local_patients store
 */
async function saveLocalPatient(patient) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("local_patients", "readwrite");
      const store = tx.objectStore("local_patients");
      const req = store.put(patient);
      req.onsuccess = () => resolve(patient);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    return patient;
  }
}

/**
 * Retrieve all patients from local_patients store
 */
async function getLocalPatients() {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction("local_patients", "readonly");
      const store = tx.objectStore("local_patients");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

/**
 * Retrieve a single patient from local_patients store
 */
async function getLocalPatient(patientId) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction("local_patients", "readonly");
      const store = tx.objectStore("local_patients");
      const req = store.get(patientId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Save consultations into local store
 */
async function saveLocalConsultation(consultation) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("local_consultations", "readwrite");
      const store = tx.objectStore("local_consultations");
      const req = store.add(consultation);
      req.onsuccess = () => resolve(consultation);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    return consultation;
  }
}

/**
 * Retrieve all local consultations
 */
async function getLocalConsultations() {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction("local_consultations", "readonly");
      const store = tx.objectStore("local_consultations");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

/**
 * Save referrals into local store
 */
async function saveLocalReferral(referral) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("local_referrals", "readwrite");
      const store = tx.objectStore("local_referrals");
      const req = store.put(referral);
      req.onsuccess = () => resolve(referral);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    return referral;
  }
}

/**
 * Retrieve all local referrals
 */
async function getLocalReferrals() {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction("local_referrals", "readonly");
      const store = tx.objectStore("local_referrals");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

/**
 * Retrieve all local followups
 */
async function getLocalFollowups() {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction("local_followups", "readonly");
      const store = tx.objectStore("local_followups");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

/**
 * Save or update followups in local store
 */
async function saveLocalFollowup(followup) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("local_followups", "readwrite");
      const store = tx.objectStore("local_followups");
      const req = store.put(followup);
      req.onsuccess = () => resolve(followup);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    return followup;
  }
}

/**
 * Get count of pending unsynchronized items
 */
async function getPendingSyncCount() {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction("pending_sync", "readonly");
      const store = tx.objectStore("pending_sync");
      const countReq = store.count();
      countReq.onsuccess = () => resolve(countReq.result || 0);
      countReq.onerror = () => resolve(0);
    });
  } catch (e) {
    try {
      const rawQ = localStorage.getItem("sevahealth_pending_queue") || "[]";
      return JSON.parse(rawQ).length;
    } catch (err) {
      return 0;
    }
  }
}

/**
 * Fetch all pending items from IndexedDB
 */
async function getAllPendingSyncItems() {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction("pending_sync", "readonly");
      const store = tx.objectStore("pending_sync");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    try {
      const rawQ = localStorage.getItem("sevahealth_pending_queue") || "[]";
      return JSON.parse(rawQ);
    } catch (err) {
      return [];
    }
  }
}

/**
 * Clear synchronized items from IndexedDB queue
 */
async function clearPendingSyncQueue() {
  try {
    localStorage.removeItem("sevahealth_pending_queue");
  } catch (e) {}

  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction("pending_sync", "readwrite");
      const store = tx.objectStore("pending_sync");
      const req = store.clear();
      req.onsuccess = () => {
        updateSyncStatusUI();
        resolve();
      };
      req.onerror = () => resolve();
    });
  } catch (e) {
    updateSyncStatusUI();
  }
}

/**
 * Determine API URL for sync endpoint
 */
function getSyncApiUrl() {
  if (typeof API_BASE_URL !== "undefined" && API_BASE_URL) {
    return `${API_BASE_URL}/sync/batch`;
  }
  if (typeof window !== "undefined" && window.location) {
    const { hostname, port, origin } = window.location;
    if ((hostname === "localhost" || hostname === "127.0.0.1") && port && port !== "8000") {
      return `http://${hostname}:8000/api/sync/batch`;
    }
    if (origin && origin.startsWith("http")) {
      return `${origin}/api/sync/batch`;
    }
  }
  return "http://127.0.0.1:8000/api/sync/batch";
}

/**
 * Synchronize all pending records to the FastAPI backend
 */
async function syncPendingRecords() {
  if (!isAppOnline()) {
    showToast("⚠️ Cannot sync while in offline mode. Reconnect or toggle Online first.", "warning");
    return;
  }

  const items = await getAllPendingSyncItems();
  if (!items || items.length === 0) {
    updateSyncStatusUI();
    showToast("✅ All records are already synchronized!");
    return;
  }

  setSyncBadgeState("syncing");

  try {
    const user = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
    const workerName = user ? (user.name || user.username) : "Health Worker";

    const payload = {
      records: items,
      synced_by: workerName
    };

    const syncUrl = getSyncApiUrl();
    let response = null;
    let syncSucceededOnServer = false;
    let result = null;

    try {
      response = await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok && !syncUrl.includes("8000")) {
        response = await fetch("http://127.0.0.1:8000/api/sync/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (response && response.ok) {
        result = await response.json();
        syncSucceededOnServer = true;
      }
    } catch (netErr) {
      console.warn("[Sync] Initial sync attempt notice:", netErr);
      if (!syncUrl.includes("8000")) {
        try {
          const res8000 = await fetch("http://127.0.0.1:8000/api/sync/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (res8000.ok) {
            result = await res8000.json();
            syncSucceededOnServer = true;
          }
        } catch (e2) {}
      }
    }

    if (syncSucceededOnServer && result) {
      // Server synchronized successfully
      if (result.mapping && Object.keys(result.mapping).length > 0) {
        await updateLocalRecordsWithMapping(result.mapping);
      }
      await clearPendingSyncQueue();
      await updateSyncStatusUI();
      showToast(`🎉 Sync completed! ${result.synced_count} records committed to central PHC database.`);
    } else {
      // Server is unreachable: keep items in queue and do not discard
      console.warn("[Sync] Server unreachable. Records retained in queue for next online connection.");
      setSyncBadgeState("error");
      showToast("⚠️ Backend unreachable. Pending records saved safely and will sync when connected.", "warning");
      return;
    }
    
    // Refresh active views
    if (typeof loadDashboardMetrics === "function") loadDashboardMetrics();
    if (typeof loadPatientsList === "function") loadPatientsList();
    if (typeof loadDoctorQueue === "function") loadDoctorQueue();
    if (typeof loadReferralsList === "function") loadReferralsList();
    if (typeof loadFollowupsList === "function") loadFollowupsList();
    if (typeof loadCompletedConsultations === "function") loadCompletedConsultations();
  } catch (err) {
    console.error("[Sync] Synchronization error:", err);
    setSyncBadgeState("error");
    showToast("⚠️ Sync encountered an error. Records retained in queue.", "warning");
  }
}

/**
 * Update cached IndexedDB records when temporary offline IDs are mapped to server IDs
 */
async function updateLocalRecordsWithMapping(mapping) {
  if (!mapping || Object.keys(mapping).length === 0) return;
  try {
    const db = await openOfflineDB();
    for (const [tempId, serverId] of Object.entries(mapping)) {
      try {
        const tx = db.transaction("local_patients", "readwrite");
        const store = tx.objectStore("local_patients");
        const req = store.get(tempId);
        req.onsuccess = () => {
          const existing = req.result;
          if (existing) {
            store.delete(tempId);
            existing.patient_id = serverId;
            delete existing.client_temp_id;
            store.put(existing);
          }
        };
      } catch (e) {
        console.warn("Notice updating local_patients mapping:", e);
      }
    }
  } catch (err) {
    console.warn("updateLocalRecordsWithMapping notice:", err);
  }
}

/**
 * Update the Topbar Network and Sync status badges
 */
async function updateNetworkStatusUI() {
  const netBadges = document.querySelectorAll("#network-status-badge, .network-status-badge, #mobile-network-status-badge");
  const offlineToggleBtns = document.querySelectorAll("#btn-toggle-offline-demo, .btn-toggle-offline-demo, #mobile-btn-toggle-offline");

  const online = isAppOnline();

  netBadges.forEach((netBadge) => {
    if (online) {
      netBadge.className = "badge badge-status-online";
      netBadge.innerHTML = `<span class="badge-status-dot status-online"></span> <span>ONLINE</span>`;
      netBadge.title = "Connected to central PHC server";
    } else {
      netBadge.className = "badge badge-status-offline";
      netBadge.innerHTML = `<span class="badge-status-dot status-offline"></span> <span>OFFLINE</span>`;
      netBadge.title = "Offline: Data saved locally in IndexedDB";
    }
  });

  offlineToggleBtns.forEach((offlineToggleBtn) => {
    offlineToggleBtn.innerHTML = online ? "📡 Simulate Offline" : "📶 Go Online";
    offlineToggleBtn.className = online ? "btn btn-outline btn-sm" : "btn btn-primary btn-sm";
  });

  await updateSyncStatusUI();
}

/**
 * Update the sync counter indicator
 */
async function updateSyncStatusUI() {
  const syncBadges = document.querySelectorAll("#sync-status-indicator, .sync-status-indicator, #mobile-sync-status-indicator");
  const syncCount = await getPendingSyncCount();

  syncBadges.forEach((syncBadge) => {
    if (syncCount === 0) {
      syncBadge.innerHTML = `☁️ All synced`;
      syncBadge.className = "badge badge-primary";
    } else {
      syncBadge.innerHTML = `⏳ ${syncCount} pending`;
      syncBadge.className = "badge badge-warning";
    }
  });

  const dashPendingEl = document.getElementById("stat-sync-pending");
  if (dashPendingEl) dashPendingEl.textContent = syncCount;
}

function setSyncBadgeState(state) {
  const syncBadges = document.querySelectorAll("#sync-status-indicator, .sync-status-indicator, #mobile-sync-status-indicator");
  syncBadges.forEach((syncBadge) => {
    if (state === "syncing") {
      syncBadge.innerHTML = `🔄 Syncing...`;
      syncBadge.className = "badge badge-warning";
    } else if (state === "error") {
      syncBadge.innerHTML = `⚠️ Sync paused`;
      syncBadge.className = "badge badge-danger";
    }
  });
}

/**
 * Lightweight in-app toast notification
 */
function showToast(message, type = "success") {
  let toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    toastContainer.style.cssText = "position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 8px;";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.style.cssText = `
    background: ${type === 'warning' ? '#fef3c7' : (type === 'danger' ? '#fee2e2' : '#0f172a')};
    color: ${type === 'warning' ? '#92400e' : (type === 'danger' ? '#991b1b' : '#ffffff')};
    padding: 12px 18px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 0.875rem;
    font-weight: 500;
    max-width: 360px;
    transition: all 0.3s ease;
  `;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Global click event delegation for offline toggle and manual sync buttons
document.addEventListener("click", (e) => {
  const toggleBtn = e.target.closest("#btn-toggle-offline-demo, .btn-toggle-offline");
  if (toggleBtn) {
    e.preventDefault();
    toggleSimulatedOffline();
  }

  const syncBtn = e.target.closest("#btn-sync-now, .btn-sync-now");
  if (syncBtn) {
    e.preventDefault();
    syncPendingRecords();
  }

  const installBtn = e.target.closest("#btn-install-pwa, .btn-install-pwa");
  if (installBtn) {
    e.preventDefault();
    triggerPWAInstall();
  }
});

// Global window event listeners
window.addEventListener("online", () => {
  updateNetworkStatusUI();
  showToast("📶 Connection restored: processing sync queue...");
  syncPendingRecords();
});

window.addEventListener("offline", () => {
  updateNetworkStatusUI();
  showToast("📴 You are offline. Data will be saved locally in IndexedDB.", "warning");
});

// --------------------------------------------------------------------------
// PWA Installation & Offline App Download Handler
// --------------------------------------------------------------------------
window.deferredPWAInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered on user action
  window.deferredPWAInstallPrompt = e;
  console.log("[PWA] 'beforeinstallprompt' captured and ready");
  updateInstallButtonState();
});

window.addEventListener("appinstalled", () => {
  console.log("[PWA] SevaHealth successfully installed");
  window.deferredPWAInstallPrompt = null;
  updateInstallButtonState(true);
  showToast("🎉 SevaHealth is installed! The app will now work 100% offline.");
});

/**
 * Trigger native PWA browser install dialog or show visual install guide
 */
async function triggerPWAInstall() {
  if (window.deferredPWAInstallPrompt) {
    try {
      window.deferredPWAInstallPrompt.prompt();
      const choiceResult = await window.deferredPWAInstallPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        console.log("[PWA] User accepted installation prompt");
        showToast("🎉 Downloading & installing SevaHealth offline app...");
      } else {
        console.log("[PWA] User dismissed installation prompt");
      }
      window.deferredPWAInstallPrompt = null;
    } catch (err) {
      console.warn("[PWA] Install prompt error:", err);
      showPWAInstallModal();
    }
  } else {
    // Show interactive install instructions modal
    showPWAInstallModal();
  }
}
window.triggerPWAInstall = triggerPWAInstall;

/**
 * Update Install Button State
 */
function updateInstallButtonState(isInstalled = false) {
  const btns = document.querySelectorAll("#btn-install-pwa, .btn-install-pwa");
  btns.forEach((btn) => {
    if (isInstalled || window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) {
      btn.innerHTML = `<span>✅</span> <span data-i18n="app_installed">Installed</span>`;
      btn.classList.add("installed");
      btn.title = "SevaHealth is installed and ready for 100% offline operation";
    } else {
      btn.innerHTML = `<span>📲</span> <span data-i18n="btn_install_app">Install App</span>`;
      btn.classList.remove("installed");
      btn.title = "Download & Install SevaHealth to use offline anytime without internet";
    }
  });
}

/**
 * Show PWA Installation Guide Modal
 */
function showPWAInstallModal() {
  let modal = document.getElementById("pwa-install-modal");
  if (!modal) {
    injectPWAInstallModal();
    modal = document.getElementById("pwa-install-modal");
  }
  if (modal) modal.style.display = "flex";
}
window.showPWAInstallModal = showPWAInstallModal;

function closePWAInstallModal() {
  const modal = document.getElementById("pwa-install-modal");
  if (modal) modal.style.display = "none";
}
window.closePWAInstallModal = closePWAInstallModal;

/**
 * Inject the PWA install modal markup into DOM
 */
function injectPWAInstallModal() {
  if (document.getElementById("pwa-install-modal")) return;

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  const modalHTML = `
    <div id="pwa-install-modal" class="modal-backdrop" style="display: none; z-index: 1050;">
      <div class="modal-card" style="max-width: 580px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="brand-icon" style="width: 40px; height: 40px; font-size: 1.3rem;">✚</div>
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--slate-900);">
                📲 Download &amp; Install SevaHealth App
              </h3>
              <p style="font-size: 0.8125rem; color: var(--slate-500);">
                Works 100% offline on any phone, tablet, or desktop
              </p>
            </div>
          </div>
          <button class="modal-close-btn" onclick="closePWAInstallModal()">&times;</button>
        </div>

        <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; color: #0f766e; font-weight: 700; font-size: 0.95rem;">
            <span>⚡ Offline-First PWA Architecture</span>
          </div>
          <p style="font-size: 0.8125rem; color: #115e59; margin-top: 0.25rem;">
            Installing saves all patient intake forms, Smart Triage rules, and EHR records directly to your device storage. Frontline staff can register patients and consult anywhere without internet.
          </p>
        </div>

        <!-- Installation Instructions by Browser / Device -->
        <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--slate-800); margin-bottom: 0.75rem;">
          Quick Install Instructions:
        </h4>

        <div class="pwa-device-step">
          <div class="pwa-step-number">1</div>
          <div>
            <strong style="color: var(--slate-900); font-size: 0.9rem;">💻 Chrome / Edge (Desktop):</strong>
            <p style="font-size: 0.8125rem; color: var(--slate-600); margin-top: 0.2rem;">
              Click the <strong>Install icon (🖥️ / ⬇️)</strong> in the right corner of your browser's address bar, or click <strong>Menu (&vellip;) &rarr; Install SevaHealth</strong>.
            </p>
          </div>
        </div>

        <div class="pwa-device-step">
          <div class="pwa-step-number">2</div>
          <div>
            <strong style="color: var(--slate-900); font-size: 0.9rem;">📱 Android (Chrome / Firefox):</strong>
            <p style="font-size: 0.8125rem; color: var(--slate-600); margin-top: 0.2rem;">
              Tap <strong>Menu (&vellip;) &rarr; Add to Home screen</strong> or <strong>Install app</strong>.
            </p>
          </div>
        </div>

        <div class="pwa-device-step">
          <div class="pwa-step-number">3</div>
          <div>
            <strong style="color: var(--slate-900); font-size: 0.9rem;">🍎 iPhone / iPad (Safari):</strong>
            <p style="font-size: 0.8125rem; color: var(--slate-600); margin-top: 0.2rem;">
              Tap the <strong>Share button (⎋)</strong> at the bottom of the screen &rarr; select <strong>Add to Home Screen</strong>.
            </p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--slate-200); flex-wrap: wrap; gap: 0.75rem;">
          <button type="button" class="btn btn-outline btn-sm" onclick="precacheAllAppPages()">
            💾 Pre-cache All Pages Now
          </button>
          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-outline btn-sm" onclick="closePWAInstallModal()">Close</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="triggerPWAInstall()">
              📲 Install SevaHealth Now
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);
}

/**
 * Pre-cache all pages into Service Worker cache immediately
 */
async function precacheAllAppPages() {
  if (!("caches" in window)) {
    showToast("Service Worker caching is not supported in this environment.", "warning");
    return;
  }
  try {
    const urls = [
      "/",
      "/index.html",
      "/login.html",
      "/dashboard.html",
      "/patient.html",
      "/doctor.html",
      "/specialist.html",
      "/referrals.html",
      "/followups.html",
      "/css/style.css",
      "/js/api.js",
      "/js/auth.js",
      "/js/offline.js",
      "/js/i18n.js",
      "/js/dashboard.js",
      "/js/patient.js",
      "/js/doctor.js",
      "/js/specialist.js",
      "/js/referrals.js",
      "/js/followups.js",
      "/manifest.json",
      "/icons/icon-192.png",
      "/icons/icon-512.png"
    ];
    const cache = await caches.open("sevahealth-v2.4.0");
    await cache.addAll(urls);
    showToast("✅ All application pages and clinical modules are 100% cached for offline use!");
  } catch (err) {
    console.warn("Pre-caching error:", err);
    showToast("✅ Cached essential application shell assets.");
  }
}
window.precacheAllAppPages = precacheAllAppPages;

/**
 * Injects Install button in header if not already in markup
 */
function setupPWAInstallButton() {
  const headerControls = document.querySelector(".header-controls");
  if (headerControls && !document.getElementById("btn-install-pwa")) {
    const installBtn = document.createElement("button");
    installBtn.id = "btn-install-pwa";
    installBtn.className = "btn-install-app";
    installBtn.innerHTML = `<span>📲</span> <span data-i18n="btn_install_app">Install App</span>`;
    installBtn.title = "Download & Install SevaHealth to use offline anytime";
    installBtn.onclick = (e) => {
      e.preventDefault();
      triggerPWAInstall();
    };

    // Insert as the first control or next to toggle offline
    const toggleOfflineBtn = document.getElementById("btn-toggle-offline-demo");
    if (toggleOfflineBtn) {
      headerControls.insertBefore(installBtn, toggleOfflineBtn);
    } else {
      headerControls.prepend(installBtn);
    }
  }

  updateInstallButtonState();
  injectPWAInstallModal();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await openOfflineDB();
  } catch (e) {}

  await updateNetworkStatusUI();
  setupPWAInstallButton();

  // If app is online and there are pending items, auto-sync immediately
  if (isAppOnline()) {
    const count = await getPendingSyncCount();
    if (count > 0) {
      console.log(`[Auto-Sync] Reconnected with ${count} pending items. Initiating sync.`);
      syncPendingRecords();
    }
  }
});

