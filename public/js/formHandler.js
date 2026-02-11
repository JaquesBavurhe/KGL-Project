document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signupForm');

  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault(); // prevent reload

      // Clear previous errors
      document
        .querySelectorAll('.error-message')
        .forEach((el) => (el.textContent = ''));

      let isValid = true;

      const fullName = document.getElementById('fullName').value.trim();
      const username = document.getElementById('username').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const branch = document.getElementById('branch').value;
      const role = document.getElementById('role').value;
      const password = document.getElementById('password').value;

      // Full name validation
      if (fullName.length < 2) {
        document.getElementById('fullNameError').innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Full name must be at least 2 characters.';
        isValid = false;
      }

      // Username validation
      if (username.length < 2) {
        document.getElementById('usernameError').innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Username must be at least 2 characters.';
        isValid = false;
      }

      // Phone validation (Uganda format)
      const phoneRegex = /^(\+256|0)[0-9]{9}$/;
      if (!phoneRegex.test(phone)) {
        document.getElementById('phoneError').innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Enter a valid Ugandan phone number.';
        isValid = false;
      }

      // Branch validation
      if (!branch) {
        document.getElementById('branchError').innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Please select a branch.';
        isValid = false;
      }

      // Role validation
      if (!role || !['Director', 'Manager', 'Sales Agent'].includes(role)) {
        document.getElementById('roleError').innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Select a valid role (Director, Manager, Sales Agent).';
        isValid = false;
      }

      // Password validation
      if (password.length < 6) {
        document.getElementById('passwordError').innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Password must be at least 6 characters.';
        isValid = false;
      }

      if (isValid) {
        // For now, just show success message
        alert('Form validated successfully! Ready for backend integration.');
      }
    });
  }

  const loginForm = document.getElementById('loginForm');

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault(); // prevent reload
      // Clear previous errors
      document
        .querySelectorAll('.error-message')
        .forEach((el) => (el.textContent = ''));
      let isValid = true;

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      // Email validation
      if (email.length < 2) {
        document.getElementById('emailError').innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Email must be at least 2 characters.';
        isValid = false;
      }
      // Password validation
      if (password.length < 6) {
        document.getElementById('passwordError').innerHTML =
          '<i class="fa-solid fa-circle-exclamation"></i>Password must be at least 6 characters.';
        isValid = false;
      }
      if (isValid) {
        // For now, just show success message
        alert(
          'Login form validated successfully! Ready for backend integration.'
        );
      }
    });
  }

  // -------------------
  // Password Toggle
  // -------------------
  const passwordInput = document.getElementById('password');
  const togglePassword = document.getElementById('togglePassword');

  if (togglePassword) {
    togglePassword.addEventListener('click', () => {
      const type =
        passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);

      togglePassword.classList.toggle('fa-eye');
      togglePassword.classList.toggle('fa-eye-slash');
    });
  }
});
