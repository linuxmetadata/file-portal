const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const verifyToken = require("../middleware/authMiddleware");
const { validatePDF } = require("../services/pdfValidator"); // ✅ added

const router = express.Router();

const auth = require("../services/googleAuth");
const drive = google.drive({ version: "v3", auth });

// 🔒 Prevent double-click uploads
const uploadLocks = {};

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

router.post("/", verifyToken, upload.single("file"), async (req, res) => {
  try {
    const { type, code } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // 🔒 Prevent multiple clicks / duplicate requests
    const lockKey = `${req.user.id}_${code}_${type}`;
    if (uploadLocks[lockKey]) {
      return res.status(429).json({
        error: "Upload already in progress. Please wait."
      });
    }
    uploadLocks[lockKey] = true;

    // 📄 PDF VALIDATION
    if (file.mimetype === "application/pdf") {
      const isValidPDF = await validatePDF(file.path);

      if (!isValidPDF) {
        fs.unlinkSync(file.path);
        delete uploadLocks[lockKey];
        return res.status(400).json({
          error: "Invalid PDF (scanned or unreadable)"
        });
      }
    }

    const filePath = path.join(__dirname, "../data/files.json");
    let data = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath))
      : [];

    // ❌ Prevent duplicate (same code + type)
    const alreadyExists = data.find(
      d => d.code === code && d.type === type
    );

    if (alreadyExists) {
      fs.unlinkSync(file.path);
      delete uploadLocks[lockKey];
      return res.status(400).json({
        error: "File already uploaded for this Code and Type"
      });
    }

    console.log("Uploading:", file.originalname);

    const response = await drive.files.create({
      requestBody: { name: file.originalname },
      media: { body: fs.createReadStream(file.path) },
      fields: "id"
    });

    const fileId = response.data.id;

    console.log("Upload success:", fileId);

    fs.unlinkSync(file.path);

    // (Your existing logic preserved)
    data = data.filter(d => !(d.code === code && d.type === type));

    data.push({
      code,
      type,
      fileId,
      uploadedAt: new Date(),
      uploadedBy: req.user.id
    });

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    delete uploadLocks[lockKey];

    res.json({ success: true });

  } catch (err) {
    console.error("Upload Error:", err.message);

    if (req.user && req.body) {
      const lockKey = `${req.user.id}_${req.body.code}_${req.body.type}`;
      delete uploadLocks[lockKey];
    }

    res.status(500).json({ error: err.message });
  }
});

module.exports = router;