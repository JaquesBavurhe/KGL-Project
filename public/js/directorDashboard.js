const formatNumber = (value) => new Intl.NumberFormat("en-UG").format(value || 0);

const toDateSafe = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

  return { issued, unpaid, overdue };
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
  ] = await Promise.all([
    fetch("/auth/me"),
    fetch("/sales/summary"),
    fetch("/sales/records?type=all"),
    fetch("/stock/summary"),
    fetch("/procurement/summary"),
    fetch("/procurement/records"),
  ]);

  if (!meRes.ok) {
    window.location.href = "/login";
    return;
  }

  const meData = await meRes.json().catch(() => ({}));
  const user = meData.user || {};

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

  const displayName = user.fullName || user.username || "Director";
  document.getElementById("profileName").textContent = displayName;
  document.getElementById("profileRole").textContent = (user.role || "Director").toUpperCase();
  document.getElementById("overviewGreeting").textContent = `Welcome, ${displayName}`;
  document.getElementById("overviewSubtext").textContent =
    "Live, system-wide sales and credit insights across all branches.";

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

  try {
    const rows = await loadDirectorDashboard();
    document.getElementById("searchInput")?.addEventListener("input", () => {
      applySearchFilter(rows);
    });
  } catch (error) {
    const salesStatus = document.getElementById("salesStatus");
    if (salesStatus) {
      salesStatus.textContent = error.message;
    }
  }
});
