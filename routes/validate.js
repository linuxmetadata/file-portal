const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

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

    // ✅ GET EXTENSION
    const ext = path.extname(file.originalname).toLowerCase().replace(".", "");

    // ✅ ALLOWED FORMATS
    const allowed = ["pdf", "xlsx", "xls", "doc", "docx", "txt", "html", "htm"];

    // ❌ INVALID FORMAT
    if (!allowed.includes(ext)) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: "INVALID FORMAT" });
    }

    /* =========================
       PDF VALIDATION
    ========================= */
    if (ext === "pdf") {

      // If pdf-parse not installed → skip strict validation
      if (!pdfParse) {
        console.log("pdf-parse not available, skipping PDF validation");
      } else {
        try {
          const buffer = fs.readFileSync(file.path);
          const data = await pdfParse(buffer);

          const text = data.text || "";

          // 🔍 LOG FOR DEBUG
          console.log("PDF TEXT LENGTH:", text.length);

          // ❌ ONLY reject completely empty PDFs
          if (text.replace(/\s/g, "").length < 20) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: "SCANNED PDF NOT ALLOWED" });
          }

        } catch (err) {
          console.log("PDF PARSE ERROR:", err.message);

          fs.unlinkSync(file.path);
          return res.status(400).json({ error: "INVALID PDF" });
        }
      }
    }

    // ✅ CLEAN TEMP FILE
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return res.json({ success: true });

  } catch (err) {

    console.error("VALIDATION ERROR:", err);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(400).json({ error: err.message || "VALIDATION FAILED" });
  }
});

module.exports = router;