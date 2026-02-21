const express = require("express");
const router = express.Router();
const Procurement = require("../models/Procurement");
const { authenticateToken } = require("../middleware/authMiddleware");

const canRecordProcurement = (role) => ["Manager"].includes(role);


// viewing procurement records. Only directors can view procurement records.
router.get("/procurement/records", authenticateToken(), async (req, res) => {
  try {
    if (req.user.role !== "Director") {
      return res
        .status(403)
        .json({ message: "Only directors can view procurement records." });
    }

    const records = await Procurement.find({})
      .sort({ date: -1 })
      .populate("recordedBy", "fullName username role branch");

    return res.status(200).json({
      message: "Procurement records fetched successfully",
      records,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// viewing procurement summary.
router.get("/procurement/summary", authenticateToken(), async (req, res) => {
  try {
    if (req.user.role !== "Director") {
      return res
        .status(403)
        .json({ message: "Only directors can view procurement summaries." });
    }

    const [summaryByBranch, summaryByProduce] = await Promise.all([
      Procurement.aggregate([
        {
          $group: {
            _id: "$branch",
            procurementCount: { $sum: 1 },
            totalTonnageKg: { $sum: "$tonnage" },
            totalCost: { $sum: "$cost" },
            averageCostPerKg: { $avg: { $divide: ["$cost", "$tonnage"] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Procurement.aggregate([
        {
          $group: {
            _id: "$produceName",
            totalTonnageKg: { $sum: "$tonnage" },
            totalCost: { $sum: "$cost" },
            averageBuyingPricePerKg: {
              $avg: { $divide: ["$cost", "$tonnage"] },
            },
            averageSellingPrice: { $avg: "$sellingPrice" },
          },
        },
        { $sort: { totalCost: -1 } },
      ]),
    ]);

    const totals = summaryByBranch.reduce(
      (acc, row) => {
        acc.totalProcurements += row.procurementCount || 0;
        acc.totalTonnageKg += row.totalTonnageKg || 0;
        acc.totalCost += row.totalCost || 0;
        return acc;
      },
      { totalProcurements: 0, totalTonnageKg: 0, totalCost: 0 },
    );

    return res.status(200).json({
      message: "Procurement summary fetched successfully",
      totals,
      summaryByBranch,
      summaryByProduce,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});


// recording procurement. Only managers can record procurement.
router.post("/procurement", authenticateToken(), async (req, res) => {
  try {
    if (!canRecordProcurement(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You are not allowed to record procurement." });
    }

    const {
      produceName,
      produceType,
      tonnage,
      cost,
      dealerName,
      dealerContact,
      branch,
      sellingPrice,
      date,
    } = req.body;

    const effectiveBranch = ensureBranchAccess(req, branch);
    if (!effectiveBranch) {
      return res.status(400).json({ message: "Branch is required." });
    }

    const record = await Procurement.create({
      produceName,
      produceType,
      tonnage,
      cost,
      dealerName,
      dealerContact,
      branch: effectiveBranch,
      sellingPrice,
      recordedBy: req.user.id,
      date,
    });

    return res.status(201).json({
      message: "Procurement recorded successfully",
      procurement: record,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = { router };