const express = require("express");
const multer = require("multer");
const fs = require("fs");

let pdfParse;
try {
  pdfParse = require("pdf-parse");
} catch (e) {
  pdfParse = null;
}

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/* =========================
   VALIDATE FILE
========================= */
router.post("/", upload.single("file"), async (req, res) => {

  try {
    if (!req.file) {
      return res.status(400).json({ error: "NO FILE" });
    }

    const file = req.file;
    const ext = file.originalname.split(".").pop().toLowerCase();

    const allowed = ["pdf", "xlsx", "xls", "doc", "docx", "txt", "html"];

    // ❌ FORMAT VALIDATION
    if (!allowed.includes(ext)) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: "INVALID FORMAT" });
    }

    // ❌ PDF VALIDATION (STRICT)
    if (ext === "pdf") {

      if (!pdfParse) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: "PDF ENGINE NOT AVAILABLE" });
      }

      try {
        const buffer = fs.readFileSync(file.path);
        const data = await pdfParse(buffer);

        const text = data.text || "";

        // 🔥 STRICT RULE (scanned = no text)
        if (text.trim().length < 20) {
          fs.unlinkSync(file.path);
          return res.status(400).json({ error: "INVALID PDF" });
        }

      } catch (err) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: "INVALID PDF" });
      }
    }

    // ✅ CLEAN TEMP FILE
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return res.json({ success: true });

  } catch (err) {

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(400).json({ error: err.message || "VALIDATION FAILED" });
  }
});

module.exports = router;