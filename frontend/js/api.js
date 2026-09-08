/**
 * SevaHealth - REST API Client Wrapper
 * Centralized fetch functions for communication with FastAPI backend.
 */

const API_BASE_URL = (window.location.origin && window.location.origin.startsWith("http"))
  ? `${window.location.origin}/api`
  : "http://127.0.0.1:8000/api";

/**
 * Check backend health
 */
async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    throw new Error("Unable to connect to the server. Please check your connection.");
  }
}

/**
 * Authenticate user credentials
 */
async function loginUser(username, password) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password: password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Invalid username or password.");
    }
    return data;
  } catch (e) {
    if (e.message.includes("Failed to fetch") || e.message.includes("NetworkError")) {
      throw new Error("Unable to connect to the server. Please check your connection.");
    }
    throw e;
  }
}

/**
 * Get dashboard metrics
 */
async function getDashboardData() {
  try {
    const res = await fetch(`${API_BASE_URL}/dashboard`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    throw new Error("Unable to load dashboard data.");
  }
}
