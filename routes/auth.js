const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

// Load Excel data
function getUsers() {
  const filePath = path.join(__dirname, "../data/source.xlsx");

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  return data;
}

/* =========================
   USER LOGIN (ID)
========================= */
router.post("/user-login", (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.json({
        success: false,
        message: "ID required"
      });
    }

    const users = getUsers();

    const loginId = String(id)
      .trim()
      .toLowerCase();

    const found = users.find(row =>
      String(row.BH_ID || "").trim().toLowerCase() === loginId ||
      String(row.SM_ID || "").trim().toLowerCase() === loginId ||
      String(row.ZBM_ID || "").trim().toLowerCase() === loginId ||
      String(row.RBM_ID || "").trim().toLowerCase() === loginId ||
      String(row.ABM_ID || "").trim().toLowerCase() === loginId
    );

    if (found) {
      return res.json({
        success: true
      });
    }

    return res.json({
      success: false,
      message: "Invalid ID"
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false
    });
  }
});


/* =========================
   ADMIN LOGIN
========================= */
router.post("/admin-login", (req, res) => {
  const { email, password } = req.body;

  // 👉 Change credentials here
  if (email === "admin@gmail.com" && password === "admin123") {
    return res.json({
      success: true
    });
  }

  return res.json({
    success: false
  });
});

module.exports = router;