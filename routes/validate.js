const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const router = express.Router();

const upload = multer({
  dest: "uploads/"
});

/* =========================
   VALIDATE FILE
========================= */
router.post(
  "/",
  upload.single("file"),

  async (req, res) => {

    try {

      /* NO FILE */
      if (!req.file) {

        return res.status(400).json({
          error: "NO FILE"
        });
      }

      const file = req.file;

      /* EXTENSION */
      const ext =
        path.extname(file.originalname)
          .toLowerCase()
          .replace(".", "");

      /* ALLOWED */
      const allowed = [
        "pdf",
        "xlsx",
        "xls",
        "doc",
        "docx",
        "txt",
        "html",
        "htm"
      ];

      /* INVALID FORMAT */
      if (!allowed.includes(ext)) {

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }

        return res.status(400).json({
          error: "INVALID FORMAT"
        });
      }

      /* =========================
         PDF VALIDATION
      ========================= */
      if (ext === "pdf") {

        try {

          const buffer =
            fs.readFileSync(file.path);

          const data =
            await pdfParse(buffer);

          const text =
            (data.text || "").trim();

          console.log(
            "PDF TEXT LENGTH:",
            text.length
          );

          /* SCANNED PDF */
          if (
            !text ||
            text.replace(/\s/g, "").length < 20
          ) {

            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }

            return res.status(400).json({
              error: "SCANNED PDF NOT ALLOWED"
            });
          }

        } catch (err) {

          console.log(
            "PDF PARSE ERROR:",
            err.message
          );

          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          return res.status(400).json({
            error: "INVALID PDF"
          });
        }
      }

      /* CLEAN TEMP FILE */
      if (fs.existsSync(file.path)) {

        fs.unlinkSync(file.path);
      }

      return res.json({
        success: true
      });

    } catch (err) {

      console.error(
        "VALIDATION ERROR:",
        err
      );

      if (
        req.file &&
        fs.existsSync(req.file.path)
      ) {

        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        error:
          err.message ||
          "VALIDATION FAILED"
      });
    }
  }
);

module.exports = router;