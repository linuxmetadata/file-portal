function normalizeName(name = "") {
    return name
        .toUpperCase()
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

    // Pattern 1
    let match = header.match(/Statements?\s+of\s+([A-Za-z0-9&.,()\- ]+)/i);

    if (match) {
    extractedName = match[1].trim();
}
    if (!extractedName) {

    match = header.match(
        /Product\s+Stock\s+Report\s+([A-Za-z0-9&.,()\- ]+)/i
    );

    if (match) {
        extractedName = match[1].trim();
    }

}

    if (!extractedName) {

    const firstLine = text
        .split(/\r?\n/)
        .find(x => x.trim().length > 3);

    if (firstLine)
        extractedName = firstLine.trim();

}

    const normalizedDocument =
    normalizeName(extractedName);

    const normalizedDashboard =
    normalizeName(dashboardName);

    const valid =
    normalizedDocument.includes(normalizedDashboard) ||
    normalizedDashboard.includes(normalizedDocument);

    console.log("Extracted :", extractedName);

    console.log("Normalized Document :", normalizedDocument);

    console.log("Normalized Dashboard :", normalizedDashboard);

    console.log("VALID :", valid);

    return {
        valid,
        dashboardName,
        extractedName,
        normalizedDashboard,
        normalizedDocument
    };
}

module.exports = {
    validateStockist
};