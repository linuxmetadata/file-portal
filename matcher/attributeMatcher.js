const CONFIG = require("./config");
const { kb } = require("./knowledgeBase");

/**
 * General attribute-based fallback matcher.
 *
 * Design principles:
 * - No product-specific aliases or product codes.
 * - Brand, explicitly stated numeric attributes, meaningful modifiers,
 *   and comparable pack quantities constrain candidate selection.
 * - Dosage-form differences do not automatically reject a unique candidate.
 *   They are returned as review reasons, per the selected business rule.
 * - Missing/uncomparable description data is reported for review rather than
 *   silently treated as proof that two products are identical.
 * - Explicit conflicting strengths/quantities, meaningful modifiers, or
 *   comparable pack counts reject a candidate.
 */

const FORM_RULES = [
    ["FACEWASH", /\bFACEWASH\b/],
    ["SOFTGEL", /\bSOFTGEL\b/],
    ["TABLET", /\bTAB\b/],
    ["CAPSULE", /\bCAP\b/],
    ["SHAMPOO", /\bSHAMPOO\b/],
    ["SOAP", /\bSOAP\b/],
    ["CREAM", /\bCREAM\b/],
    ["LOTION", /\bLOT\b/],
    ["GEL", /\bGEL\b/],
    ["OINTMENT", /\bOINT\b/],
    ["POWDER", /\bPWD\b/],
    ["SOLUTION", /\bSOL\b/],
    ["SPRAY", /\bSPRAY\b/],
    ["SERUM", /\bSERUM\b/],
    ["DROPS", /\bDROP\b/],
    ["SUSPENSION", /\bSUSP\b/],
    ["SYRUP", /\bSYP\b/]
];

const FORM_TOKENS = new Set([
    "FACEWASH", "SOFTGEL", "TAB", "CAP", "SHAMPOO", "SOAP",
    "CREAM", "LOT", "GEL", "OINT", "PWD", "SOL", "SPRAY",
    "SERUM", "DROP", "SUSP", "SYP"
]);

function canonicalize(value) {
    return String(value ?? "")
        .normalize("NFKC")
        .toUpperCase()
        .replace(/[’‘'`´]/g, " ")
        .replace(/[‐‑‒–—-]/g, " ")
        .replace(/[()[\]{}]/g, " ")
        .replace(/\.(?!\d)/g, " ")
        .replace(/[,;:]/g, " ")
        .replace(/\+/g, " PLUS ")
        .replace(/\bFACE\s*WASH\b|\bFACEWASH\b/g, " FACEWASH ")
        .replace(/\bSOFT\s*GELS?\b/g, " SOFTGEL ")
        .replace(/\bTABLETS?\b|\bTABS?\b/g, " TAB ")
        .replace(/\bCAPSULES?\b|\bCAPS?\b/g, " CAP ")
        // Normalize gram spellings without converting grams to milligrams.
        .replace(/(\d+(?:\.\d+)?)\s*(?:GRAMS?|GMS?|GR|G)\b/g, "$1GM")
        .replace(/\b(?:GRAMS?|GMS?|GR)\b/g, " GM ")
        // Normalize spaces between numeric values and their units.
        // MG remains MG; GM/G/GR/GMS become GM.
        .replace(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)+)\s*(MCG|MG|ML|KG|IU|L|%)\b/g,
            (_, numbers, unit) => `${numbers.replace(/\s*\/\s*/g, "/")}${unit}`)
        .replace(/(\d+(?:\.\d+)?)\s*(MCG|MG|ML|KG|IU|L|%)\b/g, "$1$2")
        // Normalize package-count notation such as 10 S, 10'S and 10S.
        .replace(/\b(\d+(?:\.\d+)?)\s+S\b/g, "$1S")
        .replace(/\b(?:CREME|CREA|CRM|CR)\b/g, " CREAM ")
        .replace(/\b(?:LOTION|LOTI|LOTN)\b/g, " LOT ")
        .replace(/\bOINTMENT\b/g, " OINT ")
        .replace(/\bPOWDER\b/g, " PWD ")
        .replace(/\bSOLUTION\b/g, " SOL ")
        .replace(/\b(?:SYRUP|SYR)\b/g, " SYP ")
        .replace(/\bSUSPENSION\b/g, " SUSP ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizedNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(number) : String(value);
}

function normalizedUnit(unit) {
    const value = String(unit || "").toUpperCase();
    return value === "G" ? "GM" : value;
}

function findPackCount(text) {
    const matches = [...String(text || "").matchAll(/\b(\d+(?:\.\d+)?)\s*S\b/g)];
    if (!matches.length) return null;
    return normalizedNumber(matches[matches.length - 1][1]);
}

function uniqueAmounts(amounts) {
    const seen = new Set();
    return amounts.filter(amount => {
        const key = `${amount.value}|${amount.unit || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function extractAmounts(text) {
    let remaining = String(text || "");
    const amounts = [];
    const unitPattern = "MCG|MG|GM|G|ML|L|KG|IU|%";

    const compoundRegex = new RegExp(
        `\\b((?:\\d+(?:\\.\\d+)?\\s*\\/\\s*)+\\d+(?:\\.\\d+)?)\\s*(${unitPattern})(?=$|[^A-Z])`,
        "g"
    );

    remaining = remaining.replace(compoundRegex, (full, ratio, unit, offset) => {
        const parts = ratio.split("/").map(part => part.trim()).filter(Boolean);
        parts.forEach((part, index) => {
            amounts.push({
                value: normalizedNumber(part),
                unit: normalizedUnit(unit),
                position: offset + index / 1000
            });
        });
        return " ".repeat(full.length);
    });

    const singleRegex = new RegExp(
        `\\b(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})(?=$|[^A-Z])`,
        "g"
    );

    remaining = remaining.replace(singleRegex, (full, number, unit, offset) => {
        amounts.push({
            value: normalizedNumber(number),
            unit: normalizedUnit(unit),
            position: offset
        });
        return " ".repeat(full.length);
    });

    remaining = remaining.replace(/\b\d+(?:\.\d+)?\s*S\b/g, match => " ".repeat(match.length));

    const bareNumberRegex = /(^|[^A-Z0-9])(\d+(?:\.\d+)?)(?=$|[^A-Z0-9])/g;
    remaining.replace(bareNumberRegex, (full, prefix, number, offset) => {
        amounts.push({
            value: normalizedNumber(number),
            unit: "",
            position: offset + prefix.length
        });
        return full;
    });

    amounts.sort((a, b) => a.position - b.position);

    return {
        amounts: uniqueAmounts(amounts),
        remaining
    };
}

const modifierNames = new Set(
    [...(CONFIG.MANDATORY_MODIFIERS || []), ...((kb && kb.modifiers) || [])]
        .map(value => canonicalize(value))
        .filter(value => value && !FORM_TOKENS.has(value))
);

function parseProduct(value) {
    const text = canonicalize(value);
    const tokens = text.split(/\s+/).filter(Boolean);
    const brand = tokens[0] || "";
    const packCount = findPackCount(text);
    const withoutPack = text.replace(/\b\d+(?:\.\d+)?\s*S\b/g, " ");
    const amountResult = extractAmounts(withoutPack);

    const forms = FORM_RULES
        .filter(([, pattern]) => pattern.test(text))
        .map(([name]) => name)
        .sort();

    const modifiers = [...new Set(
        tokens.filter(token => modifierNames.has(token))
    )].sort();

    // Variant markers such as D3 are review flags, not silently discarded.
    const variantMarkers = [...new Set(
        tokens.filter(token => /^[A-Z]{1,3}\d{1,3}$/.test(token))
    )].sort();

    const ignoreCoreTokens = new Set([
        brand,
        ...modifiers,
        ...forms,
        ...FORM_TOKENS,
        ...variantMarkers,
        "S"
    ]);

    const coreTokens = [...new Set(
        amountResult.remaining
            .split(/\s+/)
            .filter(token =>
                /^[A-Z]+$/.test(token) &&
                !ignoreCoreTokens.has(token) &&
                !/^(?:MG|MCG|GM|G|ML|L|KG|IU|PLUS)$/.test(token)
            )
    )].sort();

    return {
        original: String(value ?? ""),
        text,
        brand,
        forms,
        modifiers,
        variantMarkers,
        amounts: amountResult.amounts,
        packCount,
        coreTokens
    };
}

function amountsCompatible(sourceAmounts, candidateAmounts) {
    const source = uniqueAmounts(sourceAmounts);
    const candidate = uniqueAmounts(candidateAmounts);
    const reviewReasons = [];

    if (!source.length && !candidate.length) {
        return { compatible: true, reviewReasons };
    }

    // The statement omits numeric detail that the catalogue does show.
    // Permit only as a reviewable candidate; multiple candidates may remain ambiguous.
    if (!source.length && candidate.length) {
        reviewReasons.push("STATEMENT_STRENGTH_OR_SIZE_NOT_SPECIFIED");
        return { compatible: true, reviewReasons };
    }

    // The statement specifies a numeric detail that the catalogue description omits.
    // Do not pretend the information agrees; allow unique candidates with a review flag.
    if (source.length && !candidate.length) {
        reviewReasons.push("CATALOGUE_STRENGTH_OR_SIZE_NOT_SPECIFIED");
        return { compatible: true, reviewReasons };
    }

    const amountMatches = (left, right) =>
        left.value === right.value &&
        !(left.unit && right.unit && left.unit !== right.unit);

    const allSourceAmountsPresent = source.every(left =>
        candidate.some(right => amountMatches(left, right))
    );
    const allCandidateAmountsPresent = candidate.every(right =>
        source.some(left => amountMatches(left, right))
    );

    if (!allSourceAmountsPresent || !allCandidateAmountsPresent) {
        return { compatible: false, reviewReasons: [] };
    }

    const unitOmitted = source.some(left =>
        left.unit && candidate.some(right => right.value === left.value && !right.unit)
    );
    if (unitOmitted) {
        reviewReasons.push("CATALOGUE_STRENGTH_UNIT_NOT_SPECIFIED");
    }

    return { compatible: true, reviewReasons };
}

function sameArray(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function coreSimilarity(left, right) {
    const a = new Set(left);
    const b = new Set(right);
    const union = new Set([...a, ...b]);
    if (union.size === 0) return 1;
    let intersection = 0;
    for (const token of a) if (b.has(token)) intersection++;
    return intersection / union.size;
}

/**
 * General candidate confidence score (0-100).
 * Higher weight is given to brand, specified numeric strength/size, and pack.
 * A form discrepancy is tolerated under Option B but contributes no form points
 * and remains visible in reviewReasons. This is not a medicine-equivalence rule;
 * it ranks only candidates that have already passed the compatibility filters.
 */
function scoreCandidate(source, candidate, product) {
    let score = 0;

    // The candidate has already been restricted to the identified price-list brand.
    if (source.brand && source.brand === candidate.brand) score += 30;

    const amountCheck = amountsCompatible(source.amounts, candidate.amounts);
    if (source.amounts.length && candidate.amounts.length) {
        if (amountCheck.compatible) {
            score += amountCheck.reviewReasons.length ? 25 : 30;
        }
    } else {
        // Missing numeric information is neutral/partial credit, not a full match.
        score += 15;
    }

    if (source.forms.length && candidate.forms.length) {
        if (sameArray(source.forms, candidate.forms)) score += 15;
        // Option B permits a form difference, but gives it no form points.
    } else {
        score += 8;
    }

    const packCheck = comparePack(source, candidate, product);
    if (source.packCount !== null) {
        if (packCheck.compatible && packCheck.reviewReasons.length === 0) {
            score += 15;
        } else if (packCheck.compatible) {
            score += 8;
        }
    } else {
        score += 8;
    }

    if (sameArray(source.modifiers, candidate.modifiers)) score += 5;
    score += Math.round(coreSimilarity(source.coreTokens, candidate.coreTokens) * 5);

    return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * User rule: automatically select only when at most two compatible candidates
 * remain and the best candidate score is strictly greater than 65/100.
 * A tie is not resolved automatically, even when the tied score exceeds 65.
 */
function resolveEligibleCandidates(eligible, sourceDescription, matchMethod) {
    const ordered = [...eligible].sort((a, b) => b.score - a.score);
    const candidateNames = ordered.map(entry =>
        entry.product?.["Product Description"] || ""
    );

    if (ordered.length > 2) {
        return {
            matched: false,
            ambiguous: true,
            reviewRequired: true,
            product: null,
            score: ordered[0]?.score ?? 0,
            reason: `More than 2 compatible candidates remain for ${sourceDescription}`,
            matchMethod,
            reviewReasons: ["MORE_THAN_TWO_COMPATIBLE_CANDIDATES"],
            candidateCount: ordered.length,
            candidates: candidateNames
        };
    }

    if (!ordered.length) return null;

    const best = ordered[0];
    if (best.score <= 65) {
        return {
            matched: false,
            ambiguous: ordered.length > 1,
            reviewRequired: true,
            product: null,
            score: best.score,
            reason: `Best candidate score ${best.score}/100 did not exceed 65`,
            matchMethod,
            reviewReasons: ["BEST_CANDIDATE_SCORE_NOT_ABOVE_65"],
            candidateCount: ordered.length,
            candidates: candidateNames
        };
    }

    if (ordered.length === 2 && best.score === ordered[1].score) {
        return {
            matched: false,
            ambiguous: true,
            reviewRequired: true,
            product: null,
            score: best.score,
            reason: `Two candidates tie at ${best.score}/100; no automatic selection`,
            matchMethod,
            reviewReasons: ["TOP_CANDIDATES_TIED"],
            candidateCount: ordered.length,
            candidates: candidateNames
        };
    }

    return {
        matched: true,
        ambiguous: false,
        reviewRequired: best.reviewReasons.length > 0,
        product: best.product,
        score: best.score,
        reason: `Unique top candidate scored ${best.score}/100 with brand/attribute checks`,
        matchMethod,
        reviewReasons: [...new Set(best.reviewReasons)],
        candidateCount: ordered.length,
        candidates: candidateNames
    };
}

function comparePack(source, candidate, product) {
    const reviewReasons = [];
    if (source.packCount === null) {
        return { compatible: true, reviewReasons };
    }

    // A count in the catalogue description is the most directly comparable field.
    if (candidate.packCount !== null) {
        return {
            compatible: source.packCount === candidate.packCount,
            reviewReasons: []
        };
    }

    // If description doesn't state a count, consult the structured Pack field.
    const structuredPackCount = findPackCount(canonicalize(product["Pack"] || ""));
    if (structuredPackCount === source.packCount) {
        return { compatible: true, reviewReasons };
    }

    if (structuredPackCount === null) {
        reviewReasons.push("CATALOGUE_PACK_COUNT_NOT_SPECIFIED");
        return { compatible: true, reviewReasons };
    }

    // A structured Pack value of 1'S can describe one retail kit/item, while a
    // number in the product description can describe its contents (e.g. a combikit).
    // Those may not be equivalent units; leave an explicit review flag.
    if (structuredPackCount === "1" && Number(source.packCount) > 1) {
        reviewReasons.push("PACK_COUNT_NOT_DIRECTLY_COMPARABLE");
        return { compatible: true, reviewReasons };
    }

    return { compatible: false, reviewReasons: [] };
}

function compareForms(source, candidate) {
    const reviewReasons = [];
    if (!source.forms.length && !candidate.forms.length) {
        return { reviewReasons };
    }

    if (!sameArray(source.forms, candidate.forms)) {
        reviewReasons.push(
            source.forms.length && candidate.forms.length
                ? `DOSAGE_FORM_DIFFERENCE:${source.forms.join("/")}->${candidate.forms.join("/")}`
                : source.forms.length
                    ? `CATALOGUE_DOSAGE_FORM_NOT_SPECIFIED:statement=${source.forms.join("/")}`
                    : `STATEMENT_DOSAGE_FORM_NOT_SPECIFIED:catalogue=${candidate.forms.join("/")}`
        );
    }

    return { reviewReasons };
}

function compareVariants(source, candidate) {
    if (sameArray(source.variantMarkers, candidate.variantMarkers)) return [];

    const sourceMarkers = source.variantMarkers.length ? source.variantMarkers.join("/") : "NONE";
    const candidateMarkers = candidate.variantMarkers.length ? candidate.variantMarkers.join("/") : "NONE";
    return [`VARIANT_MARKER_DIFFERENCE:${sourceMarkers}->${candidateMarkers}`];
}

/**
 * Identify the statement brand using brand keys already present in the
 * price-list index. The price list remains the source of truth for brands.
 * Longest prefix wins if the index contains overlapping brand names.
 */
function stripLeadingProductCode(value) {
    const text = String(value ?? "").trim();
    const match = text.match(/^\s*([A-Z0-9]{5,})\s*[-:]\s*(.+?)\s*$/i);

    // Remove only a code-like prefix containing at least one digit.
    if (match && /\d/.test(match[1])) {
        return match[2].trim();
    }

    return text;
}

function identifyBrandFromPriceList(statementProduct, priceIndex) {
    const statementName = stripLeadingProductCode(statementProduct);
    const sourceText = canonicalize(statementName);

    const brandEntries = Object.keys(priceIndex || {})
        .filter(key => Array.isArray(priceIndex[key]) && priceIndex[key].length)
        .map(key => ({ key, normalized: canonicalize(key) }))
        .filter(entry => entry.normalized && (
            sourceText === entry.normalized ||
            sourceText.startsWith(`${entry.normalized} `)
        ))
        .sort((a, b) => b.normalized.length - a.normalized.length);

    if (!brandEntries.length) {
        return {
            brandKey: null,
            statementName,
            ambiguous: false,
            brandCandidates: []
        };
    }

    const longestLength = brandEntries[0].normalized.length;
    const longest = brandEntries.filter(entry => entry.normalized.length === longestLength);
    const distinctNames = [...new Set(longest.map(entry => entry.normalized))];

    if (distinctNames.length > 1) {
        return {
            brandKey: null,
            statementName,
            ambiguous: true,
            brandCandidates: longest.map(entry => entry.key)
        };
    }

    return {
        brandKey: longest[0].key,
        normalizedBrand: longest[0].normalized,
        statementName,
        ambiguous: false,
        brandCandidates: [longest[0].key]
    };
}

/**
 * Second-pass fallback for products that did not pass the primary attribute
 * matcher. It searches only catalogue brands, then checks specified
 * strength/size and comparable pack quantities before considering a match.
 * It intentionally does not use product-specific names or codes.
 */
function matchByPriceListBrandStrengthAndPack(statementProduct, priceIndex) {
    const brandInfo = identifyBrandFromPriceList(statementProduct, priceIndex);

    if (brandInfo.ambiguous) {
        return {
            matched: false,
            ambiguous: true,
            reviewRequired: true,
            product: null,
            reason: "More than one price-list brand matched the statement prefix",
            reviewReasons: ["AMBIGUOUS_PRICE_LIST_BRAND"],
            candidates: brandInfo.brandCandidates,
            candidateCount: brandInfo.brandCandidates.length
        };
    }

    if (!brandInfo.brandKey) {
        return {
            matched: false,
            ambiguous: false,
            reviewRequired: false,
            product: null,
            reason: "No brand from the price list was identified at the start of the statement",
            reviewReasons: [],
            candidateCount: 0
        };
    }

    const source = parseProduct(brandInfo.statementName);

    // This fallback is specifically strength/size-first. Without a numeric
    // strength/size in the statement, it cannot safely select by this rule.
    if (!source.amounts.length) {
        return {
            matched: false,
            ambiguous: false,
            reviewRequired: false,
            product: null,
            reason: "Brand identified, but statement has no strength/size for fallback comparison",
            reviewReasons: ["STATEMENT_STRENGTH_OR_SIZE_NOT_SPECIFIED"],
            candidateCount: 0
        };
    }

    const catalogueProducts = priceIndex[brandInfo.brandKey] || [];
    const eligible = [];

    for (const item of catalogueProducts) {
        if (!item || !item.product) continue;

        const product = item.product;
        const candidate = parseProduct(product["Product Description"] || "");

        if (candidate.brand !== canonicalize(brandInfo.brandKey)) continue;
        if (!candidate.amounts.length) continue;

        // Explicit meaningful modifiers (PLUS/MF/GOLD/LITE/SR, etc.) must
        // still agree so the fallback cannot cross a named variant boundary.
        if (!sameArray(source.modifiers, candidate.modifiers)) continue;

        const amountCheck = amountsCompatible(source.amounts, candidate.amounts);
        if (!amountCheck.compatible) continue;

        const packCheck = comparePack(source, candidate, product);
        if (!packCheck.compatible) continue;

        const formCheck = compareForms(source, candidate);
        const reviewReasons = [
            "BRAND_STRENGTH_PACK_FALLBACK_USED",
            ...amountCheck.reviewReasons,
            ...packCheck.reviewReasons,
            ...formCheck.reviewReasons,
            ...compareVariants(source, candidate)
        ];

        if (!sameArray(source.coreTokens, candidate.coreTokens)) {
            if (source.coreTokens.length || candidate.coreTokens.length) {
                reviewReasons.push("DESCRIPTIVE_TOKEN_DIFFERENCE");
            }
        }

        eligible.push({
            product,
            candidate,
            score: scoreCandidate(source, candidate, product),
            reviewReasons: [...new Set(reviewReasons)]
        });
    }

    if (eligible.length) {
        return resolveEligibleCandidates(
            eligible,
            brandInfo.statementName,
            "BRAND_STRENGTH_PACK_FALLBACK"
        );
    }

    return {
        matched: false,
        ambiguous: false,
        reviewRequired: false,
        product: null,
        reason: "No same-brand price-list candidate passed strength/size and pack checks",
        reviewReasons: [],
        candidateCount: 0
    };
}

function matchByProductAttributes(statementProduct, priceIndex) {
    if (!priceIndex) {
        return {
        matched: false,
        ambiguous: false,
        reviewRequired: false,
        product: null,
        candidates: [],
        reviewReasons: [],
        candidateCount: 0,
        reason: "Price-list index is unavailable"
        };
    }

    // FIRST PASS: normalize the complete statement and catalogue descriptions,
    // then accept an exact normalized match only when it identifies one record.
    // This handles formatting differences (spacing, punctuation, unit notation,
    // pack notation and synonyms) before running attribute-based fallback logic.
    const statementName = stripLeadingProductCode(statementProduct);
    const normalizedSource = canonicalize(statementName);
    const exactNormalizedMatches = [];

    if (normalizedSource) {
        for (const brandKey of Object.keys(priceIndex)) {
            for (const item of priceIndex[brandKey] || []) {
                if (!item?.product) continue;

                const candidateName = item.product["Product Description"] || "";
                if (canonicalize(candidateName) === normalizedSource) {
                    exactNormalizedMatches.push(item.product);
                }
            }
        }
    }

    if (exactNormalizedMatches.length === 1) {
        return {
            matched: true,
            ambiguous: false,
            reviewRequired: false,
            product: exactNormalizedMatches[0],
            reason: "Exact normalized description match",
            candidateCount: exactNormalizedMatches.length,
            matchMethod: "NORMALIZED_EXACT",
            reviewReasons: [],
            candidates: [exactNormalizedMatches[0]["Product Description"]]
        };
    }

    if (exactNormalizedMatches.length > 1) {
        return {
            matched: false,
            ambiguous: true,
            reviewRequired: true,
            product: null,
            reason: "Multiple catalogue records have the same normalized description",
            candidateCount: exactNormalizedMatches.length,
            matchMethod: "NORMALIZED_EXACT",
            reviewReasons: ["DUPLICATE_NORMALIZED_CATALOGUE_DESCRIPTIONS"],
            candidates: exactNormalizedMatches.map(product =>
                product["Product Description"]
            )
        };
    }

    // No exact normalized match: continue with brand/strength/pack logic.
    const source = parseProduct(statementName);
    if (!source.brand) {
        return {
        matched: false,
        ambiguous: false,
        reviewRequired: false,
        product: null,
        candidates: [],
        reviewReasons: [],
        candidateCount: 0,
        reason: "No brand could be identified"
        };
    }

    const bucket = priceIndex[source.brand] || [];
    const eligible = [];

    for (const item of bucket) {
        if (!item || !item.product) continue;

        const product = item.product;
        const candidate = parseProduct(product["Product Description"] || "");
        if (candidate.brand !== source.brand) continue;

        // Meaningful modifiers remain hard constraints (PLUS, MF, M, SR, GOLD, etc.).
        if (!sameArray(source.modifiers, candidate.modifiers)) continue;

        const amountCheck = amountsCompatible(source.amounts, candidate.amounts);
        if (!amountCheck.compatible) continue;

        const packCheck = comparePack(source, candidate, product);
        if (!packCheck.compatible) continue;

        // If both descriptions have distinctive core words, they must overlap.
        // If one side omits such words, retain the candidate only with a review flag.
        if (source.coreTokens.length && candidate.coreTokens.length) {
            const overlap = source.coreTokens.some(token => candidate.coreTokens.includes(token));
            if (!overlap) continue;
        }

        const formCheck = compareForms(source, candidate);
        const reviewReasons = [
            ...amountCheck.reviewReasons,
            ...packCheck.reviewReasons,
            ...formCheck.reviewReasons,
            ...compareVariants(source, candidate)
        ];

        if (source.coreTokens.length !== candidate.coreTokens.length ||
            source.coreTokens.some(token => !candidate.coreTokens.includes(token)) ||
            candidate.coreTokens.some(token => !source.coreTokens.includes(token))) {
            if (source.coreTokens.length || candidate.coreTokens.length) {
                reviewReasons.push("DESCRIPTIVE_TOKEN_DIFFERENCE");
            }
        }

        eligible.push({
            product,
            candidate,
            score: scoreCandidate(source, candidate, product),
            reviewReasons: [...new Set(reviewReasons)]
        });
    }

    if (eligible.length) {
        return resolveEligibleCandidates(
            eligible,
            statementName,
            "PRIMARY_ATTRIBUTE_MATCH"
        );
    }

    // SECOND PASS: use the brand identified from the price-list index, then
    // require compatible specified strength/size and pack information.
    return matchByPriceListBrandStrengthAndPack(statementProduct, priceIndex);
}

module.exports = {
    matchByProductAttributes,
    matchByPriceListBrandStrengthAndPack,
    identifyBrandFromPriceList,
    parseProduct
};
