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

const monthMap = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

  const lines =
  text
    .split(/\r?\n/)
    .slice(0, 100);

  let first20Lines =
  lines.join(" ");

  first20Lines =
  first20Lines.replace(
    /\(?.*?sale report updated till\s*:?\s*[^\)]*\)?/gi,
    ""
  );
  const monthDatePeriodMatch =
  text.match(
    /from\s+(\d{1,2}-[A-Za-z]{3}-\d{4})\s+to\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/i
  );

if (monthDatePeriodMatch) {

  const parts =
    monthDatePeriodMatch[1].split("-");

  const fileMonth =
    monthMap[
      parts[1]
        .substring(0,3)
        .toLowerCase()
    ];

  const fileYear =
    parseInt(parts[2]);

  return (
    fileMonth === (month - 1) &&
    fileYear === year
  );
}

  const rrpdMatch =
  text.match(
    /period\s+of\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i
  );

  if (rrpdMatch) {

  const startDate =
    new Date(rrpdMatch[1]);

  return (
    startDate.getMonth() === (month - 1) &&
    startDate.getFullYear() === year
  );
}

  /* =========================
   PRIORITY PERIOD CHECK
========================= */
  const fromMonthMatch =
  text.match(
    /from\s+month\s*:?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})/i
  );

if (fromMonthMatch) {

  const fileMonth =
    monthMap[
      fromMonthMatch[1]
        .substring(0, 3)
        .toLowerCase()
    ];

  let fileYear =
    parseInt(fromMonthMatch[2]);

  if (fileYear < 100) {
    fileYear += 2000;
  }

  return (
    fileMonth === (month - 1) &&
    fileYear === year
  );
}

  const fromToMonthMatch =
  text.match(
    /from\s*:?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[- ]?(\d{2,4})/i
  );

  if (fromToMonthMatch) {

  const fileMonth =
    monthMap[
      fromToMonthMatch[1]
        .substring(0, 3)
        .toLowerCase()
    ];

  let fileYear =
    parseInt(fromToMonthMatch[2]);

  if (fileYear < 100) {
    fileYear += 2000;
  }

  return (
    fileMonth === (month - 1) &&
    fileYear === year
  );
} 
  const monthPeriodMatch =
  text.match(
    /from\s*[:\-]?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[- ]?(\d{2,4}).*?to\s*[:\-]?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[- ]?(\d{2,4})/i
  );

  if (monthPeriodMatch) {

  const fileMonth =
    monthMap[
      monthPeriodMatch[1]
        .substring(0,3)
        .toLowerCase()
    ];

  let fileYear =
    parseInt(monthPeriodMatch[2]);

  if (fileYear < 100) {
    fileYear += 2000;
  }

  return (
    fileMonth === (month - 1) &&
    fileYear === year
  );
}

  for (const line of lines) {

  const periodMatch =
  line.match(
    /(from\s*date|from|period|duration).*?(\d{1,2}(?:[\/-]\d{1,2}[\/-]\d{2,4}|[\/-][A-Za-z]{3}[\/-]\d{2,4})).*?(to\s*date|to|upto).*?(\d{1,2}(?:[\/-]\d{1,2}[\/-]\d{2,4}|[\/-][A-Za-z]{3}[\/-]\d{2,4}))/i
  );

  if (periodMatch) {

  const startDate =
    periodMatch[2];

  if (/[A-Za-z]/.test(startDate)) {

    const parts =
      startDate.split(/[\/-]/);

    const fileMonth =
      monthMap[
        parts[1]
          .substring(0,3)
          .toLowerCase()
      ];

    let fileYear =
      parseInt(parts[2]);

    if (fileYear < 100) {
      fileYear += 2000;
    }

    return (
      fileMonth === (month - 1) &&
      fileYear === year
    );
  }

    const parts =
    startDate.split(/[\/-]/);

    const fileMonth =
    parseInt(parts[1]);

    let fileYear =
    parseInt(parts[2]);

    if (fileYear < 100) {
    fileYear += 2000;
  }

    return (
    fileMonth === month &&
    fileYear === year
  );
}
}

  console.log("FIRST20LINES");
  console.log(first20Lines);
  console.log("END FIRST20LINES");

  const directPeriodMatch =
  text.match(
    /from\s*date\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}).*?to\s*date\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i
  );

if (directPeriodMatch) {

  const startParts =
    directPeriodMatch[1].split(/[\/-]/);

  const fileMonth =
    parseInt(startParts[1]);

  let fileYear =
    parseInt(startParts[2]);

  if (fileYear < 100) {
    fileYear += 2000;
  }

  return (
    fileMonth === month &&
    fileYear === year
  );
}

  const ymdPeriodMatch =
  text.match(
    /(\d{4}-\d{2}-\d{2}).*?(?:to|upto|-).*?(\d{4}-\d{2}-\d{2})/i
  );

  if (ymdPeriodMatch) {

  const startDate =
    new Date(ymdPeriodMatch[1]);

  return (
    startDate.getMonth() === (month - 1) &&
    startDate.getFullYear() === year
  );
}

  const foundDates = [];

  /* DD/MM/YYYY or DD-MM-YYYY */
  const dmyRegex =
    /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/g;

  let match;

  while ((match = dmyRegex.exec(first20Lines)) !== null) {

    let dd = parseInt(match[1]);
    let mm = parseInt(match[2]);
    let yyyy = parseInt(match[3]);

    if (yyyy < 100) {
      yyyy += 2000;
    }

    foundDates.push(
      new Date(yyyy, mm - 1, dd)
    );
  }

  /* DD-Mon-YY or DD Mon YYYY */
  const monRegex =
    /\b(\d{1,2})[-\s\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s\/](\d{2,4})\b/gi;

  while ((match = monRegex.exec(first20Lines)) !== null) {

    let dd = parseInt(match[1]);

    let mm =
      monthMap[
        match[2]
          .substring(0, 3)
          .toLowerCase()
      ];

    let yyyy = parseInt(match[3]);

    if (yyyy < 100) {
      yyyy += 2000;
    }

    foundDates.push(
      new Date(yyyy, mm, dd)
    );
  }

  /* YYYY-MM-DD */
  const ymdRegex =
    /\b(\d{4})-(\d{2})-(\d{2})\b/g;

  while ((match = ymdRegex.exec(first20Lines)) !== null) {

    foundDates.push(
      new Date(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3])
      )
    );
  }

  console.log("FOUND DATES:");
  foundDates.forEach(d => {
  console.log(d.toISOString());
});
  /* Month-only formats like May'26, May 2026 */
  if (foundDates.length === 0) {

    const monthOnlyRegex =
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*['\-\s]?(\d{2,4})/i;

    const monthMatch =
      first20Lines.match(monthOnlyRegex);

    if (!monthMatch) {
      return false;
    }

    const fileMonth =
      monthMap[
        monthMatch[1]
          .substring(0, 3)
          .toLowerCase()
      ];

    let fileYear =
      parseInt(monthMatch[2]);

    if (fileYear < 100) {
      fileYear += 2000;
    }

    return (
      fileMonth === (month - 1) &&
      fileYear === year
    );
  }

  if (foundDates.length === 1) {

  const onlyDate =
    foundDates[0];

  return (
    onlyDate.getMonth() === (month - 1) &&
    onlyDate.getFullYear() === year
  );
}

  if (foundDates.length < 2) {
  return false;
}

  foundDates.sort(
    (a, b) => a - b
  );

  let startDate = null;
  let endDate = null;

  for (let i = 0; i < foundDates.length - 1; i++) {

    const first = foundDates[i];
    const second = foundDates[i + 1];

    const diffDays =
      Math.abs(
        (second - first) /
        (1000 * 60 * 60 * 24)
      );

    if (diffDays <= 31) {

      startDate = first;
      endDate = second;
      break;
    }
  }

  if (!startDate || !endDate) {
    return false;
  }

  const expectedMonth =
    month - 1;

  const expectedYear =
    year;

  if (
    startDate.getMonth() !== expectedMonth ||
    endDate.getMonth() !== expectedMonth
  ) {
    return false;
  }

  if (
    startDate.getFullYear() !== expectedYear ||
    endDate.getFullYear() !== expectedYear
  ) {
    return false;
  }

  const days =
    Math.abs(
      (endDate - startDate) /
      (1000 * 60 * 60 * 24)
    );

  if (days > 31) {
    return false;
  }

  return true;
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

        const validationResult =
        isValidPreviousMonth(text);

        console.log("================================");
        console.log("FILE:", file.originalname);
        console.log("VALIDATION RESULT:", validationResult);
        console.log("TEXT PREVIEW:");
        console.log(text.substring(0, 3000));
        console.log("================================");

      if (!validationResult) {

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