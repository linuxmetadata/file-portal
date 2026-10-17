
const PORTAL_COLUMNS = [
    "Division",
    "BM HQ",
    "Code",
    "Stockist Name"
];

const IDENTITY_COLUMNS = [
    "Record ID",
    "Source File",
    "Source Sheet",
    "Source Row",
    "Statement Structure"
];

const SUPPORT_COLUMNS = [
    "Raw Source Values",
    "Header Mapping",
    "Unidentified Headers"
];

const PRODUCT_COLUMNS = [
    "Common Product",
    "Common Pack",
    "Common Purchase Rate",
    "Common Rate",
    "Common Age"
];

// Each entry explicitly pairs a quantity with its value.
// These pairs define the proposed schema, not the calculation rules.
const QUANTITY_VALUE_PAIRS = [
    ["Common Opening", "Common Opening Value"],
    ["Common Purchase", "Common Purchase Value"],
    ["Common Purchase Free", "Common Purchase Free Value"],
    ["Common Purchase Return", "Common Purchase Return Value"],
    ["Common Purchase Return Free", "Common Purchase Return Free Value"],
    ["Common Replacement", "Common Replacement Value"],
    ["Common Sales Replacement", "Common Sales Replacement Value"],
    ["Common Sales", "Common Sales Value"],
    ["Common Sales Free", "Common Sales Free Value"],
    ["Common Sales Last", "Common Sales Last Value"],
    ["Common Sales Return", "Common Sales Return Value"],
    ["Common Sales Return Free", "Common Sales Return Free Value"],
    ["Common TRN IN", "Common TRN IN Value"],
    ["Common TRN OUT", "Common TRN OUT Value"],
    ["Common Credit", "Common Credit Value"],
    ["Common Debit", "Common Debit Value"],
    ["Common Adjustment", "Common Adjustment Value"],
    ["Common Closing", "Common Closing Value"],
    ["Common Closing Free", "Common Closing Free Value"],
    ["Common Total Stock", "Common Total Stock Value"]
];

const MATCH_COLUMNS = [
    "Match Status",
    "Matched Product",
    "Matched Product Code",
    "Matched PTS",
    "Match Reason"
];

const QUANTITY_COLUMNS = QUANTITY_VALUE_PAIRS.map(
    ([quantity]) => quantity
);

const VALUE_COLUMNS = QUANTITY_VALUE_PAIRS.map(
    ([, value]) => value
);

const COMMON_COLUMNS = [
    ...PRODUCT_COLUMNS,
    ...QUANTITY_COLUMNS,
    ...VALUE_COLUMNS
];

const MASTER_COLUMNS = [
    ...PORTAL_COLUMNS,
    ...IDENTITY_COLUMNS,
    ...SUPPORT_COLUMNS,
    ...COMMON_COLUMNS,
    ...MATCH_COLUMNS
];

// Create a row with every canonical column present.
// Raw extraction values are populated by the integration layer.
// Calculated value fields start blank.
function createEmptyMasterRow() {
    const row = Object.fromEntries(
        MASTER_COLUMNS.map(column => [column, ""])
    );

    for (const valueColumn of VALUE_COLUMNS) {
        row[valueColumn] = "";
    }

    row["Match Status"] = "PENDING";

    return row;
}

module.exports = {
    PORTAL_COLUMNS,
    IDENTITY_COLUMNS,
    SUPPORT_COLUMNS,
    PRODUCT_COLUMNS,
    QUANTITY_VALUE_PAIRS,
    QUANTITY_COLUMNS,
    VALUE_COLUMNS,
    COMMON_COLUMNS,
    MATCH_COLUMNS,
    MASTER_COLUMNS,
    createEmptyMasterRow
};
