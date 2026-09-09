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
/**
 * Switch between Sign In and Create Account tabs
 * @param {'login'|'register'} tab 
 */
function switchAuthTab(tab) {
  const loginContainer = document.getElementById("login-form-container");
  const registerContainer = document.getElementById("register-form-container");
  const tabBtnLogin = document.getElementById("tab-btn-login");
  const tabBtnRegister = document.getElementById("tab-btn-register");
  const authCard = document.getElementById("auth-card");
  const authSubtitle = document.getElementById("auth-subtitle");
  const errorAlert = document.getElementById("error-alert");
  const successAlert = document.getElementById("success-alert");

  if (errorAlert) errorAlert.style.display = "none";
  if (successAlert) successAlert.style.display = "none";

  if (tab === "register") {
    if (loginContainer) loginContainer.style.display = "none";
    if (registerContainer) registerContainer.style.display = "block";
    if (tabBtnLogin) {
      tabBtnLogin.classList.remove("active");
      tabBtnLogin.setAttribute("aria-selected", "false");
    }
    if (tabBtnRegister) {
      tabBtnRegister.classList.add("active");
      tabBtnRegister.setAttribute("aria-selected", "true");
    }
    if (authCard) authCard.classList.add("register-mode");
    if (authSubtitle) {
      authSubtitle.textContent = "Create an account for ASHA, Doctor, Specialist, or Admin";
    }
  } else {
    if (loginContainer) loginContainer.style.display = "block";
    if (registerContainer) registerContainer.style.display = "none";
    if (tabBtnLogin) {
      tabBtnLogin.classList.add("active");
      tabBtnLogin.setAttribute("aria-selected", "true");
    }
    if (tabBtnRegister) {
      tabBtnRegister.classList.remove("active");
      tabBtnRegister.setAttribute("aria-selected", "false");
    }
    if (authCard) authCard.classList.remove("register-mode");
    if (authSubtitle) {
      authSubtitle.textContent = "Sign in or register your healthcare workspace";
    }
  }
}
window.switchAuthTab = switchAuthTab;

/**
 * Handle role selection change in registration form to update UI highlights and facility placeholders
 * @param {string} selectedRole 
 */
function handleRoleSelectionChange(selectedRole) {
  // Update card styling
  document.querySelectorAll(".role-radio-card").forEach(card => {
    const radio = card.querySelector("input[type='radio']");
    if (radio && radio.checked) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });

  // Dynamic facility placeholders & name placeholder hints
  const facilityInput = document.getElementById("reg-facility");
  const facilityLabel = document.getElementById("facility-label-text");
  const nameInput = document.getElementById("reg-name");

  if (selectedRole.includes("Health Worker") || selectedRole.includes("ASHA")) {
    if (facilityLabel) facilityLabel.textContent = "Village Sub-Centre / Ward";
    if (facilityInput) facilityInput.placeholder = "e.g. Ramapuram Sub-Centre";
    if (nameInput) nameInput.placeholder = "e.g. Anitha Devi (ASHA)";
  } else if (selectedRole.includes("Specialist")) {
    if (facilityLabel) facilityLabel.textContent = "Hospital / Unit Name";
    if (facilityInput) facilityInput.placeholder = "e.g. District Hospital Ongole - Cardiology Unit";
    if (nameInput) nameInput.placeholder = "e.g. Dr. Priya Sharma (Specialist)";
  } else if (selectedRole.includes("Doctor")) {
    if (facilityLabel) facilityLabel.textContent = "Primary Health Centre (PHC)";
    if (facilityInput) facilityInput.placeholder = "e.g. Chirala Primary Health Centre";
    if (nameInput) nameInput.placeholder = "e.g. Dr. Suresh Kumar";
  } else {
    if (facilityLabel) facilityLabel.textContent = "Administrative Office / Block";
    if (facilityInput) facilityInput.placeholder = "e.g. Prakasam DMHO / Chirala Block";
    if (nameInput) nameInput.placeholder = "e.g. Ramesh Patel";
  }
}
window.handleRoleSelectionChange = handleRoleSelectionChange;

// Attach login form, register form, and global auth listeners on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
  if (user) {
    setupGlobalHeader(user);
    applyRolePermissions();
  }

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const errorAlert = document.getElementById("error-alert");
  const successAlert = document.getElementById("success-alert");
  const successAlertText = document.getElementById("success-alert-text");
  const loginButton = document.getElementById("btn-submit-login");
  const registerButton = document.getElementById("btn-submit-register");

  // Helper alerts
  function showError(msg) {
    if (successAlert) successAlert.style.display = "none";
    if (errorAlert) {
      errorAlert.textContent = msg;
      errorAlert.style.display = "flex";
    } else {
      alert(msg);
    }
  }

  function showSuccess(msg) {
    if (errorAlert) errorAlert.style.display = "none";
    if (successAlert) {
      if (successAlertText) successAlertText.textContent = msg;
      successAlert.style.display = "flex";
    }
  }

  // --- 1. LOGIN FORM HANDLER ---
  if (loginForm) {
    redirectIfLoggedIn();

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const usernameInput = document.getElementById("username");
      const passwordInput = document.getElementById("password");

      const username = usernameInput ? usernameInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value : "";

      if (!username || !password) {
        showError("Please enter both username and password.");
        return;
      }

      // Indicate loading state
      if (loginButton) {
        loginButton.disabled = true;
        loginButton.innerHTML = "Authenticating...";
      }

      if (errorAlert) errorAlert.style.display = "none";
      if (successAlert) successAlert.style.display = "none";

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
          if (response.role.includes("Health Worker") || response.role.includes("ASHA")) {
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
          loginButton.innerHTML = "Sign In to Workspace &rarr;";
        }
      }
    });
  }

  // --- 2. REGISTER FORM HANDLER ---
  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const nameInput = document.getElementById("reg-name");
      const usernameInput = document.getElementById("reg-username");
      const passwordInput = document.getElementById("reg-password");
      const confirmPasswordInput = document.getElementById("reg-confirm-password");
      const facilityInput = document.getElementById("reg-facility");
      const phoneInput = document.getElementById("reg-phone");
      const roleRadio = document.querySelector("input[name='reg-role']:checked");

      const name = nameInput ? nameInput.value.trim() : "";
      const username = usernameInput ? usernameInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value : "";
      const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : "";
      const facility = facilityInput ? facilityInput.value.trim() : "";
      const phone = phoneInput ? phoneInput.value.trim() : "";
      const role = roleRadio ? roleRadio.value : "Health Worker (ASHA / ANM)";

      // Validation
      if (!name) {
        showError("Please enter your full name.");
        if (nameInput) nameInput.focus();
        return;
      }
      if (!username) {
        showError("Please choose a unique username.");
        if (usernameInput) usernameInput.focus();
        return;
      }
      if (username.length < 3) {
        showError("Username must be at least 3 characters long.");
        if (usernameInput) usernameInput.focus();
        return;
      }
      if (!password) {
        showError("Please create a password.");
        if (passwordInput) passwordInput.focus();
        return;
      }
      if (password.length < 4) {
        showError("Password should be at least 4 characters long.");
        if (passwordInput) passwordInput.focus();
        return;
      }
      if (password !== confirmPassword) {
        showError("Passwords do not match. Please re-enter your password.");
        if (confirmPasswordInput) confirmPasswordInput.focus();
        return;
      }

      // Indicate loading
      if (registerButton) {
        registerButton.disabled = true;
        registerButton.innerHTML = "Creating Account...";
      }

      if (errorAlert) errorAlert.style.display = "none";
      if (successAlert) successAlert.style.display = "none";

      try {
        const response = await registerUser({
          name: name,
          username: username,
          password: password,
          role: role,
          facility: facility || (role.includes("ASHA") ? "Ramapuram Sub-Centre" : "Chirala Primary Health Centre"),
          phone: phone || null
        });

        if (response && response.success) {
          showSuccess(`Welcome, ${response.name}! Account created as ${response.role}. Redirecting...`);

          // Auto-login registered user
          setCurrentUser({
            id: response.user_id,
            name: response.name,
            username: response.username,
            role: response.role,
            facility: response.facility
          });

          // Redirect to appropriate workspace
          setTimeout(() => {
            if (response.role.includes("Health Worker") || response.role.includes("ASHA")) {
              window.location.href = "patient.html";
            } else if (response.role.includes("Specialist")) {
              window.location.href = "specialist.html";
            } else if (response.role.includes("Doctor")) {
              window.location.href = "doctor.html";
            } else {
              window.location.href = "dashboard.html";
            }
          }, 800);
        } else {
          showError("Could not create account. Please try again.");
        }
      } catch (error) {
        showError(error.message || "Failed to create account.");
      } finally {
        if (registerButton) {
          registerButton.disabled = false;
          registerButton.innerHTML = "Create Account & Enter Workspace &rarr;";
        }
      }
    });
  }
});

