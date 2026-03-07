const formatNumber = (value) => new Intl.NumberFormat("en-UG").format(value || 0);
const apiFetch = (url, options = {}) => fetch(url, { credentials: "include", ...options });
let directorUserId = null;
let managedUsers = [];
let pendingDeleteUserId = null;
let authenticatedUser = null;
let notificationsCache = [];
let unreadNotifications = 0;

// Shared helpers for safe date parsing and HTML escaping.
const toDateSafe = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

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

// Aggregation/render helpers for dashboard overview cards and tables.
const buildSalesRows = (cashSales, creditSales) => {
  const cashRows = (cashSales || []).map((sale) => ({
    id: sale._id,
    date: sale.date,
    branch: sale.branch || "Unknown",
    produceName: sale.produceName || "-",
    amount: sale.amountPaid || 0,
    tonnageKg: sale.tonnageKg || 0,
    buyerName: sale.buyerName || "-",
    type: "Cash",
    status: "Completed",
    dueDate: null,
  }));

  const creditRows = (creditSales || []).map((sale) => ({
    id: sale._id,
    date: sale.date,
    branch: sale.branch || "Unknown",
    produceName: sale.produceName || "-",
    amount: sale.amountDue || 0,
    tonnageKg: sale.tonnageKg || 0,
    buyerName: sale.buyerName || "-",
    type: "Credit",
    status: sale.status || "Pending",
    dueDate: sale.dueDate || null,
  }));

  return [...cashRows, ...creditRows].sort(
    (a, b) => (toDateSafe(b.date)?.getTime() || 0) - (toDateSafe(a.date)?.getTime() || 0),
  );
};

const renderSalesByBranch = (rows) => {
  const container = document.getElementById("salesByBranchContainer");
  if (!container) return;

  const byBranch = rows.reduce((acc, row) => {
    acc[row.branch] = (acc[row.branch] || 0) + (row.amount || 0);
    return acc;
  }, {});

  const entries = Object.entries(byBranch).sort((a, b) => b[1] - a[1]);
  const maxAmount = entries.length ? entries[0][1] : 0;

  if (!entries.length) {
    container.innerHTML = '<p class="status">No branch sales found.</p>';
    return;
  }

  container.innerHTML = entries
    .map(([branch, amount], index) => {
      const width = maxAmount > 0 ? Math.max(5, (amount / maxAmount) * 100) : 0;
      const color = index % 2 === 0 ? "var(--primary)" : "var(--blue)";

      return `
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
          <span>${branch}</span>
          <b>${formatNumber(amount)}</b>
        </div>
        <div class="progress-track" style="margin-bottom: 12px;">
          <div class="progress-fill" style="width: ${width}%; background: ${color};"></div>
        </div>
      `;
    })
    .join("");
};

const renderTopProduceByValue = (rows) => {
  const container = document.getElementById("topProduceContainer");
  if (!container) return;

  const totals = rows.reduce((acc, row) => {
    const key = row.produceName || "Unknown";
    acc[key] = (acc[key] || 0) + (row.amount || 0);
    return acc;
  }, {});

  const entries = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!entries.length) {
    container.innerHTML = '<p class="status">No produce sales found.</p>';
    return;
  }

  container.innerHTML = entries
    .map(
      ([produce, value]) => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span>${produce}</span>
        <b class="text-emerald">${formatNumber(value)}</b>
      </div>
    `,
    )
    .join("");
};

const renderRecentSalesLog = (rows) => {
  const body = document.getElementById("recentSalesBody");
  if (!body) return;

  const topRows = rows.slice(0, 12);

  if (!topRows.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">No recent sales available.</td></tr>';
    return;
  }

  body.innerHTML = topRows
    .map((row) => {
      const dt = toDateSafe(row.date);
      const dateLabel = dt ? dt.toLocaleDateString() : "-";
      const idLabel = row.id ? `#${String(row.id).slice(-6)}` : "-";
      const statusClass = row.type === "Cash" || row.status === "Paid"
        ? "status-pill bg-emerald-light text-emerald"
        : "status-pill bg-amber-light text-amber";

      return `
        <tr>
          <td>${dateLabel}</td>
          <td>${idLabel}</td>
          <td>${row.branch}</td>
          <td>${row.produceName}</td>
          <td>${formatNumber(row.amount)}</td>
          <td><span class="${statusClass}">${row.status}</span></td>
        </tr>
      `;
    })
    .join("");
};

const renderCreditBreakdown = (creditSales) => {
  const issued = (creditSales || []).reduce((sum, sale) => sum + (sale.amountDue || 0), 0);
  const unpaid = (creditSales || [])
    .filter((sale) => sale.status !== "Paid")
    .reduce((sum, sale) => sum + (sale.amountDue || 0), 0);

  const now = new Date();
  const overdueSales = (creditSales || []).filter((sale) => {
    if (sale.status === "Paid") return false;
    const due = toDateSafe(sale.dueDate);
    return due ? due < now : false;
  });

  const overdue = overdueSales.reduce((sum, sale) => sum + (sale.amountDue || 0), 0);

  document.getElementById("creditIssued").textContent = formatNumber(issued);
  document.getElementById("creditUnpaid").textContent = formatNumber(unpaid);
  document.getElementById("creditOverdue").textContent = formatNumber(overdue);

  const branchTotals = (creditSales || []).reduce((acc, sale) => {
    const branch = sale.branch || "Unknown";
    acc[branch] = (acc[branch] || 0) + (sale.amountDue || 0);
    return acc;
  }, {});

  const creditByBranchContainer = document.getElementById("creditByBranchContainer");
  const branchEntries = Object.entries(branchTotals);

  creditByBranchContainer.innerHTML = branchEntries.length
    ? branchEntries
      .map(
        ([branch, amount]) => `
        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
          <span>${branch}</span>
          <b>${formatNumber(amount)}</b>
        </div>
      `,
      )
      .join("")
    : '<p class="status">No credit sales found.</p>';

  const debtorsBody = document.getElementById("debtorsBody");

  if (!overdueSales.length) {
    debtorsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">No overdue debtors found.</td></tr>';
    return;
  }

  debtorsBody.innerHTML = overdueSales
    .sort((a, b) => (toDateSafe(a.dueDate)?.getTime() || 0) - (toDateSafe(b.dueDate)?.getTime() || 0))
    .slice(0, 10)
    .map((sale) => {
      const due = toDateSafe(sale.dueDate);
      const days = due ? Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000)) : 0;

      return `
        <tr>
          <td>${sale.buyerName || "-"}</td>
          <td>${sale.branch || "-"}</td>
          <td>${formatNumber(sale.amountDue || 0)}</td>
          <td><b class="text-rose">${days} Day${days === 1 ? "" : "s"}</b></td>
          <td><span class="status-pill bg-amber-light text-amber">${sale.status || "Pending"}</span></td>
        </tr>
      `;
    })
    .join("");

};

const renderProcurementSummary = (procurementSummary, procurementRecords) => {
  const totals = procurementSummary?.totals || {
    totalProcurements: 0,
    totalTonnageKg: 0,
    totalCost: 0,
  };
  const summaryByBranch = procurementSummary?.summaryByBranch || [];
  const summaryByProduce = procurementSummary?.summaryByProduce || [];
  const records = procurementRecords?.records || [];

  document.getElementById("procurementTotalCost").textContent = formatNumber(
    totals.totalCost || 0,
  );
  document.getElementById("procurementTotalTonnage").textContent = formatNumber(
    totals.totalTonnageKg || 0,
  );
  document.getElementById("procurementTotalRecords").textContent = formatNumber(
    totals.totalProcurements || 0,
  );

  const uniqueDealers = new Set(
    records
      .map((row) => String(row.dealerName || "").trim().toLowerCase())
      .filter(Boolean),
  );
  document.getElementById("procurementActiveDealers").textContent = formatNumber(
    uniqueDealers.size,
  );

  const byBranchContainer = document.getElementById("procurementByBranchContainer");
  const branchRows = [...summaryByBranch].sort(
    (a, b) => (b.totalCost || 0) - (a.totalCost || 0),
  );
  const maxBranchCost = branchRows.length ? branchRows[0].totalCost || 0 : 0;

  byBranchContainer.innerHTML = branchRows.length
    ? branchRows
      .map((row, index) => {
        const cost = row.totalCost || 0;
        const width = maxBranchCost > 0 ? Math.max(5, (cost / maxBranchCost) * 100) : 0;
        const color = index % 2 === 0 ? "var(--primary)" : "var(--blue)";

        return `
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span>${row._id || "Unknown"}</span>
            <b>${formatNumber(cost)}</b>
          </div>
          <div class="progress-track" style="margin-bottom: 12px;">
            <div class="progress-fill" style="width: ${width}%; background: ${color};"></div>
          </div>
        `;
      })
      .join("")
    : '<p class="status">No procurement branch summary found.</p>';

  const topProduceContainer = document.getElementById(
    "procurementTopProduceContainer",
  );
  const topProduceRows = [...summaryByProduce]
    .sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))
    .slice(0, 8);

  topProduceContainer.innerHTML = topProduceRows.length
    ? topProduceRows
      .map(
        (row) => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>${row._id || "Unknown"}</span>
            <b class="text-emerald">${formatNumber(row.totalCost || 0)}</b>
          </div>
        `,
      )
      .join("")
    : '<p class="status">No procurement produce summary found.</p>';

  const procurementTableBody = document.getElementById("procurementTableBody");
  const recentRows = [...records]
    .sort(
      (a, b) =>
        (toDateSafe(b.date)?.getTime() || 0) - (toDateSafe(a.date)?.getTime() || 0),
    )
    .slice(0, 12);

  procurementTableBody.innerHTML = recentRows.length
    ? recentRows
      .map((row) => {
        const dateLabel = toDateSafe(row.date)?.toLocaleDateString() || "-";
        return `
          <tr>
            <td>${dateLabel}</td>
            <td>${row.branch || "-"}</td>
            <td>${row.produceName || "-"}</td>
            <td>${formatNumber(row.tonnage || 0)}</td>
            <td>${formatNumber(row.cost || 0)}</td>
            <td>${row.dealerName || "-"}</td>
          </tr>
        `;
      })
      .join("")
    : '<tr><td colspan="6" style="text-align:center; color:#64748b;">No procurement records available.</td></tr>';
};

const renderStockSummary = (stockData) => {
  const {
    totals = { totalItems: 0, totalQuantityKg: 0, totalStockValue: 0 },
    stockByBranch = [],
    stockByProduce = [],
    lowStockItems = [],
    thresholdKg = 100,
  } = stockData || {};

  document.getElementById("stockTotalQuantity").textContent = formatNumber(
    totals.totalQuantityKg || 0,
  );
  document.getElementById("stockTotalValue").textContent = formatNumber(
    totals.totalStockValue || 0,
  );
  document.getElementById("stockTotalItems").textContent = formatNumber(
    totals.totalItems || 0,
  );
  document.getElementById("stockLowCount").textContent = formatNumber(
    lowStockItems.length,
  );

  const stockByBranchContainer = document.getElementById("stockByBranchContainer");
  const byBranchEntries = [...stockByBranch].sort(
    (a, b) => (b.totalQuantityKg || 0) - (a.totalQuantityKg || 0),
  );
  const maxBranchQuantity = byBranchEntries.length
    ? byBranchEntries[0].totalQuantityKg || 0
    : 0;

  stockByBranchContainer.innerHTML = byBranchEntries.length
    ? byBranchEntries
      .map((row, index) => {
        const qty = row.totalQuantityKg || 0;
        const width = maxBranchQuantity > 0 ? Math.max(5, (qty / maxBranchQuantity) * 100) : 0;
        const color = index % 2 === 0 ? "var(--primary)" : "var(--blue)";

        return `
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span>${row._id || "Unknown"}</span>
            <b>${formatNumber(qty)} KG</b>
          </div>
          <div class="progress-track" style="margin-bottom: 12px;">
            <div class="progress-fill" style="width: ${width}%; background: ${color};"></div>
          </div>
        `;
      })
      .join("")
    : '<p class="status">No branch stock records found.</p>';

  const stockByProduceContainer = document.getElementById("stockByProduceContainer");
  const byProduceEntries = [...stockByProduce]
    .sort((a, b) => (b.totalQuantityKg || 0) - (a.totalQuantityKg || 0))
    .slice(0, 8);

  stockByProduceContainer.innerHTML = byProduceEntries.length
    ? byProduceEntries
      .map(
        (row) => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>${row._id || "Unknown"}</span>
            <b>${formatNumber(row.totalQuantityKg || 0)} KG</b>
          </div>
        `,
      )
      .join("")
    : '<p class="status">No stock by produce records found.</p>';

  const lowStockBody = document.getElementById("lowStockBody");
  lowStockBody.innerHTML = lowStockItems.length
    ? lowStockItems
      .map(
        (item) => `
          <tr>
            <td>${item.produceName || "-"}</td>
            <td>${item.produceType || "-"}</td>
            <td>${item.branch || "-"}</td>
            <td>${formatNumber(item.quantity || 0)}</td>
            <td>${formatNumber(item.sellingPrice || 0)}</td>
          </tr>
        `,
      )
      .join("")
    : '<tr><td colspan="5" style="text-align:center; color:#64748b;">No low stock items found.</td></tr>';

  document.getElementById("stockStatus").textContent =
    `Low stock threshold: ${formatNumber(thresholdKg)} KG`;
};

const syncUserBranchState = () => {
  const roleField = document.getElementById("userRole");
  const branchField = document.getElementById("userBranch");
  if (!roleField || !branchField) return;

  const isDirector = roleField.value === "Director";
  branchField.disabled = isDirector;
  if (isDirector) {
    branchField.value = "";
  }
};

const resetUserForm = () => {
  document.getElementById("userId").value = "";
  document.getElementById("userFullName").value = "";
  document.getElementById("userUsername").value = "";
  document.getElementById("userPhone").value = "";
  document.getElementById("userRole").value = "";
  document.getElementById("userBranch").value = "";
  document.getElementById("userPassword").value = "";
  document.getElementById("saveUserButton").textContent = "Save User";
  document.getElementById("userModalTitle").textContent = "Add New User";
  document.getElementById("userModalStatus").textContent = "";
  syncUserBranchState();
};

const openUserModal = () => {
  document.getElementById("userModal")?.classList.add("open");
};

const closeUserModal = () => {
  document.getElementById("userModal")?.classList.remove("open");
};

const openDeleteUserModal = () => {
  document.getElementById("deleteUserModal")?.classList.add("open");
};

const closeDeleteUserModal = () => {
  document.getElementById("deleteUserModal")?.classList.remove("open");
  pendingDeleteUserId = null;
};

// Syncs top-bar/profile hero labels with the latest authenticated user info.
const applyProfileHeader = (user) => {
  if (!user) return;
  const displayName = user.fullName || user.username || "User";
  const role = (user.role || "User").toUpperCase();

  const profileName = document.getElementById("profileName");
  const profileRole = document.getElementById("profileRole");
  const overviewGreeting = document.getElementById("overviewGreeting");
  const overviewSubtext = document.getElementById("overviewSubtext");

  if (profileName) profileName.textContent = displayName;
  if (profileRole) profileRole.textContent = role;
  if (overviewGreeting) overviewGreeting.textContent = `Welcome, ${displayName}`;
  if (overviewSubtext) {
    overviewSubtext.textContent =
      "Live, system-wide sales and credit insights across all branches.";
  }
};

// Renders the director notification dropdown and unread badge state.
const renderDirectorNotifications = () => {
  const badge = document.getElementById("notificationBadge");
  const list = document.getElementById("notificationList");
  if (!badge || !list) return;

  badge.style.display = unreadNotifications > 0 ? "inline-block" : "none";
  badge.textContent = String(unreadNotifications > 99 ? "99+" : unreadNotifications);

  if (!notificationsCache.length) {
    list.innerHTML =
      '<div style="font-size:12px; color:#64748b; padding:8px;">No profile update notifications yet.</div>';
    return;
  }

  list.innerHTML = notificationsCache
    .map((item) => {
      const when = toDateSafe(item.createdAt);
      const dateLabel = when ? when.toLocaleString() : "Just now";
      return `
        <div style="border-radius:10px; padding:10px; background:#f8fafc; border:1px solid #e2e8f0;">
          <p style="margin:0; font-size:12px; font-weight:700; color:#0f172a;">${escapeHtml(item.message || "Profile updated.")}</p>
          <p style="margin:4px 0 0 0; font-size:11px; color:#64748b;">${dateLabel}</p>
        </div>
      `;
    })
    .join("");
};

// Fetches the latest profile-change notifications for the current director.
const loadDirectorNotifications = async () => {
  const response = await apiFetch("/notifications/director?limit=10");
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Failed to load notifications.");
  }

  notificationsCache = payload.notifications || [];
  unreadNotifications = Number(payload.unreadCount || 0);
  renderDirectorNotifications();
};

// Clears unread count once the director opens the notification panel.
const markDirectorNotificationsAsRead = async () => {
  const response = await apiFetch("/notifications/director/read-all", {
    method: "POST",
  });
  if (!response.ok) return;

  unreadNotifications = 0;
  notificationsCache = notificationsCache.map((item) => ({ ...item, isRead: true }));
  renderDirectorNotifications();
};

// Handles top-right profile dropdown + profile update modal interactions.
const setupProfileMenu = ({ onProfileUpdated } = {}) => {
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

    if (typeof onProfileUpdated === "function") {
      await onProfileUpdated(authenticatedUser);
    }
  });
};

const renderUsersTable = (users) => {
  const body = document.getElementById("usersTableBody");
  if (!body) return;

  if (!users.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b;">No users found.</td></tr>';
    return;
  }

  body.innerHTML = users
    .map((user) => {
      const createdAt = toDateSafe(user.createdAt)?.toLocaleDateString() || "-";
      const disableDelete = String(user._id) === String(directorUserId) ? "disabled" : "";

      return `
        <tr>
          <td>${escapeHtml(user.fullName || "-")}</td>
          <td>${escapeHtml(user.username || "-")}</td>
          <td>${escapeHtml(user.phone || "-")}</td>
          <td>${escapeHtml(user.role || "-")}</td>
          <td>${escapeHtml(user.branch || "-")}</td>
          <td>${createdAt}</td>
          <td>
            <button class="icon-btn edit user-edit-btn" data-id="${user._id}" type="button" aria-label="Edit user">
              <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="icon-btn delete user-delete-btn" data-id="${user._id}" type="button" ${disableDelete} aria-label="Delete user">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
};

const loadUsers = async () => {
  const usersStatus = document.getElementById("usersStatus");
  if (usersStatus) usersStatus.textContent = "Loading users...";

  const response = await apiFetch("/users");
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Failed to load users.");
  }

  managedUsers = payload.users || [];
  renderUsersTable(managedUsers);
  if (usersStatus) usersStatus.textContent = "";
};

const handleSaveUser = async () => {
  const usersStatus = document.getElementById("usersStatus");
  const userModalStatus = document.getElementById("userModalStatus");
  const id = document.getElementById("userId").value.trim();
  const fullName = document.getElementById("userFullName").value.trim();
  const username = document.getElementById("userUsername").value.trim();
  const phone = document.getElementById("userPhone").value.trim();
  const role = document.getElementById("userRole").value;
  const branch = document.getElementById("userBranch").value;
  const password = document.getElementById("userPassword").value;

  if (fullName.length < 2 || username.length < 2) {
    userModalStatus.textContent = "Full name and username must have at least 2 characters.";
    return;
  }

  if (!role) {
    userModalStatus.textContent = "Please select a role.";
    return;
  }

  if (role !== "Director" && !branch) {
    userModalStatus.textContent = "Please select a branch for non-director users.";
    return;
  }

  if (!id && password.length < 6) {
    userModalStatus.textContent = "Password must be at least 6 characters for new users.";
    return;
  }

  if (id && password && password.length < 6) {
    userModalStatus.textContent = "Updated password must be at least 6 characters.";
    return;
  }

  const body = {
    fullName,
    username,
    phone,
    role,
    branch,
  };

  if (password) {
    body.password = password;
  }

  userModalStatus.textContent = id ? "Updating user..." : "Creating user...";

  const response = await apiFetch(id ? `/users/${id}` : "/users", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    userModalStatus.textContent = result.message || "Failed to save user.";
    return;
  }

  usersStatus.textContent = result.message || "User saved successfully.";
  resetUserForm();
  closeUserModal();
  await loadUsers();
};

const handleEditUser = (id) => {
  const target = managedUsers.find((user) => String(user._id) === String(id));
  if (!target) return;

  document.getElementById("userId").value = target._id || "";
  document.getElementById("userFullName").value = target.fullName || "";
  document.getElementById("userUsername").value = target.username || "";
  document.getElementById("userPhone").value = target.phone || "";
  document.getElementById("userRole").value = target.role || "";
  document.getElementById("userBranch").value = target.branch || "";
  document.getElementById("userPassword").value = "";
  document.getElementById("userModalTitle").textContent = "Edit User";
  document.getElementById("saveUserButton").textContent = "Update User";
  document.getElementById("userModalStatus").textContent = "";
  syncUserBranchState();
  openUserModal();
  setNavSection("users");
};

const handleDeleteUser = async (id) => {
  const usersStatus = document.getElementById("usersStatus");
  if (!managedUsers.some((user) => String(user._id) === String(id))) return;

  usersStatus.textContent = "Deleting user...";
  const response = await apiFetch(`/users/${id}`, { method: "DELETE" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    usersStatus.textContent = result.message || "Failed to delete user.";
    return;
  }

  usersStatus.textContent = result.message || "User deleted successfully.";
  await loadUsers();
};

const promptDeleteUser = (id) => {
  const target = managedUsers.find((user) => String(user._id) === String(id));
  if (!target) return;

  pendingDeleteUserId = String(id);
  const label = target.fullName || target.username || "this user";
  const text = document.getElementById("deleteUserModalText");
  if (text) {
    text.textContent = `Delete user "${label}"? This action cannot be undone.`;
  }
  openDeleteUserModal();
};

const loadDirectorDashboard = async () => {
  const salesStatus = document.getElementById("salesStatus");
  const stockStatus = document.getElementById("stockStatus");
  const procurementStatus = document.getElementById("procurementStatus");
  if (salesStatus) salesStatus.textContent = "Loading dashboard data...";
  if (stockStatus) stockStatus.textContent = "Loading stock data...";
  if (procurementStatus) procurementStatus.textContent = "Loading procurement data...";

  const [
    meRes,
    summaryRes,
    recordsRes,
    stockRes,
    procurementSummaryRes,
    procurementRecordsRes,
    notificationsRes,
  ] = await Promise.all([
    apiFetch("/auth/me"),
    apiFetch("/sales/summary"),
    apiFetch("/sales/records?type=all"),
    apiFetch("/stock/summary"),
    apiFetch("/procurement/summary"),
    apiFetch("/procurement/records"),
    apiFetch("/notifications/director?limit=10"),
  ]);

  if (!meRes.ok) {
    window.location.href = "/login";
    return;
  }

  const meData = await meRes.json().catch(() => ({}));
  const user = meData.user || {};
  authenticatedUser = user;

  if (
    summaryRes.status === 403 ||
    recordsRes.status === 403 ||
    stockRes.status === 403 ||
    procurementSummaryRes.status === 403 ||
    procurementRecordsRes.status === 403
  ) {
    throw new Error("Only directors can view this dashboard.");
  }

  if (!summaryRes.ok || !recordsRes.ok) {
    throw new Error("Failed to load director dashboard data.");
  }

  const summaryData = await summaryRes.json();
  const recordsData = await recordsRes.json();
  const stockData = stockRes.ok
    ? await stockRes.json()
    : { message: "Stock summary is currently unavailable." };
  const procurementSummaryData = procurementSummaryRes.ok
    ? await procurementSummaryRes.json()
    : { message: "Procurement summary is currently unavailable." };
  const procurementRecordsData = procurementRecordsRes.ok
    ? await procurementRecordsRes.json()
    : { message: "Procurement records are currently unavailable.", records: [] };
  const notificationsData = notificationsRes.ok
    ? await notificationsRes.json()
    : { notifications: [], unreadCount: 0 };

  notificationsCache = notificationsData.notifications || [];
  unreadNotifications = Number(notificationsData.unreadCount || 0);
  renderDirectorNotifications();

  directorUserId = user._id || user.id || null;
  applyProfileHeader(user);

  const cashByBranch = summaryData.cashByBranch || [];
  const totalRevenue = cashByBranch.reduce((sum, row) => sum + (row.totalCashAmount || 0), 0);

  const cashSales = recordsData.cashSales || [];
  const creditSales = recordsData.creditSales || [];
  const allRows = buildSalesRows(cashSales, creditSales);

  const outstanding = creditSales
    .filter((sale) => sale.status !== "Paid")
    .reduce((sum, sale) => sum + (sale.amountDue || 0), 0);

  const totalTonnage = allRows.reduce((sum, row) => sum + (row.tonnageKg || 0), 0);

  document.getElementById("kpiTotalRevenue").textContent = formatNumber(totalRevenue);
  document.getElementById("kpiCreditOutstanding").textContent = formatNumber(outstanding);
  document.getElementById("kpiSalesRecords").textContent = formatNumber(allRows.length);
  document.getElementById("kpiTonnageSold").textContent = formatNumber(totalTonnage);

  renderSalesByBranch(allRows);
  renderTopProduceByValue(allRows);
  renderRecentSalesLog(allRows);
  renderCreditBreakdown(creditSales);
  renderStockSummary(stockData);
  renderProcurementSummary(procurementSummaryData, procurementRecordsData);

  if (procurementSummaryRes.ok && procurementRecordsRes.ok) {
    document.getElementById("procurementStatus").textContent = "";
  } else {
    document.getElementById("procurementStatus").textContent =
      procurementSummaryData.message ||
      procurementRecordsData.message ||
      "Procurement data is currently unavailable.";
  }
  if (!stockRes.ok) {
    document.getElementById("stockStatus").textContent =
      stockData.message || "Stock summary is currently unavailable.";
  }

  if (salesStatus) salesStatus.textContent = "";

  try {
    await loadUsers();
  } catch (error) {
    const usersStatus = document.getElementById("usersStatus");
    if (usersStatus) {
      usersStatus.textContent = error.message;
    }
  }

  return allRows;
};

const applySearchFilter = (rows) => {
  const searchInput = document.getElementById("searchInput");
  const query = (searchInput?.value || "").trim().toLowerCase();

  const filtered = !query
    ? rows
    : rows.filter((row) => {
      const haystack = [row.branch, row.produceName, row.buyerName, row.type, row.status]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

  renderRecentSalesLog(filtered);
  renderTopProduceByValue(filtered);
  renderSalesByBranch(filtered);
};

// Entry point: wire UI events then load dashboard data.
document.addEventListener("DOMContentLoaded", async () => {
  const navItems = document.querySelectorAll(".nav-item[data-target]");
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const targetId = item.getAttribute("data-target");
      if (!targetId) return;
      setNavSection(targetId);
    });
  });

  document.getElementById("logoutButton")?.addEventListener("click", () => {
    window.location.href = "/logout";
  });

  const notificationToggle = document.getElementById("notificationToggle");
  const notificationPanel = document.getElementById("notificationPanel");
  notificationToggle?.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (!notificationPanel) return;

    const isOpen = notificationPanel.style.display === "block";
    if (isOpen) {
      notificationPanel.style.display = "none";
      return;
    }

    notificationPanel.style.display = "block";
    try {
      await loadDirectorNotifications();
      await markDirectorNotificationsAsRead();
    } catch (_) {
      // Keep the panel open with last known state.
    }
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

  setupProfileMenu({
    onProfileUpdated: async () => {
      try {
        await loadUsers();
      } catch (error) {
        const usersStatus = document.getElementById("usersStatus");
        if (usersStatus) usersStatus.textContent = error.message;
      }
    },
  });

  try {
    const rows = await loadDirectorDashboard();
    document.getElementById("searchInput")?.addEventListener("input", () => {
      applySearchFilter(rows);
    });
    document.getElementById("openAddUserModalButton")?.addEventListener("click", () => {
      resetUserForm();
      openUserModal();
    });
    document.getElementById("closeUserModalButton")?.addEventListener("click", () => {
      closeUserModal();
    });
    document.getElementById("userRole")?.addEventListener("change", syncUserBranchState);
    document.getElementById("saveUserButton")?.addEventListener("click", async () => {
      try {
        await handleSaveUser();
      } catch (error) {
        document.getElementById("usersStatus").textContent = error.message;
      }
    });
    document.getElementById("cancelEditUserButton")?.addEventListener("click", () => {
      resetUserForm();
      closeUserModal();
    });
    document.getElementById("userModal")?.addEventListener("click", (event) => {
      if (event.target.id === "userModal") {
        closeUserModal();
      }
    });
    document.getElementById("closeDeleteUserModalButton")?.addEventListener("click", () => {
      closeDeleteUserModal();
    });
    document.getElementById("cancelDeleteUserButton")?.addEventListener("click", () => {
      closeDeleteUserModal();
    });
    document.getElementById("confirmDeleteUserButton")?.addEventListener("click", async () => {
      if (!pendingDeleteUserId) {
        closeDeleteUserModal();
        return;
      }

      const idToDelete = pendingDeleteUserId;
      closeDeleteUserModal();
      try {
        await handleDeleteUser(idToDelete);
      } catch (error) {
        document.getElementById("usersStatus").textContent = error.message;
      }
    });
    document.getElementById("deleteUserModal")?.addEventListener("click", (event) => {
      if (event.target.id === "deleteUserModal") {
        closeDeleteUserModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDeleteUserModal();
      }
    });
    document.getElementById("usersTableBody")?.addEventListener("click", async (event) => {
      const editButton = event.target.closest(".user-edit-btn");
      const deleteButton = event.target.closest(".user-delete-btn");

      if (editButton) {
        handleEditUser(editButton.dataset.id);
      }

      if (deleteButton) {
        promptDeleteUser(deleteButton.dataset.id);
      }
    });
    syncUserBranchState();
  } catch (error) {
    const salesStatus = document.getElementById("salesStatus");
    if (salesStatus) {
      salesStatus.textContent = error.message;
    }
    const usersStatus = document.getElementById("usersStatus");
    if (usersStatus) {
      usersStatus.textContent = error.message;
    }
  }
});
