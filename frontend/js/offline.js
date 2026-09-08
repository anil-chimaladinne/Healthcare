/**
 * SevaHealth - Offline-First IndexedDB & Synchronization Engine
 * Manages local offline storage, sync queues, and seamless reconnection syncing.
 * Enables SIH presenters to demonstrate "Care continues even when the internet does not."
 */

const DB_NAME = "SevaHealthOfflineDB";
const DB_VERSION = 1;
let dbInstance = null;

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
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error("[IndexedDB] Error opening database:", event.target.error);
      reject(event.target.error);
    };
  });
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
    showToast("📴 Offline Mode Enabled: Capturing data locally in IndexedDB.");
  }
}

/**
 * Save a record into the offline IndexedDB sync queue
 */
async function queueOfflineRecord(type, data) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_sync", "readwrite");
    const store = tx.objectStore("pending_sync");
    const item = {
      type: type,
      data: data,
      timestamp: new Date().toISOString()
    };
    const req = store.add(item);
    req.onsuccess = () => {
      updateSyncStatusUI();
      resolve(item);
    };
    req.onerror = (e) => reject(e.target.error);
  });
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
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => resolve(0);
    });
  } catch (e) {
    return 0;
  }
}

/**
 * Fetch all pending items from IndexedDB
 */
async function getAllPendingSyncItems() {
  const db = await openOfflineDB();
  return new Promise((resolve) => {
    const tx = db.transaction("pending_sync", "readonly");
    const store = tx.objectStore("pending_sync");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

/**
 * Clear synchronized items from IndexedDB queue
 */
async function clearPendingSyncQueue() {
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
}

/**
 * Synchronize all pending records to the FastAPI backend
 */
async function syncPendingRecords() {
  if (!isAppOnline()) {
    showToast("⚠️ Cannot sync while in offline mode.", "warning");
    return;
  }

  const items = await getAllPendingSyncItems();
  if (items.length === 0) {
    updateSyncStatusUI();
    showToast("✅ All records are up to date!");
    return;
  }

  setSyncBadgeState("syncing");

  try {
    const user = (typeof getCurrentUser === "function") ? getCurrentUser() : null;
    const workerName = user ? user.name : "Health Worker";

    const payload = {
      records: items,
      synced_by: workerName
    };

    const response = await fetch(`${API_BASE_URL}/sync/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Sync server returned ${response.status}`);
    }

    const result = await response.json();
    await clearPendingSyncQueue();
    updateSyncStatusUI();

    showToast(`🎉 Sync completed! ${result.synced_count} records synchronized with PHC server.`);
    
    // Refresh page data if on dashboard or queue
    if (typeof loadDashboardMetrics === "function") {
      loadDashboardMetrics();
    }
  } catch (err) {
    console.error("[Sync] Synchronization failed:", err);
    setSyncBadgeState("error");
    showToast("⚠️ Sync encountered a network issue. Retrying automatically when stable.", "warning");
  }
}

/**
 * Update the Topbar Network and Sync status badges
 */
async function updateNetworkStatusUI() {
  const netBadge = document.getElementById("network-status-badge");
  const offlineToggleBtn = document.getElementById("btn-toggle-offline-demo");

  const online = isAppOnline();

  if (netBadge) {
    if (online) {
      netBadge.className = "badge badge-status-online";
      netBadge.innerHTML = `<span class="badge-status-dot status-online"></span> <span>ONLINE</span>`;
      netBadge.title = "Connected to central PHC server";
    } else {
      netBadge.className = "badge badge-status-offline";
      netBadge.innerHTML = `<span class="badge-status-dot status-offline"></span> <span>OFFLINE MODE</span>`;
      netBadge.title = "Offline: Data saved locally in IndexedDB";
    }
  }

  if (offlineToggleBtn) {
    offlineToggleBtn.innerHTML = online ? "📡 Simulate Offline" : "📶 Go Online";
    offlineToggleBtn.className = online ? "btn btn-outline btn-sm" : "btn btn-primary btn-sm";
  }

  await updateSyncStatusUI();
}

/**
 * Update the sync counter indicator
 */
async function updateSyncStatusUI() {
  const syncBadge = document.getElementById("sync-status-indicator");
  const syncCount = await getPendingSyncCount();

  if (syncBadge) {
    if (syncCount === 0) {
      syncBadge.innerHTML = `☁️ All synced`;
      syncBadge.className = "badge badge-primary";
    } else {
      syncBadge.innerHTML = `⏳ ${syncCount} pending sync`;
      syncBadge.className = "badge badge-warning";
    }
  }

  const dashPendingEl = document.getElementById("stat-sync-pending");
  if (dashPendingEl) dashPendingEl.textContent = syncCount;
}

function setSyncBadgeState(state) {
  const syncBadge = document.getElementById("sync-status-indicator");
  if (!syncBadge) return;
  if (state === "syncing") {
    syncBadge.innerHTML = `🔄 Syncing...`;
    syncBadge.className = "badge badge-warning";
  } else if (state === "error") {
    syncBadge.innerHTML = `⚠️ Sync paused`;
    syncBadge.className = "badge badge-danger";
  }
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

document.addEventListener("DOMContentLoaded", () => {
  openOfflineDB().then(() => {
    updateNetworkStatusUI();
  });
});
