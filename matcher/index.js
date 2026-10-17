const { rawMatch } = require("./rawMatcher");
const { splitProduct } = require("./splitter");
const { getBrandProducts } = require("./priceIndex");
const { progressiveMatch } = require("./progressiveMatcher");
const { applyRules } = require("./rules");
const { normalizeProduct } = require("./normalizer");
const { generateAlternatives } = require("./advancedNormalizer");
const { matchByProductAttributes } = require("./attributeMatcher");

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
 * EXACT NORMALIZED DESCRIPTION + PACK FALLBACK
 * ADDITIVE FALLBACK ONLY
 * =====================================================
 */
function matchByExactProductCoreAndPack(statementProduct, priceIndex) {

    const source = String(statementProduct || "").trim();

    if (!source || !priceIndex)
        return null;

    // Detect a trailing pack suffix such as "10 S" or "10'S".
    const suffixMatch = source.match(
        /\s+(\d+(?:\.\d+)?)\s*['’]?\s*S\s*$/i
    );

    if (!suffixMatch)
        return null;

    const statementPack =
        `${suffixMatch[1]}S`.toUpperCase();

    const statementDescription =
        source.slice(0, suffixMatch.index).trim();

    const compactNormalized = value =>
        normalizeProduct(value)
            .replace(/[^A-Z0-9]/g, "");

    const target =
        compactNormalized(statementDescription);

    if (!target)
        return null;

    const matches = [];

    for (const brand of Object.keys(priceIndex)) {

        const candidates = priceIndex[brand] || [];

        for (const item of candidates) {

            if (!item || !item.product)
                continue;

            const product = item.product;

            const candidatePack =
                String(product["Pack"] || "")
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "");

            // Pack must match exactly after punctuation removal.
            if (candidatePack !== statementPack)
                continue;

            const candidateDescription =
                compactNormalized(
                    product["Product Description"] || ""
                );

            if (candidateDescription === target) {
                matches.push(product);
            }
        }
    }

    // Never guess when more than one candidate matches.
    if (matches.length !== 1) {

        if (matches.length > 1) {
            console.log(
                "EXACT DESCRIPTION + PACK MATCH AMBIGUOUS:",
                source,
                "| Candidates:",
                matches.length
            );
        }

        return null;
    }

    console.log(
        "EXACT DESCRIPTION + PACK MATCH:",
        source,
        "->",
        matches[0]["Product Description"]
    );

    return matches[0];
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
    // STEP 2 : GENERAL ATTRIBUTE MATCHING
    //--------------------------------------------------

    const attributeMatch = matchByProductAttributes(
        statementProduct,
        priceIndex
    );

    const reviewReasons = Array.isArray(attributeMatch?.reviewReasons)
        ? attributeMatch.reviewReasons
        : attributeMatch?.reviewReasons
            ? [attributeMatch.reviewReasons]
            : [];

    if (attributeMatch?.matched) {
        return {
            matched: true,
            stage: "ATTRIBUTE_FALLBACK",
            product: attributeMatch.product,
            reason: attributeMatch.reason || "General attribute match",
            score: attributeMatch.score ?? null,
            candidateCount: attributeMatch.candidateCount ?? null,
            reviewRequired: Boolean(attributeMatch.reviewRequired),
            reviewReasons
        };
    }

    //--------------------------------------------------
    // DO NOT OVERRIDE ATTRIBUTE MATCHING SAFEGUARDS
    //--------------------------------------------------

    const attributeFailureReason =
        String(attributeMatch?.reason || "");

    const stopForAttributeReview =
        Boolean(attributeMatch?.ambiguous) ||
        Boolean(attributeMatch?.reviewRequired) ||
        attributeFailureReason.startsWith(
            "No same-brand price-list candidate passed"
        ) ||
        attributeFailureReason.startsWith(
            "Brand identified, but statement has no strength/size"
        );

    if (stopForAttributeReview) {
        return {
            matched: false,
            stage: attributeMatch?.ambiguous
                ? "ATTRIBUTE_AMBIGUOUS"
                : "ATTRIBUTE_REVIEW_REQUIRED",
            product: null,
            ambiguous: Boolean(attributeMatch?.ambiguous),
            score: attributeMatch?.score ?? null,
            candidateCount: attributeMatch?.candidateCount ?? null,
            reviewRequired: true,
            reviewReasons,
            reason: attributeMatch?.reason || "Attribute matching requires review",
            candidates: attributeMatch?.candidates ?? []
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
    // STEP 5: EXACT NORMALIZED DESCRIPTION + PACK
    // ADDITIVE FALLBACK ONLY
    //--------------------------------------------------

    const corePackMatch =
        matchByExactProductCoreAndPack(
            statementProduct,
            priceIndex
        );

    if (corePackMatch) {
        return {
            matched: true,
            stage: "EXACT_CORE_PACK",
            product: corePackMatch,
            reason: "Unique normalized description and pack match"
        };
    }

    //--------------------------------------------------
    // STEP 7: USER-CONFIRMED PRODUCT ALIASES
    // FALLBACK ONLY — DO NOT OVERRIDE EARLIER MATCHES
    //--------------------------------------------------

    const confirmedAliasSourceKey = String(statementProduct ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase();

    const confirmedAliasTargets = {
        "IBITRET 20MG SOFT GELS 10S":
            "IBITRET 20 SOFT GELS 10`S(D3)",

        "KERAGRIS MFR 60ML":
            "KERAGRIS MFR 60 ML",

        "PROTEK ANTI DANDRUFF SHAMPOO 100ML":
            "PROTEK ANTI - DANDRUFF SHAMPOO 100 ML"
    };

    const confirmedAliasTarget =
        confirmedAliasTargets[confirmedAliasSourceKey];

    if (confirmedAliasTarget) {
        const confirmedAliasProduct =
            execute(confirmedAliasTarget, priceIndex);

        if (confirmedAliasProduct) {
            return {
                matched: true,
                stage: "EXPLICIT_ALIAS",
                product: confirmedAliasProduct,
                reason: "User-confirmed product mapping"
            };
        }
    }

    //--------------------------------------------------
    // NO MATCH
    //--------------------------------------------------

    return {
        matched: false,
        stage: attributeMatch?.ambiguous
            ? "ATTRIBUTE_AMBIGUOUS"
            : "NONE",
        product: null,
        ambiguous: Boolean(attributeMatch?.ambiguous),
        score: attributeMatch?.score ?? null,
        candidateCount: attributeMatch?.candidateCount ?? null,
        reviewRequired: Boolean(attributeMatch?.reviewRequired),
        reviewReasons,
        reason: attributeMatch?.reason ||
            "No matching product passed the attribute checks",
        candidates: attributeMatch?.candidates ?? []
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