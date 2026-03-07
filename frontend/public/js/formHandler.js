document.addEventListener("DOMContentLoaded", () => {
  const errorTimers = new Map();
  const apiFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });

  // Toast UI helpers used by login/signup feedback.
  const ensureToastStyles = () => {
    if (document.getElementById("toastStyles")) return;

    const style = document.createElement("style");
    style.id = "toastStyles";
    style.textContent = `
      .toast-container {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .toast {
        min-width: 240px;
        max-width: 360px;
        padding: 12px 14px;
        border-radius: 10px;
        color: #ffffff;
        font-size: 0.9rem;
        font-weight: 600;
        box-shadow: 0 12px 24px rgba(15, 23, 42, 0.2);
        opacity: 0;
        transform: translateY(-8px);
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .toast.show {
        opacity: 1;
        transform: translateY(0);
      }
      .toast.success { background: #16a34a; }
      .toast.error { background: #dc2626; }
      .toast.info { background: #2563eb; }
    `;
    document.head.appendChild(style);
  };

  const getToastContainer = () => {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    return container;
  };

  const showToast = (message, type = "info") => {
    ensureToastStyles();
    const container = getToastContainer();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  };

  // Field-level validation message helpers.
  const ensureFieldErrorStyles = () => {
    if (document.getElementById("fieldErrorStyles")) return;

    const style = document.createElement("style");
    style.id = "fieldErrorStyles";
    style.textContent = `
      .error-message {
        min-height: 16px;
        line-height: 1.1;
        opacity: 0;
        transform: translateY(-3px);
        transition: opacity 0.25s ease, transform 0.25s ease;
      }
      .error-message.visible {
        opacity: 1;
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);
  };

  const clearFieldError = (errorEl, immediate = false) => {
    if (!errorEl) return;

    const existingTimer = errorTimers.get(errorEl.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      errorTimers.delete(errorEl.id);
    }

    errorEl.classList.remove("visible");

    const clearContent = () => {
      errorEl.textContent = "";
    };

    if (immediate) {
      clearContent();
    } else {
      setTimeout(clearContent, 250);
    }
  };

  const setFieldError = (errorId, message) => {
    ensureFieldErrorStyles();

    const errorEl = document.getElementById(errorId);
    if (!errorEl) return;

    clearFieldError(errorEl, true);
    errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i>${message}`;

    requestAnimationFrame(() => {
      errorEl.classList.add("visible");
    });

    const timer = setTimeout(() => {
      clearFieldError(errorEl);
    }, 3000);

    errorTimers.set(errorId, timer);
  };

  const clearAllFieldErrors = (immediate = true) => {
    document.querySelectorAll(".error-message").forEach((el) => {
      clearFieldError(el, immediate);
    });
  };

  const bindInputToClearError = (inputId, errorId) => {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    if (!input || !errorEl) return;

    input.addEventListener("input", () => {
      if (errorEl.textContent.trim()) {
        clearFieldError(errorEl);
      }
    });
  };

  const bindPasswordToggle = (toggleId, inputId) => {
    const toggle = document.getElementById(toggleId);
    const input = document.getElementById(inputId);

    if (!toggle || !input) return;

    toggle.addEventListener("click", () => {
      const nextType = input.getAttribute("type") === "password" ? "text" : "password";
      input.setAttribute("type", nextType);
      toggle.classList.toggle("fa-eye");
      toggle.classList.toggle("fa-eye-slash");
    });
  };

  // Ensure error-message spacing/animation styles are present on initial page render.
  ensureFieldErrorStyles();

  // Optional signup form logic (kept for pages that still mount signup form controls).
  const signupForm = document.getElementById("signupForm");

  const roleSelect = document.getElementById("role");
  const branchSelect = document.getElementById("branch");
  const branchError = document.getElementById("branchError");

  const syncBranchStateWithRole = () => {
    if (!roleSelect || !branchSelect) return;

    const isDirector = roleSelect.value === "Director";
    branchSelect.disabled = isDirector;

    if (isDirector) {
      branchSelect.value = "";
      if (branchError) {
        branchError.textContent = "";
      }
    }
  };

  if (roleSelect && branchSelect) {
    roleSelect.addEventListener("change", syncBranchStateWithRole);
    syncBranchStateWithRole();
  }

  if (signupForm) {
    bindInputToClearError("fullName", "fullNameError");
    bindInputToClearError("username", "usernameError");
    bindInputToClearError("phone", "phoneError");
    bindInputToClearError("branch", "branchError");
    bindInputToClearError("role", "roleError");
    bindInputToClearError("password", "passwordError");

    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      clearAllFieldErrors();

      let isValid = true;

      const fullName = document.getElementById("fullName").value.trim();
      const username = document.getElementById("username").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const branch = document.getElementById("branch").value;
      const role = document.getElementById("role").value;
      const password = document.getElementById("password").value;

      if (fullName.length < 2) {
        setFieldError("fullNameError", "Full name must be at least 2 characters.");
        isValid = false;
      }

      if (username.length < 2) {
        setFieldError("usernameError", "Username must be at least 2 characters.");
        isValid = false;
      }

      const phoneRegex = /^(\+256|0)[0-9]{9}$/;
      if (!phoneRegex.test(phone)) {
        setFieldError("phoneError", "Enter a valid Ugandan phone number.");
        isValid = false;
      }

      if (role !== "Director" && !branch) {
        setFieldError("branchError", "Please select a branch.");
        isValid = false;
      }

      if (!role || !["Director", "Manager", "Sales Agent"].includes(role)) {
        setFieldError(
          "roleError",
          "Select a valid role (Director, Manager, Sales Agent).",
        );
        isValid = false;
      }

      if (password.length < 6) {
        setFieldError("passwordError", "Password must be at least 6 characters.");
        isValid = false;
      }

      if (!isValid) {
        showToast("Please fill all required fields correctly.", "error");
        return;
      }

      try {
        const response = await apiFetch("/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName,
            username,
            phone,
            branch,
            role,
            password,
          }),
        });

        const result = await response.json();

        if (response.ok) {
          showToast("Registration successful. Redirecting to login...", "success");
          setTimeout(() => {
            window.location.href = "/login";
          }, 900);
        } else {
          showToast(result.message || "Failed to sign up", "error");
        }
      } catch (error) {
        console.error("Fetch Error:", error);
        showToast("Network error. Is the server running?", "error");
      }
    });
  }

  const loginForm = document.getElementById("loginForm");

  // Login flow with first-login password reset modal.
  if (loginForm) {
    bindInputToClearError("username", "usernameError");
    bindInputToClearError("password", "passwordError");
    bindInputToClearError("firstLoginCurrentPassword", "firstLoginCurrentPasswordError");
    bindInputToClearError("firstLoginNewPassword", "firstLoginNewPasswordError");

    // First-login flow: optional prompt + forced credential update form in modal.
    const firstLoginModal = document.getElementById("firstLoginModal");
    const firstLoginPromptStep = document.getElementById("firstLoginPromptStep");
    const firstLoginFormStep = document.getElementById("firstLoginFormStep");
    const firstLoginProceedBtn = document.getElementById("firstLoginProceedBtn");
    const firstLoginLaterBtn = document.getElementById("firstLoginLaterBtn");
    const firstLoginBackBtn = document.getElementById("firstLoginBackBtn");
    const firstLoginPasswordForm = document.getElementById("firstLoginPasswordForm");
    const firstLoginCurrentPassword = document.getElementById("firstLoginCurrentPassword");
    const firstLoginNewPassword = document.getElementById("firstLoginNewPassword");

    let cachedLoginPassword = "";

    const redirectToDashboard = () => {
      window.location.href = "/dashboard";
    };

    const openFirstLoginModal = () => {
      if (!firstLoginModal) return;
      firstLoginModal.classList.add("open");
      firstLoginModal.setAttribute("aria-hidden", "false");
    };

    const closeFirstLoginModal = () => {
      if (!firstLoginModal) return;
      firstLoginModal.classList.remove("open");
      firstLoginModal.setAttribute("aria-hidden", "true");
    };

    const showFirstLoginPromptStep = () => {
      if (!firstLoginPromptStep || !firstLoginFormStep) return;
      firstLoginPromptStep.classList.add("active");
      firstLoginFormStep.classList.remove("active");
      clearFieldError(document.getElementById("firstLoginCurrentPasswordError"), true);
      clearFieldError(document.getElementById("firstLoginNewPasswordError"), true);
    };

    const showFirstLoginFormStep = () => {
      if (!firstLoginPromptStep || !firstLoginFormStep) return;
      firstLoginPromptStep.classList.remove("active");
      firstLoginFormStep.classList.add("active");
      if (firstLoginCurrentPassword) firstLoginCurrentPassword.value = cachedLoginPassword;
      if (firstLoginNewPassword) firstLoginNewPassword.value = "";
      if (firstLoginNewPassword) firstLoginNewPassword.focus();
    };

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAllFieldErrors();
      let isValid = true;

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;

      if (username.length < 2) {
        setFieldError("usernameError", "Username must be at least 2 characters.");
        isValid = false;
      }

      if (password.length < 6) {
        setFieldError("passwordError", "Password must be at least 6 characters.");
        isValid = false;
      }

      if (!isValid) {
        showToast("Please fill all required fields correctly.", "error");
        return;
      }

      try {
        const response = await apiFetch(`/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const result = await response.json();

        if (response.ok) {
          const mustResetPassword = Boolean(result?.user?.mustResetPassword);
          cachedLoginPassword = password;

          if (mustResetPassword) {
            showToast("Login successful.", "success");
            openFirstLoginModal();
            showFirstLoginPromptStep();
          } else {
            showToast("Login successful. Redirecting...", "success");
            setTimeout(() => {
              redirectToDashboard();
            }, 900);
          }
        } else {
          showToast(result.message || "Login failed", "error");
        }
      } catch (error) {
        console.error("Fetch Error:", error);
        showToast("Network error. Is the server running?", "error");
      }
    });

    if (firstLoginProceedBtn) {
      firstLoginProceedBtn.addEventListener("click", () => {
        showFirstLoginFormStep();
      });
    }

    if (firstLoginBackBtn) {
      firstLoginBackBtn.addEventListener("click", () => {
        showFirstLoginPromptStep();
      });
    }

    if (firstLoginLaterBtn) {
      firstLoginLaterBtn.addEventListener("click", () => {
        closeFirstLoginModal();
        showToast("You can update your password later.", "info");
        setTimeout(() => {
          redirectToDashboard();
        }, 700);
      });
    }

    if (firstLoginPasswordForm) {
      firstLoginPasswordForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearFieldError(document.getElementById("firstLoginCurrentPasswordError"), true);
        clearFieldError(document.getElementById("firstLoginNewPasswordError"), true);

        const currentPassword = firstLoginCurrentPassword ? firstLoginCurrentPassword.value : "";
        const newPassword = firstLoginNewPassword ? firstLoginNewPassword.value : "";
        let modalFormValid = true;

        if (currentPassword.length < 6) {
          setFieldError("firstLoginCurrentPasswordError", "Current password must be at least 6 characters.");
          modalFormValid = false;
        }

        if (newPassword.length < 6) {
          setFieldError("firstLoginNewPasswordError", "New password must be at least 6 characters.");
          modalFormValid = false;
        }

        if (currentPassword && newPassword && currentPassword === newPassword) {
          setFieldError("firstLoginNewPasswordError", "New password must be different from current password.");
          modalFormValid = false;
        }

        if (!modalFormValid) {
          showToast("Please fix the password form errors.", "error");
          return;
        }

        try {
          const response = await apiFetch("/auth/reset-first-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword, newPassword }),
          });

          const result = await response.json();

          if (response.ok) {
            closeFirstLoginModal();
            showToast("Password changed successfully. Redirecting...", "success");
            setTimeout(() => {
              redirectToDashboard();
            }, 900);
            return;
          }

          if (response.status === 401) {
            setFieldError("firstLoginCurrentPasswordError", "Current password is incorrect.");
          } else if (response.status === 400 && result.message) {
            setFieldError("firstLoginNewPasswordError", result.message);
          } else {
            showToast(result.message || "Failed to reset password.", "error");
          }
        } catch (error) {
          console.error("Password reset error:", error);
          showToast("Network error. Is the server running?", "error");
        }
      });
    }
  }

  bindPasswordToggle("togglePassword", "password");
  bindPasswordToggle("toggleFirstLoginCurrentPassword", "firstLoginCurrentPassword");
  bindPasswordToggle("toggleFirstLoginNewPassword", "firstLoginNewPassword");

  // Generic logout button fallback for pages that include this script.
  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      window.location.href = "/logout";
    });
  }
});
