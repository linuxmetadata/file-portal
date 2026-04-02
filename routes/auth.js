const express = require("express");
const jwt = require("jsonwebtoken");
const XLSX = require("xlsx");
const path = require("path");

const router = express.Router();

/* LOAD EXCEL */
function loadUsers() {
  const filePath = path.join(__dirname, "../data/source.xlsx");
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

/* LOGIN */
router.post("/user-login", (req, res) => {
  try {
    const { id } = req.body;

    if (!id) return res.status(400).json({ message: "Enter ID or Email" });

    // ✅ ADMIN LOGIN
    if (id.includes("@")) {
      const token = jwt.sign(
        { id, role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.json({ token, role: "admin" });
    }

    const data = loadUsers();

    let found = null;
    let level = "";

    for (let row of data) {
      if (
        row.BH_ID == id ||
        row.SM_ID == id ||
        row.ZBM_ID == id ||
        row.RBM_ID == id ||
        row.ABM_ID == id ||
        (row.NAME && row.NAME.toLowerCase() == id.toLowerCase()) // ✅ NAME SUPPORT
      ) {
        found = row;

        if (row.BH_ID == id) level = "BH";
        else if (row.SM_ID == id) level = "SM";
        else if (row.ZBM_ID == id) level = "ZBM";
        else if (row.RBM_ID == id) level = "RBM";
        else if (row.ABM_ID == id) level = "ABM";
        else level = "USER";

        break;
      }
    }

    if (!found) {
      return res.status(401).json({ message: "Invalid ID" });
    }

    const token = jwt.sign(
      {
        id,
        role: "user",
        level
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      role: "user",
      level
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;