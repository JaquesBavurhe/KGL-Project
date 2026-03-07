const formatNumber = (value) => new Intl.NumberFormat("en-UG").format(value || 0);
const apiFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });

// Normalizes `datetime-local` input values before sending to API.
const toIsoFromDateTimeLocal = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

let allRowsCache = [];
let activeSaleModalId = null;
let authenticatedUser = null;

// Modal state helpers for sales-agent quick-entry forms.
const openSaleModal = (modalId) => {
  activeSaleModalId = modalId;
  document.getElementById(modalId)?.classList.add("open");
};

const closeSaleModal = (modalId) => {
  document.getElementById(modalId)?.classList.remove("open");
  if (activeSaleModalId === modalId) {
    activeSaleModalId = null;
  }
};

// Syncs sales-agent header labels with the latest authenticated user details.
const applyProfileHeader = (user) => {
  if (!user) return;
  const displayName = user.fullName || user.username || "Sales Agent";
  const role = user.role || "Sales Agent";
  const branch = user.branch || "N/A";

  const profileName = document.getElementById("profileName");
  const profileMeta = document.getElementById("profileMeta");
  const overviewGreeting = document.getElementById("overviewGreeting");
  const userContext = document.getElementById("userContext");

  if (profileName) profileName.textContent = displayName;
  if (profileMeta) profileMeta.textContent = `${role} - ${branch}`;
  if (overviewGreeting) overviewGreeting.textContent = `Good day, ${displayName}`;
  if (userContext) {
    userContext.textContent = `${displayName} (${role}) - Branch: ${branch}. Record and monitor daily sales from this dashboard.`;
  }
};

// Controls sales-agent profile dropdown + manage-profile modal behavior.
const setupProfileMenu = () => {
  const menuToggle = document.getElementById("profileMenuToggle");
  const menu = document.getElementById("profileMenu");
  const manageProfileButton = document.getElementById("manageProfileButton");
  const logoutFromMenuButton = document.getElementById("logoutFromMenuButton");
  const profileModal = document.getElementById("profileModal");
  const closeProfileModalButton = document.getElementById("closeProfileModalButton");
  const cancelProfileModalButton = document.getElementById("cancelProfileModalButton");
  const saveProfileButton = document.getElementById("saveProfileButton");
  const profileModalStatus = document.getElementById("profileModalStatus");
  const profileFullNameInput = document.getElementById("profileFullNameInput");
  const profileUsernameInput = document.getElementById("profileUsernameInput");
  const profileCurrentPasswordInput = document.getElementById("profileCurrentPasswordInput");
  const profileNewPasswordInput = document.getElementById("profileNewPasswordInput");

  if (!menuToggle || !menu || !profileModal || !saveProfileButton) return;

  const closeMenu = () => menu.classList.remove("open");
  const toggleMenu = () => menu.classList.toggle("open");

  const closeProfileModal = () => {
    profileModal.classList.remove("open");
    if (profileModalStatus) profileModalStatus.textContent = "";
    if (profileCurrentPasswordInput) profileCurrentPasswordInput.value = "";
    if (profileNewPasswordInput) profileNewPasswordInput.value = "";
  };

  const openProfileModal = () => {
    if (profileFullNameInput) profileFullNameInput.value = authenticatedUser?.fullName || "";
    if (profileUsernameInput) profileUsernameInput.value = authenticatedUser?.username || "";
    if (profileCurrentPasswordInput) profileCurrentPasswordInput.value = "";
    if (profileNewPasswordInput) profileNewPasswordInput.value = "";
    if (profileModalStatus) profileModalStatus.textContent = "";
    profileModal.classList.add("open");
  };

  menuToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu();
  });

  manageProfileButton?.addEventListener("click", () => {
    closeMenu();
    openProfileModal();
  });

  logoutFromMenuButton?.addEventListener("click", () => {
    window.location.href = "/logout";
  });

  closeProfileModalButton?.addEventListener("click", closeProfileModal);
  cancelProfileModalButton?.addEventListener("click", closeProfileModal);

  profileModal.addEventListener("click", (event) => {
    if (event.target.id === "profileModal") {
      closeProfileModal();
    }
  });

  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target) && !menuToggle.contains(event.target)) {
      closeMenu();
    }
  });

  document.querySelectorAll(".password-toggle-btn[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-target");
      const input = targetId ? document.getElementById(targetId) : null;
      const icon = button.querySelector(".material-symbols-outlined");
      if (!input || !icon) return;

      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      icon.textContent = isHidden ? "visibility_off" : "visibility";
    });
  });

  saveProfileButton.addEventListener("click", async () => {
    if (!profileFullNameInput || !profileUsernameInput) return;
    const fullName = profileFullNameInput.value.trim();
    const username = profileUsernameInput.value.trim();
    const currentPassword = profileCurrentPasswordInput?.value || "";
    const newPassword = profileNewPasswordInput?.value || "";

    if (fullName.length < 2 || username.length < 2) {
      if (profileModalStatus) {
        profileModalStatus.textContent = "Full name and username must be at least 2 characters.";
      }
      return;
    }

    if (newPassword && !currentPassword) {
      if (profileModalStatus) profileModalStatus.textContent = "Current password is required to change password.";
      return;
    }

    if (newPassword && newPassword.length < 6) {
      if (profileModalStatus) profileModalStatus.textContent = "New password must be at least 6 characters.";
      return;
    }

    if (profileModalStatus) profileModalStatus.textContent = "Saving profile changes...";

    const response = await apiFetch("/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        username,
        currentPassword,
        newPassword,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (profileModalStatus) profileModalStatus.textContent = result.message || "Failed to update profile.";
      return;
    }

    authenticatedUser = result.user || authenticatedUser;
    applyProfileHeader(authenticatedUser);
    closeProfileModal();
  });
};

// Auto-price support and table rendering helpers.
const resetCashSaleForm = () => {
  const form = document.getElementById("cashSaleForm");
  form?.reset();
  const status = document.getElementById("cashStatus");
  if (status) status.textContent = "";
};

const resetCreditSaleForm = () => {
  const form = document.getElementById("creditSaleForm");
  form?.reset();
  const status = document.getElementById("creditStatus");
  if (status) status.textContent = "";
};

const fetchSaleQuote = async (produceName, tonnageKg) => {
  const params = new URLSearchParams({
    produceName: String(produceName || "").trim(),
    tonnageKg: String(tonnageKg || ""),
  });
  const res = await apiFetch(`/sales/price-quote?${params.toString()}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || "Failed to fetch price quote.");
  }
  return body.quote;
};

const setupAutoAmountCalculation = ({ formId, amountName, statusId }) => {
  const form = document.getElementById(formId);
  if (!form) return;

  const produceInput = form.elements.produceName;
  const tonnageInput = form.elements.tonnageKg;
  const amountInput = form.elements[amountName];
  const statusEl = document.getElementById(statusId);

  const update = async () => {
    const produceName = produceInput?.value?.trim() || "";
    const tonnageKg = Number(tonnageInput?.value || 0);

    if (!produceName || !tonnageKg) {
      if (amountInput) amountInput.value = "";
      return;
    }

    try {
      const quote = await fetchSaleQuote(produceName, tonnageKg);
      if (amountInput) amountInput.value = String(quote.amount);
      if (statusEl && !statusEl.textContent.startsWith("Saving")) {
        statusEl.textContent = `Auto-priced at UGX ${formatNumber(quote.unitPrice)} per KG.`;
      }
    } catch (error) {
      if (amountInput) amountInput.value = "";
      if (statusEl && !statusEl.textContent.startsWith("Saving")) {
        statusEl.textContent = error.message;
      }
    }
  };

  produceInput?.addEventListener("input", () => {
    update().catch(() => {});
  });
  tonnageInput?.addEventListener("input", () => {
    update().catch(() => {});
  });
};

const setNavSection = (targetId) => {
  const navItems = document.querySelectorAll(".nav-item[data-target]");
  const sections = document.querySelectorAll(".view-section");

  navItems.forEach((item) => {
    item.classList.toggle("active", item.getAttribute("data-target") === targetId);
  });

  sections.forEach((section) => {
    section.classList.toggle("active", section.id === targetId);
  });
};

const renderRows = (rows) => {
  const tableBody = document.getElementById("recordsTableBody");

  if (!tableBody) return;

  if (!rows.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; color:#64748b;">No sales records found.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = rows
    .map((row) => {
      const isCash = row.type === "Cash";
      const typeClass = isCash
        ? "status-pill bg-emerald-light text-emerald"
        : "status-pill bg-blue-light text-blue";

      const statusClass = isCash
        ? "status-pill bg-emerald-light text-emerald"
        : row.status?.toLowerCase?.() === "paid"
          ? "status-pill bg-emerald-light text-emerald"
          : "status-pill bg-amber-light text-amber";

      const statusText = isCash
        ? "Paid"
        : `${row.status || "Pending"} (Due: ${row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "N/A"})`;

      return `
        <tr>
          <td><span class="${typeClass}">${escapeHtml(row.type)}</span></td>
          <td>${escapeHtml(row.produceName)}</td>
          <td>${escapeHtml(row.buyerName)}</td>
          <td>${escapeHtml(row.tonnageKg)}</td>
          <td>${formatNumber(row.amount)}</td>
          <td><span class="${statusClass}">${escapeHtml(statusText)}</span></td>
          <td>${row.date ? new Date(row.date).toLocaleString() : "-"}</td>
        </tr>
      `;
    })
    .join("");
};

const applySearchFilter = () => {
  const searchInput = document.getElementById("recordSearch");
  const search = searchInput?.value?.trim().toLowerCase() || "";

  if (!search) {
    renderRows(allRowsCache);
    return;
  }

  const filteredRows = allRowsCache.filter((row) => {
    const haystack = [row.type, row.produceName, row.buyerName, row.status]
      .map((v) => String(v || "").toLowerCase())
      .join(" ");

    return haystack.includes(search);
  });

  renderRows(filteredRows);
};

// Loads sales-agent data and updates overview + records tables.
const loadDashboard = async () => {
  const recordsStatus = document.getElementById("recordsStatus");

  if (recordsStatus) {
    recordsStatus.textContent = "Loading sales records...";
  }

  const [meRes, salesRes] = await Promise.all([
    apiFetch("/auth/me"),
    apiFetch("/sales/records?type=all"),
  ]);

  if (!meRes.ok) {
    window.location.href = "/login";
    return;
  }

  if (!salesRes.ok) {
    const errorBody = await salesRes.json().catch(() => ({}));
    throw new Error(errorBody.message || "Failed to fetch sales records");
  }

  const meData = await meRes.json();
  const salesData = await salesRes.json();

  const user = meData.user || {};
  authenticatedUser = user;
  applyProfileHeader(user);

  const cashSales = salesData.cashSales || [];
  const creditSales = salesData.creditSales || [];

  const totalCash = cashSales.reduce((sum, sale) => sum + (sale.amountPaid || 0), 0);
  const totalCredit = creditSales.reduce((sum, sale) => sum + (sale.amountDue || 0), 0);

  document.getElementById("cashCount").textContent = String(cashSales.length);
  document.getElementById("creditCount").textContent = String(creditSales.length);
  document.getElementById("cashTotal").textContent = formatNumber(totalCash);
  document.getElementById("creditTotal").textContent = formatNumber(totalCredit);

  const cashRows = cashSales.map((sale) => ({
    type: "Cash",
    produceName: sale.produceName,
    buyerName: sale.buyerName,
    tonnageKg: sale.tonnageKg,
    amount: sale.amountPaid,
    status: "Paid",
    date: sale.date,
  }));

  const creditRows = creditSales.map((sale) => ({
    type: "Credit",
    produceName: sale.produceName,
    buyerName: sale.buyerName,
    tonnageKg: sale.tonnageKg,
    amount: sale.amountDue,
    status: sale.status || "Pending",
    dueDate: sale.dueDate,
    date: sale.date,
  }));

  allRowsCache = [...cashRows, ...creditRows].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  applySearchFilter();

  if (recordsStatus) {
    recordsStatus.textContent = "";
  }
};

// Form submit handlers for cash/credit sales.
const handleCashSubmit = async (event) => {
  event.preventDefault();
  const status = document.getElementById("cashStatus");
  const form = event.currentTarget;

  if (status) status.textContent = "Saving cash sale...";

  const payload = {
    produceName: form.produceName.value.trim(),
    buyerName: form.buyerName.value.trim(),
    tonnageKg: Number(form.tonnageKg.value),
    date: toIsoFromDateTimeLocal(form.date.value),
  };

  const res = await apiFetch("/sales/cash", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (status) status.textContent = body.message || "Failed to save cash sale";
    return;
  }

  form.reset();
  if (status) status.textContent = "";
  closeSaleModal("cashSaleModal");
  await loadDashboard();
  const recordsStatus = document.getElementById("recordsStatus");
  if (recordsStatus) recordsStatus.textContent = "Cash sale saved.";
  setNavSection("records");
};

const handleCreditSubmit = async (event) => {
  event.preventDefault();
  const status = document.getElementById("creditStatus");
  const form = event.currentTarget;

  if (status) status.textContent = "Saving credit sale...";

  const payload = {
    produceName: form.produceName.value.trim(),
    buyerName: form.buyerName.value.trim(),
    tonnageKg: Number(form.tonnageKg.value),
    buyerNIN: form.buyerNIN.value.trim(),
    buyerContact: form.buyerContact.value.trim(),
    buyerLocation: form.buyerLocation.value.trim(),
    dueDate: form.dueDate.value,
  };

  const res = await apiFetch("/sales/credit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (status) status.textContent = body.message || "Failed to save credit sale";
    return;
  }

  form.reset();
  if (status) status.textContent = "";
  closeSaleModal("creditSaleModal");
  await loadDashboard();
  const recordsStatus = document.getElementById("recordsStatus");
  if (recordsStatus) recordsStatus.textContent = "Credit sale saved.";
  setNavSection("records");
};

// Entry point: register UI events and fetch initial dashboard data.
document.addEventListener("DOMContentLoaded", async () => {
  const navItems = document.querySelectorAll(".nav-item[data-target]");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const targetId = item.getAttribute("data-target");
      if (!targetId) return;
      setNavSection(targetId);
    });
  });

  document.getElementById("recordSearch")?.addEventListener("input", applySearchFilter);
  setupAutoAmountCalculation({
    formId: "cashSaleForm",
    amountName: "amountPaid",
    statusId: "cashStatus",
  });
  setupAutoAmountCalculation({
    formId: "creditSaleForm",
    amountName: "amountDue",
    statusId: "creditStatus",
  });

  document.getElementById("logoutButton")?.addEventListener("click", () => {
    window.location.href = "/logout";
  });

  setupProfileMenu();

  document.getElementById("cashSaleForm")?.addEventListener("submit", (event) => {
    handleCashSubmit(event).catch((error) => {
      const status = document.getElementById("cashStatus");
      if (status) status.textContent = error.message;
    });
  });

  document.getElementById("creditSaleForm")?.addEventListener("submit", (event) => {
    handleCreditSubmit(event).catch((error) => {
      const status = document.getElementById("creditStatus");
      if (status) status.textContent = error.message;
    });
  });

  document.getElementById("openCashSaleModalButton")?.addEventListener("click", () => {
    resetCashSaleForm();
    openSaleModal("cashSaleModal");
  });

  document.getElementById("closeCashSaleModalButton")?.addEventListener("click", () => {
    closeSaleModal("cashSaleModal");
  });

  document.getElementById("cancelCashSaleModalButton")?.addEventListener("click", () => {
    closeSaleModal("cashSaleModal");
  });

  document.getElementById("openCreditSaleModalButton")?.addEventListener("click", () => {
    resetCreditSaleForm();
    openSaleModal("creditSaleModal");
  });

  document.getElementById("closeCreditSaleModalButton")?.addEventListener("click", () => {
    closeSaleModal("creditSaleModal");
  });

  document.getElementById("cancelCreditSaleModalButton")?.addEventListener("click", () => {
    closeSaleModal("creditSaleModal");
  });

  document.getElementById("cashSaleModal")?.addEventListener("click", (event) => {
    if (event.target.id === "cashSaleModal") {
      closeSaleModal("cashSaleModal");
    }
  });

  document.getElementById("creditSaleModal")?.addEventListener("click", (event) => {
    if (event.target.id === "creditSaleModal") {
      closeSaleModal("creditSaleModal");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !activeSaleModalId) return;
    closeSaleModal(activeSaleModalId);
  });

  try {
    await loadDashboard();
  } catch (error) {
    const recordsStatus = document.getElementById("recordsStatus");
    if (recordsStatus) recordsStatus.textContent = error.message;
  }
});
