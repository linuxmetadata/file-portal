function normalizeName(name = "") {
    return name
        .toUpperCase()
        .replace(/AGENCIES/g, "AGENCY")
        .replace(/&/g, "AND")
        .replace(/\b(M\/S|MS|MESSRS)\b/g, "")
        .replace(/[^A-Z0-9]/g, "");
}
async function validateStockist(text, dashboardName) {

    console.log("================================");
    console.log("STOCKIST VALIDATION");
    console.log("================================");

    console.log("Dashboard Name :", dashboardName);

    const header = text
        .replace(/\r/g, " ")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .substring(0, 2000);

    console.log("HEADER:");
    console.log(header);

    let extractedName = "";

// Statements of XXXXX
let m = header.match(/Statements?\s+of\s+([^\r\n]+)/i);

if (m)
    extractedName = m[1].trim();


// Product Stock Report XXXXX
if (!extractedName) {

    m = header.match(
        /Product\s+Stock\s+Report\s+([^\r\n]+)/i
    );

    if (m)
        extractedName = m[1].trim();
}


// STOCK AND SALES
if (!extractedName) {

    m = header.match(
        /STOCK\s+AND\s+SALES\s+([A-Z0-9 .,&()'-]+)/i
    );

    if (m)
        extractedName = m[1].trim();
}


// Company Name before Stock & Sales Statement
if (!extractedName) {

    m = header.match(
        /^(.+?)\s+Stock\s*&\s*Sales\s+Statement/i
    );

    if (m)
        extractedName = m[1].trim();
}

    // Company Name before Stock Statement
if (!extractedName) {

    m = header.match(
        /^(.+?)\s+Stock\s+Statement/i
    );

    if (m)
        extractedName = m[1].trim();
}

    // Company Name before Saleable Stock Report
if (!extractedName) {

    m = header.match(
        /^(.+?)\s+\(From\s+\d{2}[\/-]\d{2}[\/-]\d{4}\s+To\s+\d{2}[\/-]\d{2}[\/-]\d{4}\)\s+Saleable\s+Stock\s+Report/i
    );

    if (m)
        extractedName = m[1].trim();
}

    // Saleable Stock Report
if (!extractedName) {

    const lines = text
        .split(/\r?\n/)
        .map(x => x.trim())
        .filter(Boolean);

    if (
        lines.length &&
        /Saleable Stock Report/i.test(text)
    ) {
        extractedName = lines[0];
    }
}

    const normalizedDocument =
    normalizeName(extractedName);

    const normalizedDashboard =
    normalizeName(dashboardName);

    let valid = false;

    if (normalizedDocument && normalizedDashboard) {

    valid =
        normalizedDocument.includes(normalizedDashboard) ||
        normalizedDashboard.includes(normalizedDocument);

}

    console.log("Extracted :", extractedName);
    console.log("Normalized Document :", normalizedDocument);
    console.log("Normalized Dashboard :", normalizedDashboard);
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

module.exports = {
    validateStockist
};