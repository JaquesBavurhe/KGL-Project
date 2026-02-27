const formatNumber = (value) => new Intl.NumberFormat("en-UG").format(value || 0);

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

const fetchSaleQuote = async (produceName, tonnageKg) => {
  const params = new URLSearchParams({
    produceName: String(produceName || "").trim(),
    tonnageKg: String(tonnageKg || ""),
  });
  const res = await fetch(`/sales/price-quote?${params.toString()}`);
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

const renderProcurementRows = (rows) => {
  const body = document.getElementById("procurementRecordsBody");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b;">No procurement records found.</td></tr>';
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
      </tr>
    `,
    )
    .join("");
};

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

const loadManagerDashboard = async () => {
  const [meRes, salesRes, procurementSummaryRes, procurementRecordsRes, stockRes, alertsRes] =
    await Promise.all([
      fetch("/auth/me"),
      fetch("/sales/records?type=all"),
      fetch("/procurement/summary"),
      fetch("/procurement/records"),
      fetch("/stock/summary"),
      fetch("/stock/alerts"),
    ]);

  if (!meRes.ok) {
    window.location.href = "/login";
    return;
  }

  if (
    salesRes.status === 403 ||
    procurementSummaryRes.status === 403 ||
    procurementRecordsRes.status === 403 ||
    stockRes.status === 403 ||
    alertsRes.status === 403
  ) {
    throw new Error("Only managers can view this dashboard.");
  }

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
  alertsCache = alertsData.alerts || [];
  renderNotificationPanel();

  const user = meData.user || {};
  const displayName = user.fullName || user.username || "Manager";
  const role = user.role || "Manager";
  const branch = user.branch || "N/A";

  document.getElementById("profileName").textContent = displayName;
  document.getElementById("profileMeta").textContent = `${role} - ${branch}`;
  document.getElementById("overviewGreeting").innerHTML = `Welcome, ${role} <br> ${displayName}`;
  document.getElementById("userContext").textContent =
    `Branch dashboard for ${branch}. Record sales, track procurement, and monitor inventory.`;

  const cashSales = salesData.cashSales || [];
  const creditSales = salesData.creditSales || [];
  const procurementRows = procurementRecordsData.records || [];

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

  const res = await fetch("/sales/cash", {
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
  if (status) status.textContent = "Cash sale saved.";
  await loadManagerDashboard();
  setNavSection("records");
};

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

  const res = await fetch("/sales/credit", {
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
  if (status) status.textContent = "Credit sale saved.";
  await loadManagerDashboard();
  setNavSection("records");
};

const handleProcurementSubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("procurementStatus");

  if (status) status.textContent = "Saving procurement...";

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

  const res = await fetch("/procurement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (status) status.textContent = body.message || "Failed to save procurement";
    return;
  }

  form.reset();
  if (status) status.textContent = "Procurement saved.";
  await loadManagerDashboard();
  setNavSection("records");
};

document.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll(".nav-item[data-target]").forEach((item) => {
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

  document.getElementById("logoutButton")?.addEventListener("click", () => {
    window.location.href = "/logout";
  });

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

  try {
    await loadManagerDashboard();
  } catch (error) {
    const recordsStatus = document.getElementById("recordsStatus");
    if (recordsStatus) recordsStatus.textContent = error.message;
  }
});
