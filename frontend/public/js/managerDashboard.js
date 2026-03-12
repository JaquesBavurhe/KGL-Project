// Core formatter/API utilities shared across manager dashboard actions.
const formatNumber = (value) => new Intl.NumberFormat("en-UG").format(value || 0);
const API_BASE_URL = "https://kgl-backend-2-5od0.onrender.com";
// const API_BASE_URL = "http://localhost:3000";
const buildApiUrl = (url) =>
  /^https?:\/\//i.test(url)
    ? url
    : `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
const apiFetch = async (url, options = {}) => {
  const { showLoader = true, loadingMessage = "Loading...", ...fetchOptions } = options;
  if (showLoader && window.AppLoader) {
    window.AppLoader.show(loadingMessage);
  }
  try {
    return await fetch(buildApiUrl(url), { credentials: "include", ...fetchOptions });
  } finally {
    if (showLoader && window.AppLoader) {
      window.AppLoader.hide();
    }
  }
};
const redirectToLoginPage = () => {
  window.location.href = "/login.html";
};

// Attempts server logout, then always returns user to login.
const logoutAndRedirect = async () => {
  try {
    await apiFetch("/logout");
  } catch (_) {
    // Ignore logout API errors and still return to login page.
  }
  redirectToLoginPage();
};

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

let salesRowsCache = [];
let procurementRowsCache = [];
let alertsCache = [];
let activeManagerModalId = null;
let editingProcurementId = null;
let pendingDeleteProcurementId = null;
let authenticatedUser = null;

// Generic modal open/close helpers used by sale/procurement/delete dialogs.
const openManagerModal = (modalId) => {
  activeManagerModalId = modalId;
  document.getElementById(modalId)?.classList.add("open");
};

const closeManagerModal = (modalId) => {
  document.getElementById(modalId)?.classList.remove("open");
  if (activeManagerModalId === modalId) {
    activeManagerModalId = null;
  }
};

// Resets modal fields and any transient status messages before reopening forms.
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

const resetProcurementForm = () => {
  const form = document.getElementById("procurementForm");
  form?.reset();
  editingProcurementId = null;
  const title = document.getElementById("procurementModalTitle");
  const submitButton = document.getElementById("procurementSubmitButton");
  if (title) title.textContent = "New Procurement";
  if (submitButton) submitButton.textContent = "Save Procurement";
  const status = document.getElementById("procurementStatus");
  if (status) status.textContent = "";
};

// Converts API date strings back into `datetime-local` format for edit mode.
const toDateTimeLocalInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

const openDeleteProcurementModal = () => {
  openManagerModal("deleteProcurementModal");
};

const closeDeleteProcurementModal = () => {
  closeManagerModal("deleteProcurementModal");
  pendingDeleteProcurementId = null;
};

// Syncs manager header labels with the latest authenticated user details.
const applyProfileHeader = (user) => {
  if (!user) return;
  const displayName = user.fullName || user.username || "Manager";
  const role = user.role || "Manager";
  const branch = user.branch || "N/A";

  const profileName = document.getElementById("profileName");
  const profileMeta = document.getElementById("profileMeta");
  const overviewGreeting = document.getElementById("overviewGreeting");
  const userContext = document.getElementById("userContext");

  if (profileName) profileName.textContent = displayName;
  if (profileMeta) profileMeta.textContent = `${role} - ${branch}`;
  if (overviewGreeting) overviewGreeting.innerHTML = `Welcome, ${role} <br> ${displayName}`;
  if (userContext) {
    userContext.textContent =
      `Branch dashboard for ${branch}. Record sales, track procurement, and monitor inventory.`;
  }
};

// Wires profile dropdown actions and in-place profile update form.
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

  logoutFromMenuButton?.addEventListener("click", async () => {
    await logoutAndRedirect();
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

// Requests live sale quote from backend for amount auto-calculation.
const fetchSaleQuote = async (produceName, tonnageKg) => {
  const params = new URLSearchParams({
    produceName: String(produceName || "").trim(),
    tonnageKg: String(tonnageKg || ""),
  });
  const res = await apiFetch(`/sales/price-quote?${params.toString()}`, { showLoader: false });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || "Failed to fetch price quote.");
  }
  return body.quote;
};

// Auto-fills amount fields when produce or tonnage changes in sale forms.
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

    // Skip quote requests until both required inputs are present.
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

// Renders sales table rows for combined cash + credit records.
const renderSalesRows = (rows) => {
  const body = document.getElementById("salesRecordsBody");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b;">No sales records found.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((row) => {
      const statusClass =
        row.type === "Cash" || row.status === "Paid"
          ? "status-pill bg-emerald-light text-emerald"
          : "status-pill bg-amber-light text-amber";

      return `
        <tr>
          <td>${escapeHtml(row.type)}</td>
          <td>${escapeHtml(row.produceName)}</td>
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.tonnageKg)}</td>
          <td>${formatNumber(row.amount)}</td>
          <td><span class="${statusClass}">${escapeHtml(row.status)}</span></td>
          <td>${row.date ? new Date(row.date).toLocaleString() : "-"}</td>
        </tr>
      `;
    })
    .join("");
};

// Renders procurement records table with edit/delete action buttons.
const renderProcurementRows = (rows) => {
  const body = document.getElementById("procurementRecordsBody");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b;">No procurement records found.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.produceName)}</td>
        <td>${escapeHtml(row.produceType)}</td>
        <td>${formatNumber(row.tonnage)}</td>
        <td>${formatNumber(row.cost)}</td>
        <td>${escapeHtml(row.dealerName)}</td>
        <td>${row.date ? new Date(row.date).toLocaleString() : "-"}</td>
        <td>
          <button class="icon-btn edit procurement-edit-btn" data-id="${row._id}" type="button" aria-label="Edit procurement">
            <span class="material-symbols-outlined">edit</span>
          </button>
          <button class="icon-btn delete procurement-delete-btn" data-id="${row._id}" type="button" aria-label="Delete procurement">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </td>
      </tr>
    `,
    )
    .join("");
};

// Applies a single search query across both sales and procurement datasets.
const applySearchFilter = () => {
  const search = (document.getElementById("recordSearch")?.value || "")
    .trim()
    .toLowerCase();

  if (!search) {
    renderSalesRows(salesRowsCache);
    renderProcurementRows(procurementRowsCache);
    return;
  }

  const filteredSales = salesRowsCache.filter((row) =>
    [row.type, row.produceName, row.name, row.status]
      .map((v) => String(v || "").toLowerCase())
      .join(" ")
      .includes(search),
  );

  const filteredProcurement = procurementRowsCache.filter((row) =>
    [row.produceName, row.produceType, row.dealerName]
      .map((v) => String(v || "").toLowerCase())
      .join(" ")
      .includes(search),
  );

  renderSalesRows(filteredSales);
  renderProcurementRows(filteredProcurement);
};

// Renders top-right notification panel using stock-alert payloads.
const renderNotificationPanel = () => {
  const badge = document.getElementById("notificationBadge");
  const list = document.getElementById("notificationList");
  if (!badge || !list) return;

  const count = alertsCache.length;
  badge.style.display = count ? "inline-block" : "none";
  badge.textContent = String(count > 99 ? "99+" : count);

  if (!count) {
    list.innerHTML =
      '<div style="font-size:12px; color:#64748b; padding:8px;">No active stock alerts.</div>';
    return;
  }

  list.innerHTML = alertsCache
    .map((alert) => {
      const tone =
        alert.type === "out_of_stock"
          ? "background:#fff1f2; border:1px solid #fecdd3;"
          : "background:#fffbeb; border:1px solid #fde68a;";
      return `
        <div style="border-radius:10px; padding:10px; ${tone}">
          <p style="margin:0; font-size:12px; font-weight:700; color:#0f172a;">${escapeHtml(alert.produceName || "Item")}</p>
          <p style="margin:4px 0 0 0; font-size:11px; color:#475569;">${escapeHtml(alert.message || "")}</p>
        </div>
      `;
    })
    .join("");
};

// Loads all manager dashboard resources and hydrates UI.
const loadManagerDashboard = async () => {
  // Fetch all dashboard dependencies together to reduce load time.
  const [meRes, salesRes, procurementSummaryRes, procurementRecordsRes, stockRes, alertsRes] =
    await Promise.all([
      apiFetch("/auth/me"),
      apiFetch("/sales/records?type=all"),
      apiFetch("/procurement/summary"),
      apiFetch("/procurement/records"),
      apiFetch("/stock/summary"),
      apiFetch("/stock/alerts"),
    ]);

  // Redirect unauthenticated users before processing dashboard payloads.
  if (!meRes.ok) {
    redirectToLoginPage();
    return;
  }

  // Authorization guard in case session belongs to a non-manager role.
  if (
    salesRes.status === 403 ||
    procurementSummaryRes.status === 403 ||
    procurementRecordsRes.status === 403 ||
    stockRes.status === 403 ||
    alertsRes.status === 403
  ) {
    throw new Error("Only managers can view this dashboard.");
  }

  // Prevent partial rendering when one of the core dashboard resources fails.
  if (
    !salesRes.ok ||
    !procurementSummaryRes.ok ||
    !procurementRecordsRes.ok ||
    !stockRes.ok ||
    !alertsRes.ok
  ) {
    throw new Error("Failed to load manager dashboard data.");
  }

  const meData = await meRes.json();
  const salesData = await salesRes.json();
  const procurementSummaryData = await procurementSummaryRes.json();
  const procurementRecordsData = await procurementRecordsRes.json();
  const stockData = await stockRes.json();
  const alertsData = await alertsRes.json();
  // Persist alert list for badge/panel rendering.
  alertsCache = alertsData.alerts || [];
  renderNotificationPanel();

  const user = meData.user || {};
  authenticatedUser = user;
  applyProfileHeader(user);

  const cashSales = salesData.cashSales || [];
  const creditSales = salesData.creditSales || [];
  const procurementRows = procurementRecordsData.records || [];

  // Flatten cash + credit records into a shared table model for search/render.
  salesRowsCache = [
    ...cashSales.map((sale) => ({
      type: "Cash",
      produceName: sale.produceName,
      name: sale.buyerName,
      tonnageKg: sale.tonnageKg,
      amount: sale.amountPaid,
      status: "Paid",
      date: sale.date,
    })),
    ...creditSales.map((sale) => ({
      type: "Credit",
      produceName: sale.produceName,
      name: sale.buyerName,
      tonnageKg: sale.tonnageKg,
      amount: sale.amountDue,
      status: sale.status || "Pending",
      date: sale.date,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Keep newest entries first for both sales and procurement logs.
  procurementRowsCache = [...procurementRows].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  document.getElementById("cashCount").textContent = String(cashSales.length);
  document.getElementById("creditCount").textContent = String(creditSales.length);
  document.getElementById("procurementCount").textContent = String(
    procurementSummaryData.totals?.totalProcurements || 0,
  );
  document.getElementById("stockQty").textContent = formatNumber(
    stockData.totals?.totalQuantityKg || 0,
  );

  document.getElementById("stockItems").textContent = formatNumber(
    stockData.totals?.totalItems || 0,
  );
  document.getElementById("stockQuantity").textContent = formatNumber(
    stockData.totals?.totalQuantityKg || 0,
  );
  document.getElementById("stockValue").textContent = formatNumber(
    stockData.totals?.totalStockValue || 0,
  );
  document.getElementById("lowStockCount").textContent = formatNumber(
    (stockData.lowStockItems || []).length,
  );

  const lowStockBody = document.getElementById("lowStockBody");
  const lowStockItems = stockData.lowStockItems || [];
  lowStockBody.innerHTML = lowStockItems.length
    ? lowStockItems
      .map(
        (row) => `
      <tr>
        <td>${escapeHtml(row.produceName)}</td>
        <td>${escapeHtml(row.produceType)}</td>
        <td>${formatNumber(row.quantity)}</td>
        <td>${formatNumber(row.sellingPrice)}</td>
      </tr>
    `,
      )
      .join("")
    : '<tr><td colspan="4" style="text-align:center; color:#64748b;">No low stock items found.</td></tr>';

  // Build compact alert summary line shown in stock section footer.
  const alertPreview = (alertsData.alerts || [])
    .slice(0, 2)
    .map((alert) => alert.message)
    .join(" | ");
  const alertText = alertsData.totalAlerts
    ? `Alerts: ${alertsData.totalAlerts} (${alertsData.criticalAlerts} critical). ${alertPreview}`
    : "No active stock alerts.";

  document.getElementById("stockStatus").textContent =
    `Low stock threshold: ${formatNumber(stockData.thresholdKg || 100)} KG. ${alertText}`;

  renderSalesRows(salesRowsCache);
  renderProcurementRows(procurementRowsCache);
  document.getElementById("recordsStatus").textContent = "";
};

// Handles cash-sale submission lifecycle: save -> reload dashboard -> return to records view.
const handleCashSubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("cashStatus");

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
  closeManagerModal("cashSaleModal");
  await loadManagerDashboard();
  const recordsStatus = document.getElementById("recordsStatus");
  if (recordsStatus) recordsStatus.textContent = "Cash sale saved.";
  setNavSection("records");
};

// Handles credit-sale submission with identical post-save refresh behavior.
const handleCreditSubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("creditStatus");

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
  closeManagerModal("creditSaleModal");
  await loadManagerDashboard();
  const recordsStatus = document.getElementById("recordsStatus");
  if (recordsStatus) recordsStatus.textContent = "Credit sale saved.";
  setNavSection("records");
};

// Handles create/update procurement submit based on current edit mode state.
const handleProcurementSubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("procurementStatus");
  const isEditing = Boolean(editingProcurementId);

  if (status) status.textContent = isEditing ? "Updating procurement..." : "Saving procurement...";

  const payload = {
    produceName: form.produceName.value.trim(),
    produceType: form.produceType.value.trim(),
    tonnage: Number(form.tonnage.value),
    cost: Number(form.cost.value),
    dealerName: form.dealerName.value.trim(),
    dealerContact: form.dealerContact.value.trim(),
    sellingPrice: Number(form.sellingPrice.value),
    date: toIsoFromDateTimeLocal(form.date.value),
  };

  const res = await apiFetch(isEditing ? `/procurement/${editingProcurementId}` : "/procurement", {
    method: isEditing ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (status) status.textContent = body.message || `Failed to ${isEditing ? "update" : "save"} procurement`;
    return;
  }

  form.reset();
  if (status) status.textContent = "";
  closeManagerModal("procurementModal");
  await loadManagerDashboard();
  const recordsStatus = document.getElementById("recordsStatus");
  if (recordsStatus) {
    recordsStatus.textContent = body.message || (isEditing ? "Procurement updated." : "Procurement saved.");
  }
  setNavSection("records");
};

// Pre-fills procurement modal from selected table row and switches to edit mode.
const startEditProcurement = (id) => {
  const target = procurementRowsCache.find((row) => String(row._id) === String(id));
  if (!target) return;

  const form = document.getElementById("procurementForm");
  if (!form) return;

  editingProcurementId = String(target._id);
  form.produceName.value = target.produceName || "";
  form.produceType.value = target.produceType || "";
  form.tonnage.value = target.tonnage ?? "";
  form.cost.value = target.cost ?? "";
  form.dealerName.value = target.dealerName || "";
  form.dealerContact.value = target.dealerContact || "";
  form.sellingPrice.value = target.sellingPrice ?? "";
  form.date.value = toDateTimeLocalInputValue(target.date);

  const title = document.getElementById("procurementModalTitle");
  const submitButton = document.getElementById("procurementSubmitButton");
  const status = document.getElementById("procurementStatus");
  if (title) title.textContent = "Edit Procurement";
  if (submitButton) submitButton.textContent = "Update Procurement";
  if (status) status.textContent = "";

  openManagerModal("procurementModal");
  setNavSection("procurement");
};

// Opens destructive-action confirmation modal for procurement deletion.
const promptDeleteProcurement = (id) => {
  const target = procurementRowsCache.find((row) => String(row._id) === String(id));
  if (!target) return;

  pendingDeleteProcurementId = String(id);
  const text = document.getElementById("deleteProcurementModalText");
  if (text) {
    text.textContent = `Delete procurement for "${target.produceName || "produce"}" from dealer "${target.dealerName || "-"}"? This action cannot be undone.`;
  }
  openDeleteProcurementModal();
};

// Deletes selected procurement record and refreshes dashboard caches.
const handleDeleteProcurement = async (id) => {
  const recordsStatus = document.getElementById("recordsStatus");
  if (recordsStatus) recordsStatus.textContent = "Deleting procurement...";

  const response = await apiFetch(`/procurement/${id}`, { method: "DELETE" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (recordsStatus) recordsStatus.textContent = result.message || "Failed to delete procurement.";
    return;
  }

  await loadManagerDashboard();
  const latestStatus = document.getElementById("recordsStatus");
  if (latestStatus) latestStatus.textContent = result.message || "Procurement deleted successfully.";
};

// Entry point: register event listeners and fetch initial data.
document.addEventListener("DOMContentLoaded", async () => {
  // Sidebar navigation tab switching.
  document.querySelectorAll(".nav-item[data-target]").forEach((item) => {
    item.addEventListener("click", () => {
      const targetId = item.getAttribute("data-target");
      if (!targetId) return;
      setNavSection(targetId);
    });
  });

  // Search + auto-pricing behavior.
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

  // Lightweight notification panel toggle (data already fetched on dashboard load).
  const notificationToggle = document.getElementById("notificationToggle");
  const notificationPanel = document.getElementById("notificationPanel");
  notificationToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!notificationPanel) return;
    notificationPanel.style.display =
      notificationPanel.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", (event) => {
    if (!notificationPanel || !notificationToggle) return;
    if (
      notificationPanel.style.display === "block" &&
      !notificationPanel.contains(event.target) &&
      !notificationToggle.contains(event.target)
    ) {
      notificationPanel.style.display = "none";
    }
  });

  // Top-level account/logout interactions.
  document.getElementById("logoutButton")?.addEventListener("click", async () => {
    await logoutAndRedirect();
  });

  setupProfileMenu();

  // Form submit handlers.
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

  document.getElementById("procurementForm")?.addEventListener("submit", (event) => {
    handleProcurementSubmit(event).catch((error) => {
      const status = document.getElementById("procurementStatus");
      if (status) status.textContent = error.message;
    });
  });

  // Open/close actions for each modal.
  document.getElementById("openCashSaleModalButton")?.addEventListener("click", () => {
    resetCashSaleForm();
    openManagerModal("cashSaleModal");
  });
  document.getElementById("closeCashSaleModalButton")?.addEventListener("click", () => {
    closeManagerModal("cashSaleModal");
  });
  document.getElementById("cancelCashSaleModalButton")?.addEventListener("click", () => {
    closeManagerModal("cashSaleModal");
  });

  document.getElementById("openCreditSaleModalButton")?.addEventListener("click", () => {
    resetCreditSaleForm();
    openManagerModal("creditSaleModal");
  });
  document.getElementById("closeCreditSaleModalButton")?.addEventListener("click", () => {
    closeManagerModal("creditSaleModal");
  });
  document.getElementById("cancelCreditSaleModalButton")?.addEventListener("click", () => {
    closeManagerModal("creditSaleModal");
  });

  document.getElementById("openProcurementModalButton")?.addEventListener("click", () => {
    resetProcurementForm();
    openManagerModal("procurementModal");
  });
  document.getElementById("closeProcurementModalButton")?.addEventListener("click", () => {
    closeManagerModal("procurementModal");
  });
  document.getElementById("cancelProcurementModalButton")?.addEventListener("click", () => {
    resetProcurementForm();
    closeManagerModal("procurementModal");
  });

  // Close modals when backdrop is clicked.
  document.getElementById("cashSaleModal")?.addEventListener("click", (event) => {
    if (event.target.id === "cashSaleModal") {
      closeManagerModal("cashSaleModal");
    }
  });
  document.getElementById("creditSaleModal")?.addEventListener("click", (event) => {
    if (event.target.id === "creditSaleModal") {
      closeManagerModal("creditSaleModal");
    }
  });
  document.getElementById("procurementModal")?.addEventListener("click", (event) => {
    if (event.target.id === "procurementModal") {
      resetProcurementForm();
      closeManagerModal("procurementModal");
    }
  });

  // Table row actions for procurement edit/delete.
  document.getElementById("procurementRecordsBody")?.addEventListener("click", (event) => {
    const editButton = event.target.closest(".procurement-edit-btn");
    const deleteButton = event.target.closest(".procurement-delete-btn");

    if (editButton) {
      startEditProcurement(editButton.dataset.id);
    }

    if (deleteButton) {
      promptDeleteProcurement(deleteButton.dataset.id);
    }
  });

  // Confirmation modal actions for procurement deletion.
  document.getElementById("closeDeleteProcurementModalButton")?.addEventListener("click", () => {
    closeDeleteProcurementModal();
  });
  document.getElementById("cancelDeleteProcurementButton")?.addEventListener("click", () => {
    closeDeleteProcurementModal();
  });
  document.getElementById("confirmDeleteProcurementButton")?.addEventListener("click", async () => {
    if (!pendingDeleteProcurementId) {
      closeDeleteProcurementModal();
      return;
    }

    const idToDelete = pendingDeleteProcurementId;
    closeDeleteProcurementModal();
    try {
      await handleDeleteProcurement(idToDelete);
    } catch (error) {
      const recordsStatus = document.getElementById("recordsStatus");
      if (recordsStatus) recordsStatus.textContent = error.message;
    }
  });
  document.getElementById("deleteProcurementModal")?.addEventListener("click", (event) => {
    if (event.target.id === "deleteProcurementModal") {
      closeDeleteProcurementModal();
    }
  });

  // Global ESC handling closes whichever manager modal is currently active.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !activeManagerModalId) return;
    closeManagerModal(activeManagerModalId);
  });

  // Initial dashboard hydration.
  try {
    await loadManagerDashboard();
  } catch (error) {
    const recordsStatus = document.getElementById("recordsStatus");
    if (recordsStatus) recordsStatus.textContent = error.message;
  }
});
