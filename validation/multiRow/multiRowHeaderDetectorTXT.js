/*
 * ============================================================
 * MULTI-ROW TXT HEADER DETECTOR
 * ============================================================
 * File:
 * validation/multiRow/multiRowHeaderDetectorTXT.js
 *
 * STEP 1 ONLY
 *
 * Detects:
 *   - headerStart
 *   - headerEnd
 *   - headerLines
 *   - dataStartsAt
 *
 * It does NOT extract data or perform Common-field mapping.
 * ============================================================
 */

"use strict";

const fs = require("fs");
const path = require("path");

const MAX_HEADER_ROWS = 6;
const MIN_HEADER_SCORE = 80;
const DATA_LOOKAHEAD_ROWS = 8;

const HEADER_TERMS = [
    "product","productname","product name","particular","particulars",
    "description","medicine","item","itemname","item name",
    "pack","packing","pkg","opening","opstk","op stk","op.qty","op qty",
    "purchase","purch","pur","receipt","receipts","rcpt","pr","pr.ret",
    "purchase return","purchase rtn","sales","sale","sl","sl ret",
    "sales return","sales rtn","return","closing","cl.st","cl stk",
    "clstk","closing stock","value","sal.val","salevalue","salesvalue",
    "cl.val","clvalue","closing value","adjustment","adj","free","scheme",
    "qty","quantity","stock","age","expiry","hsn","hsncode","hsn code",
    "code","total"
];

const TITLE_TERMS = [
    "company","company name","category","category name","from","to",
    "statement","report","period","address","area","region","division",
    "territory","date","generated","customer","party","distributor"
];

function normalizedText(value) {
    return String(value == null ? "" : value)
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim();
}

function compact(value) {
    return String(value == null ? "" : value)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "");
}

function isBlank(line) {
    return !String(line == null ? "" : line).trim();
}

function countSpaces(line) {
    const matches = String(line).match(/ /g);
    return matches ? matches.length : 0;
}

function countTabs(line) {
    const matches = String(line).match(/\t/g);
    return matches ? matches.length : 0;
}

function countNonWhitespace(line) {
    return String(line == null ? "" : line).replace(/\s/g, "").length;
}

function hasDigit(line) {
    return /\d/.test(String(line));
}

function hasDecimalNumber(line) {
    return /\d+(?:\.\d+)?/.test(String(line));
}

function isSeparatorLine(line) {
    const text = String(line == null ? "" : line);
    if (!text.trim()) return false;

    const stripped = text.replace(/\s/g, "");

    return stripped.length >= 5 && /^[-_=~*]+$/.test(stripped);
}

function countHeaderTerms(line) {
    const text = normalizedText(line);
    const compactText = compact(text);
    let count = 0;

    for (const term of HEADER_TERMS) {
        if (
            text.includes(term.toUpperCase()) ||
            compactText.includes(compact(term))
        ) {
            count++;
        }
    }

    return count;
}

function countTitleTerms(line) {
    const text = normalizedText(line);
    let count = 0;

    for (const term of TITLE_TERMS) {
        if (text.includes(term.toUpperCase())) count++;
    }

    return count;
}

function scoreHeaderRow(line, index) {
    const text = normalizedText(line);

    if (!text) {
        return {
            score: 0,
            isCandidate: false,
            reason: "blank",
            index
        };
    }

    if (isSeparatorLine(line)) {
        return {
            score: -100,
            isCandidate: false,
            reason: "separator",
            index
        };
    }

    const termCount = countHeaderTerms(line);
    const titleCount = countTitleTerms(line);
    const spaces = countSpaces(line);
    const tabs = countTabs(line);
    const length = String(line).length;
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    let score = 0;

    score += Math.min(termCount * 25, 175);

    if (spaces >= 5) score += 15;
    if (spaces >= 15) score += 15;
    if (spaces >= 30) score += 15;
    if (tabs > 0) score += Math.min(tabs * 10, 30);

    if (wordCount >= 3) score += 10;
    if (wordCount >= 5) score += 10;

    score -= Math.min(titleCount * 20, 60);

    if (length < 8) score -= 30;

    if (hasDigit(line) && termCount < 2) score -= 25;

    if (/PRODUCT|PARTICULAR|DESCRIPTION|MEDICINE|ITEM/i.test(line)) {
        score += 40;
    }

    if (/OPENING|PURCHASE|SALES|CLOSING|STOCK/i.test(line)) {
        score += 35;
    }

    if (/VALUE|QTY|QUANTITY|PACK|PACKING|PKG/i.test(line)) {
        score += 25;
    }

    return {
        score: Math.max(0, score),
        isCandidate: score >= MIN_HEADER_SCORE,
        reason: {
            termCount,
            titleCount,
            spaces,
            tabs,
            wordCount,
            length,
            hasDigit: hasDigit(line),
            hasDecimalNumber: hasDecimalNumber(line)
        },
        index
    };
}

function physicalCompatibility(lineA, lineB) {
    const a = String(lineA);
    const b = String(lineB);

    if (!a || !b) return 0;

    const widthDifference = Math.abs(a.length - b.length);
    let score = 0;

    if (widthDifference <= 2) score += 30;
    else if (widthDifference <= 5) score += 20;
    else if (widthDifference <= 10) score += 10;

    if (countSpaces(a) >= 10 && countSpaces(b) >= 10) {
        score += 20;
    }

    if (countHeaderTerms(a) > 0 && countHeaderTerms(b) > 0) {
        score += 30;
    }

    if (
        /OPENING|PURCHASE|SALES|CLOSING|VALUE|QTY|QUANTITY/i.test(a) &&
        /OPENING|PURCHASE|SALES|CLOSING|VALUE|QTY|QUANTITY/i.test(b)
    ) {
        score += 20;
    }

    return Math.min(score, 100);
}

function hasStrongDataPattern(line) {
    const text = normalizedText(line);

    if (!text || isSeparatorLine(line)) return false;

    const leadingText = String(line).replace(/^\s+/, "");

    const productLike =
        /^[A-Z0-9][A-Z0-9 .,&'()\/:%_-]{2,}/i.test(leadingText);

    const hasOperationalNumbers = /\d/.test(String(line));

    return productLike && hasOperationalNumbers;
}

function scoreDataRow(line) {
    const text = normalizedText(line);

    if (!text) return { score: 0, likelyData: false };

    if (isSeparatorLine(line)) {
        return {
            score: -100,
            likelyData: false,
            separator: true
        };
    }

    const headerTerms = countHeaderTerms(line);
    let score = 0;

    if (!/^(TOTAL|GRAND TOTAL|SUB TOTAL|SUBTOTAL)\b/i.test(text)) {
        if (/^[A-Z0-9][A-Z0-9 .,&'()\/:%_-]{2,}/i.test(text)) {
            score += 15;
        }
    }

    if (hasDigit(line)) score += 25;
    if (hasDecimalNumber(line)) score += 20;
    if (countNonWhitespace(line) >= 10) score += 10;

    score -= Math.min(headerTerms * 15, 60);

    if (/^(TOTAL|GRAND TOTAL|SUB TOTAL|SUBTOTAL)\b/i.test(text)) {
        score -= 80;
    }

    if (hasStrongDataPattern(line)) score += 80;

    return {
        score: Math.max(0, score),
        likelyData: score >= 25
    };
}

function scoreHeaderBlock(lines, start, end) {
    const block = lines.slice(start, end + 1);

    if (block.length < 2) {
        return { score: 0, valid: false };
    }

    for (const line of block) {
        if (isSeparatorLine(line)) {
            return {
                score: 0,
                valid: false,
                reason: "separator-inside-header"
            };
        }

        /*
         * A continuation header may contain digits as part of a
         * formatting label, e.g. "(1.00)". When a line itself has
         * several header terms, do not mistake that header formatting
         * for a product-data row.
         */
        if (
            hasStrongDataPattern(line) &&
            countHeaderTerms(line) < 3
        ) {
            return {
                score: 0,
                valid: false,
                reason: "data-inside-header"
            };
        }
    }

    const rowScores = block.map((line, offset) =>
        scoreHeaderRow(line, start + offset)
    );

    const totalHeaderScore = rowScores.reduce(
        (sum, result) => sum + result.score,
        0
    );

    const nonBlankRows = block.filter(line => !isBlank(line));

    if (nonBlankRows.length < 2) {
        return { score: 0, valid: false };
    }

    const weakRows = rowScores.filter(
        result => result.score < MIN_HEADER_SCORE
    );

    if (weakRows.length > 0) {
        return {
            score: 0,
            valid: false,
            reason: "weak-header-row"
        };
    }

    let compatibilityScore = 0;

    for (let i = 1; i < nonBlankRows.length; i++) {
        compatibilityScore += physicalCompatibility(
            nonBlankRows[i - 1],
            nonBlankRows[i]
        );
    }

    const combined = block.join(" ");

    /*
     * CODE / NAME reports use "Code" + "Name" as the product-side
     * header instead of the literal word "Product".
     *
     * This is intentionally narrow: Code must be immediately followed
     * by Name in the combined header text. Existing product-header
     * aliases remain unchanged.
     */
    const hasProductHeader =
        /PRODUCT|PARTICULAR|DESCRIPTION|MEDICINE|ITEM/i.test(combined) ||
        /\bCODE\b\s+\bNAME\b/i.test(combined);

    const hasOperationalHeader =
        /OPENING|PURCHASE|SALES|CLOSING|STOCK|VALUE|QTY|QUANTITY/i.test(
            combined
        );

    let score = totalHeaderScore + compatibilityScore;

    if (hasProductHeader) score += 100;
    if (hasOperationalHeader) score += 100;

    return {
        score,
        valid:
            hasProductHeader &&
            hasOperationalHeader &&
            score >= 250,
        rowScores,
        hasProductHeader,
        hasOperationalHeader,
        compatibilityScore
    };
}

function findDataStart(lines, headerEnd) {
    const start = headerEnd + 1;
    const max = Math.min(lines.length, start + DATA_LOOKAHEAD_ROWS);

    for (let i = start; i < max; i++) {
        if (isBlank(lines[i]) || isSeparatorLine(lines[i])) continue;

        if (hasStrongDataPattern(lines[i])) return i;
    }

    for (let i = start; i < lines.length; i++) {
        if (!isBlank(lines[i]) && !isSeparatorLine(lines[i])) return i;
    }

    return lines.length;
}

function countContiguousDataRows(lines, dataStart) {
    let count = 0;

    for (let i = dataStart; i < lines.length; i++) {
        const line = lines[i];

        if (isBlank(line) || isSeparatorLine(line)) {
            if (count > 0) break;
            continue;
        }

        if (!hasStrongDataPattern(line)) break;

        const text = normalizedText(line);

        /*
         * Secondary sections such as:
         *   SHORT EXPIRY PRODUCTS
         *   LONG PENDING CLAIMS
         *   SALES VALUE
         * are not product-data rows even when they contain digits.
         */
        if (
            /^(SHORT|LONG|OPENING|CLOSING|SALES|PURCHASE|LAST MONTH|TOTAL|GRAND TOTAL|SUB TOTAL)/i.test(text)
        ) {
            break;
        }

        count++;
    }

    return count;
}

function findMultiRowHeader(lines) {
    const candidates = [];

    for (let i = 0; i < lines.length; i++) {
        if (isBlank(lines[i]) || isSeparatorLine(lines[i])) continue;

        const score = scoreHeaderRow(lines[i], i);

        if (score.isCandidate) candidates.push(score);
    }

    let best = null;

    for (const candidate of candidates) {
        const start = candidate.index;

        for (
            let rowCount = 2;
            rowCount <= MAX_HEADER_ROWS;
            rowCount++
        ) {
            const end = start + rowCount - 1;

            if (end >= lines.length) break;

            const blockLines = lines.slice(start, end + 1);

            if (blockLines.some(line => isBlank(line))) break;

            if (
                blockLines.some(
                    line =>
                        isSeparatorLine(line) ||
                        (
                            hasStrongDataPattern(line) &&
                            countHeaderTerms(line) < 3
                        )
                )
            ) {
                break;
            }

            const block = scoreHeaderBlock(
                lines,
                start,
                end
            );

            if (!block.valid) continue;

            const dataStartsAt = findDataStart(lines, end);

            if (dataStartsAt <= end) continue;

            const result = {
                success: true,
                format: "MULTI_ROW_FIXED_WIDTH",
                detection: "MULTI_ROW_HEADER",
                headerStart: start,
                headerEnd: end,
                headerLines: lines.slice(start, end + 1),
                dataStartsAt,
                confidence: Math.min(999, block.score),
                diagnostics: {
                    headerRows: rowCount,
                    blockScore: block.score,
                    compatibilityScore: block.compatibilityScore,
                    hasProductHeader: block.hasProductHeader,
                    hasOperationalHeader: block.hasOperationalHeader,
                    contiguousDataRows:
                        countContiguousDataRows(
                            lines,
                            dataStartsAt
                        )
                }
            };

            if (!best) {
                best = result;
                continue;
            }

            const bestRows =
                best.headerEnd - best.headerStart + 1;

            const resultDataRows =
                result.diagnostics.contiguousDataRows;

            const bestDataRows =
                best.diagnostics.contiguousDataRows;

            /*
             * PRIMARY TABLE SELECTION
             *
             * When a TXT contains multiple valid-looking tables,
             * the primary statement table is the one backed by the
             * largest continuous block of data rows.
             *
             * This selection rule is intentionally applied only after
             * the existing header validation has succeeded. It does
             * not change header scoring, aliases, exports, or the
             * existing detector API.
             */
            if (
                resultDataRows >
                bestDataRows
            ) {
                best = result;
            }
            else if (
                resultDataRows ===
                bestDataRows
            ) {
                if (
                    result.confidence >
                    best.confidence
                ) {
                    best = result;
                }
                else if (
                    Math.abs(
                        result.confidence -
                        best.confidence
                    ) <= 20 &&
                    rowCount > bestRows
                ) {
                    best = result;
                }
            }
        }
    }

    if (best) return best;

    return {
        success: false,
        format: null,
        detection: null,
        headerStart: null,
        headerEnd: null,
        headerLines: [],
        dataStartsAt: null,
        confidence: 0,
        diagnostics: {
            message:
                "No multi-row fixed-width header block detected."
        }
    };
}

function readTXT(filePath) {
    const absolutePath = path.resolve(filePath);
    const buffer = fs.readFileSync(absolutePath);
    const text = buffer.toString("utf8");
    const lines = text.split(/\r?\n/);

    return {
        file: absolutePath,
        encoding: "utf8",
        totalLines: lines.length,
        nonBlankLines: lines.filter(line => !isBlank(line)).length,
        tabLines: lines.filter(line => countTabs(line) > 0).length,
        spacedLines: lines.filter(line => countSpaces(line) >= 2).length,
        lines
    };
}

function detectMultiRowTXTHeader(filePath) {
    const reader = readTXT(filePath);
    const detection = findMultiRowHeader(reader.lines);

    return {
        ...detection,
        file: reader.file,
        encoding: reader.encoding,
        totalLines: reader.totalLines,
        nonBlankLines: reader.nonBlankLines,
        tabLines: reader.tabLines,
        spacedLines: reader.spacedLines
    };
}

function printResult(result) {
    console.log("\n============================================================");
    console.log("       MULTI-ROW TXT HEADER DETECTOR");
    console.log("============================================================");
    console.log(`File           : ${result.file}`);
    console.log(`Encoding       : ${result.encoding}`);
    console.log(`Total Lines    : ${result.totalLines}`);
    console.log(`Non-Blank      : ${result.nonBlankLines}`);
    console.log(`TAB Lines      : ${result.tabLines}`);
    console.log(`Spaced Lines   : ${result.spacedLines}`);
    console.log("------------------------------------------------------------");

    if (!result.success) {
        console.log("Detection      : NOT FOUND");
        console.dir(result.diagnostics, { depth: null });
        console.log("============================================================");
        return;
    }

    console.log(`Detection      : ${result.detection}`);
    console.log(`Format         : ${result.format}`);
    console.log(`Header Start   : ${result.headerStart + 1}`);
    console.log(`Header End     : ${result.headerEnd + 1}`);
    console.log(`Data Starts    : ${result.dataStartsAt + 1}`);
    console.log(`Confidence     : ${result.confidence}`);
    console.log("------------------------------------------------------------");
    console.log("Header Lines:");

    result.headerLines.forEach((line, index) => {
        console.log(
            `${result.headerStart + index + 1}: ${line}`
        );
    });

    console.log("------------------------------------------------------------");
    console.log("Diagnostics:");
    console.dir(result.diagnostics, { depth: null });
    console.log("============================================================");
}

module.exports = {
    detectMultiRowTXTHeader,
    findMultiRowHeader,
    scoreHeaderRow,
    scoreHeaderBlock,
    scoreDataRow,
    physicalCompatibility,
    isSeparatorLine,
    hasStrongDataPattern,
    readTXT
};

if (require.main === module) {
    const input = process.argv[2];

    if (!input) {
        console.error("Usage:");
        console.error(
            'node validation/multiRow/multiRowHeaderDetectorTXT.js "path\\to\\statement.txt"'
        );
        process.exit(1);
    }

    try {
        const result = detectMultiRowTXTHeader(input);
        printResult(result);
        process.exit(result.success ? 0 : 2);
    }
    catch (error) {
        console.error("\nERROR:");
        console.error(
            error && error.stack ? error.stack : error
        );
        process.exit(1);
    }
}
