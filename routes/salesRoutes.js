const express = require("express");
const router = express.Router();
const Sale = require("../models/Sales");
const CreditSale = require("../models/Credit");
const Stock = require("../models/Stock");
const { authenticateToken } = require("../middleware/authMiddleware");

const canRecordSales = (role) => ["Manager", "Sales Agent"].includes(role);
const LOW_STOCK_THRESHOLD_KG = 100;

const ensureBranchAccess = (req, requestedBranch) => {
  const { role, branch } = req.user;

  if (role === "Director") {
    return requestedBranch || undefined;
  }

  return branch;
};

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildStockAlerts = (items, thresholdKg) => {
  return (items || []).map((item) => {
    const qty = Number(item.quantity || 0);
    const level = qty <= 0 ? "critical" : qty <= thresholdKg ? "warning" : "info";
    const typeLabel = qty <= 0 ? "out_of_stock" : "low_stock";

    return {
      type: typeLabel,
      level,
      produceName: item.produceName,
      produceType: item.produceType,
      branch: item.branch,
      quantity: qty,
      thresholdKg,
      message:
        qty <= 0
          ? `${item.produceName} is out of stock at ${item.branch}.`
          : `${item.produceName} is running low at ${item.branch} (${qty} KG remaining).`,
    };
  });
};

const reserveStockForSale = async ({
  branch,
  produceName,
  tonnageKg,
  userId,
}) => {
  const normalizedProduceName = String(produceName || "").trim();
  const numericTonnage = Number(tonnageKg);

  const updatedStock = await Stock.findOneAndUpdate(
    {
      branch,
      produceName: {
        $regex: new RegExp(`^${escapeRegex(normalizedProduceName)}$`, "i"),
      },
      quantity: { $gte: numericTonnage },
    },
    {
      $inc: { quantity: -numericTonnage },
      $set: { lastUpdatedBy: userId },
    },
    { new: true },
  );

  if (updatedStock) {
    return updatedStock;
  }

  const matchingStock = await Stock.findOne({
    branch,
    produceName: {
      $regex: new RegExp(`^${escapeRegex(normalizedProduceName)}$`, "i"),
    },
  }).select("produceName quantity");

  const error = new Error();
  error.status = 400;
  if (!matchingStock) {
    error.message = `Cannot record sale. ${normalizedProduceName} is not available in ${branch} stock.`;
  } else {
    error.message = `Insufficient stock for ${matchingStock.produceName}. Available: ${matchingStock.quantity} KG, requested: ${numericTonnage} KG.`;
  }
  throw error;
};

const quoteSaleAmount = async ({ branch, produceName, tonnageKg }) => {
  const normalizedProduceName = String(produceName || "").trim();
  const numericTonnage = Number(tonnageKg);

  if (!normalizedProduceName || Number.isNaN(numericTonnage) || numericTonnage <= 0) {
    const error = new Error("Produce name and a valid tonnage are required.");
    error.status = 400;
    throw error;
  }

  const stockItem = await Stock.findOne({
    branch,
    produceName: {
      $regex: new RegExp(`^${escapeRegex(normalizedProduceName)}$`, "i"),
    },
  }).select("produceName sellingPrice quantity");

  if (!stockItem) {
    const error = new Error(`No stock pricing found for ${normalizedProduceName} in ${branch}.`);
    error.status = 404;
    throw error;
  }

  const unitPrice = Number(stockItem.sellingPrice || 0);
  const amount = unitPrice * numericTonnage;

  return {
    produceName: stockItem.produceName,
    branch,
    unitPrice,
    tonnageKg: numericTonnage,
    amount,
    availableQuantityKg: Number(stockItem.quantity || 0),
  };
};

router.get("/sales/records", authenticateToken(), async (req, res) => {
  try {
    const { role, branch: userBranch } = req.user;
    const { type = "all", branch } = req.query;

    if (!["all", "cash", "credit"].includes(type)) {
      return res
        .status(400)
        .json({ message: "Invalid type. Use all, cash, or credit." });
    }

    if (role !== "Director" && !userBranch) {
      return res
        .status(403)
        .json({ message: "Branch assignment is required for this account." });
    }

    const effectiveBranch = ensureBranchAccess(req, branch);
    const query = effectiveBranch ? { branch: effectiveBranch } : {};

    const [cashSales, creditSales] = await Promise.all([
      type === "credit" ? [] : Sale.find(query).sort({ date: -1 }),
      type === "cash" ? [] : CreditSale.find(query).sort({ date: -1 }),
    ]);

    return res.status(200).json({
      message: "Sales records fetched successfully",
      filters: {
        type,
        branch: effectiveBranch || "all",
      },
      cashSales,
      creditSales,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/sales/summary", authenticateToken(), async (req, res) => {
  try {
    if (req.user.role !== "Director") {
      return res
        .status(403)
        .json({ message: "Only directors can view aggregated sales totals." });
    }

    const [cashByBranch, creditByBranch] = await Promise.all([
      Sale.aggregate([
        {
          $group: {
            _id: "$branch",
            salesCount: { $sum: 1 },
            totalCashAmount: { $sum: "$amountPaid" },
            totalTonnageKg: { $sum: "$tonnageKg" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      CreditSale.aggregate([
        {
          $group: {
            _id: "$branch",
            creditSalesCount: { $sum: 1 },
            totalCreditAmountDue: { $sum: "$amountDue" },
            totalCreditTonnageKg: { $sum: "$tonnageKg" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return res.status(200).json({
      message: "Aggregated sales totals fetched successfully",
      cashByBranch,
      creditByBranch,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/sales/price-quote", authenticateToken(), async (req, res) => {
  try {
    if (!canRecordSales(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You are not allowed to access sale pricing." });
    }

    const { produceName, tonnageKg, branch } = req.query;
    const effectiveBranch = ensureBranchAccess(req, branch);
    if (!effectiveBranch) {
      return res.status(400).json({ message: "Branch is required." });
    }

    const quote = await quoteSaleAmount({
      branch: effectiveBranch,
      produceName,
      tonnageKg,
    });

    return res.status(200).json({
      message: "Sale price quote fetched successfully",
      quote,
    });
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
});

router.get("/stock/summary", authenticateToken(), async (req, res) => {
  try {
    const { role, branch: userBranch } = req.user;

    if (!["Director", "Manager"].includes(role)) {
      return res
        .status(403)
        .json({ message: "Only directors or managers can view stock summaries." });
    }

    if (role !== "Director" && !userBranch) {
      return res
        .status(403)
        .json({ message: "Branch assignment is required for this account." });
    }

    const matchStage = role === "Director" ? [] : [{ $match: { branch: userBranch } }];
    const lowStockQuery = role === "Director"
      ? { quantity: { $lte: LOW_STOCK_THRESHOLD_KG } }
      : { branch: userBranch, quantity: { $lte: LOW_STOCK_THRESHOLD_KG } };

    const [stockByBranch, stockByProduce, lowStockItems] = await Promise.all([
      Stock.aggregate([
        ...matchStage,
        {
          $group: {
            _id: "$branch",
            itemCount: { $sum: 1 },
            totalQuantityKg: { $sum: "$quantity" },
            totalStockValue: {
              $sum: { $multiply: ["$quantity", "$sellingPrice"] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Stock.aggregate([
        ...matchStage,
        {
          $group: {
            _id: "$produceName",
            totalQuantityKg: { $sum: "$quantity" },
            averageSellingPrice: { $avg: "$sellingPrice" },
            branchCount: { $addToSet: "$branch" },
          },
        },
        {
          $project: {
            _id: 1,
            totalQuantityKg: 1,
            averageSellingPrice: 1,
            branchCount: { $size: "$branchCount" },
          },
        },
        { $sort: { totalQuantityKg: -1 } },
      ]),
      Stock.find(lowStockQuery)
        .sort({ quantity: 1 })
        .select("produceName produceType branch quantity sellingPrice"),
    ]);

    const totals = stockByBranch.reduce(
      (acc, row) => {
        acc.totalItems += row.itemCount || 0;
        acc.totalQuantityKg += row.totalQuantityKg || 0;
        acc.totalStockValue += row.totalStockValue || 0;
        return acc;
      },
      { totalItems: 0, totalQuantityKg: 0, totalStockValue: 0 },
    );

    return res.status(200).json({
      message: "Stock summary fetched successfully",
      scope: role === "Director" ? "all" : userBranch,
      thresholdKg: LOW_STOCK_THRESHOLD_KG,
      totals,
      stockByBranch,
      stockByProduce,
      lowStockItems,
      alerts: buildStockAlerts(lowStockItems, LOW_STOCK_THRESHOLD_KG),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/stock/alerts", authenticateToken(), async (req, res) => {
  try {
    const { role, branch: userBranch } = req.user;

    if (!["Director", "Manager"].includes(role)) {
      return res
        .status(403)
        .json({ message: "Only directors or managers can view stock alerts." });
    }

    if (role !== "Director" && !userBranch) {
      return res
        .status(403)
        .json({ message: "Branch assignment is required for this account." });
    }

    const query = role === "Director"
      ? { quantity: { $lte: LOW_STOCK_THRESHOLD_KG } }
      : { branch: userBranch, quantity: { $lte: LOW_STOCK_THRESHOLD_KG } };

    const lowStockItems = await Stock.find(query)
      .sort({ quantity: 1 })
      .select("produceName produceType branch quantity sellingPrice");

    const alerts = buildStockAlerts(lowStockItems, LOW_STOCK_THRESHOLD_KG);

    return res.status(200).json({
      message: "Stock alerts fetched successfully",
      scope: role === "Director" ? "all" : userBranch,
      thresholdKg: LOW_STOCK_THRESHOLD_KG,
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter((alert) => alert.type === "out_of_stock").length,
      alerts,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/sales/cash", authenticateToken(), async (req, res) => {
  try {
    if (!canRecordSales(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You are not allowed to record sales." });
    }

    const {
      produceName,
      tonnageKg,
      buyerName,
      salesAgentName,
      date,
      branch,
    } = req.body;

    const effectiveBranch = ensureBranchAccess(req, branch);
    if (!effectiveBranch) {
      return res.status(400).json({ message: "Branch is required." });
    }

    const reservedStock = await reserveStockForSale({
      branch: effectiveBranch,
      produceName,
      tonnageKg,
      userId: req.user.id,
    });
    const computedAmount = Number(reservedStock.sellingPrice || 0) * Number(tonnageKg);

    let newSale;
    try {
      newSale = await Sale.create({
        produceName,
        tonnageKg,
        amountPaid: computedAmount,
        buyerName,
        salesAgentName: salesAgentName || req.user.username,
        branch: effectiveBranch,
        date,
      });
    } catch (createError) {
      await Stock.findOneAndUpdate(
        {
          branch: effectiveBranch,
          produceName: {
            $regex: new RegExp(`^${escapeRegex(String(produceName || "").trim())}$`, "i"),
          },
        },
        { $inc: { quantity: Number(tonnageKg) } },
      );
      throw createError;
    }

    return res.status(201).json({
      message: "Cash sale recorded and stock updated successfully",
      sale: newSale,
      pricing: {
        unitPrice: Number(reservedStock.sellingPrice || 0),
        computedAmount,
      },
    });
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
});

router.post("/sales/credit", authenticateToken(), async (req, res) => {
  try {
    if (!canRecordSales(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You are not allowed to record credit sales." });
    }

    const {
      produceName,
      tonnageKg,
      buyerName,
      buyerNIN,
      buyerLocation,
      buyerContact,
      salesAgentName,
      dueDate,
      status,
      date,
      dispatchDate,
      branch,
    } = req.body;

    const effectiveBranch = ensureBranchAccess(req, branch);
    if (!effectiveBranch) {
      return res.status(400).json({ message: "Branch is required." });
    }

    const reservedStock = await reserveStockForSale({
      branch: effectiveBranch,
      produceName,
      tonnageKg,
      userId: req.user.id,
    });
    const computedAmount = Number(reservedStock.sellingPrice || 0) * Number(tonnageKg);

    let newCreditSale;
    try {
      newCreditSale = await CreditSale.create({
        produceName,
        tonnageKg,
        amountDue: computedAmount,
        buyerName,
        buyerNIN,
        buyerLocation,
        buyerContact,
        salesAgentName: salesAgentName || req.user.username,
        dueDate,
        status,
        dispatchDate,
        date,
        branch: effectiveBranch,
      });
    } catch (createError) {
      await Stock.findOneAndUpdate(
        {
          branch: effectiveBranch,
          produceName: {
            $regex: new RegExp(`^${escapeRegex(String(produceName || "").trim())}$`, "i"),
          },
        },
        { $inc: { quantity: Number(tonnageKg) } },
      );
      throw createError;
    }

    return res.status(201).json({
      message: "Credit sale recorded and stock updated successfully",
      creditSale: newCreditSale,
      pricing: {
        unitPrice: Number(reservedStock.sellingPrice || 0),
        computedAmount,
      },
    });
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
});

module.exports = { router };
