const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const XLSX = require("xlsx");
const mammoth = require("mammoth");

const router = express.Router();

const upload = multer({
  dest: "uploads/"
});

/* =========================
   PREVIOUS MONTH
========================= */
function getPreviousMonthInfo() {

  const now = new Date();

  const prev = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  );

  const month = prev.getMonth() + 1;
  const year = prev.getFullYear();

  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
  ];

  return {
    month,
    year,
    monthName: monthNames[month - 1]
  };
}

/* =========================
   EXTRACT TEXT
========================= */
async function extractText(filePath, ext) {

  try {

    if (ext === "pdf") {

      const buffer = fs.readFileSync(filePath);

      const data = await pdfParse(buffer);

      return data.text || "";
    }

    if (ext === "xlsx" || ext === "xls") {

      const workbook = XLSX.readFile(filePath);

      let text = "";

      workbook.SheetNames.forEach(sheetName => {

        const sheet = workbook.Sheets[sheetName];

        text +=
          XLSX.utils.sheet_to_csv(sheet) + "\n";
      });

      return text;
    }

    if (ext === "docx") {

      const result =
        await mammoth.extractRawText({
          path: filePath
        });

      return result.value || "";
    }

    if (ext === "txt") {

      return fs.readFileSync(
        filePath,
        "utf8"
      );
    }

    if (
      ext === "html" ||
      ext === "htm"
    ) {

      const html =
        fs.readFileSync(
          filePath,
          "utf8"
        );

      return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ");
    }

    return "";

  } catch (err) {

    console.log(
      "TEXT EXTRACTION ERROR:",
      err.message
    );

    return "";
  }
}

/* =========================
   PERIOD VALIDATION
========================= */
  function isValidPreviousMonth(text) {

  const { month, year } =
    getPreviousMonthInfo();

  const first20Lines =
    text
      .split(/\r?\n/)
      .slice(0, 20)
      .join(" ");

  const periodRegex =
  /from[:\s]*(\d{2}[\/-]\d{2}[\/-]\d{2,4}).*?(upto|to|till|\|?\s*to[:\s]*)\s*(\d{2}[\/-]\d{2}[\/-]\d{2,4})/i;

  const match =
    first20Lines.match(periodRegex);

  if (!match) {

    return false;
  }

  const startDate = match[1];

  const parts =
    startDate.split(/[\/-]/);

  const fileMonth =
    parseInt(parts[1]);

  const fileYear =
    parseInt(parts[2].length === 2
      ? `20${parts[2]}`
      : parts[2]);

  return (
    fileMonth === month &&
    fileYear === year
  );
}


/* =========================
   VALIDATE FILE
========================= */
router.post(
  "/",
  upload.single("file"),

  async (req, res) => {

    try {

      if (!req.file) {

        return res.status(400).json({
          error: "NO FILE"
        });
      }

      const file = req.file;

      const ext =
        path
          .extname(file.originalname)
          .toLowerCase()
          .replace(".", "");

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

      if (!allowed.includes(ext)) {

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }

        return res.status(400).json({
          error: "INVALID FORMAT"
        });
      }

      /* =========================
         PDF SCANNED CHECK
      ========================= */
      if (ext === "pdf") {

        try {

          const buffer =
            fs.readFileSync(
              file.path
            );

          const data =
            await pdfParse(buffer);

          const text =
            (data.text || "").trim();

          if (
            !text ||
            text.replace(/\s/g, "")
              .length < 20
          ) {

            if (
              fs.existsSync(
                file.path
              )
            ) {
              fs.unlinkSync(
                file.path
              );
            }

            return res
              .status(400)
              .json({
                error:
                  "SCANNED PDF NOT ALLOWED"
              });
          }

        } catch (err) {

          if (
            fs.existsSync(
              file.path
            )
          ) {
            fs.unlinkSync(
              file.path
            );
          }

          return res
            .status(400)
            .json({
              error:
                "INVALID PDF"
            });
        }
      }

      /* =========================
         PERIOD VALIDATION
      ========================= */

      if (ext !== "doc") {

        const text =
          await extractText(
            file.path,
            ext
          );

        if (
          !isValidPreviousMonth(
            text
          )
        ) {

          if (
            fs.existsSync(
              file.path
            )
          ) {
            fs.unlinkSync(
              file.path
            );
          }

          return res
            .status(400)
            .json({
              error:
                "INVALID PERIOD. Please upload previous month report only."
            });
        }
      }

      /* CLEAN TEMP FILE */

      if (
        fs.existsSync(
          file.path
        )
      ) {

        fs.unlinkSync(
          file.path
        );
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
        fs.existsSync(
          req.file.path
        )
      ) {

        fs.unlinkSync(
          req.file.path
        );
      }

      return res
        .status(400)
        .json({
          error:
            err.message ||
            "VALIDATION FAILED"
        });
    }
  }
);

module.exports = router;