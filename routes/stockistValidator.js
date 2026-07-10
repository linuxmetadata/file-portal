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

    return {
        valid: true,
        dashboardName,
        extractedName: "",
        normalizedDashboard: "",
        normalizedDocument: ""
    };
}

module.exports = {
    validateStockist
};