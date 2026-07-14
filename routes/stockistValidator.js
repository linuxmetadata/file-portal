/*=========================================================
 STOCKIST VALIDATOR
=========================================================*/

function normalizeName(name = "") {

    return String(name)

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
        .replace(/\bPRIVATE\b/g,"")
        .replace(/\bLIMITED\b/g,"")
        .replace(/\bPVT\b/g,"")
        .replace(/\bLTD\b/g,"")
        .replace(/\bCOMPANY\b/g,"")
        .replace(/\bCO\b/g,"")

        .replace(/\s+/g," ")

        .trim();

}
/*=========================================================
 REMOVE GARBAGE
=========================================================*/

function removeGarbage(line = "") {

    return line

        .replace(/\s+/g, " ")

        .replace(/,+/g, " ")

        .replace(/[_-]{2,}/g, " ")

        .trim();

}



/*=========================================================
 IGNORE THESE LINES
=========================================================*/

function isCompanyLine(line = "") {

    line = line.toUpperCase();

    return (

    /PHONE/i.test(line) ||
    /EMAIL/i.test(line) ||
    /CONTACT/i.test(line) ||
    /GST/i.test(line) ||
    /TIN/i.test(line) ||
    /DL/i.test(line) ||
    /RUN DATE/i.test(line) ||
    /RUN TIME/i.test(line) ||
    /DATE\/TIME/i.test(line) ||
    /FROM/i.test(line) ||
    /TO/i.test(line) ||
    /PAGE/i.test(line) ||
    /PRODUCT/i.test(line) ||
    /ITEM/i.test(line) ||
    /PACK/i.test(line) ||
    /QTY/i.test(line) ||
    /SALE/i.test(line) ||
    /PURCHASE/i.test(line) ||
    /TOTAL/i.test(line) ||
    /LINUX/i.test(line) ||
    /LABORATORIES/i.test(line) ||
    /DIVISION/i.test(line) ||
    /SUPPLIER/i.test(line) ||
    /^Company\s*:/i.test(line) ||
    /MFG/i.test(line) ||
    /ABOUT:BLANK/i.test(line) ||
    /AUTHORIZED/i.test(line) ||
    /SIGNATORY/i.test(line)

);

}
/*=========================================================
 BUSINESS NAME SCORE
=========================================================*/

function scoreBusinessLine(line = "") {

    line = removeGarbage(line);

    if (!line)

        return 0;

    // Reject page numbers like 1/1, 2/3 etc.
    if (/^\d+\s*\/\s*\d+$/.test(line))
        return 0;

    // Reject lines containing only numbers/slashes
    if (/^[0-9\s\/().-]+$/.test(line))
        return 0;

    // Reject product names immediately
    if (
        /\b(VYSOV|TRIEXER|EBERNET|TABLET|TABLETS|TAB|CAPSULE|CAPSULES|CREAM|LOTION|SYRUP|INJECTION|MG|ML|GM)\b/i.test(line)
    ) {
    return 0;
    }

    if (isCompanyLine(line))

        return 0;
    // Reject column headers
    if (
        /^(FREE|TOTAL|QTY|ORDER|PRODUCT|OPENING|PURCHASE|SALES|CLOSING|STOCK|AMOUNT)$/i.test(line)
    ) {
        return 0;
    }

    if (
        /PRODUCTOPENINGPURCHASE/i.test(line) ||
        /TOTALSALESSALES/i.test(line) ||
        /SALESRET/i.test(line) ||
        /SHORTAGE/i.test(line)
        ) {
        return 0;
    }

    if (/^FOR\b/i.test(line))
        return 0;

    if (/AUTHORISED SIGNATORY/i.test(line))
        return 0;

    if (/AUTHORIZED SIGNATORY/i.test(line))
        return 0;

    let score = 0;

    if (/[A-Z]/i.test(line))

        score += 10;

    if (line.length > 5)

        score += 10;

    if (line.length < 70)

        score += 10;

    if (/MEDICAL/i.test(line))

        score += 30;

    if (/PHARMA/i.test(line))

        score += 30;

    if (/AGENCY/i.test(line))

        score += 30;

    if (/AGENCIES/i.test(line))

        score += 30;

    if (/DISTRIBUTOR/i.test(line))

        score += 30;

    if (/ENTERPRISE/i.test(line))

        score += 20;

    if (/CHEMIST/i.test(line))

        score += 20;

    if (/STORE/i.test(line))

        score += 20;

    if (/DRUG/i.test(line))

        score += 20;

    if (/TRADER/i.test(line))

        score += 20;

    if (/\d{4,}/.test(line))

        score -= 40;

    if (line.length > 90)

        score -= 40;


    if (/PVT/i.test(line))
        score += 15;

    if (/LTD/i.test(line))
        score += 15;

    if (/LIMITED/i.test(line))
        score += 15;

    if (/PRIVATE/i.test(line))
        score += 15;

    if (/AGENCY/i.test(line))
        score += 25;

    if (/MEDICAL/i.test(line))
        score += 25;

    if (/PHARMA/i.test(line))
        score += 25;

    if (/\bAND\b/i.test(line))
    score += 10;

    if (/\bDISTRIBUTOR/i.test(line))
        score += 40;

    if (/\bCHEMIST/i.test(line))
        score += 40;

    if (
    /ROAD/i.test(line) ||
    /STREET/i.test(line) ||
    /NAGAR/i.test(line) ||
    /HOSPITAL/i.test(line) ||
    /SHAHPORE/i.test(line) ||
    /AWAS/i.test(line) ||
    /RAJKOT/i.test(line)
)
    return 0;
    
    return score;

}
/*=========================================================
 EXTRACT STOCKIST NAME
=========================================================*/

function extractStockistName(text = "") {

    const header = text
        .replace(/\r/g, "\n")
        .replace(/\t/g, " ")
        .replace(/[ ]+/g, " ")
        .substring(0, 3000);

    let m;

    /*--------------------------------------------------
      Statements of XXXXX
    --------------------------------------------------*/
    m = header.match(/Statements?\s+of\s+([^\n]+)/i);

    if (m)
        return removeGarbage(m[1]);



    /*--------------------------------------------------
      Product Stock Report XXXXX
    --------------------------------------------------*/
    m = header.match(/Product\s+Stock\s+Report\s+([^\n]+)/i);

    if (m)
        return removeGarbage(m[1]);



    /*----------------------------------------------------
  CIPLA / Linux Stock & Sales Statement
-----------------------------------------------------*/

if (/STOCK\s*&\s*SALES\s*STATEMENT/i.test(header)) {

    const lines = header
        .split(/\r?\n/)
        .map(removeGarbage)
        .filter(Boolean);

    const companyIndex = lines.findIndex(x =>
        /^Company\s*:/i.test(x)
    );

    if (companyIndex >= 0) {

        for (let i = companyIndex + 1; i < lines.length; i++) {

            const line = lines[i];

            if (/^Division/i.test(line)) continue;
            if (/^Date/i.test(line)) continue;
            if (/^Contact/i.test(line)) continue;
            if (/^EMail/i.test(line)) continue;
            if (/^Phone/i.test(line)) continue;
            if (/STOCK\s*&\s*SALES/i.test(line)) break;

            if (
                line.length > 5 &&
                /[A-Za-z]/.test(line)
            ) {
                return line;
            }
        }
    }
}

    /*--------------------------------------------------
      XXXXX Stock & Sales Statement
    --------------------------------------------------*/
    m = header.match(/^(.+?)\s+Stock\s*&\s*Sales\s+Statement/im);

    if (m)
        return removeGarbage(m[1]);



    /*--------------------------------------------------
      Saleable Stock Report
    --------------------------------------------------*/

    if (/Saleable\s+Stock\s+Report/i.test(header)) {

        const lines = header
            .split(/\n/)
            .map(x => removeGarbage(x))
            .filter(Boolean);

        let best = "";
        let bestScore = 0;

        for (const line of lines.slice(0, 20)) {

            const score = scoreBusinessLine(line);

            if (score > bestScore) {

                bestScore = score;
                best = line;

            }

        }

        if (best)
            return best;

    }



    /*--------------------------------------------------
      Stock Statement (Datewise)
    --------------------------------------------------*/

    if (/Stock\s+Statement/i.test(header)) {

        const lines = header
            .split(/\n/)
            .map(x => removeGarbage(x))
            .filter(Boolean);

        let best = "";
        let bestScore = 0;

        for (const line of lines) {

            const score = scoreBusinessLine(line);

            if (score > bestScore) {

                bestScore = score;
                best = line;

            }

        }

        if (best)
            return best;

    }


    const companyMatch = header.match(
    /(?:^|\n)([A-Z][A-Z0-9 .,&()'-]{8,}(?:MEDICAL|CHEMIST|PHARMA|AGENCY|AGENCIES|DISTRIBUTOR|DISTRIBUTORS)[A-Z0-9 .,&()'-]*)(?=\n|$)/im
    );

    if (companyMatch) {
    return removeGarbage(companyMatch[1]);
}

    /*--------------------------------------------------
      Generic PDF / Excel fallback
    --------------------------------------------------*/

    const lines = header
        .split(/\n/)
        .map(x => removeGarbage(x))
        .filter(Boolean);

    let best = "";
    let bestScore = 0;

    for (const line of lines.slice(0, 25)) {

        const score = scoreBusinessLine(line);

        if (score > bestScore) {

            bestScore = score;
            best = line;

        }

    }

    return best;

}
/*=========================================================
 VALIDATE STOCKIST
=========================================================*/

async function validateStockist(text, dashboardName) {

    console.log("================================");
    console.log("STOCKIST VALIDATION");
    console.log("================================");

    console.log("Dashboard :", dashboardName);

    let extractedName = extractStockistName(text);

    if (!extractedName) {

    console.log("Primary extraction failed.");

    extractedName = fallbackExtract(text);

}

    console.log("Extracted :", extractedName);

    if (!extractedName) {

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

    /*==================================
      EXACT / CONTAINS
    ==================================*/

    if (documentCompact && dashboardCompact) {

        valid =

            documentCompact.includes(dashboardCompact) ||

            dashboardCompact.includes(documentCompact);

    }

    /*==================================
      WORD MATCH
    ==================================*/

    if (!valid) {

        const docWords =
            documentClean.split(" ");

        const dashWords =
            dashboardClean.split(" ");

        let matched = 0;

        dashWords.forEach(word => {

            if (docWords.includes(word))

                matched++;

        });

        if (matched >= Math.min(2, dashWords.length))

            valid = true;

    }

    /*==================================
      LOGS
    ==================================*/

    console.log("Normalized Document :", normalizedDocument);

    console.log("Normalized Dashboard :", normalizedDashboard);

    console.log("Document Clean :", documentClean);

    console.log("Dashboard Clean :", dashboardClean);

    console.log("Document Compact :", documentCompact);

    console.log("Dashboard Compact :", dashboardCompact);

    console.log("VALID :", valid);

    return {

        valid,

        reason:

            valid

                ? ""

                : "INVALID STOCKIST NAME",

        extractedName,

        dashboardName,

        normalizedDocument,

        normalizedDashboard

    };

}
/*=========================================================
 FALLBACK EXTRACTOR
=========================================================*/

function fallbackExtract(text = "") {

    const lines = text
        .split(/\r?\n/)
        .map(removeGarbage)
        .filter(Boolean);

    let best = "";
    let bestScore = 0;

    for (const line of lines.slice(0, 60)) {

        const score = scoreBusinessLine(line);

        if (score > bestScore) {

            bestScore = score;
            best = line;

        }

    }

    return best;

}
module.exports = {
    validateStockist
};