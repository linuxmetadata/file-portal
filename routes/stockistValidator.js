function normalizeName(name = "") {

    return name
        .toUpperCase()

        .replace(/&/g, " AND ")

        .replace(/\bM\/S\b/g, "")
        .replace(/\bMS\b/g, "")
        .replace(/\bMESSRS\b/g, "")

        .replace(/\bSHREE\b/g, "SHRI")
        .replace(/\bSRI\b/g, "SHRI")

        .replace(/\bAGENCIES\b/g, "AGENCY")
        .replace(/\bDISTRIBUTORS\b/g, "DISTRIBUTOR")
        .replace(/\bMEDICALS\b/g, "MEDICAL")
        .replace(/\bPHARMACEUTICALS\b/g, "PHARMA")
        .replace(/\bPHARMACY\b/g, "PHARMA")

        .replace(/[^A-Z0-9 ]/g, " ")

        .replace(/\s+/g, " ")

        .trim();

}
function cleanBusinessName(name = "") {

    return normalizeName(name)

        .replace(/^SHRI\s+/,"")

        .replace(/\bAGENCY\b/g,"")
        .replace(/\bDISTRIBUTOR\b/g,"")
        .replace(/\bMEDICAL\b/g,"")
        .replace(/\bPHARMA\b/g,"")
        .replace(/\bENTERPRISE\b/g,"")
        .replace(/\bENTERPRISES\b/g,"")
        .replace(/\bTRADERS\b/g,"")
        .replace(/\bSTORE\b/g,"")
        .replace(/\bSTORES\b/g,"")
        .replace(/\bCHEMIST\b/g,"")
        .replace(/\bDRUGS\b/g,"")
        .replace(/\bPRIVATE\b/g, "PVT")
        .replace(/\bLIMITED\b/g, "LTD")
        .replace(/\bPVT\s+LTD\b/g, "PVT LTD")
        .replace(/\bPVT\.?\b/g,"PVT")
        .replace(/\bLTD\.?\b/g,"LTD")

        .replace(/\s+/g," ")
        .replace(/\s*-\s*[A-Z ]+$/,"")
        .trim();

}
function extractStockistName(text = "") {

    const header = text
        .replace(/\r/g, "\n")
        .replace(/\t/g, " ")
        .replace(/[ ]+/g, " ")
        .substring(0, 2500);

    let m;

    /*----------------------------------------------------
      Statements of XXXXX
    -----------------------------------------------------*/
    m = header.match(/Statements?\s+of\s+([^\n]+)/i);

    if (m)
        return m[1].trim();



    /*----------------------------------------------------
      Product Stock Report XXXXX
    -----------------------------------------------------*/
    m = header.match(/Product\s+Stock\s+Report\s+([^\n]+)/i);

    if (m)
        return m[1].trim();



    /*----------------------------------------------------
      XXXXX Stock & Sales Statement
    -----------------------------------------------------*/
    m = header.match(/^(.+?)\s+Stock\s*&\s*Sales\s+Statement/im);

    if (m)
        return m[1].trim();



    /*----------------------------------------------------
      Saleable Stock Report
      (Company name is first line)
    -----------------------------------------------------*/
    if (/Saleable\s+Stock\s+Report/i.test(header)) {

        const lines = header
            .split(/\n/)
            .map(x => x.trim())
            .filter(Boolean);

        if (lines.length)
            return lines[0];

    }



    /*----------------------------------------------------
      Stock Statement (Datewise)
      (First line is stockist)
    -----------------------------------------------------*/
    if (/Stock\s+Statement/i.test(header)) {

        const lines = header
            .split(/\n/)
            .map(x => x.trim())
            .filter(Boolean);

        if (lines.length)
            return lines[0];

    }

//======================================================
// CIPLA / Linux PDF
//======================================================

const lines = text
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

const idx = lines.findIndex(x =>
    /STOCK\s*&\s*SALES\s*STATEMENT/i.test(x)
);

if (idx > 0) {

    for (let i = idx - 1; i >= 0; i--) {

        const line = lines[i];

        if (
            /Company|Division|Date\/Time|Contact|Phone|Email|EMail/i.test(line)
        )
            continue;

        if (line.length < 5)
            continue;

        return line;
    }
}


    /*----------------------------------------------------
      Product Stock Report
      MFG Company...
      Company is previous line
    -----------------------------------------------------*/
    const lines = header
        .split(/\n/)
        .map(x => x.trim())
        .filter(Boolean);

    for (let i = 1; i < lines.length; i++) {

        if (/MFG\s+Company/i.test(lines[i])) {

            return lines[i - 1];

        }

    }

    return "";

}
async function validateStockist(text, dashboardName) {

    console.log("================================");
    console.log("STOCKIST VALIDATION");
    console.log("================================");

    console.log("Dashboard Name :", dashboardName);

    let extractedName = extractStockistName(text);

if (!extractedName) {

    console.log("Trying Fallback...");

    extractedName = fallbackExtract(text);

}

    console.log("Extracted :", extractedName);

    if (!extractedName) {

        console.log("❌ Unable to extract stockist name.");

        return {

            valid: false,

            reason: "STOCKIST NAME NOT FOUND",

            extractedName: "",

            dashboardName,

            normalizedDocument: "",

            normalizedDashboard: ""

        };

    }

    const normalizedDocument =
        normalizeName(extractedName);

    const normalizedDashboard =
        normalizeName(dashboardName);

    const documentClean =
        cleanBusinessName(extractedName);

    const dashboardClean =
        cleanBusinessName(dashboardName);

    const documentCompact =
        documentClean.replace(/\s/g, "");

    const dashboardCompact =
        dashboardClean.replace(/\s/g, "");

    let valid = false;

if (documentCompact && dashboardCompact) {

    valid =
        documentCompact.includes(dashboardCompact) ||
        dashboardCompact.includes(documentCompact);

}

/* Second chance */

if (!valid) {

    const docWords = documentClean.split(" ");
    const dashWords = dashboardClean.split(" ");

    let matched = 0;

    dashWords.forEach(w => {

        if (docWords.includes(w))
            matched++;

    });

    if (matched >= Math.min(2, dashWords.length)) {

        valid = true;

    }

}

    console.log("Normalized Document :", normalizedDocument);
    console.log("Normalized Dashboard :", normalizedDashboard);

    console.log("Document Clean :", documentClean);
    console.log("Dashboard Clean :", dashboardClean);

    console.log("Document Compact :", documentCompact);
    console.log("Dashboard Compact :", dashboardCompact);

    console.log("VALID :", valid);

    return {

        valid,

        reason: valid ? "" : "INVALID STOCKIST NAME",

        extractedName,

        dashboardName,

        normalizedDocument,

        normalizedDashboard

    };

}
function fallbackExtract(text = "") {

    const lines = text
        .split(/\r?\n/)
        .map(x => x.trim())
        .filter(Boolean);

    for (let line of lines.slice(0, 15)) {

        if (
            /Company/i.test(line) ||
            /Run Date/i.test(line) ||
            /From\s*:/i.test(line) ||
            /To\s*:/i.test(line) ||
            /Statement/i.test(line) ||
            /Product/i.test(line)
        ) {
            continue;
        }

        if (
            line.length > 4 &&
            line.length < 80 &&
            /[A-Za-z]/.test(line)
        ) {
            return line;
        }
    }

    return "";

}
module.exports = {
    validateStockist
};