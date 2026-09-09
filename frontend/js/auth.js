/**
 * RuralCare - Frontend Authentication Management
 * Prototype session handling using browser storage.
 */

const AUTH_STORAGE_KEY = "ruralcare_active_user";

/**
 * Get current logged in user from session storage
 * @returns {object|null}
 */
function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Error reading auth state:", e);
    return null;
  }
}

/**
 * Save logged in user into session storage
 * @param {object} user 
 */
function setCurrentUser(user) {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

/**
 * Clear session and log out reliably
 */
function logout() {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.clear();
    localStorage.clear();
  } catch (e) {
    console.error("Logout error:", e);
  }
  window.location.replace("login.html");
}
window.logout = logout;

/**
 * Route protection: Ensure user is logged in
 */
function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.replace("login.html");
    return null;
  }
  return user;
}

/**
 * Redirect already authenticated users from login page to their dedicated role workspace
 */
function redirectIfLoggedIn() {
  const user = getCurrentUser();
  if (user && user.role) {
    if (user.role.includes("Health Worker") || user.role.includes("ASHA")) {
      window.location.replace("patient.html");
    } else if (user.role.includes("Specialist")) {
      window.location.replace("specialist.html");
    } else if (user.role.includes("Doctor")) {
      window.location.replace("doctor.html");
    } else {
      window.location.replace("dashboard.html");
    }
  }
}

/**
 * Quick-fill helper for hackathon demo testing
 * @param {string} username 
 * @param {string} password 
 */
function setDemoCredentials(username, password) {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  if (usernameInput && passwordInput) {
    usernameInput.value = username;
    passwordInput.value = password;
    const errorAlert = document.getElementById("error-alert");
    if (errorAlert) {
      errorAlert.style.display = "none";
    }
  }
}

/**
 * Global Header initialization for all authenticated pages
 */
function setupGlobalHeader(user) {
  if (!user) return;

  // 1. Setup Universal Logout Buttons
  const logoutButtons = document.querySelectorAll("#btn-logout, .btn-logout, [data-action='logout']");
  logoutButtons.forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      logout();
    };
  });

  // 2. Render User Role Badge if present
  const userRoleEl = document.getElementById("user-role-badge");
  if (userRoleEl) {
    userRoleEl.textContent = user.role;
    userRoleEl.className = "badge";
    if (user.role.includes("Health Worker") || user.role.includes("ASHA")) {
      userRoleEl.classList.add("badge-healthworker");
    } else if (user.role.includes("Specialist")) {
      userRoleEl.classList.add("badge-specialist");
    } else if (user.role.includes("Doctor")) {
      userRoleEl.classList.add("badge-doctor");
    } else {
      userRoleEl.classList.add("badge-admin");
    }
  }

  // 3. Render User Name if present
  const userNameEl = document.getElementById("user-name-display");
  if (userNameEl) {
    userNameEl.textContent = user.name || user.username;
  }
}

/**
 * Apply role-based navigation visibility and page permissions
 */
function applyRolePermissions() {
  const user = getCurrentUser();
  if (!user) return;

  const currentPath = (window.location.pathname || "").toLowerCase();
  const roleStr = (user.role || "").toLowerCase();
  const usernameStr = (user.username || "").toLowerCase();
  const isAsha = roleStr.includes("health worker") || roleStr.includes("asha") || roleStr.includes("anm") || usernameStr === "healthworker";
  const isSpecialist = roleStr.includes("specialist") || usernameStr === "specialist";
  const isDoctor = !isSpecialist && (roleStr.includes("doctor") || usernameStr === "doctor");
  const isAdmin = roleStr.includes("admin") || usernameStr === "admin";

  // 1. Route Protection & Redirects
  if (isAsha && (currentPath.includes("doctor.html") || currentPath.includes("specialist.html") || currentPath.includes("followups.html"))) {
    window.location.replace("patient.html");
    return;
  }
  if (isDoctor && (currentPath.includes("patient.html") || currentPath.includes("specialist.html") || currentPath.includes("followups.html"))) {
    window.location.replace("doctor.html");
    return;
  }
  if (isSpecialist && (currentPath.includes("patient.html") || currentPath.includes("doctor.html") || currentPath.includes("followups.html"))) {
    window.location.replace("specialist.html");
    return;
  }
  if (isAdmin && (currentPath.includes("patient.html") || currentPath.includes("doctor.html") || currentPath.includes("specialist.html") || currentPath.includes("followups.html"))) {
    window.location.replace("dashboard.html");
    return;
  }

  // 2. Filter Navigation Links across all pages
  const navLinks = document.querySelectorAll(".sidebar-nav .nav-link, a[href*='.html']");
  navLinks.forEach((link) => {
    const href = (link.getAttribute("href") || "").toLowerCase();

    if (isAsha) {
      // ASHA sees: Dashboard, Patients & Doorstep, Referrals (Follow-ups, Doctor Queue, Specialist Queue removed)
      if (href.includes("doctor.html") || href.includes("specialist.html") || href.includes("followups.html")) {
        link.style.display = "none";
      } else if (href.includes("dashboard") || href.includes("patient") || href.includes("referrals")) {
        link.style.display = "flex";
      }
    } else if (isDoctor) {
      // Doctor sees: Dashboard, Doctor Queue, Referrals
      if (href.includes("patient.html") || href.includes("specialist.html") || href.includes("followups.html")) {
        link.style.display = "none";
      } else if (href.includes("dashboard") || href.includes("doctor") || href.includes("referrals")) {
        link.style.display = "flex";
      }
    } else if (isSpecialist) {
      // Specialist sees: Dashboard, Specialist Workspace, Referrals
      if (href.includes("patient.html") || href.includes("doctor.html") || href.includes("followups.html")) {
        link.style.display = "none";
      } else if (href.includes("dashboard") || href.includes("specialist") || href.includes("referrals")) {
        link.style.display = "flex";
      }
    } else if (isAdmin) {
      // Admin sees: Dashboard, Specialist Queue & Referrals
      if (href.includes("patient.html") || href.includes("doctor.html") || href.includes("followups.html")) {
        link.style.display = "none";
      } else if (href.includes("dashboard") || href.includes("referrals") || href.includes("specialist")) {
        link.style.display = "flex";
      }
    }
  });

  // Specifically hide follow-ups for ASHA everywhere
  if (isAsha) {
    document.querySelectorAll('a[href*="followups.html"], #card-stat-followups').forEach(el => {
      el.style.display = "none";
    });
  }
}

// Global click event delegation for logout (works everywhere regardless of script load timing)
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#btn-logout, .btn-logout, [data-action='logout']");
  if (btn) {
    e.preventDefault();
    logout();
  }
});

// Attach login form and global auth listeners on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
  if (user) {
    setupGlobalHeader(user);
    applyRolePermissions();
  }

  const loginForm = document.getElementById("login-form");
  const errorAlert = document.getElementById("error-alert");
  const loginButton = document.getElementById("btn-submit-login");

  if (loginForm) {
    redirectIfLoggedIn();

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const usernameInput = document.getElementById("username");
      const passwordInput = document.getElementById("password");

      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (!username || !password) {
        showError("Please enter both username and password.");
        return;
      }

      // Indicate loading state
      if (loginButton) {
        loginButton.disabled = true;
        loginButton.innerHTML = "Authenticating...";
      }

      if (errorAlert) {
        errorAlert.style.display = "none";
      }

      try {
        const response = await loginUser(username, password);

        if (response && response.success) {
          setCurrentUser({
            id: response.user_id,
            name: response.name,
            username: response.username,
            role: response.role,
            facility: response.facility
          });

          // Role-specific landing page
          if (response.role.includes("Health Worker")) {
            window.location.href = "patient.html";
          } else if (response.role.includes("Specialist")) {
            window.location.href = "specialist.html";
          } else if (response.role.includes("Doctor")) {
            window.location.href = "doctor.html";
          } else {
            window.location.href = "dashboard.html";
          }
        } else {
          showError("Invalid username or password.");
        }
      } catch (error) {
        showError(error.message || "Invalid username or password.");
      } finally {
        if (loginButton) {
          loginButton.disabled = false;
          loginButton.innerHTML = "Sign In to Workspace →";
        }
      }
    });
  }

  function showError(msg) {
    if (errorAlert) {
      errorAlert.textContent = msg;
      errorAlert.style.display = "flex";
    } else {
      alert(msg);
    }
  }
});
