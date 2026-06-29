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
function validateDateRange(startDate, endDate) {

  const { month, year } =
    getPreviousMonthInfo();

  const expectedMonth =
    month - 1;

  return (
    startDate.getMonth() === expectedMonth &&
    endDate.getMonth() === expectedMonth &&
    startDate.getFullYear() === year &&
    endDate.getFullYear() === year
  );
}

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

    if (ext === "csv") {

      return fs.readFileSync(
        filePath,
        "utf8"
      );
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

  console.log("VALIDATOR INPUT LENGTH:", text.length);

  console.log(
    "VALIDATOR INPUT PREVIEW:",
    text.substring(0,500)
  );

  const { month, year } = getPreviousMonthInfo();

  const monthMap = {
    jan:0,
    feb:1,
    mar:2,
    apr:3,
    may:4,
    jun:5,
    jul:6,
    aug:7,
    sep:8,
    oct:9,
    nov:10,
    dec:11
  };

  function ok(startDate, endDate) {

    return (
      startDate.getMonth() === (month - 1) &&
      endDate.getMonth() === (month - 1) &&
      startDate.getFullYear() === year &&
      endDate.getFullYear() === year
    );

  }

  const normalizedText =
    text
      .replace(/\r/g, " ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .replace(/FromTo/gi, "From To")
      .replace(
        /\(?.*?Sale Report Updated Till\s*:?\s*[^\)]*\)?/gi,
        ""
      );


  const headerText = normalizedText;

  console.log("TEXT LENGTH:", normalizedText.length);
  console.log(
    "VALIDATOR INPUT PREVIEW:",
    text.substring(0,500)
  );

  const stockSalesMatch =
  text.match(
    /from\s*(\d{1,2}-[A-Za-z]{3}-\d{4})\s*to\s*(\d{1,2}-[A-Za-z]{3}-\d{4})/i
  );

if (stockSalesMatch) {

  console.log("MATCHED STOCK SALES");

  const startParts =
    stockSalesMatch[1].split("-");

  const fileMonth =
    monthMap[
      startParts[1]
        .toLowerCase()
    ];

  const fileYear =
    parseInt(startParts[2]);

  console.log(
    "Month:",
    fileMonth,
    "Year:",
    fileYear
  );

  return (
    fileMonth === (month - 1) &&
    fileYear === year
  );
}

      /* =========================
     EXCEL MONTH + STOCK END DATE
  ========================= */

  const monthColumnMatch =
    headerText.match(
      /month.*?(\d{4}[\/-]\d{1,2}[\/-]\d{1,2}).*?stock\s*end\s*date.*?(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/is
    );

  if (monthColumnMatch) {

    console.log("Matched : Excel Month");

    const startDate =
      new Date(
        monthColumnMatch[1].replace(/\//g, "-")
      );

    const endDate =
      new Date(
        monthColumnMatch[2].replace(/\//g, "-")
      );

    if (ok(startDate, endDate)) {

      console.log("Excel validation passed");

      return true;

    }

    console.log("Excel validation failed");

  }

    /* =========================
     RRPD PERIOD
  ========================= */

  const rrpdMatch =
    headerText.match(
      /period\s+of\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i
    );

  if (rrpdMatch) {

    console.log("Matched : RRPD");

    const startDate =
      new Date(rrpdMatch[1]);

    const endDate =
      new Date(rrpdMatch[2]);

    if (ok(startDate, endDate)) {

      console.log("RRPD validation passed");

      return true;

    }

    console.log("RRPD validation failed");

  }

    /* =========================
     FROM DD-MON-YY TO DD-MON-YY
  ========================= */

  const monthNameRangeMatch =
    headerText.match(
      /from\s*:?\s*(\d{1,2})[-\/ ](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\/ ](\d{2,4}).*?to\s*:?\s*(\d{1,2})[-\/ ](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\/ ](\d{2,4})/i
    );

  if (monthNameRangeMatch) {

    console.log("Matched : Month Name Range");

    let startYear = parseInt(monthNameRangeMatch[3]);
    let endYear = parseInt(monthNameRangeMatch[6]);

    if (startYear < 100) startYear += 2000;
    if (endYear < 100) endYear += 2000;

    const startDate =
      new Date(
        startYear,
        monthMap[
          monthNameRangeMatch[2]
            .substring(0,3)
            .toLowerCase()
        ],
        parseInt(monthNameRangeMatch[1])
      );

    const endDate =
      new Date(
        endYear,
        monthMap[
          monthNameRangeMatch[5]
            .substring(0,3)
            .toLowerCase()
        ],
        parseInt(monthNameRangeMatch[4])
      );

    if (ok(startDate,endDate)) {

      console.log("Month Name validation passed");

      return true;

    }

    console.log("Month Name validation failed");

  }

    /* =========================
     DD/MM/YYYY DATE RANGE
  ========================= */

  const dateRangeMatch =
    headerText.match(
      /(from|period|duration|statement)?\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}).*?(to|upto)?\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i
    );

  if (dateRangeMatch) {

    console.log("Matched : Numeric Date Range");

    const parseDate = (value) => {

      const p = value.split(/[\/-]/);

      let day = parseInt(p[0]);
      let monthValue = parseInt(p[1]);
      let yearValue = parseInt(p[2]);

      if (yearValue < 100)
        yearValue += 2000;

      return new Date(
        yearValue,
        monthValue - 1,
        day
      );

    };

    const startDate =
      parseDate(dateRangeMatch[2]);

    const endDate =
      parseDate(dateRangeMatch[4]);

    if (ok(startDate, endDate)) {

      console.log("Numeric Date validation passed");

      return true;

    }

    console.log("Numeric Date validation failed");

  }

    /* =========================
     OCR COMPRESSED FROM TO
  ========================= */

  const compressedFromToMatch =
    headerText.match(
      /from\s*to\s*(\d{2}\/\d{2}\/\d{4})\s*(\d{2}\/\d{2}\/\d{4})/i
    );

  if (compressedFromToMatch) {

    console.log("Matched : Compressed From-To");

    const parseDate = (value) => {

      const p = value.split("/");

      return new Date(
        parseInt(p[2]),
        parseInt(p[1]) - 1,
        parseInt(p[0])
      );

    };

    const startDate =
      parseDate(compressedFromToMatch[1]);

    const endDate =
      parseDate(compressedFromToMatch[2]);

    if (ok(startDate, endDate)) {

      console.log("Compressed From-To Passed");

      return true;

    }

    console.log("Compressed From-To Failed");

  }

  /* =========================
   MONTH ONLY
========================= */

const monthOnlyMatch =
  headerText.match(
    /(?:month\s+of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*['\-\s]?(\d{2,4})/i
  );

if (monthOnlyMatch) {

  console.log("Matched : Month Only");

  const fileMonth =
    monthMap[
      monthOnlyMatch[1]
        .substring(0,3)
        .toLowerCase()
    ];

  let fileYear =
    parseInt(monthOnlyMatch[2]);

  if (fileYear < 100)
    fileYear += 2000;

  if (
    fileMonth === (month - 1) &&
    fileYear === year
  ) {

    console.log("Month Only Passed");

    return true;

  }

}

  /* =========================
   FROM DD-M-YY TO DD.M.YY
========================= */

const mixedDateMatch =
  text.match(
    /from\s+(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})\s+to\s+(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})/i
  );

if (mixedDateMatch) {

  console.log("Matched : Mixed Date Format");

  let fileMonth =
    parseInt(mixedDateMatch[2]);

  let fileYear =
    parseInt(mixedDateMatch[3]);

  if (fileYear < 100) {
    fileYear += 2000;
  }

  console.log(
    "Month:",
    fileMonth,
    "Year:",
    fileYear
  );

  return (
    fileMonth === month &&
    fileYear === year
  );
}

/* =========================
   FROM DATE / TO DATE
========================= */

const fromDateMatch =
  text.match(
    /from\s*date\s*,?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*,?\s*to\s*date\s*,?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i
  );

if (fromDateMatch) {

  console.log("Matched : From Date To Date");

  let fileMonth =
    parseInt(fromDateMatch[1]);

  let fileYear =
    parseInt(fromDateMatch[3]);

  if (fileYear < 100) {
    fileYear += 2000;
  }

  console.log(
    "Month:",
    fileMonth,
    "Year:",
    fileYear
  );

  return (
    fileMonth === month &&
    fileYear === year
  );
}

/* =========================
   1 May,26 TO 31 May,26
========================= */

const monthNamePeriodMatch =
  text.match(
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?(\d{2,4})\s+to\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?(\d{2,4})/i
  );

if (monthNamePeriodMatch) {

  console.log("Matched : Month Name Period");

  const fileMonth =
    monthMap[
      monthNamePeriodMatch[2]
        .substring(0,3)
        .toLowerCase()
    ];

  let fileYear =
    parseInt(monthNamePeriodMatch[3]);

  if (fileYear < 100) {
    fileYear += 2000;
  }

  console.log(
    "Month:",
    fileMonth,
    "Year:",
    fileYear
  );

  return (
    fileMonth === (month - 1) &&
    fileYear === year
  );
}

  let periodFound = false;

    /* =========================
     GENERIC DATE EXTRACTION
  ========================= */

  const foundDates = [];

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyRegex =
    /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/g;

  let match;

  while ((match = dmyRegex.exec(headerText)) !== null) {

    let year = parseInt(match[3]);

    if (year < 100)
      year += 2000;

    foundDates.push(
      new Date(
        year,
        parseInt(match[2]) - 1,
        parseInt(match[1])
      )
    );

  }

  // DD-MMM-YYYY
  const monRegex =
    /\b(\d{1,2})[- ](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[- ](\d{2,4})\b/gi;

  while ((match = monRegex.exec(headerText)) !== null) {

    let year = parseInt(match[3]);

    if (year < 100)
      year += 2000;

    foundDates.push(
      new Date(
        year,
        monthMap[
          match[2]
            .substring(0,3)
            .toLowerCase()
        ],
        parseInt(match[1])
      )
    );

  }

  // YYYY-MM-DD
  const ymdRegex =
    /\b(\d{4})-(\d{2})-(\d{2})\b/g;

  while ((match = ymdRegex.exec(headerText)) !== null) {

    foundDates.push(
      new Date(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3])
      )
    );

  }

  if (!periodFound) {

    console.log(
      "Rejected - No period header found"
    );

    for(let i=0;i<foundDates.length-1;i++){

      const startDate =
        foundDates[i];

      const endDate =
        foundDates[i+1];

      const days =
        Math.abs(
          (endDate-startDate)/
          (1000*60*60*24)
        );

      if(days<=31){

        if(ok(startDate,endDate)){

          console.log(
            "Matched : Generic Dates"
          );

          return true;

        }

      }

    }

  }

   /* =========================
     HEADER DATE RANGE
  ========================= */

  const headerRangeMatch =
    headerText.match(
      /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}-[A-Za-z]{3}-\d{2,4}).{0,20}(?:TO|-).{0,20}(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}-[A-Za-z]{3}-\d{2,4})/i
    );

  if (headerRangeMatch) {

    console.log("Matched : Header Range");

    function parseAnyDate(value){

      if(/[A-Za-z]/.test(value)){

        const p=value.split("-");

        let y=parseInt(p[2]);

        if(y<100)
          y+=2000;

        return new Date(
          y,
          monthMap[
            p[1]
              .substring(0,3)
              .toLowerCase()
          ],
          parseInt(p[0])
        );

      }

      const p=value.split(/[\/-]/);

      let y=parseInt(p[2]);

      if(y<100)
        y+=2000;

      return new Date(
        y,
        parseInt(p[1])-1,
        parseInt(p[0])
      );

    }

    const startDate =
      parseAnyDate(
        headerRangeMatch[1]
      );

    const endDate =
      parseAnyDate(
        headerRangeMatch[2]
      );

    if(ok(startDate,endDate)){

      console.log(
        "Header Range Passed"
      );

      return true;

    }

    console.log(
      "Header Range Failed"
    );

  }

  /* =========================
   REPORT DATE COLUMNS
========================= */

if (
  /report[_ ]?date/i.test(text) ||
  /sns[_ ]?month/i.test(text) ||
  /\bmonth\b/i.test(text)
) {

  console.log(
    "Matched : Report Date Column"
  );

  const dateMatch =
    text.match(
      /(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})/
    );

  if (dateMatch) {

    const fileYear =
      parseInt(dateMatch[1]);

    const fileMonth =
      parseInt(dateMatch[2]);

    return (
      fileMonth === month &&
      fileYear === year
    );

  }
}

  // Next validation will come here.


  console.log("================================");
  console.log("VALIDATION RESULT: false");
  console.log("TEXT PREVIEW:");
  console.log(headerText.substring(0, 2000));
  console.log("================================");

  return false;

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

      console.log("FILE NAME:", file.originalname);
      console.log("EXTENSION:", ext);

      const allowed = [
        "pdf",
        "xlsx",
        "xls",
        "csv",
        "doc",
        "docx",
        "txt",
        "html",
        "htm"
      ];

      console.log("ALLOWED:", allowed);

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

          console.log("TEXT PASSED TO VALIDATOR");
          console.log(text.substring(0,2000));
          console.log("TEXT LENGTH:", text.length);

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
                "INVALID MONTH"
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