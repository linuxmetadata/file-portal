const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const verifyToken = require("../middleware/authMiddleware");

const router = express.Router();

const auth = require("../services/googleAuth");
const drive = google.drive({ version: "v3", auth });

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

    const response = await drive.files.create({
      requestBody: { name: file.originalname },
      media: { body: fs.createReadStream(file.path) },
      fields: "id"
    });

    const fileId = response.data.id;

    fs.unlinkSync(file.path);

    const filePath = path.join(__dirname, "../data/files.json");
    let data = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath))
      : [];

    data = data.filter(d => !(d.code === code && d.type === type));

    data.push({
      code,
      type,
      fileId,
      uploadedAt: new Date(),
      uploadedBy: req.user.id
    });

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;