const express = require("express");
const router = express.Router();
const Procurement = require("../models/Procurement");
const Stock = require("../models/Stock");
const { authenticateToken } = require("../middleware/authMiddleware");

const canRecordProcurement = (role) => ["Manager"].includes(role);


const ensureBranchAccess = (req, requestedBranch) => {
  const { role, branch } = req.user;

  if (role === "Director") {
    return requestedBranch || undefined;
  }

  return branch;
};

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");




router.get("/procurement/records", authenticateToken(), async (req, res) => {
  try {
    const { role, branch: userBranch } = req.user;

    if (!["Director", "Manager"].includes(role)) {
      return res.status(403).json({
        message: "Only directors or managers can view procurement records.",
      });
    }

    if (role !== "Director" && !userBranch) {
      return res
        .status(403)
        .json({ message: "Branch assignment is required for this account." });
    }

    const query = role === "Director" ? {} : { branch: userBranch };

    const records = await Procurement.find(query)
      .sort({ date: -1 })
      .populate("recordedBy", "fullName username role branch");

    return res.status(200).json({
      message: "Procurement records fetched successfully",
      scope: role === "Director" ? "all" : userBranch,
      records,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});



router.get("/procurement/summary", authenticateToken(), async (req, res) => {
  try {
    const { role, branch: userBranch } = req.user;

    if (!["Director", "Manager"].includes(role)) {
      return res.status(403).json({
        message: "Only directors or managers can view procurement summaries.",
      });
    }

    if (role !== "Director" && !userBranch) {
      return res
        .status(403)
        .json({ message: "Branch assignment is required for this account." });
    }

    const matchStage =
      role === "Director" ? [] : [{ $match: { branch: userBranch } }];

    const [summaryByBranch, summaryByProduce] = await Promise.all([
      Procurement.aggregate([
        ...matchStage,
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
        ...matchStage,
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
      scope: role === "Director" ? "all" : userBranch,
      totals,
      summaryByBranch,
      summaryByProduce,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});



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

    const normalizedProduceName = String(produceName || "").trim();
    const normalizedProduceType = String(produceType || "").trim();
    const numericTonnage = Number(tonnage);
    const numericSellingPrice = Number(sellingPrice);

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

    try {
      const existingStock = await Stock.findOne({
        branch: effectiveBranch,
        produceName: {
          $regex: new RegExp(`^${escapeRegex(normalizedProduceName)}$`, "i"),
        },
      });

      if (existingStock) {
        existingStock.quantity += numericTonnage;
        existingStock.produceType =
          normalizedProduceType || existingStock.produceType;
        existingStock.sellingPrice = numericSellingPrice;
        existingStock.lastUpdatedBy = req.user.id;
        await existingStock.save();
      } else {
        await Stock.create({
          produceName: normalizedProduceName,
          produceType: normalizedProduceType,
          branch: effectiveBranch,
          quantity: numericTonnage,
          sellingPrice: numericSellingPrice,
          lastUpdatedBy: req.user.id,
        });
      }
    } catch (stockError) {
      await Procurement.findByIdAndDelete(record._id);
      throw stockError;
    }

    return res.status(201).json({
      message: "Procurement recorded and stock updated successfully",
      procurement: record,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = { router };
