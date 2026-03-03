const express = require("express");
const router = express.Router();
const Procurement = require("../models/Procurement");
const Stock = require("../models/Stock");
const { authenticateToken } = require("../middleware/authMiddleware");

// Roles allowed to create procurement records.
const canRecordProcurement = (role) => ["Manager"].includes(role);
// Roles allowed to update/delete procurement records.
const canManageProcurement = (role) => ["Manager"].includes(role);

// Limits branch access: directors can query any branch, others are scoped to their own.
const ensureBranchAccess = (req, requestedBranch) => {
  const { role, branch } = req.user;

  if (role === "Director") {
    return requestedBranch || undefined;
  }

  return branch;
};

// Escapes user input before building case-insensitive regex queries.
const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Finds a stock item by branch and produce name (case-insensitive).
const findStockByBranchProduce = async (branch, produceName) => {
  return Stock.findOne({
    branch,
    produceName: {
      $regex: new RegExp(
        `^${escapeRegex(String(produceName || "").trim())}$`,
        "i",
      ),
    },
  });
};

// Returns procurement history in the caller's allowed scope.
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

// Returns aggregated procurement totals by branch and produce.
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

// Records a procurement entry and updates stock levels/pricing.
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

// Updates an existing procurement record and reconciles stock changes.
router.put("/procurement/:id", authenticateToken(), async (req, res) => {
  try {
    if (!canManageProcurement(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You are not allowed to edit procurement." });
    }

    const existingRecord = await Procurement.findOne({
      _id: req.params.id,
      branch: req.user.branch,
    });

    if (!existingRecord) {
      return res.status(404).json({ message: "Procurement record not found." });
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

    const effectiveBranch = ensureBranchAccess(
      req,
      branch || existingRecord.branch,
    );
    const normalizedProduceName = String(produceName || "").trim();
    const normalizedProduceType = String(produceType || "").trim();
    const numericTonnage = Number(tonnage);
    const numericSellingPrice = Number(sellingPrice);

    const oldBranch = existingRecord.branch;
    const oldProduceName = existingRecord.produceName;
    const oldTonnage = Number(existingRecord.tonnage || 0);

    const sameStockBucket =
      oldBranch === effectiveBranch &&
      oldProduceName.trim().toLowerCase() ===
        normalizedProduceName.toLowerCase();

    if (sameStockBucket) {
      const stock = await findStockByBranchProduce(oldBranch, oldProduceName);
      if (!stock) {
        return res
          .status(400)
          .json({ message: "Related stock item was not found." });
      }

      const delta = numericTonnage - oldTonnage;
      stock.quantity = Math.max(0, Number(stock.quantity || 0) + delta);
      if (stock.quantity <= 0) {
        await Stock.deleteOne({ _id: stock._id });
      } else {
        stock.produceType = normalizedProduceType || stock.produceType;
        stock.sellingPrice = numericSellingPrice;
        stock.lastUpdatedBy = req.user.id;
        await stock.save();
      }
    } else {
      const oldStock = await findStockByBranchProduce(
        oldBranch,
        oldProduceName,
      );
      if (oldStock) {
        oldStock.quantity = Number(oldStock.quantity || 0) - oldTonnage;
        if (oldStock.quantity <= 0) {
          await Stock.deleteOne({ _id: oldStock._id });
        } else {
          oldStock.lastUpdatedBy = req.user.id;
          await oldStock.save();
        }
      }

      const targetStock = await findStockByBranchProduce(
        effectiveBranch,
        normalizedProduceName,
      );
      if (targetStock) {
        targetStock.quantity =
          Number(targetStock.quantity || 0) + numericTonnage;
        targetStock.produceType =
          normalizedProduceType || targetStock.produceType;
        targetStock.sellingPrice = numericSellingPrice;
        targetStock.lastUpdatedBy = req.user.id;
        await targetStock.save();
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
    }

    existingRecord.produceName = produceName;
    existingRecord.produceType = produceType;
    existingRecord.tonnage = tonnage;
    existingRecord.cost = cost;
    existingRecord.dealerName = dealerName;
    existingRecord.dealerContact = dealerContact;
    existingRecord.sellingPrice = sellingPrice;
    existingRecord.branch = effectiveBranch;
    existingRecord.date = date || existingRecord.date;

    await existingRecord.save();

    return res.status(200).json({
      message: "Procurement updated successfully.",
      procurement: existingRecord,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

// Deletes a procurement record and rolls back its stock contribution.
router.delete("/procurement/:id", authenticateToken(), async (req, res) => {
  try {
    if (!canManageProcurement(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You are not allowed to delete procurement." });
    }

    const record = await Procurement.findOne({
      _id: req.params.id,
      branch: req.user.branch,
    });

    if (!record) {
      return res.status(404).json({ message: "Procurement record not found." });
    }

    const stock = await findStockByBranchProduce(
      record.branch,
      record.produceName,
    );
    if (stock) {
      stock.quantity =
        Number(stock.quantity || 0) - Number(record.tonnage || 0);
      if (stock.quantity <= 0) {
        await Stock.deleteOne({ _id: stock._id });
      } else {
        stock.lastUpdatedBy = req.user.id;
        await stock.save();
      }
    }

    await Procurement.deleteOne({ _id: record._id });

    return res
      .status(200)
      .json({ message: "Procurement deleted successfully." });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = { router };
