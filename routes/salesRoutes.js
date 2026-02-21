const express = require("express");
const router = express.Router();
const Sale = require("../models/Sales");
const CreditSale = require("../models/Credit");
const Stock = require("../models/Stock");
const Procurement = require("../models/Procurement");
const { authenticateToken } = require("../middleware/authMiddleware");

const canRecordSales = (role) => ["Manager", "Sales Agent"].includes(role);
const canRecordProcurement = (role) => ["Manager"].includes(role);

const ensureBranchAccess = (req, requestedBranch) => {
  const { role, branch } = req.user;

  if (role === "Director") {
    return requestedBranch || undefined;
  }

  return branch;
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

router.get("/stock/summary", authenticateToken(), async (req, res) => {
  try {
    if (req.user.role !== "Director") {
      return res
        .status(403)
        .json({ message: "Only directors can view stock summaries." });
    }

    const LOW_STOCK_THRESHOLD_KG = 100;

    const [stockByBranch, stockByProduce, lowStockItems] = await Promise.all([
      Stock.aggregate([
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
      Stock.find({ quantity: { $lte: LOW_STOCK_THRESHOLD_KG } })
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
      thresholdKg: LOW_STOCK_THRESHOLD_KG,
      totals,
      stockByBranch,
      stockByProduce,
      lowStockItems,
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
      amountPaid,
      buyerName,
      salesAgentName,
      date,
      branch,
    } = req.body;

    const effectiveBranch = ensureBranchAccess(req, branch);
    if (!effectiveBranch) {
      return res.status(400).json({ message: "Branch is required." });
    }

    const newSale = await Sale.create({
      produceName,
      tonnageKg,
      amountPaid,
      buyerName,
      salesAgentName: salesAgentName || req.user.username,
      branch: effectiveBranch,
      date,
    });

    return res.status(201).json({
      message: "Cash sale recorded successfully",
      sale: newSale,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
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
      amountDue,
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

    const newCreditSale = await CreditSale.create({
      produceName,
      tonnageKg,
      amountDue,
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

    return res.status(201).json({
      message: "Credit sale recorded successfully",
      creditSale: newCreditSale,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = { router };
