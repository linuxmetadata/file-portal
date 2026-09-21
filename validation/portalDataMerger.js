/**
 * ======================================================
 * PORTAL DATA MERGER
 * ======================================================
 *
 * Merges Portal metadata into the Extraction Master record.
 *
 * Portal is the single source of truth for:
 * - MONTH
 * - ZONE
 * - STATE
 * - HQ
 * - ABMHQ
 * - RBMHQ
 * - STKCODE
 * - STOCKIST
 *
 * It DOES NOT:
 * - Match products
 * - Calculate values
 * - Read statements
 * - Read Excel
 */

const PORTAL_FIELDS = [

    "MONTH",

    "ZONE",

    "STATE",

    "HQ",

    "ABMHQ",

    "RBMHQ",

    "STKCODE",

    "STOCKIST"

];

function mergePortalData(record, portalData = {}) {

    const output = {
        ...record
    };

    for (const field of PORTAL_FIELDS) {

        output[field] = portalData[field] ?? "";

    }

    return output;

}

module.exports = {

    mergePortalData,

    PORTAL_FIELDS

};