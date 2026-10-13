const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

// ============================================================
// LOAD EXCEL DATA
// ============================================================

function getUsers() {
  const filePath = path.join(__dirname, "../data/source.xlsx");

  if (!fs.existsSync(filePath)) {
    throw new Error("source.xlsx not found");
  }

  const workbook = XLSX.readFile(filePath);

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const data = XLSX.utils.sheet_to_json(sheet, {
    defval: ""
  });

  return data;
}

// ============================================================
// USER LOGIN
// ============================================================
// Currently ID-only login.
// Password / Employee Code will be added later.
// ============================================================

router.post("/user-login", (req, res) => {
  try {
    const { id } = req.body;

    // --------------------------------------------------------
    // CHECK ID
    // --------------------------------------------------------

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID required"
      });
    }

    // --------------------------------------------------------
    // NORMALIZE LOGIN ID
    // --------------------------------------------------------

    const loginId = String(id)
      .trim()
      .toLowerCase();

    // --------------------------------------------------------
    // LOAD USERS FROM SOURCE EXCEL
    // --------------------------------------------------------

    const users = getUsers();

    // --------------------------------------------------------
    // FIND USER
    // --------------------------------------------------------

    const found = users.find((row) => {

      const bhId = String(row.BH_ID || "")
        .trim()
        .toLowerCase();

      const smId = String(row.SM_ID || "")
        .trim()
        .toLowerCase();

      const zbmId = String(row.ZBM_ID || "")
        .trim()
        .toLowerCase();

      const rbmId = String(row.RBM_ID || "")
        .trim()
        .toLowerCase();

      const abmId = String(row.ABM_ID || "")
        .trim()
        .toLowerCase();

      return (
        bhId === loginId ||
        smId === loginId ||
        zbmId === loginId ||
        rbmId === loginId ||
        abmId === loginId
      );
    });

    // --------------------------------------------------------
    // USER NOT FOUND
    // --------------------------------------------------------

    if (!found) {
      return res.json({
        success: false,
        message: "Invalid ID"
      });
    }

    // ========================================================
    // DETERMINE USER ROLE
    // ========================================================

    let role = "";

    const bhId = String(found.BH_ID || "")
      .trim()
      .toLowerCase();

    const smId = String(found.SM_ID || "")
      .trim()
      .toLowerCase();

    const zbmId = String(found.ZBM_ID || "")
      .trim()
      .toLowerCase();

    const rbmId = String(found.RBM_ID || "")
      .trim()
      .toLowerCase();

    const abmId = String(found.ABM_ID || "")
      .trim()
      .toLowerCase();

    if (bhId === loginId) {
      role = "BH";
    } else if (smId === loginId) {
      role = "SM";
    } else if (zbmId === loginId) {
      role = "ZBM";
    } else if (rbmId === loginId) {
      role = "RBM";
    } else if (abmId === loginId) {
      role = "ABM";
    }

    // ========================================================
    // RETURN USER + HIERARCHY
    // ========================================================

    return res.json({
      success: true,

      message: "Login successful",

      user: {

        // ----------------------------------------------------
        // LOGIN INFORMATION
        // ----------------------------------------------------

        id: id,

        role: role,

        // ----------------------------------------------------
        // BASIC INFORMATION
        // ----------------------------------------------------

        division: found.Division || "",

        state: found.STATE || "",

        // ----------------------------------------------------
        // HIERARCHY IDS
        // ----------------------------------------------------

        BH_ID: found.BH_ID || "",

        SM_ID: found.SM_ID || "",

        ZBM_ID: found.ZBM_ID || "",

        RBM_ID: found.RBM_ID || "",

        ABM_ID: found.ABM_ID || "",

        // ----------------------------------------------------
        // HIERARCHY HQ
        // ----------------------------------------------------

        RBM_HQ: found.RBM_HQ || "",

        ABM_HQ: found.ABM_HQ || "",

        BM_HQ: found.BM_HQ || ""
      }
    });

  } catch (err) {

    console.error("USER LOGIN ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ============================================================
// ADMIN LOGIN
// ============================================================

router.post("/admin-login", (req, res) => {

  const { email, password } = req.body;

  // ----------------------------------------------------------
  // ADMIN CREDENTIALS
  // ----------------------------------------------------------

  if (
    email === "admin@gmail.com" &&
    password === "admin123"
  ) {

    return res.json({
      success: true
    });
  }

  return res.json({
    success: false
  });
});

// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;
