const { rawMatch } = require("./rawMatcher");
const { splitProduct } = require("./splitter");
const { getBrandProducts } = require("./priceIndex");
const { progressiveMatch } = require("./progressiveMatcher");
const { applyRules } = require("./rules");
const { normalizeProduct } = require("./normalizer");
const { generateAlternatives } = require("./advancedNormalizer");

/**
 * =====================================================
 * CODE + DESCRIPTION FALLBACK MATCH
 * =====================================================
 *
 * Handles statement products such as:
 *
 * 1000011595 - PREGALIFT D 50/20MG CAPSULES
 *
 * IMPORTANT:
 *
 * The statement Code may be an ERP code and may NOT
 * be the same as the Linux Product Code.
 *
 * Therefore:
 *
 * 1. Extract Code + Description.
 * 2. Try Code + Description first.
 * 3. If code does not match, try exact normalized
 *    Description only.
 * 4. Description-only match is accepted ONLY when
 *    exactly one product matches.
 *
 * This is an ADDITIVE fallback.
 *
 * Existing matcher logic is not changed.
 */

function matchByProductCodeAndDescription(
    statementProduct,
    priceIndex
) {

    if (!statementProduct || !priceIndex)
        return null;

    const statementText =
        String(statementProduct).trim();

    //--------------------------------------------------
    // Detect:
    //
    // CODE - DESCRIPTION
    // CODE : DESCRIPTION
    //--------------------------------------------------

    const match =
        statementText.match(
            /^\s*([A-Za-z0-9]+)\s*[-:]\s*(.+?)\s*$/
        );

    if (!match)
        return null;

    const statementCode =
        String(match[1])
            .trim()
            .toUpperCase();

    const statementDescription =
        String(match[2])
            .trim();

    if (
        !statementCode ||
        !statementDescription
    ) {
        return null;
    }

    //--------------------------------------------------
    // Normalize statement description
    //--------------------------------------------------

    const statementNormalized =
        normalizeProduct(
            statementDescription
        );

    if (!statementNormalized)
        return null;

    //--------------------------------------------------
    // STEP 1
    // CODE + DESCRIPTION MATCH
    //--------------------------------------------------

    for (
        const brand of Object.keys(priceIndex)
    ) {

        const candidates =
            priceIndex[brand] || [];

        for (const item of candidates) {

            if (
                !item ||
                !item.product
            ) {
                continue;
            }

            const priceCode =
                String(
                    item.product["Product Code"] || ""
                )
                    .trim()
                    .toUpperCase();

            const priceDescription =
                String(
                    item.product["Product Description"] || ""
                ).trim();

            if (
                !priceCode ||
                !priceDescription
            ) {
                continue;
            }

            //--------------------------------------------------
            // Product Code
            //--------------------------------------------------

            if (
                priceCode !==
                statementCode
            ) {
                continue;
            }

            //--------------------------------------------------
            // Product Description
            //--------------------------------------------------

            const priceNormalized =
                normalizeProduct(
                    priceDescription
                );

            if (
                statementNormalized ===
                priceNormalized
            ) {

                console.log(
                    "CODE + DESCRIPTION MATCH :",
                    statementCode,
                    "-",
                    statementDescription
                );

                return item.product;
            }
        }
    }

    //--------------------------------------------------
    // STEP 2
    // DESCRIPTION-ONLY FALLBACK
    //--------------------------------------------------
    //
    // The statement code may be from the distributor's
    // ERP system and therefore different from the
    // Linux Product Code.
    //
    // Example:
    //
    // Statement:
    // 1000011595 - PREGALIFT D 50/20MG CAPSULES
    //
    // Price List:
    // ITMxxxxx - PREGALIFT D 50/20MG CAPSULES
    //
    //--------------------------------------------------

    const descriptionMatches = [];

    for (
        const brand of Object.keys(priceIndex)
    ) {

        const candidates =
            priceIndex[brand] || [];

        for (const item of candidates) {

            if (
                !item ||
                !item.product
            ) {
                continue;
            }

            const priceDescription =
                String(
                    item.product["Product Description"] || ""
                ).trim();

            if (!priceDescription)
                continue;

            const priceNormalized =
                normalizeProduct(
                    priceDescription
                );

            //--------------------------------------------------
            // EXACT NORMALIZED DESCRIPTION
            //--------------------------------------------------

            if (
                statementNormalized ===
                priceNormalized
            ) {

                descriptionMatches.push(
                    item.product
                );
            }
        }
    }

    //--------------------------------------------------
    // EXACTLY ONE DESCRIPTION MATCH
    //--------------------------------------------------

    if (
        descriptionMatches.length === 1
    ) {

        console.log(
            "DESCRIPTION FALLBACK MATCH :",
            statementCode,
            "-",
            statementDescription
        );

        return descriptionMatches[0];
    }

    //--------------------------------------------------
    // MULTIPLE MATCHES
    //
    // Do NOT guess.
    //--------------------------------------------------

    if (
        descriptionMatches.length > 1
    ) {

        console.log(
            "DESCRIPTION FALLBACK AMBIGUOUS :",
            statementDescription,
            "MATCHES :",
            descriptionMatches.length
        );

        return null;
    }

    //--------------------------------------------------
    // NO MATCH
    //--------------------------------------------------

    return null;
}


/**
 * =====================================================
 * MAIN PRODUCT MATCHER
 * =====================================================
 */

function matchProduct(
    statementProduct,
    priceIndex
) {

    //--------------------------------------------------
    // STEP 1 : RAW MATCH
    //--------------------------------------------------

    const raw =
        rawMatch(
            statementProduct,
            priceIndex
        );

    if (raw) {

        return {

            matched: true,

            stage: "RAW",

            product: raw,

            reason: "Exact product match"

        };
    }


    //--------------------------------------------------
    // STEP 1B : CODE + DESCRIPTION
    //--------------------------------------------------
    //
    // ADDITIVE FALLBACK ONLY.
    //
    // Existing RAW matching remains unchanged.
    //--------------------------------------------------

    const codeDescriptionMatch =
        matchByProductCodeAndDescription(
            statementProduct,
            priceIndex
        );

    if (codeDescriptionMatch) {

        return {

            matched: true,

            stage: "CODE_DESCRIPTION",

            product:
                codeDescriptionMatch,

            reason:
                "Product code and description match"

        };
    }


    //--------------------------------------------------
    // STEP 2 : ORIGINAL
    //--------------------------------------------------

    let result =
        execute(
            statementProduct,
            priceIndex
        );

    if (result) {

        return {

            matched: true,

            stage: "ORIGINAL",

            product: result

        };
    }


    //--------------------------------------------------
    // STEP 3 : NORMALIZED
    //--------------------------------------------------

    const normalized =
        normalizeProduct(
            statementProduct
        );

    result =
        execute(
            normalized,
            priceIndex
        );

    if (result) {

        return {

            matched: true,

            stage: "NORMALIZED",

            product: result

        };
    }


    //--------------------------------------------------
    // STEP 4 : ADVANCED
    //--------------------------------------------------

    const alternatives =
        generateAlternatives(
            normalized
        );

    for (
        const alt of alternatives
    ) {

        result =
            execute(
                alt,
                priceIndex
            );

        if (result) {

            return {

                matched: true,

                stage: "ADVANCED",

                product: result

            };
        }
    }


    //--------------------------------------------------
    // NO MATCH
    //--------------------------------------------------

    return {

        matched: false,

        stage: "NONE",

        product: null

    };
}


/**
 * =====================================================
 * EXECUTE ONE MATCHING CYCLE
 * =====================================================
 */

function execute(
    product,
    priceIndex
) {

    const statement =
        splitProduct(product);


    const candidates =
        getBrandProducts(
            priceIndex,
            statement.brand
        );


    //--------------------------------------------------
    // NO BRAND FOUND
    //--------------------------------------------------

    if (
        candidates.length === 0
    ) {
        return null;
    }


    //--------------------------------------------------
    // SINGLE PRODUCT
    //--------------------------------------------------

    if (
        candidates.length === 1
    ) {

        return candidates[0].product;
    }


    //--------------------------------------------------
    // PROGRESSIVE MATCH
    //--------------------------------------------------

    const progressive =
        progressiveMatch(
            statement.parts,
            candidates
        );


    //--------------------------------------------------
    // RULE ENGINE
    //--------------------------------------------------

    const finalCandidates =
        applyRules(
            statement.parts,
            progressive.remaining
        );


    //--------------------------------------------------
    // FINAL RESULT
    //--------------------------------------------------

    if (
        finalCandidates.length === 1
    ) {

        return finalCandidates[0].product;
    }


    return null;
}


module.exports = {

    matchProduct

};