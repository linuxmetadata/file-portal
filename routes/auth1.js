const express = require("express");
const router = express.Router();

const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

/* ============================================================
   LOAD SOURCE EXCEL
============================================================ */

function getUsers() {
  const filePath = path.join(__dirname, "../data/source.xlsx");

  if (!fs.existsSync(filePath)) {
    throw new Error("source.xlsx not found");
  }

  const workbook = XLSX.readFile(filePath);

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(sheet, {
    defval: ""
  });
}

/* ============================================================
   CLEAN VALUE
============================================================ */

function clean(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/* ============================================================
   UNIQUE VALUES
============================================================ */

function unique(values) {
  return [
    ...new Set(
      values
        .map(value => String(value || "").trim())
        .filter(Boolean)
    )
  ];
}

/* ============================================================
   IDENTIFY USER ROLE
============================================================ */

function identifyUser(users, loginId) {

  const id = clean(loginId);

  /*
    Priority:
    BH
    SM
    ZBM
    RBM
    ABM
  */

  const roleFields = [
    {
      role: "BH",
      field: "BH_ID"
    },
    {
      role: "SM",
      field: "SM_ID"
    },
    {
      role: "ZBM",
      field: "ZBM_ID"
    },
    {
      role: "RBM",
      field: "RBM_ID"
    },
    {
      role: "ABM",
      field: "ABM_ID"
    }
  ];

  for (const item of roleFields) {

    const matchingRows = users.filter(row =>
      clean(row[item.field]) === id
    );

    if (matchingRows.length > 0) {

      return {
        role: item.role,
        field: item.field,
        rows: matchingRows
      };
    }
  }

  return null;
}

/* ============================================================
   USER LOGIN
============================================================ */

router.post("/user-login", (req, res) => {

  try {

    const { id } = req.body;

    /* --------------------------------------------------------
       BASIC VALIDATION
    -------------------------------------------------------- */

    if (!id || !String(id).trim()) {

      return res.status(400).json({
        success: false,
        message: "User ID required"
      });
    }

    /* --------------------------------------------------------
       LOAD SOURCE
    -------------------------------------------------------- */

    const users = getUsers();

    if (!users.length) {

      return res.status(500).json({
        success: false,
        message: "Source data is empty"
      });
    }

    /* --------------------------------------------------------
       FIND USER
    -------------------------------------------------------- */

    const userResult = identifyUser(users, id);

    if (!userResult) {

      return res.status(401).json({
        success: false,
        message: "Invalid User ID"
      });
    }

    const rows = userResult.rows;

    const firstRow = rows[0];

    /* --------------------------------------------------------
       COMMON INFORMATION
    -------------------------------------------------------- */

    const divisionList = unique(
      rows.map(row => row.Division)
    );

    const stateList = unique(
      rows.map(row => row.STATE)
    );

    const rbmHqList = unique(
      rows.map(row => row.RBM_HQ)
    );

    const abmHqList = unique(
      rows.map(row => row.ABM_HQ)
    );

    const bmHqList = unique(
      rows.map(row =>
        row["BM HQ"] ||
        row.BM_HQ ||
        ""
      )
    );

    /* --------------------------------------------------------
       HIERARCHY IDs
    -------------------------------------------------------- */

    const bhIds = unique(
      rows.map(row => row.BH_ID)
    );

    const smIds = unique(
      rows.map(row => row.SM_ID)
    );

    const zbmIds = unique(
      rows.map(row => row.ZBM_ID)
    );

    const rbmIds = unique(
      rows.map(row => row.RBM_ID)
    );

    const abmIds = unique(
      rows.map(row => row.ABM_ID)
    );

    /* --------------------------------------------------------
       STOCKIST INFORMATION
    -------------------------------------------------------- */

    const stockists = rows.map(row => ({
      division: row.Division || "",
      state: row.STATE || "",

      rbmHq: row.RBM_HQ || "",
      abmHq: row.ABM_HQ || "",

      bmHq:
        row["BM HQ"] ||
        row.BM_HQ ||
        "",

      code:
        row.Code ||
        row.CODE ||
        "",

      stockistName:
        row["Stockist Name"] ||
        row.Name ||
        ""
    }));

    /* --------------------------------------------------------
       USER RESPONSE
    -------------------------------------------------------- */

    const user = {

      id: String(id).trim(),

      role: userResult.role,

      division:
        firstRow.Division ||
        "",

      divisions: divisionList,

      states: stateList,

      hierarchy: {

        bhIds: bhIds,

        smIds: smIds,

        zbmIds: zbmIds,

        rbmIds: rbmIds,

        abmIds: abmIds,

        rbmHqs: rbmHqList,

        abmHqs: abmHqList,

        bmHqs: bmHqList
      },

      stockists: stockists
    };

    /* --------------------------------------------------------
       LOGIN SUCCESS
    -------------------------------------------------------- */

    console.log(
      "LOGIN SUCCESS:",
      user.id,
      "| ROLE:",
      user.role,
      "| STOCKISTS:",
      stockists.length
    );

    return res.json({

      success: true,

      message: "Login successful",

      user: user
    });

  } catch (err) {

    console.error(
      "USER LOGIN ERROR:",
      err
    );

    return res.status(500).json({

      success: false,

      message:
        err.message ||
        "Login failed"
    });
  }
});

/* ============================================================
   ADMIN LOGIN
============================================================ */

router.post("/admin-login", (req, res) => {

  const { email, password } = req.body;

  if (
    email === "admin@gmail.com" &&
    password === "admin123"
  ) {

    return res.json({
      success: true,
      role: "ADMIN"
    });

  } else {

    return res.status(401).json({
      success: false,
      message: "Invalid admin credentials"
    });
  }
});

module.exports = router;
