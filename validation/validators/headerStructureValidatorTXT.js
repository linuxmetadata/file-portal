/**
 * ============================================================
 * TXT HEADER STRUCTURE VALIDATOR
 * ============================================================
 *
 * Purpose:
 *
 * Validate the generic structure produced by
 * headerStructureAnalyzerTXT.js.
 *
 * This module DOES NOT:
 *
 *   - change mappings
 *   - change extraction
 *   - change aliases
 *   - change existing mapper behaviour
 *
 * It only reports:
 *
 *   VALID
 *   WARNING
 *   UNRESOLVED
 *   CONFLICT
 *
 * ============================================================
 */

const STANDARD_FIELDS = new Set([

    "product",
    "productCode",
    "pack",
    "rate",

    "opening",
    "openingValue",

    "purchase",
    "purchaseFree",
    "purchaseValue",
    "purchaseReturn",

    "sales",
    "salesFree",
    "salesValue",
    "salesReturn",

    "closing",
    "closingFree",
    "closingValue",

    "excess",
    "short",

    "adjustmentPlus",
    "adjustmentMinus",

    "age"

]);


// ============================================================
// VALIDATE INPUT
// ============================================================

function validateInput(
    structure
) {

    if (
        !structure ||
        typeof structure !== "object"
    ) {

        return {

            valid: false,

            status: "CONFLICT",

            message:
                "Invalid structure result."

        };

    }


    return {

        valid: true

    };

}


// ============================================================
// VALIDATE DIRECT FIELDS
// ============================================================

function validateDirectFields(
    structure
) {

    const issues = [];

    const fields = [];

    const seen = new Map();


    for (
        const item
        of structure.directFields || []
    ) {

        if (
            !item.field
        ) {

            continue;

        }


        fields.push(
            item.field
        );


        if (
            !STANDARD_FIELDS.has(
                item.field
            )
        ) {

            issues.push({

                status:
                    "UNRESOLVED",

                type:
                    "UNKNOWN_FIELD",

                field:
                    item.field,

                header:
                    item.text,

                message:
                    "Field is not part of the standard TXT schema."

            });

        }


        if (
            seen.has(
                item.field
            )
        ) {

            const previous =
                seen.get(
                    item.field
                );


            issues.push({

                status:
                    "CONFLICT",

                type:
                    "DUPLICATE_FIELD",

                field:
                    item.field,

                header:
                    item.text,

                previousHeader:
                    previous.text,

                message:
                    "Multiple direct headers resolve to the same logical field."

            });

        }
        else {

            seen.set(
                item.field,
                item
            );

        }

    }


    return {

        fields,

        issues

    };

}


// ============================================================
// VALIDATE GROUPS
// ============================================================

function validateGroups(
    structure
) {

    const issues = [];

    const relationships = [];


    for (
        const relationship
        of structure.relationships || []
    ) {

        relationships.push(
            relationship
        );


        if (
            relationship.status !==
            "MATCHED"
        ) {

            issues.push({

                status:
                    "UNRESOLVED",

                type:
                    "UNMATCHED_CHILD",

                child:
                    relationship.childText,

                childType:
                    relationship.childType,

                message:
                    "Child header could not be assigned to a valid parent."

            });

            continue;

        }


        if (
            !relationship.logicalField
        ) {

            issues.push({

                status:
                    "UNRESOLVED",

                type:
                    "MISSING_LOGICAL_FIELD",

                child:
                    relationship.childText,

                parent:
                    relationship.parentText,

                message:
                    "Parent/child relationship exists but no logical field was produced."

            });

            continue;

        }


        if (
            !STANDARD_FIELDS.has(
                relationship.logicalField
            )
        ) {

            issues.push({

                status:
                    "UNRESOLVED",

                type:
                    "UNKNOWN_LOGICAL_FIELD",

                child:
                    relationship.childText,

                parent:
                    relationship.parentText,

                logicalField:
                    relationship.logicalField,

                message:
                    "Generated logical field is not part of the standard schema."

            });

        }

    }


    return {

        relationships,

        issues

    };

}


// ============================================================
// CHECK STANDARD FIELD COVERAGE
// ============================================================

function checkCoverage(
    structure
) {

    const fields = new Set();


    for (
        const item
        of structure.directFields || []
    ) {

        if (
            item.field
        ) {

            fields.add(
                item.field
            );

        }

    }


    for (
        const relationship
        of structure.relationships || []
    ) {

        if (
            relationship.logicalField
        ) {

            fields.add(
                relationship.logicalField
            );

        }

    }


    const coreFields = [

        "product",
        "opening",
        "purchase",
        "sales",
        "closing"

    ];


    const missingCore =
        coreFields.filter(
            field =>
                !fields.has(
                    field
                )
        );


    return {

        fields:
            Array.from(
                fields
            ),

        missingCore

    };

}


// ============================================================
// FINAL STATUS
// ============================================================

function determineStatus(
    issues,
    coverage
) {

    if (
        issues.some(
            issue =>
                issue.status ===
                "CONFLICT"
        )
    ) {

        return "CONFLICT";

    }


    if (
        issues.some(
            issue =>
                issue.status ===
                "UNRESOLVED"
        )
    ) {

        return "WARNING";

    }


    if (
        coverage.missingCore.length
    ) {

        return "WARNING";

    }


    return "VALID";

}


// ============================================================
// MAIN VALIDATOR
// ============================================================

function validateHeaderStructure(
    structure
) {

    const input =
        validateInput(
            structure
        );


    if (
        !input.valid
    ) {

        return {

            success: false,

            status:
                input.status,

            issues: [
                {

                    status:
                        input.status,

                    message:
                        input.message

                }
            ]

        };

    }


    const direct =
        validateDirectFields(
            structure
        );


    const groups =
        validateGroups(
            structure
        );


    const coverage =
        checkCoverage(
            structure
        );


    const issues = [

        ...direct.issues,

        ...groups.issues

    ];


    const status =
        determineStatus(
            issues,
            coverage
        );


    return {

        success: true,

        status,

        issues,

        summary: {

            directFields:
                direct.fields.length,

            relationships:
                groups.relationships.length,

            resolvedFields:
                coverage.fields.length,

            missingCore:
                coverage.missingCore

        },

        fields:
            coverage.fields

    };

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    STANDARD_FIELDS,

    validateHeaderStructure,

    validateDirectFields,

    validateGroups,

    checkCoverage

};