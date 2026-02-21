document.addEventListener("DOMContentLoaded", () => {
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
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      document
        .querySelectorAll(".error-message")
        .forEach((el) => (el.textContent = ""));

      let isValid = true;

      const fullName = document.getElementById("fullName").value.trim();
      const username = document.getElementById("username").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const branch = document.getElementById("branch").value;
      const role = document.getElementById("role").value;
      const password = document.getElementById("password").value;

      if (fullName.length < 2) {
        document.getElementById("fullNameError").innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Full name must be at least 2 characters.';
        isValid = false;
      }

      if (username.length < 2) {
        document.getElementById("usernameError").innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Username must be at least 2 characters.';
        isValid = false;
      }

      const phoneRegex = /^(\+256|0)[0-9]{9}$/;
      if (!phoneRegex.test(phone)) {
        document.getElementById("phoneError").innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Enter a valid Ugandan phone number.';
        isValid = false;
      }

      if (role !== "Director" && !branch) {
        document.getElementById("branchError").innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Please select a branch.';
        isValid = false;
      }

      if (!role || !["Director", "Manager", "Sales Agent"].includes(role)) {
        document.getElementById("roleError").innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Select a valid role (Director, Manager, Sales Agent).';
        isValid = false;
      }

      if (password.length < 6) {
        document.getElementById("passwordError").innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Password must be at least 6 characters.';
        isValid = false;
      }

      if (isValid) {
        try {
          const response = await fetch("/signup", {
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
            alert("Registration successful!");
            window.location.href = "/login";
          } else {
            alert("Error: " + (result.message || "Failed to sign up"));
          }
        } catch (error) {
          console.error("Fetch Error:", error);
          alert("Network error. Is the server running?");
        }
      }
    });
  }

  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      document
        .querySelectorAll(".error-message")
        .forEach((el) => (el.textContent = ""));
      let isValid = true;

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;

      if (username.length < 2) {
        document.getElementById("usernameError").innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Username must be at least 2 characters.';
        isValid = false;
      }

      if (password.length < 6) {
        document.getElementById("passwordError").innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Password must be at least 6 characters.';
        isValid = false;
      }

      if (isValid) {
        try {
          const response = await fetch(`/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });

          const result = await response.json();

          if (response.ok) {
            alert("Welcome back!");
            window.location.href = "/dashboard";
          } else {
            throw new Error(result.message);
          }
        } catch (error) {
          console.error("Fetch Error:", error);
        }
      }
    });
  }

  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("togglePassword");

  if (togglePassword) {
    togglePassword.addEventListener("click", () => {
      const type =
        passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);

      togglePassword.classList.toggle("fa-eye");
      togglePassword.classList.toggle("fa-eye-slash");
    });
  }

  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      window.location.href = "/logout";
    });
  }
});
