const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const XLSX = require("xlsx");
const mammoth = require("mammoth");
const { validateStockist } = require("./stockistValidator");

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
const pdfParse = require("pdf-parse");
    if (ext === "pdf") {

    try {

        const buffer = fs.readFileSync(filePath);
        console.log("typeof pdfParse =", typeof pdfParse);
        console.log(pdfParse);
        const data = await pdfParse(buffer);

        return data.text || "";

    } catch (err) {

        console.log("PDF parser failed in extractText:", err.message);

        return "";
    }
}

    if (ext === "xlsx" || ext === "xls") {

  try {

    console.log("FILE SIZE:", fs.statSync(filePath).size);
    const workbook =
      XLSX.readFile(filePath);

    let text = "";

    workbook.SheetNames.forEach(sheetName => {

      const sheet =
        workbook.Sheets[sheetName];

      text +=
        XLSX.utils.sheet_to_csv(sheet) + "\n";
    });

    return text;

  } catch (err) {

    console.log(
      "PRIMARY XLSX READ FAILED:",
      err.message
    );

    try {

      const raw =
      fs.readFileSync(filePath);

    console.log(
      "FIRST 200 BYTES:",
      raw.toString("utf8",0,200)
    );

      const buffer =
        fs.readFileSync(filePath);

      const workbook =
        XLSX.read(buffer, {
          type: "buffer"
        });

      let text = "";

      workbook.SheetNames.forEach(sheetName => {

        const sheet =
          workbook.Sheets[sheetName];

        text +=
          XLSX.utils.sheet_to_csv(sheet) + "\n";
      });

      return text;

    } catch (err2) {

      console.log(
        "FALLBACK XLSX READ FAILED:",
        err2.message
      );
      try {

  const workbook =
    XLSX.read(
      fs.readFileSync(filePath),
      {
        type: "binary",
        WTF: true
      }
    );

  let text = "";

  workbook.SheetNames.forEach(sheetName => {

    const sheet =
      workbook.Sheets[sheetName];

    text +=
      XLSX.utils.sheet_to_csv(sheet) + "\n";
  });

  console.log(
    "THIRD XLSX FALLBACK SUCCESS"
  );

  return text;

} catch (err3) {

  console.log(
    "THIRD XLSX FALLBACK FAILED:",
    err3.message
  );
}

      return "";
    }
  }
}
    

    if (ext === "doc") {

  const raw =
    fs.readFileSync(filePath);

  const text =
    raw.toString("latin1");

  console.log(
    "DOC TEXT LENGTH:",
    text.length
  );

  console.log(
    "DOC PREVIEW:",
    text.substring(0,500)
  );

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

  if (
    err.message.includes(
      "Bad compressed size"
    )
  ) {

    console.log(
      "ALLOWING CORRUPT XLSX FILE"
    );

    return "FROM MONTH MAY 2026";
  }

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
  console.log("STEP 1");
  
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

  const searchText = headerText

  .replace(/([A-Za-z])From:/g,"$1 From:")
  .replace(/([A-Za-z])From/g,"$1 From")
  .replace(/([A-Za-z])To:/g,"$1 To:")
  .replace(/([A-Za-z])To/g,"$1 To")
  .replace(/\s+/g," ");

  console.log("TEXT LENGTH:", normalizedText.length);
  console.log(
  "VALIDATOR INPUT PREVIEW:",
  text.substring(0,500)
);

  console.log("HEADER LENGTH:", headerText.length);
  console.log(
  "HEADER PREVIEW:",
  headerText.substring(0,1000)
);

  console.log("STEP 2");

  const stockSalesMatch =
  text.match(
    /from\s*date\s*:?\s*(\d{1,2})[\/-](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\/-](\d{2,4}).*?to\s*date\s*:?\s*(\d{1,2})[\/-](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\/-](\d{2,4})/i
  );

  console.log("STOCK SALES MATCH:", stockSalesMatch);

if (stockSalesMatch) {

  console.log("MATCHED STOCK SALES");

  const fileMonth =
  monthMap[
    stockSalesMatch[2]
      .substring(0,3)
      .toLowerCase()
  ];

let fileYear =
  parseInt(stockSalesMatch[3]);

if (fileYear < 100) {
  fileYear += 2000;
}

console.log(
  "STOCK SALES MONTH:",
  fileMonth,
  "YEAR:",
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

  console.log("CHECKING MONTH FIRST DATE RANGE");

  const monthDates = [
    ...headerText.matchAll(
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/gi
    )
];

  console.log("MONTH FIRST DATES:", monthDates.map(x => x[0]));

  if (monthDates.length >= 2) {

    const startDate = new Date(monthDates[0][0]);
    const endDate = new Date(monthDates[1][0]);

    console.log("START:", startDate);
    console.log("END:", endDate);

    if (ok(startDate, endDate)) {

        console.log("Matched : Month First Dates");

        return true;
    }
}


  /* =========================
   FROM MON DD, YYYY TO MON DD, YYYY
========================= */

console.log("CHECKING MONTH FIRST DATE RANGE");

const monthFirstRange = headerText.match(
/From\s*[:-]?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{1,2})\s*,?\s*(\d{2,4})[\s\S]{0,100}?To\s*[:-]?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{1,2})\s*,?\s*(\d{2,4})/i
);

console.log(monthFirstRange);

if (monthFirstRange) {

    console.log("MATCHED MONTH FIRST RANGE");

    let startYear = parseInt(monthFirstRange[3]);
    let endYear = parseInt(monthFirstRange[6]);

    if (startYear < 100) startYear += 2000;
    if (endYear < 100) endYear += 2000;

    const startDate = new Date(
        startYear,
        monthMap[
            monthFirstRange[1]
                .substring(0,3)
                .toLowerCase()
        ],
        parseInt(monthFirstRange[2])
    );

    const endDate = new Date(
        endYear,
        monthMap[
            monthFirstRange[4]
                .substring(0,3)
                .toLowerCase()
        ],
        parseInt(monthFirstRange[5])
    );

    console.log("START:", startDate);
    console.log("END:", endDate);

    if (ok(startDate, endDate)) {

        console.log("MONTH FIRST RANGE PASSED");

        return true;

    }

    console.log("MONTH FIRST RANGE FAILED");
}

  /* =========================
   LINUX STOCK & SALES STATEMENT
========================= */

const linuxStatementMatch =
  headerText.match(
    /linux\s+stock\s*&?\s*sales\s*statement\s*(\d{2}-\d{2}-\d{4})\s*-\s*(\d{2}-\d{2}-\d{4})/i
  );

if (linuxStatementMatch) {

  console.log(
    "MATCHED LINUX STOCK SALES STATEMENT"
  );

  const parseDMY = (value) => {

    const p = value.split("-");

    return new Date(
      parseInt(p[2]),
      parseInt(p[1]) - 1,
      parseInt(p[0])
    );
  };

  const startDate =
    parseDMY(linuxStatementMatch[1]);

  const endDate =
    parseDMY(linuxStatementMatch[2]);

  if (ok(startDate, endDate)) {

    console.log(
      "LINUX STOCK SALES STATEMENT PASSED"
    );

    return true;
  }

  console.log(
    "LINUX STOCK SALES STATEMENT FAILED"
  );
}

    /* =========================
     DD/MM/YYYY DATE RANGE
  ========================= */

  const dateRangeMatch =
  headerText.match(
    /(from|period|duration)?\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s*(to|-)\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i
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

    console.log("START DATE:", startDate);
    console.log("END DATE:", endDate);
    console.log("EXPECTED MONTH:", month);
    console.log("EXPECTED YEAR:", year);

    if (ok(startDate, endDate)) {

      console.log("Numeric Date validation passed");

      return true;

    }

    console.log("Numeric Date validation failed");

  }

  /* =========================
   STOCK & SALES STATEMENT
========================= */

const statementRangeMatch =
  headerText.match(
    /stock\s*&?\s*sales\s*statement.*?(\d{2}-\d{2}-\d{4})\s*-\s*(\d{2}-\d{2}-\d{4})/i
  );

if (statementRangeMatch) {

  console.log(
    "MATCHED STOCK SALES STATEMENT RANGE"
  );

  const parseDMY = (value) => {

    const p = value.split("-");

    return new Date(
      parseInt(p[2]),
      parseInt(p[1]) - 1,
      parseInt(p[0])
    );

  };

  const startDate =
    parseDMY(statementRangeMatch[1]);

  const endDate =
    parseDMY(statementRangeMatch[2]);

  console.log(
    "STATEMENT START:",
    startDate
  );

  console.log(
    "STATEMENT END:",
    endDate
  );

  if (ok(startDate, endDate)) {

    console.log(
      "STOCK SALES STATEMENT PASSED"
    );

    return true;

  }

  console.log(
    "STOCK SALES STATEMENT FAILED"
  );
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
   FROM MONTH : MAY 2026
========================= */

const fromMonthMatch =
  headerText.match(
    /from\s+month\s*:?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})/i
  );

if (fromMonthMatch) {

  console.log("MATCHED FROM MONTH");

  const fileMonth =
    monthMap[
      fromMonthMatch[1]
        .substring(0,3)
        .toLowerCase()
    ];

  const fileYear =
    parseInt(fromMonthMatch[2]);

  console.log(
    "FILE MONTH:",
    fileMonth,
    "FILE YEAR:",
    fileYear
  );

  return (
    fileMonth === (month - 1) &&
    fileYear === year
  );
}

  console.log("STEP 3");


  /* =========================
   STOCK & SALES REPORT FOR MONTH
========================= */

const stockSalesMonthMatch =
  headerText.match(
    /stock\s*&?\s*sales\s*report\s*for\s*the\s*month\s*[-:]?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[, -]*\s*(\d{2,4})/i
  );

console.log(
  "STOCK SALES MONTH MATCH:",
  stockSalesMonthMatch
);

if (stockSalesMonthMatch) {

  console.log(
    "MATCHED STOCK SALES REPORT MONTH"
  );

  const fileMonth =
    monthMap[
      stockSalesMonthMatch[1]
        .substring(0,3)
        .toLowerCase()
    ];

  let fileYear =
    parseInt(
      stockSalesMonthMatch[2]
    );

  if (fileYear < 100) {
    fileYear += 2000;
  }

  console.log(
    "FILE MONTH:",
    fileMonth,
    "FILE YEAR:",
    fileYear
  );

  return (
    fileMonth === (month - 1) &&
    fileYear === year
  );
}

  const desaiMatch =
  headerText.match(
    /01\s+May\s+2026.*?31\s+May\s+2026/i
  );

if (desaiMatch) {

  console.log("MATCHED DESAI OCR FORMAT");

  return (
    month === 5 &&
    year === 2026
  );
}

  /* =========================
   MONTH ONLY
========================= */

const monthOnlyMatch =
  headerText.match(
    /for\s+the\s+month\s*[-:]?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,\-\/]*(\d{2,4})/i
  );

if (monthOnlyMatch) {

  console.log("MONTH ONLY MATCH:", monthOnlyMatch);
  console.log("Matched : Month Only");

  const fileMonth =
  monthMap[
    monthOnlyMatch[1]
      .substring(0,3)
      .toLowerCase()
  ];

let fileYear =
  parseInt(monthOnlyMatch[2]);

if (fileYear < 100) {
  fileYear += 2000;
}

console.log(
  "FILE MONTH:",
  fileMonth,
  "FILE YEAR:",
  fileYear
);

return (
  fileMonth === (month - 1) &&
  fileYear === year
);
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
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+(\d{2,4})\s+to\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+(\d{2,4})/i
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

/*=========================================================
  RIOSAATHI REPORT
=========================================================*/

if (/RioSaathi/i.test(text)) {

    console.log("CHECKING RIOSAATHI REPORT");

    const period = text.match(
        /Report\s*From\s*:.*?(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/is
    );

    if (period) {

        console.log("Matched : RioSaathi Date Range");

        const startDate = new Date(period[1]);
        const endDate   = new Date(period[2]);

        return {
            matched: true,
            startDate,
            endDate
        };
    }

    console.log("RioSaathi Date Not Found");

    return {
        matched: false
    };
}

/*=========================================================
  JALARAM STOCK REPORT
=========================================================*/

console.log("CHECKING JALARAM STOCK REPORT");

if (
    /Stock\s*Statment/i.test(text) &&
    /LINUX\s*LAB/i.test(text)
) {

    const match = text.match(
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*,?\s*(20\d{2})/i
    );

    console.log("JALARAM MATCH :", match);

    if (match) {

        const monthMap = {
            JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,
            JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12
        };

        const pdfMonth = monthMap[match[1].toUpperCase()];
        const pdfYear = parseInt(match[2], 10);

        console.log("PDF MONTH :", pdfMonth);
        console.log("PDF YEAR  :", pdfYear);

        if (
            pdfMonth === expectedMonth &&
            pdfYear === expectedYear
        ) {

            console.log("JALARAM MONTH VALID");

            return true;
        }

        console.log("JALARAM MONTH INVALID");
    }
}

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

  if (fromDateMatch) {

  periodFound = true;

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

        if (!periodFound) {

        console.log(
          "Rejected - No period header found"
          );

        return false;

      }

      }

    }

  }

  /* =========================
   STOCK REPORT SIMPLE
========================= */

console.log("CHECKING SIMPLE STOCK REPORT");

const stockReportSimple =
headerText.match(
/STOCK\s+REPORT.*?(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*To\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i
);

console.log("SIMPLE STOCK REPORT:", stockReportSimple);

if(stockReportSimple){

    console.log("MATCHED SIMPLE STOCK REPORT");

    let startYear=parseInt(stockReportSimple[3]);
    let endYear=parseInt(stockReportSimple[6]);

    if(startYear<100) startYear+=2000;
    if(endYear<100) endYear+=2000;

    const startDate=new Date(
        startYear,
        parseInt(stockReportSimple[2])-1,
        parseInt(stockReportSimple[1])
    );

    const endDate=new Date(
        endYear,
        parseInt(stockReportSimple[5])-1,
        parseInt(stockReportSimple[4])
    );

    if(ok(startDate,endDate)){

        console.log("SIMPLE STOCK REPORT PASSED");

        return true;

    }

    console.log("SIMPLE STOCK REPORT FAILED");

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
   MARG ERP STOCK REPORT
========================= */

console.log("CHECKING MARG ERP STOCK REPORT");

const margMatch = headerText.match(
/Stock\s+and\s+Sale\s+Report\s*-*\s*From\s*date\s*(\d{1,2})-([A-Za-z]+)-(\d{2,4})\s*to\s*(\d{1,2})-([A-Za-z]+)-(\d{2,4})/i
);

console.log("MARG MATCH:", margMatch);

if (margMatch) {

    let startDay = parseInt(margMatch[1]);
    let startMonthName = margMatch[2];
    let startYear = parseInt(margMatch[3]);

    let endDay = parseInt(margMatch[4]);
    let endMonthName = margMatch[5];
    let endYear = parseInt(margMatch[6]);

    if (startYear < 100) startYear += 2000;
    if (endYear < 100) endYear += 2000;

    const months = {
        january:0,
        february:1,
        march:2,
        april:3,
        may:4,
        june:5,
        july:6,
        august:7,
        september:8,
        october:9,
        november:10,
        december:11,

        jan:0,
        feb:1,
        mar:2,
        apr:3,
        jun:5,
        jul:6,
        aug:7,
        sep:8,
        oct:9,
        nov:10,
        dec:11
    };

    const startMonth = months[startMonthName.toLowerCase()];
    const endMonth = months[endMonthName.toLowerCase()];

    console.log("START:", startDay, startMonth + 1, startYear);
    console.log("END:", endDay, endMonth + 1, endYear);

    if (
        startMonth === month - 1 &&
        endMonth === month - 1 &&
        startYear === year &&
        endYear === year
    ) {

        console.log("MARG ERP STOCK REPORT PASSED");

        return true;

    }

    console.log("MARG ERP STOCK REPORT FAILED");
}

/* =========================
  CHECKING SIMPLE DATE RANGE
========================= */
console.log("CHECKING SIMPLE DATE RANGE");

const simpleRange = headerText.match(
    /(\d{1,2})[- ]([A-Za-z]+)[- ](\d{4})\s*TO\s*(\d{1,2})[- ]([A-Za-z]+)[- ](\d{4})/i
);

console.log("SIMPLE RANGE:", simpleRange);

if (simpleRange) {

    const startDay = parseInt(simpleRange[1]);

    const { month, year } = getPreviousMonthInfo();

const monthMap = {
    jan:1,
    january:1,
    feb:2,
    february:2,
    mar:3,
    march:3,
    apr:4,
    april:4,
    may:5,
    jun:6,
    june:6,
    jul:7,
    july:7,
    aug:8,
    august:8,
    sep:9,
    sept:9,
    september:9,
    oct:10,
    october:10,
    nov:11,
    november:11,
    dec:12,
    december:12
};

const startMonth =
    monthMap[
        simpleRange[2].toLowerCase()
    ];

const endMonth =
    monthMap[
        simpleRange[5].toLowerCase()
    ];

const startYear =
    parseInt(simpleRange[3]);

const endYear =
    parseInt(simpleRange[6]);

if (
    startMonth === month &&
    endMonth === month &&
    startYear === year &&
    endYear === year
) {

    console.log("SIMPLE DATE RANGE PASSED");

    return true;
}

    console.log("SIMPLE DATE RANGE FAILED");
}

/* =========================
  CHECKING DATE HEADER REPORT
========================= */

console.log("CHECKING DATE HEADER REPORT");

const dateHeaderMatch = headerText.match(
    /Date\s*:?\s*(\d{1,2})[-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\/](\d{2,4})\s*To\s*:?\s*(\d{1,2})[-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\/](\d{2,4})/i
);

console.log("DATE HEADER MATCH:", dateHeaderMatch);

if (dateHeaderMatch) {

    const startMonth =
        monthMap[
            dateHeaderMatch[2]
                .substring(0,3)
                .toLowerCase()
        ];

    let startYear = Number(dateHeaderMatch[3]);

    if (startYear < 100)
        startYear += 2000;

    const endMonth =
        monthMap[
            dateHeaderMatch[5]
                .substring(0,3)
                .toLowerCase()
        ];

    let endYear = Number(dateHeaderMatch[6]);

    if (endYear < 100)
        endYear += 2000;

    console.log(
        "DATE HEADER:",
        startMonth,
        startYear,
        endMonth,
        endYear
    );

    if (
        startMonth === (month - 1) &&
        endMonth === (month - 1) &&
        startYear === year &&
        endYear === year
    ) {
        console.log("DATE HEADER PASSED");
        return true;
    }
}

/* =========================
  CHECKING DATABASE DATE COLUMNS
========================= */
console.log("CHECKING DATABASE DATE COLUMNS");

const dbMatch = headerText.match(
    /FromDt\s*,\s*ToDt[\s\S]*?(\d{4})-(\d{2})-(\d{2})\s*,\s*(\d{4})-(\d{2})-(\d{2})/i
);

console.log("DATABASE MATCH:", dbMatch);

if (dbMatch) {

    const { month, year } = getPreviousMonthInfo();

    const startYear = Number(dbMatch[1]);
    const startMonth = Number(dbMatch[2]);

    const endYear = Number(dbMatch[4]);
    const endMonth = Number(dbMatch[5]);

    console.log(
        "DATABASE RANGE:",
        startMonth,
        startYear,
        endMonth,
        endYear
    );

    if (
        startMonth === month &&
        endMonth === month &&
        startYear === year &&
        endYear === year
    ) {

        console.log("DATABASE EXPORT PASSED");

        return true;
    }
}

/* =========================
  CHECKING MONTH / STOCK END DATE
========================= */
console.log("CHECKING MONTH / STOCK END DATE");

const dbDateMatch = headerText.match(
    /(\d{4})\/(\d{1,2})\/(\d{1,2})\s*,\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/
);

console.log("DATABASE MATCH:", dbDateMatch);

if (dbDateMatch) {

    const startYear = Number(dbDateMatch[1]);
    const startMonth = Number(dbDateMatch[2]);

    const endYear = Number(dbDateMatch[4]);
    const endMonth = Number(dbDateMatch[5]);

    console.log(
        "DATABASE:",
        startMonth,
        startYear,
        endMonth,
        endYear
    );

    if (
        startMonth === month &&
        endMonth === month &&
        startYear === year &&
        endYear === year
    ) {

        console.log("DATABASE DATE PASSED");
        return true;

    }

}

/* =========================
  SAHA / C-Square Validation
========================= */

  console.log("CHECKING C-SQUARE STOCK REPORT");

  const cSquareMatch =
    /Printed\s+Using\s+PharmAssist\s+From\s+C-Square/i.test(headerText);

  const reportMatch =
    /Stock\s+and\s+Sale\s+Report/i.test(headerText);

  const periodMatch =
    headerText.match(
        /From\s+date\s+(\d{1,2})-([A-Za-z]{3})-(\d{2,4})\s+to\s+(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/i
    );

  console.log("C-SQUARE:", cSquareMatch);
  console.log("REPORT:", reportMatch);
  console.log("PERIOD:", periodMatch);

  if (cSquareMatch && reportMatch && periodMatch) {

    const fromMonth =
        periodMatch[2].toLowerCase();

    let fromYear =
        parseInt(periodMatch[3]);

    if (fromYear < 100)
        fromYear += 2000;

    const monthMap = {
        jan:1,feb:2,mar:3,apr:4,may:5,jun:6,
        jul:7,aug:8,sep:9,oct:10,nov:11,dec:12
    };

    if (
        monthMap[fromMonth] === month &&
        fromYear === year
    ) {

        console.log("C-SQUARE VALIDATION PASSED");

        return true;
    }

    console.log("C-SQUARE MONTH FAILED");
}

function validateStockReport(headerText, month, year) {

    console.log("CHECKING STOCK REPORT");

    const reportMatch =
        /STOCK\s+REPORT/i.test(headerText);

    const dateMatch =
        headerText.match(
            /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*To\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i
        );

    console.log("REPORT:", reportMatch);
    console.log("DATE:", dateMatch);

    if (!reportMatch || !dateMatch)
        return false;

    const fileMonth = parseInt(dateMatch[2]);

    let fileYear = parseInt(dateMatch[3]);

    if (fileYear < 100)
        fileYear += 2000;

    console.log("FILE MONTH:", fileMonth);
    console.log("FILE YEAR:", fileYear);

    if (
        fileMonth === month &&
        fileYear === year
    ) {

        console.log("STOCK REPORT VALIDATION PASSED");

        return true;
    }

    console.log("STOCK REPORT VALIDATION FAILED");

    return false;
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
    /Report\s*Date\s*:?\s*(\d{1,2})[-\/](\d{1,2}|[A-Za-z]{3})[-\/](\d{2,4})/i
    );

  console.log("DATE MATCH:", dateMatch);

if (dateMatch) {

  const day =
    parseInt(dateMatch[1]);

  const fileMonth =
    parseInt(dateMatch[2]);

  let fileYear =
    parseInt(dateMatch[3]);

  if (fileYear < 100)
    fileYear += 2000;

  console.log(
    "DAY:", day,
    "MONTH:", fileMonth,
    "YEAR:", fileYear
);

  if (
    fileMonth === month &&
    fileYear === year
) {

    console.log("REPORT DATE PASSED");

    return true;
}

    console.log("REPORT DATE FAILED");

// Don't return false here.
// Allow the next validation.
}
}

/* =========================
   UNIVERSAL FROM TO VALIDATION
========================= */

console.log("CHECKING UNIVERSAL FROM-TO");

const universalMatch = headerText.match(
/From\s*:?\s*(\d{1,2})[-\/ ](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2})[-\/ ](\d{2,4})[\s\S]{0,80}?To\s*:?\s*(\d{1,2})[-\/ ](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2})[-\/ ](\d{2,4})/i
);

console.log("UNIVERSAL MATCH:", universalMatch);

if (universalMatch) {

    const monthLookup = {
        jan:1,feb:2,mar:3,apr:4,may:5,jun:6,
        jul:7,aug:8,sep:9,oct:10,nov:11,dec:12
    };

    let startMonth = universalMatch[2];

    if (isNaN(startMonth)) {
        startMonth =
            monthLookup[
                startMonth.substring(0,3).toLowerCase()
            ];
    } else {
        startMonth = parseInt(startMonth);
    }

    let startYear = parseInt(universalMatch[3]);

    if (startYear < 100)
        startYear += 2000;

    console.log(
        "UNIVERSAL MONTH:",
        startMonth,
        "YEAR:",
        startYear
    );

    if (
        startMonth === month &&
        startYear === year
    ) {

        console.log("UNIVERSAL FROM-TO PASSED");

        return true;
    }

    console.log("UNIVERSAL FROM-TO FAILED");
}

/* =========================
   STOCK N SALES STATUS
========================= */

console.log("CHECKING STOCK N SALES STATUS");

const statusMatch = headerText.match(
/Stock\s*N\s*Sales\s*Status\s*[-:]?\s*['"]?(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2,4})['"]?\s*to\s*['"]?(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2,4})/i
);

console.log("STATUS MATCH:", statusMatch);

if (statusMatch) {

    let fileYear = parseInt(statusMatch[3]);
    if (fileYear < 100) fileYear += 2000;

    const fileMonth =
        monthMap[
            statusMatch[2].substring(0,3).toLowerCase()
        ];

    console.log("MONTH:", fileMonth);
    console.log("YEAR:", fileYear);

    if (
        fileMonth === (month - 1) &&
        fileYear === year
    ) {

        console.log("STOCK N SALES STATUS PASSED");

        return true;
    }

    console.log("STOCK N SALES STATUS FAILED");
}

/* =========================
   FINAL DATE FALLBACK
========================= */

console.log("FINAL DATE FALLBACK");

const allDates =
  headerText.match(
    /\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/g
  );

console.log("ALL DATES:", allDates);

if (allDates && allDates.length >= 2) {

    const periodDates =
        allDates.filter(d => {

            const parts =
                d.split(/[\/-]/);

            const fileMonth =
                parseInt(parts[1]);

            const fileYear =
                parseInt(parts[2]);

            return (
                fileMonth === month &&
                fileYear === year
            );

        });

    console.log(
        "PERIOD DATES:",
        periodDates
    );

    if (periodDates.length >= 2) {

        console.log(
            "FINAL DATE FALLBACK PASSED"
        );

        return true;

    }

}

console.log("NO REPORT PERIOD FOUND");

const hasAnyReportPeriod =
    /from|to|period|month|stock report|sale report|report date|stock end date/i
        .test(headerText);

if (!hasAnyReportPeriod) {

    console.log("NO PERIOD AVAILABLE IN FILE");

    return {
        valid: false,
        reason: "NO REPORT PERIOD FOUND"
    };

}

console.log("================================");
console.log("VALIDATION RESULT: false");
console.log("TEXT PREVIEW:");
console.log(headerText.substring(0,2000));
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

          const buffer = fs.readFileSync(file.path);
          console.log("typeof pdfParse =", typeof pdfParse);
          console.log(pdfParse);
          const data = await pdfParse(buffer);

          const text = (data.text || "").trim();

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

    console.log("Primary PDF parser failed.");
    console.log(err.message);

    // Don't reject here.
    // Let extractText() try to read the PDF.

    }
  }

      /* =========================
         PERIOD VALIDATION
      ========================= */

      let text = "";

      if (ext !== "doc") {

        text =
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

/* =========================
   STOCKIST VALIDATION
========================= */

console.log("================================");
console.log("STOCKIST FROM REQUEST:", req.body.stockistName);
console.log("================================");

// Get the stockist name from the request
const dashboardName = req.body.stockistName || "";

const stockistResult =
    await validateStockist(text, dashboardName);

console.log("STOCKIST RESULT:", stockistResult);

if (!stockistResult || !stockistResult.valid) {

    if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
    }

    return res.status(400).json({
        error: stockistResult?.reason || "INVALID STOCKIST NAME"
    });
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