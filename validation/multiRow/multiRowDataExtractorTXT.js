/*
 * ============================================================
 * MULTI-ROW TXT DATA EXTRACTOR - STEP 3
 * ============================================================
 *
 * Corrected positional numeric extraction.
 *
 * Core rule:
 *   Header positions define the logical order and approximate
 *   physical regions, but a continuous numeric sequence must
 *   NEVER be split merely because it crosses a header boundary.
 *
 * Examples:
 *
 *   10873.20 -> ONE complete value
 *   13772.72 -> ONE complete value
 *   1579.20  -> ONE complete value
 *
 * Quantity aggregation:
 *
 *   74 + 6 -> 80
 *   7 + 0  -> 7
 *
 * Product names containing numbers are protected because the
 * Product/Pack region is extracted before operational numbers
 * are interpreted.
 *
 * ============================================================
 */

"use strict";

const fs = require("fs");
const path = require("path");

/* ============================================================
 * LOAD STEP 1
 * ============================================================
 */

function loadDetector() {
    const file = path.join(
        __dirname,
        "multiRowHeaderDetectorTXT.js"
    );

    if (!fs.existsSync(file)) {
        throw new Error(
            `Step 1 detector not found: ${file}`
        );
    }

    const detector = require(file);

    if (
        !detector ||
        typeof detector.detectMultiRowTXTHeader !== "function"
    ) {
        throw new Error(
            "Step 1 detector API mismatch. Expected detectMultiRowTXTHeader."
        );
    }

    return detector;
}

/* ============================================================
 * LOAD STEP 2
 * ============================================================
 */

function loadMapper() {
    const file = path.join(
        __dirname,
        "multiRowHeaderMapperTXT.js"
    );

    if (!fs.existsSync(file)) {
        throw new Error(
            `Step 2 mapper not found: ${file}`
        );
    }

    const mapper = require(file);

    if (
        !mapper ||
        typeof mapper.mapDetectedHeader !== "function"
    ) {
        throw new Error(
            "Step 2 mapper API mismatch. Expected mapDetectedHeader."
        );
    }

    return mapper;
}

/* ============================================================
 * PHYSICAL HELPERS
 * ============================================================
 */

function slicePhysical(
    line,
    start,
    end
) {
    const text = String(
        line == null ? "" : line
    );

    const safeStart = Math.max(
        0,
        Number.isFinite(start)
            ? start
            : 0
    );

    if (
        end == null ||
        !Number.isFinite(end)
    ) {
        return text
            .slice(safeStart)
            .trim();
    }

    return text
        .slice(
            safeStart,
            Math.max(
                safeStart,
                end
            )
        )
        .trim();
}

/* ============================================================
 * COMPLETE NUMERIC RUN SCANNER
 * ============================================================
 *
 * The scanner operates on the COMPLETE DATA ROW.
 *
 * This is critical:
 *
 * WRONG:
 *   slice first -> scan number
 *
 * CORRECT:
 *   scan complete row -> locate complete numeric run ->
 *   assign complete run to logical field
 *
 * Thus:
 *
 *   10873.20
 *
 * remains one numeric run even if a header boundary falls
 * between characters of that number.
 */

function scanCompleteNumericRuns(
    line,
    startAt = 0
) {
    const text = String(
        line == null ? "" : line
    );

    const runs = [];

    let i = Math.max(
        0,
        startAt
    );

    while (i < text.length) {
        const current = text[i];

        const beginsNumber =
            /[0-9]/.test(current) ||
            (
                current === "-" &&
                /[0-9]/.test(
                    text[i + 1] || ""
                )
            );

        if (!beginsNumber) {
            i++;
            continue;
        }

        const start = i;

        if (text[i] === "-") {
            i++;
        }

        /*
         * Integer part.
         *
         * Commas are part of the numeric value for statement formats
         * that print Indian/international grouped amounts, e.g.:
         *
         *   8,120.00
         *   26,018.00
         *   2,59,242.00
         *
         * IMPORTANT:
         * The complete numeric token is captured before any positional
         * mapping is performed. A comma must NEVER create a new run.
         */
        while (
            i < text.length &&
            (
                /[0-9]/.test(text[i]) ||
                (
                    text[i] === "," &&
                    /[0-9]/.test(text[i + 1] || "")
                )
            )
        ) {
            i++;
        }

        /*
         * Decimal part belongs to the same number.
         */
        if (
            text[i] === "." &&
            /[0-9]/.test(
                text[i + 1] || ""
            )
        ) {
            i++;

            while (
                i < text.length &&
                /[0-9]/.test(text[i])
            ) {
                i++;
            }
        }

        const end = i;

        const raw =
            text.slice(
                start,
                end
            );

        /*
         * Number("8,120.00") is NaN in JavaScript.
         * Remove grouping commas only for the numeric value used by
         * diagnostics/quantity aggregation. The original raw text and
         * source positions are preserved exactly.
         */
        const numericValue =
            Number(
                raw.replace(/,/g, "")
            );

        /*
         * Reject malformed comma fragments rather than allowing a
         * standalone comma to become part of a numeric run.
         *
         * Accepted examples:
         *   8120
         *   8,120
         *   26,018
         *   2,59,242
         *   8120.00
         *   2,59,242.00
         */
        const validGroupedNumber =
            /^-?\d+(?:,\d+)*(?:\.\d+)?$/.test(
                raw
            );

        if (
            validGroupedNumber &&
            Number.isFinite(numericValue)
        ) {
            runs.push({
                raw,
                value: numericValue,
                start,
                end,
                isInteger:
                    Number.isInteger(
                        numericValue
                    )
            });
        }
    }

    return runs;
}

/* ============================================================
 * HEADER COLUMN ORDER
 * ============================================================
 *
 * Columns are ordered by physical start.
 */

function orderedColumns(
    columns
) {
    return [...columns]
        .sort(
            (a, b) =>
                a.physicalStart -
                b.physicalStart
        );
}

/* ============================================================
 * PRODUCT / PACK PROTECTION
 * ============================================================
 */

function isCodeNameStockPhysicalStructure(columns) {
    if (!Array.isArray(columns) || columns.length < 3) {
        return false;
    }

    const headers = columns.map(
        column =>
            String(
                column && column.header != null
                    ? column.header
                    : ""
            ).trim().toUpperCase()
    );

    return (
        headers[0] === "CODE" &&
        headers[1] === "NAME" &&
        headers[2] === "PRATE"
    );
}

function extractCodeNameStockProduct(line, columns, options = {}) {
    const productColumn =
        columns.find(
            column =>
                column &&
                column.commonField === "product"
        );

    if (!productColumn) {
        return "";
    }

    const text =
        String(line == null ? "" : line);

    const start =
        Number(productColumn.physicalStart);

    const end =
        productColumn.physicalEnd == null
            ? text.length
            : Number(productColumn.physicalEnd);

    if (
        !Number.isFinite(start) ||
        !Number.isFinite(end)
    ) {
        return slicePhysical(
            text,
            productColumn.physicalStart,
            productColumn.physicalEnd
        );
    }

    /*
     * Some reports advertise a Code column, but the data row does not
     * actually contain a code. In that case the Name boundary can fall
     * directly through the middle of the product text.
     *
     * Example:
     *   mapper: Code 0-9 | Name 9-29
     *   row:    KC LITE GOLD CRM 20GM...
     *
     * If both characters immediately around the Name boundary are
     * non-whitespace, the boundary is inside one continuous product token.
     * Extend the product back to column 0 instead of returning a truncated
     * name such as "LD CRM 20GM".
     *
     * This is deliberately restricted to the CODE/NAME/PRATE structure and
     * does not alter generic product extraction for other statements.
     */
    if (
        start > 0 &&
        start < text.length &&
        !/\s/.test(text[start - 1] || "") &&
        !/\s/.test(text[start] || "")
    ) {
        return text
            .slice(0, end)
            .trim();
    }

    return text
        .slice(start, end)
        .trim();
}

function getProductPackEnd(
    columns
) {
    const productPack =
        columns.filter(
            column =>
                column.commonField ===
                    "product" ||
                column.commonField ===
                    "pack"
        );

    if (!productPack.length) {
        return 0;
    }

    return Math.max(
        ...productPack.map(
            column =>
                column.physicalEnd == null
                    ? 0
                    : column.physicalEnd
        )
    );
}

/* ============================================================
 * OPERATIONAL COLUMNS
 * ============================================================
 */

function getOperationalColumns(
    columns
) {
    return orderedColumns(
        columns.filter(
            column =>
                column.commonField &&
                column.commonField !==
                    "product" &&
                column.commonField !==
                    "pack"
        )
    );
}

/* ============================================================
 * FIELD TYPES
 * ============================================================
 */

const QUANTITY_FIELDS =
    new Set([
        "opening",
        "purchase",
        "purchaseReturn",
        "sales",
        "salesFree",
        "salesReturn",
        "closing"
    ]);

const VALUE_FIELDS =
    new Set([
        "purchaseValue",
        "salesValue",
        "closingValue"
    ]);

/* ============================================================
 * RUN ASSIGNMENT
 * ============================================================
 *
 * We assign a COMPLETE numeric run using its position.
 *
 * The run's center is compared with the physical column
 * centers.
 *
 * If a run crosses a physical boundary, the complete run is
 * assigned to the closest logical numeric column.
 *
 * This prevents:
 *
 *   10873.20
 *
 * from becoming:
 *
 *   108 + 73.20
 *
 * merely because the old boundary was between 108 and 73.
 */

function columnCenter(
    column,
    lineLength
) {
    const start =
        column.physicalStart;

    const end =
        column.physicalEnd == null
            ? lineLength
            : column.physicalEnd;

    return (
        start + end
    ) / 2;
}

function assignNumericRuns(
    line,
    runs,
    columns
) {
    const operational =
        getOperationalColumns(
            columns
        );

    if (!operational.length) {
        return [];
    }

    /*
     * HEADER-DRIVEN POSITIONAL ASSIGNMENT
     *
     * The detected header physical ranges are authoritative.
     *
     * For each complete numeric run:
     *
     *   1. If the complete run is covered by one header range,
     *      assign it directly to that header.
     *
     *   2. If the run crosses a header boundary, assign it to the
     *      header with the greatest physical overlap.
     *
     *   3. Only when no header physically overlaps the run do we
     *      use the nearest header center as a last-resort fallback.
     *
     * This prevents a numeric value from being assigned merely
     * because its center happens to be closer to another column.
     *
     * Most importantly, the numeric run itself is NEVER changed.
     * Its raw text and start/end positions remain exactly as
     * detected from the complete source row.
     */

    return runs.map(
        run => {
            const runStart =
                Number(run.start);

            const runEnd =
                Number(run.end);

            let containing = null;

            /*
             * First preference: the complete numeric run is inside
             * one or more physical header regions.
             *
             * IMPORTANT:
             * Header ranges can overlap at a boundary because a parent
             * header may cover a wider region while a child header refines
             * part of that same region. Do NOT accept the first matching
             * column. Choose the most specific containing physical range.
             *
             * This is what prevents a value at the Purchase/Sales boundary
             * from being captured by the wider Purchase Return range when
             * the narrower Sales Qty child range also contains it.
             */
            const containingMatches = [];

            for (
                const column of operational
            ) {
                const start =
                    Number(column.physicalStart);

                const end =
                    column.physicalEnd == null
                        ? line.length
                        : Number(column.physicalEnd);

                if (
                    Number.isFinite(start) &&
                    Number.isFinite(end) &&
                    runStart >= start &&
                    runEnd <= end
                ) {
                    containingMatches.push({
                        column,
                        start,
                        end,
                        width: end - start
                    });
                }
            }

            if (containingMatches.length) {
                containingMatches.sort(
                    (a, b) => {
                        /*
                         * Narrowest containing physical range wins.
                         * Child/header refinements are therefore preferred
                         * over broader overlapping parent regions.
                         */
                        if (a.width !== b.width) {
                            return a.width - b.width;
                        }

                        /*
                         * Deterministic tie-breaker:
                         * prefer the physically rightmost range. This matches
                         * the normal right-aligned nature of fixed-width
                         * numeric statement columns.
                         */
                        return b.start - a.start;
                    }
                );

                containing =
                    containingMatches[0].column;
            }

            /*
             * Second preference: if a complete run crosses a physical
             * boundary, choose the column containing the largest part
             * of that run.
             */
            let bestOverlap = null;

            if (!containing) {
                for (
                    const column of operational
                ) {
                    const start =
                        Number(column.physicalStart);

                    const end =
                        column.physicalEnd == null
                            ? line.length
                            : Number(column.physicalEnd);

                    if (
                        !Number.isFinite(start) ||
                        !Number.isFinite(end)
                    ) {
                        continue;
                    }

                    const overlapStart =
                        Math.max(
                            runStart,
                            start
                        );

                    const overlapEnd =
                        Math.min(
                            runEnd,
                            end
                        );

                    const overlap =
                        Math.max(
                            0,
                            overlapEnd -
                                overlapStart
                        );

                    if (
                        overlap > 0 &&
                        (
                            !bestOverlap ||
                            overlap >
                                bestOverlap.overlap
                        )
                    ) {
                        bestOverlap = {
                            column,
                            overlap
                        };
                    }
                }
            }

            /*
             * IMPORTANT:
             *
             * There is intentionally NO nearest-column fallback.
             *
             * A numeric value must have physical coverage from a
             * detected operational header before it can be assigned.
             * A value that is outside every detected header remains
             * unassigned instead of being guessed into the nearest field.
             */
            const best =
                containing ||
                (
                    bestOverlap
                        ? bestOverlap.column
                        : null
                );

            if (!best) {
                return {
                    ...run,
                    commonField: null,
                    header: null,
                    physicalStart: null,
                    physicalEnd: null
                };
            }

            return {
                ...run,
                commonField:
                    best.commonField,
                header:
                    best.header,
                physicalStart:
                    best.physicalStart,
                physicalEnd:
                    best.physicalEnd
            };
        }
    );
}

/* ============================================================
 * GROUP ASSIGNMENTS BY FIELD
 * ============================================================
 */

function groupAssignedRuns(
    assigned
) {
    const grouped = {};

    for (
        const item of assigned
    ) {
        const field =
            item.commonField;

        if (!field) {
            continue;
        }

        if (!grouped[field]) {
            grouped[field] = [];
        }

        grouped[field].push(
            item
        );
    }

    return grouped;
}

/* ============================================================
 * RESOLVE FIELD
 * ============================================================
 */

function resolveField(
    runs,
    field
) {
    if (!runs || !runs.length) {
        return "";
    }

    /*
     * Quantity fields:
     *
     * Multiple integer quantities are additive.
     *
     * Example:
     *   74 + 6 = 80
     */
    if (
        QUANTITY_FIELDS.has(field)
    ) {
        const allIntegers =
            runs.every(
                run =>
                    run.isInteger
            );

        if (allIntegers) {
            const total =
                runs.reduce(
                    (
                        sum,
                        run
                    ) =>
                        sum +
                        run.value,
                    0
                );

            return String(
                total
            );
        }
    }

    /*
     * Value fields:
     *
     * Preserve the COMPLETE decimal run.
     *
     * No splitting and no arbitrary addition.
     */
    if (
        VALUE_FIELDS.has(field)
    ) {
        return runs[0].raw;
    }

    return runs[0].raw;
}

/* ============================================================
 * CHELLAS 15-COLUMN OPERATIONAL RECONSTRUCTION
 * ============================================================
 *
 * This branch is deliberately isolated to the structure identified
 * by Step 2 as CHELLAS_15_COLUMN_FIXED_WIDTH.
 *
 * Product/Pack are still taken from their physical regions.
 * Only the operational area is reconstructed as a sequence of
 * 13 source columns:
 *
 *   Opening Stock
 *   Purch
 *   Free
 *   Sales Qty Prev
 *   Sales Qty Last
 *   Sales Qty Current
 *   Sales Qty Free
 *   Exp Bro
 *   Closing Stock
 *   Trans Qty
 *   Unit Rate
 *   Value Sales
 *   Value Stock
 *
 * A "-" occupies a source column and therefore cannot be removed
 * before positional mapping.
 */ 

function isChellasStructure(columns) {
    return (
        Array.isArray(columns) &&
        columns.length === 15
    );
}

function chellasOperationalTokens(
    line,
    columns
) {
    const productPackEnd =
        getProductPackEnd(columns);

    const operationalText =
        String(line == null ? "" : line)
            .slice(productPackEnd)
            .trim();

    if (!operationalText) {
        return [];
    }

    const tokens =
        operationalText
            .split(/\s+/)
            .filter(Boolean);

    /*
     * A valid CHELLAS product row has exactly 13 operational
     * source positions. "-" is a valid empty position.
     *
     * Do not accept arbitrary text as an operational token.
     */
    if (tokens.length !== 13) {
        return [];
    }

    const valid =
        tokens.every(
            token =>
                token === "-" ||
                /^-?\d+(?:\.\d+)?$/.test(token) ||
                /^-?\d+(?:\.\d+)?(?:\+\d+(?:\.\d+)?)+$/.test(token)
        );

    return valid ? tokens : [];
}

function resolveChellasToken(
    token,
    field
) {
    if (
        token == null ||
        token === "-"
    ) {
        return "";
    }

    const value =
        String(token).trim();

    /*
     * Quantity expressions are intentionally evaluated only after
     * the source column has already been identified.
     */
    if (
        QUANTITY_FIELDS.has(field) ||
        /^(?:Opening Stock|Purch|Free|Sales Qty|Exp Bro|Closing Stock|Trans Qty)$/i.test(field || "")
    ) {
        if (value.includes("+")) {
            const parts =
                value.split("+")
                    .map(Number);

            if (
                parts.length &&
                parts.every(
                    Number.isFinite
                )
            ) {
                return String(
                    parts.reduce(
                        (sum, n) =>
                            sum + n,
                        0
                    )
                );
            }
        }
    }

    return value;
}

function extractChellasPhysicalRow(
    line,
    columns,
    options = {}
) {
    const record = {};

    /*
     * Product / Pack remain protected physical fields.
     */
    for (
        const column of columns
    ) {
        if (
            column.commonField ===
            "product"
        ) {
            record.product =
                isCodeNameStockPhysicalStructure(columns)
                    ? extractCodeNameStockProduct(
                        line,
                        columns,
                        options
                    )
                    : slicePhysical(
                        line,
                        column.physicalStart,
                        column.physicalEnd
                    );
        }

        if (
            column.commonField ===
            "pack"
        ) {
            record.pack =
                slicePhysical(
                    line,
                    column.physicalStart,
                    column.physicalEnd
                );
        }
    }

    const tokens =
        chellasOperationalTokens(
            line,
            columns
        );

    if (!tokens.length) {
        return {
            record,
            numericRuns: [],
            assignedRuns: [],
            validOperationalRow: false
        };
    }

    const operationalColumns =
        orderedColumns(
            columns.filter(
                column =>
                    column.commonField !== "product" &&
                    column.commonField !== "pack"
            )
        );

    const assignedRuns = [];
    const canonicalFields = [
        "opening",
        "purchase",
        "openingFree",
        "salesPrev",
        "salesLast",
        "sales",
        "salesFree",
        "expBro",
        "closing",
        "transQty",
        "unitRate",
        "salesValue",
        "closingValue"
    ];

    const rawRuns = [];

    for (
        let i = 0;
        i < operationalColumns.length;
        i++
    ) {
        const column =
            operationalColumns[i];

        const token =
            tokens[i];

        const field =
            canonicalFields[i];

        if (
            token !== "-"
        ) {
            record[field] =
                resolveChellasToken(
                    token,
                    field
                );

            const fieldStart =
                Number(column.physicalStart);

            const fieldEnd =
                column.physicalEnd == null
                    ? line.length
                    : Number(column.physicalEnd);

            const relative =
                String(line)
                    .slice(
                        fieldStart,
                        fieldEnd
                    );

            const tokenOffset =
                relative.indexOf(token);

            const start =
                tokenOffset >= 0
                    ? fieldStart + tokenOffset
                    : fieldStart;

            const end =
                tokenOffset >= 0
                    ? start + token.length
                    : fieldEnd;

            const numeric =
                /^-?\d+(?:\.\d+)?(?:\+\d+(?:\.\d+)?)+$/.test(token) ||
                /^-?\d+(?:\.\d+)?$/.test(token);

            if (numeric) {
                const value =
                    token.includes("+")
                        ? token.split("+")
                            .map(Number)
                            .reduce(
                                (sum, n) =>
                                    sum + n,
                                0
                            )
                        : Number(token);

                const run = {
                    raw: token,
                    value,
                    start,
                    end,
                    isInteger:
                        Number.isInteger(value)
                };

                rawRuns.push(run);

                assignedRuns.push({
                    ...run,
                    commonField: field,
                    header: column.header,
                    physicalStart:
                        column.physicalStart,
                    physicalEnd:
                        column.physicalEnd
                });
            }
        }
    }

    /*
     * Preserve compatibility with the existing standard output.
     * If Step 2 supplied a standard field name, keep it aligned with
     * the canonical CHELLAS field rather than allowing an unrelated
     * nearest-column assignment to overwrite it.
     */
    return {
        record,
        numericRuns: rawRuns,
        assignedRuns,
        validOperationalRow: true
    };
}

/* ============================================================
 * EXTRACT ONE ROW
 * ============================================================
 */


/* ============================================================
 * META KRISHNA MEDICAL STORE - FIXED WIDTH BRANCH
 * ============================================================
 */


/* ============================================================
 * MOHAK MEDICOS - FIXED WIDTH BRANCH
 * ============================================================
 *
 * Fixed-width product rows:
 *   0-30  Description/Packing
 *   30-40 Opening Qty
 *   40-48 Purchase Qty
 *   48-57 Sale Qty
 *   57-65 CR.NO. ST.[+]
 *   65-73 DR.NO. ST.[-]
 *   72-81 Closing Qty
 *
 * The report's displayed "Pro. Age" heading is not populated as a
 * separate product value; the first quantity is the Opening Qty.
 */

function isMohakMedicosStructure(columns) {
    if (!Array.isArray(columns) || columns.length !== 7) {
        return false;
    }

    /*
     * The header mapper represents this two-line report using the
     * identifiable child headers only. The parent Product/Packing
     * heading is therefore not present in the mapped columns.
     *
     * Actual mapped signature:
     *   Age | QTY. | QTY. | QTY. | ST.[+] | ST.[-] | QTY.
     *
     * The three QTY. columns correspond physically to Opening,
     * Purchase and Sale, while the final QTY. is Closing.
     */
    const headers = columns.map(
        column =>
            String(
                column && column.header != null
                    ? column.header
                    : ""
            ).trim().toUpperCase()
    );

    return (
        headers[0] === "AGE" &&
        headers[1] === "QTY." &&
        headers[2] === "QTY." &&
        headers[3] === "QTY." &&
        headers[4] === "ST.[+]" &&
        headers[5] === "ST.[-]" &&
        headers[6] === "QTY."
    );
}

function isMohakMedicosSummaryLine(line) {
    const text = String(line == null ? "" : line).trim();

    if (!text) {
        return false;
    }

    return (
        /^-{10,}$/.test(text) ||
        /^={10,}$/.test(text) ||
        /^TOTAL\s+QTY\.\s+IN\s+UNIT\/PCS\./i.test(text) ||
        /^TOTAL\s+AMOUNT\s*>>>/i.test(text) ||
        /^Receivable\s+Claim\s+Amount\s*:/i.test(text) ||
        /^Payable\s+Claim\s+Amount\s*:/i.test(text)
    );
}

function extractMohakMedicosPhysicalRow(line, columns) {
    const text = String(line == null ? "" : line);

    const record = {};
    const numericRuns = [];
    const assignedRuns = [];

    /*
     * MOHAK HEADER-DRIVEN PHYSICAL ASSIGNMENT
     *
     * The mapper supplies the physical positions of the detected leaf
     * headers. We do NOT manufacture fixed column boundaries here and
     * we do NOT pair numbers merely by left-to-right sequence.
     *
     * Rule:
     *
     *   1. Scan the COMPLETE source row for COMPLETE numeric runs.
     *   2. Keep commas inside grouped numbers, e.g. 8,120.00.
     *   3. Ignore the "Age" child header for operational assignment.
     *   4. For each complete numeric run, determine which operational
     *      header physically covers that run.
     *   5. If the run crosses a header boundary, use the header with
     *      the greatest physical overlap.
     *   6. If overlap is tied, prefer the header containing the run's
     *      right side / right edge. This is important for right-aligned
     *      fixed-width values such as the Closing quantity.
     *
     * The numeric run itself is NEVER truncated or split.
     */

    const ordered = orderedColumns(columns);

    const operationalColumns = ordered.filter(
        column => {
            const header = String(
                column && column.header != null
                    ? column.header
                    : ""
            ).trim().toUpperCase();

            return header !== "AGE";
        }
    );

    const quantityColumns = operationalColumns.filter(
        column => String(
            column && column.header != null
                ? column.header
                : ""
        ).trim().toUpperCase() === "QTY."
    );

    const logicalQuantityFields = [
        "opening",
        "purchase",
        "sales",
        "closing"
    ];

    /*
     * Scan from the beginning of the row.
     *
     * We intentionally do NOT start at firstOperationalStart - 2.
     * A right-aligned complete value can begin several characters before
     * the detected child-header start. Scanning the complete row lets the
     * physical-overlap rule decide whether a run belongs to an operational
     * header, while the product region remains protected by requiring
     * physical overlap with an operational column.
     */
    const completeRuns =
        scanCompleteNumericRuns(
            text,
            0
        );

    /*
     * A numeric run belongs to the operational area only when it physically
     * overlaps at least one operational header range.
     *
     * This removes product/description numbers without inventing a product
     * boundary and still catches values that begin slightly before a header.
     */
    const candidates = completeRuns.filter(
        run => {
            const runStart = Number(run.start);
            const runEnd = Number(run.end);

            return operationalColumns.some(
                column => {
                    const start =
                        Number(column.physicalStart);

                    const end =
                        column.physicalEnd == null
                            ? text.length
                            : Number(column.physicalEnd);

                    if (
                        !Number.isFinite(start) ||
                        !Number.isFinite(end)
                    ) {
                        return false;
                    }

                    return (
                        Math.max(
                            0,
                            Math.min(runEnd, end) -
                            Math.max(runStart, start)
                        ) > 0
                    );
                }
            );
        }
    );

    /*
     * Product ends before the first numeric run that actually belongs to
     * an operational header.
     *
     * This is derived from the source row, not from a hard-coded 0-30/30-40
     * style assumption.
     */
    const firstOperationalNumericStart =
        candidates.length > 0
            ? candidates[0].start
            : null;

    const productEnd =
        firstOperationalNumericStart != null
            ? firstOperationalNumericStart
            : (
                operationalColumns.length &&
                Number.isFinite(
                    Number(operationalColumns[0].physicalStart)
                )
                    ? Number(operationalColumns[0].physicalStart)
                    : text.length
            );

    record.product =
        text.slice(
            0,
            Math.max(0, productEnd)
        ).trim();

    record.pack = "";

    /*
     * Physical overlap helper.
     */
    function getColumnRange(column) {
        const start =
            Number(column.physicalStart);

        const end =
            column.physicalEnd == null
                ? text.length
                : Number(column.physicalEnd);

        return {
            start,
            end
        };
    }

    function getOverlap(run, column) {
        const range =
            getColumnRange(column);

        if (
            !Number.isFinite(range.start) ||
            !Number.isFinite(range.end)
        ) {
            return 0;
        }

        return Math.max(
            0,
            Math.min(
                Number(run.end),
                range.end
            ) -
            Math.max(
                Number(run.start),
                range.start
            )
        );
    }

    function chooseColumnForRun(run) {
        const runStart = Number(run.start);
        const runEnd = Number(run.end);

        /*
         * PRIMARY RULE:
         *
         * A fixed-width statement normally right-aligns the numeric value
         * inside its header column. Therefore the physical position of the
         * COMPLETE numeric value is represented most reliably by its
         * RIGHTMOST character.
         *
         * Example with the detected MOHAK positions:
         *
         *   173  -> 31-34 -> rightmost char 33 -> Opening
         *   280  -> 39-42 -> rightmost char 41 -> Purchase
         *   205  -> 47-50 -> rightmost char 49 -> Sales
         *   0    -> 57-58 -> rightmost char 57 -> ST.[+]
         *   0    -> 65-66 -> rightmost char 65 -> ST.[-]
         *   248  -> 71-74 -> rightmost char 73 -> Closing
         *
         * This is positional mapping. It does not assume that the
         * numeric values must be paired left-to-right with headers.
         */
        if (
            Number.isFinite(runStart) &&
            Number.isFinite(runEnd) &&
            runEnd > runStart
        ) {
            const rightmostPosition =
                runEnd - 1;

            const rightmostMatches =
                operationalColumns.filter(
                    column => {
                        const range =
                            getColumnRange(column);

                        return (
                            Number.isFinite(range.start) &&
                            Number.isFinite(range.end) &&
                            rightmostPosition >= range.start &&
                            rightmostPosition < range.end
                        );
                    }
                );

            if (rightmostMatches.length === 1) {
                return rightmostMatches[0];
            }

            if (rightmostMatches.length > 1) {
                /*
                 * Normally physical header ranges do not overlap. If the
                 * mapper does produce overlapping ranges, choose the
                 * narrowest range containing the numeric value's right edge.
                 */
                rightmostMatches.sort(
                    (a, b) => {
                        const ar = getColumnRange(a);
                        const br = getColumnRange(b);

                        return (
                            (ar.end - ar.start) -
                            (br.end - br.start)
                        );
                    }
                );

                return rightmostMatches[0];
            }
        }

        /*
         * SECONDARY RULE:
         *
         * If the rightmost character is not covered by any operational
         * header, use physical overlap of the COMPLETE numeric run.
         *
         * The complete value is still preserved. No split is performed.
         */
        let best = null;

        for (const column of operationalColumns) {
            const range =
                getColumnRange(column);

            if (
                !Number.isFinite(range.start) ||
                !Number.isFinite(range.end)
            ) {
                continue;
            }

            const overlap =
                getOverlap(
                    run,
                    column
                );

            if (overlap <= 0) {
                continue;
            }

            if (
                !best ||
                overlap > best.overlap
            ) {
                best = {
                    column,
                    overlap,
                    range
                };
                continue;
            }

            if (
                overlap === best.overlap
            ) {
                /*
                 * Final deterministic tie-breaker: prefer the column
                 * physically to the right, because fixed-width numeric
                 * values are normally right-aligned.
                 */
                if (
                    range.start >
                    best.range.start
                ) {
                    best = {
                        column,
                        overlap,
                        range
                    };
                }
            }
        }

        return best
            ? best.column
            : null;
    }

    /*
     * Assign each COMPLETE operational numeric run by physical coverage.
     *
     * Do not force six numbers into six headers. If a row genuinely has
     * fewer numeric values, only the values physically present are mapped.
     */
    for (const run of candidates) {
        const column =
            chooseColumnForRun(run);

        if (!column) {
            continue;
        }

        const header =
            String(
                column && column.header != null
                    ? column.header
                    : ""
            ).trim().toUpperCase();

        numericRuns.push(run);

        /*
         * ST.[+] and ST.[-] are source columns but are not standard
         * quantity output fields in this extractor.
         */
        if (
            header === "ST.[+]" ||
            header === "ST.[-]"
        ) {
            assignedRuns.push({
                ...run,
                commonField: null,
                header: column.header,
                physicalStart:
                    column.physicalStart,
                physicalEnd:
                    column.physicalEnd
            });
            continue;
        }

        if (header !== "QTY.") {
            assignedRuns.push({
                ...run,
                commonField: null,
                header: column.header,
                physicalStart:
                    column.physicalStart,
                physicalEnd:
                    column.physicalEnd
            });
            continue;
        }

        const qtyIndex =
            quantityColumns.indexOf(
                column
            );

        if (
            qtyIndex < 0 ||
            qtyIndex >=
                logicalQuantityFields.length
        ) {
            assignedRuns.push({
                ...run,
                commonField: null,
                header: column.header,
                physicalStart:
                    column.physicalStart,
                physicalEnd:
                    column.physicalEnd
            });
            continue;
        }

        const field =
            logicalQuantityFields[
                qtyIndex
            ];

        /*
         * If a malformed/source row contains multiple complete values that
         * physically map to the same QTY header, preserve the first mapping
         * rather than silently overwriting it. Such a row remains visible
         * through __assignedRuns for diagnostics.
         */
        if (
            record[field] === undefined ||
            record[field] === ""
        ) {
            record[field] = run.raw;
        }

        assignedRuns.push({
            ...run,
            commonField: field,
            header: column.header,
            physicalStart:
                column.physicalStart,
            physicalEnd:
                column.physicalEnd
        });
    }

    for (const field of logicalQuantityFields) {
        if (
            record[field] === undefined
        ) {
            record[field] = "";
        }
    }

    numericRuns.sort(
        (a, b) =>
            Number(a.start) -
            Number(b.start)
    );

    assignedRuns.sort(
        (a, b) =>
            Number(a.start) -
            Number(b.start)
    );

    return {
        record,
        numericRuns,
        assignedRuns,
        validOperationalRow:
            Boolean(
                String(
                    record.product || ""
                ).trim()
            )
    };
}

function isMetaKrishnaMedicalStoreStructure(columns) {
    if (
        !Array.isArray(columns) ||
        columns.length !== 11
    ) {
        return false;
    }

    const headers =
        columns.map(
            column =>
                String(
                    column && column.header != null
                        ? column.header
                        : ""
                )
                    .trim()
                    .toUpperCase()
        );

    return (
        headers[0] === "PRODUCT" &&
        headers[1] === "PACKING" &&
        headers[2] === "PURCHASE" &&
        headers[3] === "OTHERS" &&
        headers[4] === "SALES" &&
        headers[5] === "QTY*RATE" &&
        headers[6] === "OTHERS" &&
        headers[7] === "QTY" &&
        headers[8] === "QTY*RATE" &&
        headers[9] === "180DAYS" &&
        headers[10] === "60DYS"
    );
}

function isMetaKrishnaSummaryLine(line) {
    const text = String(line == null ? "" : line).trim();

    /*
     * The product table is followed first by a separator line and then
     * by the textual summary section. Both must be excluded from the
     * META product-record stream.
     */
    if (/^-{10,}$/.test(text)) {
        return true;
    }

    return (
        /^Sale\s+of\s+period\s*:/i.test(text) ||
        /^Total\s+stock\s+as\s+on\s*:/i.test(text) ||
        /^Total\s+cost\s+of\s+near\s+expiry\s*:/i.test(text) ||
        /^Purchase\s+of\s+period\s*:/i.test(text) ||
        /^Total\s+G\/R\s+credit\s*:/i.test(text)
    );
}

function extractMetaKrishnaMedicalStorePhysicalRow(line, columns) {
    const record = {};
    const assignedRuns = [];
    const numericRuns = [];

    const text =
        String(line == null ? "" : line);

    /*
     * META KRISHNA is a fixed-width report.
     *
     * The Step-2 mapper currently expands the Product/Packing regions
     * using the grouped parent headers. That makes its "Packing" end
     * overlap the first operational field. Do not use those overlapping
     * ranges here.
     *
     * The physical boundaries established from the META report are:
     *
     *   0  - 25   Product
     *   25 - 34   Packing
     *   34 - 44   Opening Qty
     *   44 - 54   Purchase Qty
     *   54 - 60   Receipts Others
     *   60 - 74   Totals
     *   74 - 82   Sales Qty
     *   82 - 94   Sales Value (Qty*Rate)
     *   94 - 106  Issued Others
     *   106 - 110 Closing Qty
     *   110 - 120 Closing Value (Qty*Rate)
     *   120 - 130 Expirable 180days
     *   130+      Expirable 60Dys
     *
     * Product and Packing are therefore taken from their actual
     * physical cells, and operational fields are read from their
     * corresponding physical cells. No whitespace tokenization is used.
     */

    const physicalFields = [
        {
            field: "product",
            start: 0,
            end: 25
        },
        {
            field: "pack",
            start: 25,
            end: 34
        },
        {
            field: "opening",
            start: 34,
            end: 44
        },
        {
            field: "purchase",
            start: 44,
            end: 54
        },
        {
            field: "sales",
            start: 74,
            end: 82
        },
        {
            field: "salesValue",
            start: 82,
            end: 94
        },
        {
            field: "closing",
            start: 94,
            end: 110
        },
        {
            field: "closingValue",
            start: 110,
            end: 120
        }
    ];

    for (const item of physicalFields) {
        const cell =
            text.slice(
                item.start,
                Math.min(
                    item.end,
                    text.length
                )
            );

        if (
            item.field === "product" ||
            item.field === "pack"
        ) {
            record[item.field] =
                cell.trim();

            continue;
        }

        const localRuns =
            scanCompleteNumericRuns(
                cell,
                0
            );

        /*
         * A "-" is an occupied empty position. If the cell contains
         * no numeric value, the standard field remains empty.
         */
        if (!localRuns.length) {
            record[item.field] = "";
            continue;
        }

        /*
         * Operational META cells are single physical fields. Use the
         * first complete numeric run in that exact cell; never borrow
         * a number from an adjacent cell.
         */
        const localRun =
            localRuns[0];

        const absoluteRun = {
            ...localRun,
            start:
                item.start +
                localRun.start,
            end:
                item.start +
                localRun.end
        };

        numericRuns.push(
            absoluteRun
        );

        assignedRuns.push({
            ...absoluteRun,
            commonField: item.field,
            header: item.field,
            physicalStart: item.start,
            physicalEnd: item.end
        });

        record[item.field] =
            localRun.raw;
    }

    return {
        record,
        numericRuns,
        assignedRuns,
        validOperationalRow: true
    };
}

function isJyotiMedicalHallStructure(columns) {
    if (
        !Array.isArray(columns) ||
        columns.length !== 10
    ) {
        return false;
    }

    const requiredFields = [
        "product",
        "pack",
        "opening",
        "openingValue",
        "purchase",
        "purchaseValue",
        "sales",
        "salesValue",
        "closing",
        "closingValue"
    ];

    return requiredFields.every(
        field =>
            columns.some(
                column =>
                    column &&
                    column.commonField === field
            )
    );
}

function isJyotiSummaryLine(line) {
    const text = String(line == null ? "" : line);

    return (
        /Opening\s+Value\s*:/i.test(text) ||
        /Purchase\s+Value\s*:/i.test(text) ||
        /Sale\s+Value\s*:/i.test(text) ||
        /Closing\s+Value\s*:/i.test(text)
    );
}

function isJyotiTotalSummaryLine(line) {
    const text = String(line == null ? "" : line).trim();

    /*
     * JYOTI summary rows contain these labels and are not product rows.
     * Match the labels anywhere on the fixed-width summary line because
     * the printer spacing can separate label/value blocks.
     */
    return (
        /Opening\s+Value\s*:/i.test(text) ||
        /Purchase\s+Value\s*:/i.test(text) ||
        /Sale\s+Value\s*:/i.test(text) ||
        /Closing\s+Value\s*:/i.test(text)
    );
}

function extractJyotiMedicalHallPhysicalRow(line, columns) {
    const record = {};
    const assignedRuns = [];
    const numericRuns = [];

    const productColumn = columns.find(
        c => c && c.commonField === "product"
    );

    const packColumn = columns.find(
        c => c && c.commonField === "pack"
    );

    if (productColumn) {
        record.product = slicePhysical(
            line,
            productColumn.physicalStart,
            productColumn.physicalEnd
        );
    }

    if (packColumn) {
        record.pack = slicePhysical(
            line,
            packColumn.physicalStart,
            packColumn.physicalEnd
        );
    }

    /*
     * JYOTI has a fixed Qty/Value sequence:
     *
     *   Opening Qty
     *   Opening Value
     *   Purchase Qty
     *   Purchase Value
     *   Sales Qty
     *   Sales Value
     *   Closing Qty
     *   Closing Value
     *
     * The Step-2 mapper collapses some of these child headers into
     * overlapping physical ranges. Therefore this branch deliberately
     * uses the complete numeric sequence after Product/Pack, preserving
     * each complete number in its original order.
     */
    const productPackEnd = getProductPackEnd(columns);

    const runs = scanCompleteNumericRuns(
        line,
        productPackEnd
    );

    if (runs.length < 8) {
        return {
            record,
            numericRuns: runs,
            assignedRuns: [],
            validOperationalRow: false
        };
    }

    const values = runs.slice(0, 8);

    const fields = [
        "opening",
        "openingValue",
        "purchase",
        "purchaseValue",
        "sales",
        "salesValue",
        "closing",
        "closingValue"
    ];

    for (let i = 0; i < fields.length; i++) {
        const run = values[i];
        const field = fields[i];

        record[field] = run.raw;

        assignedRuns.push({
            ...run,
            commonField: field,
            header: field,
            physicalStart: run.start,
            physicalEnd: run.end
        });

        numericRuns.push(run);
    }

    return {
        record,
        numericRuns,
        assignedRuns,
        validOperationalRow: true
    };
}

function isDermasciScienceStructure(columns) {
    return (
        Array.isArray(columns) &&
        columns.length === 12 &&
        columns.some(c => c && c.header === "Product Name") &&
        columns.some(c => c && c.header === "Opening Stock") &&
        columns.some(c => c && c.header === "Receipt")
    );
}

function isDermasciScienceSecondarySectionStart(line) {
    const text = String(line == null ? "" : line).trim();

    if (!text) {
        return false;
    }

    return (
        /\bSHORT\s+EXPIRY\s+PRODUCTS\b/i.test(text) ||
        /SALES\s+NOT\s+ACCOUNTED\s+FOR\s+ORDER\s+QTY/i.test(text) ||
        /\bCl\.Stk\s+Value\b/i.test(text)
    );
}

function getDermasciScienceProductStart(line, productColumn) {
    const start = Number(productColumn.physicalStart);
    const text = String(line == null ? "" : line);

    if (
        Number.isFinite(start) &&
        start > 0 &&
        text.length > start &&
        !/\s/.test(text[start - 1] || "") &&
        !/\s/.test(text[start] || "")
    ) {
        return start - 1;
    }

    return start;
}

function extractDermasciSciencePhysicalRow(line, columns) {
    const record = {};
    const assignedRuns = [];
    const numericRuns = [];

    const productColumn = columns.find(
        c => c && c.commonField === "product"
    );

    if (productColumn) {
        const productStart =
            getDermasciScienceProductStart(
                line,
                productColumn
            );

        record.product = slicePhysical(
            line,
            productStart,
            productColumn.physicalEnd
        );
    }

    const fieldByHeader = {
        "Opening Stock": "opening",
        "Receipt": "purchase",
        "Sales Qty": "sales",
        "Close Stock": "closing"
    };

    for (const column of orderedColumns(columns)) {
        const field = fieldByHeader[column.header];

        if (!field) continue;

        const start = Number(column.physicalStart);
        const end =
            column.physicalEnd == null
                ? String(line).length
                : Number(column.physicalEnd);

        /*
         * Scan only the exact physical cell. This prevents numbers
         * belonging to adjacent columns from being assigned here.
         */
        const cell = String(line).slice(start, end);
        const localRuns = scanCompleteNumericRuns(cell, 0);

        for (const run of localRuns) {
            /*
             * A complete numeric run must fit entirely inside the
             * physical column. Never split a run at a boundary.
             */
            if (
                run.start < 0 ||
                run.end > cell.length
            ) {
                continue;
            }

            const absoluteRun = {
                ...run,
                start: start + run.start,
                end: start + run.end
            };

            numericRuns.push(absoluteRun);

            assignedRuns.push({
                ...absoluteRun,
                commonField: field,
                header: column.header,
                physicalStart: column.physicalStart,
                physicalEnd: column.physicalEnd
            });
        }

        record[field] = resolveField(
            localRuns,
            field
        );
    }

    return {
        record,
        numericRuns,
        assignedRuns
    };
}


/* ============================================================
 * CODE / NAME / PRATE PHYSICAL EXTRACTION
 * ============================================================
 *
 * This branch is deliberately isolated to the CODE -> NAME -> PRATE
 * structure.  It preserves the complete numeric run before applying
 * the header positions.
 *
 * IMPORTANT:
 * A header boundary is NOT allowed to split a numeric value.
 * The unit-rate value is identified from the COMPLETE source row.
 * The product therefore ends immediately before that complete run,
 * not at an assumed Name-column boundary.
 */

/* ============================================================
 * CODE / NAME / PRATE NUMERIC POSITION ASSIGNMENT
 * ============================================================
 *
 * This helper is intentionally isolated to the CODE/NAME/PRATE
 * structure.  It implements the authoritative rule for this
 * statement family:
 *
 *   1. Scan the COMPLETE raw row.
 *   2. Keep each numeric run intact.
 *   3. Use the numeric run's physical RIGHTMOST CHARACTER to
 *      identify the detected header that covers that position.
 *   4. If the position is outside every operational header, do
 *      not guess and do not assign it.
 *
 * This is different from generic overlap/center matching.
 * It prevents a value such as:
 *
 *     107 at 70-73
 *
 * from being captured by:
 *
 *     Preturn 61-73
 *
 * when the rightmost character (72) is actually inside:
 *
 *     Sales 71-77
 *
 * It also leaves product numbers such as 60 in KERAGRIS 60ML
 * untouched because their rightmost position is inside the
 * Product/Name region, not an operational header.
 */
function assignCodeNameStockNumericRuns(
    line,
    runs,
    columns
) {
    const text = String(line == null ? "" : line);

    const operational = getOperationalColumns(columns);

    return runs.map(run => {
        const runStart = Number(run.start);
        const runEnd = Number(run.end);

        if (
            !Number.isFinite(runStart) ||
            !Number.isFinite(runEnd) ||
            runEnd <= runStart
        ) {
            return {
                ...run,
                commonField: null,
                header: null,
                physicalStart: null,
                physicalEnd: null
            };
        }

        /*
         * The numeric value is represented by its rightmost character.
         * This is the authoritative positional test for this structure.
         */
        const rightmostPosition = runEnd - 1;

        const matches = operational.filter(column => {
            const start = Number(column.physicalStart);
            const end = column.physicalEnd == null
                ? text.length
                : Number(column.physicalEnd);

            return (
                Number.isFinite(start) &&
                Number.isFinite(end) &&
                rightmostPosition >= start &&
                rightmostPosition < end
            );
        });

        if (!matches.length) {
            return {
                ...run,
                commonField: null,
                header: null,
                physicalStart: null,
                physicalEnd: null
            };
        }

        /*
         * Normally the detected physical ranges are non-overlapping.
         * If a mapper refinement creates an overlap, prefer the narrowest
         * range containing the authoritative rightmost position.
         */
        matches.sort((a, b) => {
            const aStart = Number(a.physicalStart);
            const aEnd = a.physicalEnd == null
                ? text.length
                : Number(a.physicalEnd);

            const bStart = Number(b.physicalStart);
            const bEnd = b.physicalEnd == null
                ? text.length
                : Number(b.physicalEnd);

            return (aEnd - aStart) - (bEnd - bStart);
        });

        const best = matches[0];

        return {
            ...run,
            commonField: best.commonField || null,
            header: best.header,
            physicalStart: best.physicalStart,
            physicalEnd: best.physicalEnd
        };
    });
}

function extractCodeNameStockPhysicalRow(line, columns, options = {}) {
    const text = String(line == null ? "" : line);
    const record = {};
    const assignedRuns = [];

    const productColumn = columns.find(
        column => column && column.commonField === "product"
    );

    const packColumn = columns.find(
        column => column && column.commonField === "pack"
    );

    /*
     * Scan the COMPLETE row.  Do not start at productPackEnd because
     * the PRATE value may begin one or more characters before the
     * mapper's physical boundary.
     */
    const completeRuns = scanCompleteNumericRuns(text, 0);

    /*
     * Locate the complete unit-rate run using its physical coverage.
     * Prefer the run whose RIGHT EDGE is covered by the unitRate column.
     * This is important for right-aligned values such as 400.24.
     */
    const rateColumn = columns.find(
        column => column && column.commonField === "unitRate"
    );

    let rateRun = null;

    if (rateColumn) {
        const rateStart = Number(rateColumn.physicalStart);
        const rateEnd = rateColumn.physicalEnd == null
            ? text.length
            : Number(rateColumn.physicalEnd);

        const matches = completeRuns.filter(run => {
            const rightEdge = Number(run.end) - 1;

            return (
                Number.isFinite(rateStart) &&
                Number.isFinite(rateEnd) &&
                rightEdge >= rateStart &&
                rightEdge < rateEnd
            );
        });

        if (matches.length) {
            /*
             * The first physically covered complete run is the rate.
             * Product numbers earlier in the row cannot be selected
             * because their right edge is outside the PRATE region.
             */
            rateRun = matches[0];
        }
    }

    /*
     * Product protection:
     *
     * If PRATE was found, product ends immediately before the COMPLETE
     * PRATE run.  This prevents:
     *
     *   400.24 -> 00.24
     *
     * and also prevents product text such as "20GM" from being mistaken
     * for operational data.
     */
    if (productColumn) {
        let productStart = Number(productColumn.physicalStart);
        let productEnd = productColumn.physicalEnd == null
            ? text.length
            : Number(productColumn.physicalEnd);

        if (
            rateRun &&
            Number.isFinite(rateRun.start) &&
            rateRun.start > productStart
        ) {
            productEnd = rateRun.start;
        }

        /*
         * PRODUCT START RULE FOR CODE / NAME / PRATE:
         *
         * The mapper describes the physical NAME cell, but some statements
         * leave the CODE cell blank. In that case the actual product text
         * starts at physical position 0, not at the NAME-column boundary.
         *
         * Example:
         *   mapper: Code 0-9 | Name 9-29 | Prate 29-35
         *   row:    KERAGRIS 60ML             871.33 ...
         *
         * The first 9 positions contain no actual code, so the complete
         * product is:
         *   KERAGRIS 60ML
         *
         * If an actual code is present, retain the mapped NAME start.
         *
         * This rule is isolated to CODE/NAME/PRATE statements and does not
         * change any generic or other statement-family extraction.
         */
        const codeColumn = columns.find(
            column => column && column.commonField === "code"
        );

        /*
         * The CODE/NAME/PRATE mapper describes physical header positions,
         * but this report can have a blank logical Code field while the
         * product name is printed from physical position 0.
         *
         * Do not decide this from one row's first 0-9 characters. Product
         * names such as "KERAGRIS 60ML" can occupy that entire Code range
         * and would otherwise be mistaken for a code.
         *
         * extractDataRows() can infer the statement-level condition from
         * multiple product rows and pass it here as codeColumnIsBlank.
         *
         * The option is intentionally scoped to this CODE/NAME/PRATE branch.
         * All other statement structures continue through their existing
         * extraction paths unchanged.
         */
        if (
            codeColumn &&
            options &&
            options.codeColumnIsBlank === true
        ) {
            productStart = 0;
        } else if (codeColumn) {
            /*
             * Preserve the existing row-level protection for callers that
             * invoke this function directly without the statement-level
             * inference option.
             */
            const codeStart = Number(codeColumn.physicalStart);
            const codeEnd = codeColumn.physicalEnd == null
                ? text.length
                : Number(codeColumn.physicalEnd);

            const codeText = (
                Number.isFinite(codeStart) &&
                Number.isFinite(codeEnd)
            )
                ? text.slice(
                    Math.max(0, codeStart),
                    Math.max(codeStart, codeEnd)
                ).trim()
                : "";

            if (!codeText) {
                productStart = 0;
            }
        } else {
            /*
             * Existing continuous-token protection.
             */
            if (
                productStart > 0 &&
                productStart < text.length &&
                !/\s/.test(text[productStart - 1] || "") &&
                !/\s/.test(text[productStart] || "")
            ) {
                productStart = 0;
            }
        }

        record.product = text
            .slice(
                Math.max(0, productStart),
                Math.max(productStart, productEnd)
            )
            .trim();
    } else {
        record.product = "";
    }

    if (packColumn) {
        record.pack = slicePhysical(
            text,
            packColumn.physicalStart,
            packColumn.physicalEnd
        );
    } else {
        record.pack = "";
    }

    /*
     * Assign every COMPLETE numeric run using the existing authoritative
     * header-position mapper.  Nothing is split or re-tokenized here.
     */
    const assigned = assignCodeNameStockNumericRuns(
        text,
        completeRuns,
        columns
    );

    const grouped = groupAssignedRuns(assigned);

    for (const column of getOperationalColumns(columns)) {
        const field = column.commonField;

        if (field === "unitRate" && rateRun) {
            record[field] = rateRun.raw;
            continue;
        }

        if (record[field] !== undefined) {
            continue;
        }

        record[field] = resolveField(
            grouped[field] || [],
            field
        );
    }

    /*
     * Diagnostics include only the runs actually assigned to a logical
     * field, while preserving the complete source runs for inspection.
     */
    for (const run of assigned) {
        if (!run.commonField) {
            continue;
        }

        assignedRuns.push(run);
    }

    return {
        record,
        numericRuns: completeRuns,
        assignedRuns
    };
}


/* ============================================================
 * SIDDARTHA MEDICAL & SURGICAL AGENCIES - 9 COLUMN FIXED WIDTH
 * ============================================================
 *
 * This branch is deliberately isolated to the exact 9-column
 * structure produced by Step 2 for the Siddartha statement:
 *
 *   Code | Product Name | Packing | Opening Stock | Receipts |
 *   Total | Sales | Closing Stock | Closing Value
 *
 * Physical positions supplied by Step 2 are authoritative.
 *
 * IMPORTANT:
 *   - Code/Product/Pack are read from their physical cells.
 *   - Operational values are assigned from COMPLETE numeric runs.
 *   - A numeric run is NEVER split at a header boundary.
 *   - The RIGHTMOST character of a complete run identifies the
 *     physical operational column. This handles right-aligned
 *     values whose first digit begins before the header label.
 *   - "Total" is retained as totalStock.
 *   - Existing generic and other statement-specific branches are
 *     not changed.
 * ============================================================
 */

function isSiddarthaMedicalSurgicalAgenciesStructure(columns) {
    if (
        !Array.isArray(columns) ||
        columns.length !== 9
    ) {
        return false;
    }

    const headers = columns.map(
        column =>
            String(
                column && column.header != null
                    ? column.header
                    : ""
            ).trim().toUpperCase()
    );

    return (
        headers[0] === "CODE" &&
        headers[1] === "PRODUCT NAME" &&
        headers[2] === "PACKING" &&
        headers[3] === "OPENING STOCK" &&
        headers[4] === "RECEIPTS" &&
        headers[5] === "TOTAL" &&
        headers[6] === "SALES" &&
        headers[7] === "CLOSING STOCK" &&
        headers[8] === "CLOSING VALUE"
    );
}

function isSiddarthaMedicalSurgicalAgenciesSummaryLine(line) {
    const text =
        String(line == null ? "" : line).trim();

    /*
     * SIDDARTHA MEDICAL & SURGICAL AGENCIES:
     *
     * The primary 9-column product table is followed by summary lines
     * such as:
     *
     *   Opening Value Rs.     1,61,821.00   Sales Value   Rs.     3,84,482.74
     *
     * These are report totals, not product rows.
     *
     * IMPORTANT:
     * This filter is deliberately restricted to the Siddartha branch.
     * It does NOT change generic TXT row validation or any other
     * statement-specific extractor.
     */
    return (
        /Opening\s+Value\s+Rs\.?/i.test(text) ||
        /Sales\s+Value\s+Rs\.?/i.test(text) ||
        /Receipt\s+Value\s+Rs\.?/i.test(text) ||
        /Closing\s+Value\s+Rs\.?/i.test(text)
    );
}

function extractSiddarthaMedicalSurgicalAgenciesPhysicalRow(
    line,
    columns
) {
    const text =
        String(line == null ? "" : line);

    const record = {};
    const numericRuns = [];
    const assignedRuns = [];

    /*
     * Read Code, Product and Packing from their mapped physical
     * positions. This protects numbers embedded in product names
     * such as "20MG", "60ML", "1X10", etc.
     */
    for (const column of orderedColumns(columns)) {
        const field =
            column.commonField;

        if (
            field !== "code" &&
            field !== "product" &&
            field !== "pack"
        ) {
            continue;
        }

        record[field] =
            slicePhysical(
                text,
                column.physicalStart,
                column.physicalEnd
            );
    }

    /*
     * Map the operational columns by their physical positions.
     *
     * IMPORTANT:
     * Do NOT scan each physical cell independently here.
     *
     * In this statement the numeric values are right-aligned. For
     * example, "10764.00" can begin at physical position 88 while
     * the "Closing Value" header begins at position 89. Scanning
     * the cell from 89 would incorrectly produce "0764.00".
     *
     * Therefore:
     *   1. Scan the COMPLETE source row.
     *   2. Keep each numeric run intact.
     *   3. Use the run's RIGHTMOST character to select the
     *      operational physical column.
     */
    const operationalColumns =
        orderedColumns(
            columns.filter(
                column =>
                    column.commonField &&
                    column.commonField !== "code" &&
                    column.commonField !== "product" &&
                    column.commonField !== "pack"
            )
        );

    const completeRuns =
        scanCompleteNumericRuns(
            text,
            0
        );

    for (const run of completeRuns) {
        const rightmostPosition =
            Number(run.end) - 1;

        if (
            !Number.isFinite(rightmostPosition)
        ) {
            continue;
        }

        const matches =
            operationalColumns.filter(
                column => {
                    const start =
                        Number(column.physicalStart);

                    const end =
                        column.physicalEnd == null
                            ? text.length
                            : Number(column.physicalEnd);

                    return (
                        Number.isFinite(start) &&
                        Number.isFinite(end) &&
                        rightmostPosition >= start &&
                        rightmostPosition < end
                    );
                }
            );

        if (!matches.length) {
            /*
             * Numeric run is outside all operational columns.
             * It remains a complete source run but is not assigned
             * to a logical field.
             */
            continue;
        }

        /*
         * If Step 2 ever produces overlapping operational ranges,
         * prefer the narrowest physical range containing the
         * rightmost character.
         */
        matches.sort(
            (a, b) => {
                const aStart =
                    Number(a.physicalStart);

                const aEnd =
                    a.physicalEnd == null
                        ? text.length
                        : Number(a.physicalEnd);

                const bStart =
                    Number(b.physicalStart);

                const bEnd =
                    b.physicalEnd == null
                        ? text.length
                        : Number(b.physicalEnd);

                return (
                    (aEnd - aStart) -
                    (bEnd - bStart)
                );
            }
        );

        const column =
            matches[0];

        const field =
            column.commonField;

        if (!field) {
            continue;
        }

        numericRuns.push(
            run
        );

        assignedRuns.push({
            ...run,
            commonField:
                field,
            header:
                column.header,
            physicalStart:
                column.physicalStart,
            physicalEnd:
                column.physicalEnd
        });

        /*
         * One physical numeric column represents one logical field.
         * Preserve the complete raw run exactly as printed.
         *
         * If an unexpected duplicate run maps to the same field,
         * preserve the first value rather than silently overwriting
         * an already assigned value.
         */
        if (
            record[field] === undefined ||
            record[field] === ""
        ) {
            record[field] =
                run.raw;
        }
    }

    /*
     * Keep every mapped operational field present in the standard
     * record shape, even when its source cell contains "-".
     */
    for (
        const column of operationalColumns
    ) {
        const field =
            column.commonField;

        if (
            field &&
            record[field] === undefined
        ) {
            record[field] = "";
        }
    }

    return {
        record,
        numericRuns,
        assignedRuns,
        validOperationalRow:
            Boolean(
                String(
                    record.product || ""
                ).trim()
            )
    };
}

function extractPhysicalRow(
    line,
    columns,
    options = {}
) {
    /*
     * CODE / NAME / PRATE fixed-width structure.
     *
     * This must run before generic extraction because the product/rate
     * boundary can fall through a complete numeric run.
     */
    if (isCodeNameStockPhysicalStructure(columns)) {
        return extractCodeNameStockPhysicalRow(
            line,
            columns,
            options
        );
    }

    if (
        isChellasStructure(columns)
    ) {
        return extractChellasPhysicalRow(
            line,
            columns
        );
    }

    /*
     * META KRISHNA MEDICAL STORE fixed-width branch.
     */
    if (isMohakMedicosStructure(columns)) {
        return extractMohakMedicosPhysicalRow(
            line,
            columns
        );
    }

    if (isMetaKrishnaMedicalStoreStructure(columns)) {
        return extractMetaKrishnaMedicalStorePhysicalRow(line, columns);
    }

    /*
     * JYOTI MEDICAL HALL Qty/Value branch.
     * This is isolated from the existing generic and DermasciScience
     * extraction logic.
     */
    if (
        isJyotiMedicalHallStructure(columns)
    ) {
        return extractJyotiMedicalHallPhysicalRow(
            line,
            columns
        );
    }

    /*
     * DERMASCIENCE-only branch.
     * Generic extraction remains completely unchanged for
     * every other structure.
     */
    if (
        isDermasciScienceStructure(columns)
    ) {
        return extractDermasciSciencePhysicalRow(
            line,
            columns
        );
    }

    /*
     * SIDDARTHA MEDICAL & SURGICAL AGENCIES-only branch.
     * Generic extraction remains completely unchanged for
     * every other structure.
     */
    if (
        isSiddarthaMedicalSurgicalAgenciesStructure(columns)
    ) {
        return extractSiddarthaMedicalSurgicalAgenciesPhysicalRow(
            line,
            columns
        );
    }

    const record = {};

    /*
     * 1. Product / Pack are extracted directly.
     *    Numbers inside these fields are not operational data.
     */
    for (
        const column of columns
    ) {
        if (
            column.commonField ===
            "product"
        ) {
            record.product =
                slicePhysical(
                    line,
                    column.physicalStart,
                    column.physicalEnd
                );
        }

        if (
            column.commonField ===
            "pack"
        ) {
            record.pack =
                slicePhysical(
                    line,
                    column.physicalStart,
                    column.physicalEnd
                );
        }
    }

    /*
     * 2. Scan the COMPLETE operational portion.
     */
    const productPackEnd =
        getProductPackEnd(
            columns
        );

    const completeRuns =
        scanCompleteNumericRuns(
            line,
            productPackEnd
        );

    /*
     * 3. Assign COMPLETE numeric runs to logical columns.
     */
    const assigned =
        assignNumericRuns(
            line,
            completeRuns,
            columns
        );

    const grouped =
        groupAssignedRuns(
            assigned
        );

    /*
     * 4. Resolve every mapped numeric field.
     */
    for (
        const column of getOperationalColumns(
            columns
        )
    ) {
        const field =
            column.commonField;

        if (
            record[field] !== undefined
        ) {
            continue;
        }

        record[field] =
            resolveField(
                grouped[field] || [],
                field
            );
    }

    return {
        record,
        numericRuns:
            completeRuns,
        assignedRuns:
            assigned
    };
}

/* ============================================================
 * DATA ROW FILTER
 * ============================================================
 */

function isSeparatorLine(
    line
) {
    const text =
        String(
            line == null ? "" : line
        );

    const stripped =
        text.replace(
            /\s/g,
            ""
        );

    return (
        stripped.length >= 5 &&
        /^[-_=~*]+$/.test(
            stripped
        )
    );
}

function isFooterLine(
    line
) {
    const text =
        String(
            line == null ? "" : line
        ).trim();

    /*
     * Ignore any line containing a control character.
     *
     * Printer escape sequences commonly look like:
     *   ESC P
     *
     * We reject the line when a control character appears
     * anywhere in it, even when printable characters follow it.
     */
    if (/[\x00-\x1F\x7F]/.test(text)) {
        return true;
    }

    return (
        /^Powered by\b/i.test(
            text
        ) ||
        /^End\.?$/i.test(
            text
        )
    );
}

function isTotalLine(
    line
) {
    const text =
        String(
            line == null ? "" : line
        ).trim();

    if (
        /^(TOTAL|GRAND TOTAL|SUB TOTAL|SUBTOTAL)\b/i.test(
            text
        )
    ) {
        return true;
    }

    /*
     * Fixed-width statements may begin their summary section with a
     * descriptive label instead of the word TOTAL. These are statement
     * summary rows, not product descriptions.
     *
     * Keep this deliberately narrow so ordinary product names are not
     * affected.
     */
    if (
        /^(OPENING\s+VALUE|PURCHASE\s+VALUE|RECEIPT\s+VALUE|SALES?\s+VALUE|RETAIL\s+SALES|LAST\s+MONTH\s+SALES|CASH\s+SALES|TRANSIT\s+VALUE|CLOSING\s+VALUE|RECEIVABLE\s+VALUE|PAYABLE\s+VALUE)\s*:/i.test(
            text
        )
    ) {
        return true;
    }

    /*
     * Siddartha / fixed-width reports may print summary values in the
     * form:
     *
     *   Opening Value Rs.     3,37,101.11
     *   Sales Value   Rs.     3,77,082.09
     *   Receipt Value Rs.     3,95,941.81
     *   Closing Value Rs.     3,55,960.83
     *
     * These are summary rows, not product records. Keep this rule narrow
     * to the explicit "Value Rs." summary labels so ordinary product names
     * and numeric product/pack text remain untouched.
     */
    if (
        /^(OPENING|PURCHASE|RECEIPT|SALES?|CLOSING)\s+VALUE\s+RS\.?/i.test(
            text
        )
    ) {
        return true;
    }

    if (
        /^\*\s*[-=]*>\s*Non\s+Moving\s+Products\b/i.test(
            text
        )
    ) {
        return true;
    }

    if (
        /^STOCK\s*&\s*SALES\s+STATEMENT\b/i.test(
            text
        )
    ) {
        return true;
    }

    if (
        /^PRODUCT\s+NAME\b.*\bOPENING\b.*\bSALES\b/i.test(
            text
        )
    ) {
        return true;
    }

    /*
     * Some fixed-width reports print a summary row without the word
     * TOTAL, containing only decimal summary values.
     */
    const numericOnly =
        text.replace(
            /[0-9+.,()\-\s]/g,
            ""
        ) === "";

    const numericRuns =
        scanCompleteNumericRuns(
            text,
            0
        );

    const hasDecimalValues =
        numericRuns.length >= 2 &&
        numericRuns.some(
            run =>
                run.raw.includes(".")
        );

    return (
        numericOnly &&
        hasDecimalValues
    );
}

function isDataRow(
    line
) {
    if (
        !String(
            line == null ? "" : line
        ).trim()
    ) {
        return false;
    }

    if (
        isSeparatorLine(line)
    ) {
        return false;
    }

    if (
        isFooterLine(line)
    ) {
        return false;
    }

    if (
        isTotalLine(line)
    ) {
        return false;
    }

    return true;
}

/* ============================================================
 * READ TXT
 * ============================================================
 */

function readTXT(
    filePath
) {
    const absolute =
        path.resolve(
            filePath
        );

    const text =
        fs.readFileSync(
            absolute,
            "utf8"
        );

    return {
        file: absolute,
        lines:
            text.split(
                /\r?\n/
            )
    };
}

/* ============================================================
 * EXTRACT DATA ROWS
 * ============================================================
 */

function inferCodeNameStockCodeColumnUsage(
    lines,
    dataStartsAt,
    columns
) {
    /*
     * Statement-level inference for CODE/NAME/PRATE reports.
     *
     * Some reports expose a Code header even though no code is printed.
     * In that format the product starts at physical position 0 and can
     * occupy the mapper's Code + Name regions.
     *
     * Do not decide this from one row. Product names can occupy the
     * apparent Code cell, so inspect several actual product rows and look
     * for whitespace inside that apparent Code cell.
     *
     * The rate-cell check prevents headings, section labels, and other
     * non-product rows from influencing the inference.
     */
    if (!isCodeNameStockPhysicalStructure(columns)) {
        return false;
    }

    const codeColumn = columns.find(
        column => column && column.commonField === "code"
    );

    const rateColumn = columns.find(
        column => column && column.commonField === "unitRate"
    );

    if (!codeColumn || !rateColumn) {
        return false;
    }

    const codeStart = Number(codeColumn.physicalStart);
    const codeEnd = codeColumn.physicalEnd == null
        ? null
        : Number(codeColumn.physicalEnd);

    const rateStart = Number(rateColumn.physicalStart);
    const rateEnd = rateColumn.physicalEnd == null
        ? null
        : Number(rateColumn.physicalEnd);

    if (
        !Number.isFinite(codeStart) ||
        codeStart < 0 ||
        (codeEnd != null && !Number.isFinite(codeEnd)) ||
        !Number.isFinite(rateStart) ||
        rateStart < 0 ||
        (rateEnd != null && !Number.isFinite(rateEnd))
    ) {
        return false;
    }

    let inspected = 0;
    let whitespaceRows = 0;

    const maxRows = Math.min(
        lines.length,
        dataStartsAt + 20
    );

    for (let i = dataStartsAt; i < maxRows; i++) {
        const line = String(lines[i] == null ? "" : lines[i]);

        if (!isDataRow(line)) {
            continue;
        }

        const rateCell = line.slice(
            rateStart,
            rateEnd == null ? line.length : rateEnd
        );

        /*
         * Only inspect rows that contain a complete numeric PRATE value
         * inside the detected rate region.
         */
        if (!scanCompleteNumericRuns(rateCell, 0).length) {
            continue;
        }

        inspected++;

        const codeCell = line.slice(
            codeStart,
            codeEnd == null ? line.length : codeEnd
        ).trim();

        if (/\s/.test(codeCell)) {
            whitespaceRows++;
        }

        /*
         * Two independent product rows are sufficient evidence that the
         * apparent Code region is actually part of the product description.
         */
        if (whitespaceRows >= 2) {
            return true;
        }

        if (inspected >= 10) {
            break;
        }
    }

    return false;
}

function extractDataRows(
    lines,
    dataStartsAt,
    columns
) {
    const records = [];

    const codeNameStockCodeColumnIsBlank =
        inferCodeNameStockCodeColumnUsage(
            lines,
            dataStartsAt,
            columns
        );

    for (
        let i = dataStartsAt;
        i < lines.length;
        i++
    ) {
        const line =
            lines[i];

        /*
         * DERMASCIENCE-only boundary:
         * stop the primary 12-column table before the later
         * HORT EXPIRY / summary section.
         */
        if (
            isDermasciScienceStructure(columns) &&
            isDermasciScienceSecondarySectionStart(line)
        ) {
            break;
        }

        /*
         * META KRISHNA MEDICAL STORE:
         * Stop when the textual summary section begins.
         */
        if (
            isMohakMedicosStructure(columns) &&
            isMohakMedicosSummaryLine(line)
        ) {
            break;
        }

        /*
         * IMPERIA / CLAIM-DETAIL SECTION BOUNDARY:
         *
         * Some statements continue with a completely different table
         * after the primary stock table, for example:
         *
         *   PENDING EXPIRY/BROKEN/P.RETURN CLAIM DETAILS
         *
         * The rows below that heading are claim rows, not product-stock
         * rows. They must never be passed to the primary product
         * extractor.
         *
         * This is an explicit section transition, not a generic TOTAL
         * rule, so existing statement formats are not disturbed.
         */
        if (
            /PENDING\s+EXPIRY\/BROKEN\/P\.RETURN\s+CLAIM\s+DETAILS/i.test(
                String(line == null ? "" : line)
            )
        ) {
            break;
        }

        if (
            isMetaKrishnaMedicalStoreStructure(columns) &&
            isMetaKrishnaSummaryLine(line)
        ) {
            break;
        }

        /*
         * JYOTI MEDICAL HALL:
         * Total/summary rows are never product rows.
         *
         * Stop before extraction so the totals cannot be converted into
         * product records by any downstream logic.
         */
        if (
            isJyotiMedicalHallStructure(columns) &&
            isJyotiTotalSummaryLine(line)
        ) {
            break;
        }

        /*
         * SIDDARTHA MEDICAL & SURGICAL AGENCIES:
         *
         * The product table is followed by Opening Value / Sales Value
         * summary lines. Stop the Siddartha product stream before those
         * lines can be interpreted as Code/Product/Pack plus operational
         * numeric values.
         *
         * This guard is isolated to the exact Siddartha 9-column
         * structure and therefore does not alter generic or other
         * statement-specific extraction.
         */
        if (
            isSiddarthaMedicalSurgicalAgenciesStructure(columns) &&
            isSiddarthaMedicalSurgicalAgenciesSummaryLine(line)
        ) {
            break;
        }

        /*
         * Generic summary/header rows:
         *
         * These lines are not product records even when they contain
         * numbers that happen to overlap operational columns. Do this
         * before fixed-width product branches so summary values cannot
         * become product fields.
         */
        if (
            isTotalLine(line)
        ) {
            continue;
        }

        /*
         * META KRISHNA is a fixed-width branch.  Some valid product rows
         * contain printer/control characters at the end of the line
         * (for example the final VYSOV-M row).  Do not let the generic
         * isDataRow() validator discard such a row before the META
         * physical extractor gets a chance to process it.
         */
        if (
            isMetaKrishnaMedicalStoreStructure(columns)
        ) {
            const metaResult =
                extractMetaKrishnaMedicalStorePhysicalRow(
                    line,
                    columns
                );

            if (
                !String(
                    metaResult.record.product == null
                        ? ""
                        : metaResult.record.product
                ).trim()
            ) {
                continue;
            }

            metaResult.record.__sourceRow =
                i + 1;

            metaResult.record.__rawSource =
                line;

            metaResult.record.__numericRuns =
                metaResult.numericRuns;

            metaResult.record.__assignedRuns =
                metaResult.assignedRuns;

            records.push(
                metaResult.record
            );

            continue;
        }

        if (
            isMohakMedicosStructure(columns)
        ) {
            const mohakResult =
                extractMohakMedicosPhysicalRow(
                    line,
                    columns
                );

            if (
                !String(
                    mohakResult.record.product == null
                        ? ""
                        : mohakResult.record.product
                ).trim()
            ) {
                continue;
            }

            mohakResult.record.__sourceRow =
                i + 1;

            mohakResult.record.__rawSource =
                line;

            mohakResult.record.__numericRuns =
                mohakResult.numericRuns;

            mohakResult.record.__assignedRuns =
                mohakResult.assignedRuns;

            records.push(
                mohakResult.record
            );

            continue;
        }

        if (
            !isDataRow(line)
        ) {
            continue;
        }

        const result =
            extractPhysicalRow(
                line,
                columns,
                {
                    codeColumnIsBlank:
                        codeNameStockCodeColumnIsBlank
                }
            );

        if (
            isChellasStructure(columns) &&
            result.validOperationalRow === false
        ) {
            continue;
        }

        /*
         * A multi-row product statement must have an actual
         * product/description value. Summary rows that contain
         * only numeric values are never product records.
         */
        if (
            !String(
                result.record.product == null
                    ? ""
                    : result.record.product
            ).trim()
        ) {
            continue;
        }

        result.record.__sourceRow =
            i + 1;

        result.record.__rawSource =
            line;

        result.record.__numericRuns =
            result.numericRuns;

        result.record.__assignedRuns =
            result.assignedRuns;

        records.push(
            result.record
        );
    }

    return records;
}

/* ============================================================
 * MAIN
 * ============================================================
 */

function extractMultiRowTXT(
    filePath
) {
    const detector =
        loadDetector();

    const mapper =
        loadMapper();

    const reader =
        readTXT(
            filePath
        );

    const detection =
        detector.detectMultiRowTXTHeader(
            filePath
        );

    if (
        !detection ||
        !detection.success
    ) {
        return {
            success: false,
            stage:
                "HEADER_DETECTION",
            file:
                reader.file,
            detection,
            mapping: null,
            records: []
        };
    }

    const mapping =
        mapper.mapDetectedHeader(
            detection
        );

    if (
        !mapping ||
        !mapping.success
    ) {
        return {
            success: false,
            stage:
                "HEADER_MAPPING",
            file:
                reader.file,
            detection,
            mapping,
            records: []
        };
    }

    const records =
        extractDataRows(
            reader.lines,
            detection.dataStartsAt,
            mapping.columns
        );

    return {
        success: true,
        stage:
            "DATA_EXTRACTION",
        file:
            reader.file,
        detection,
        mapping,
        records
    };
}

/* ============================================================
 * CLI OUTPUT
 * ============================================================
 */

function printResult(
    result
) {
    console.log(
        "\n============================================================"
    );

    console.log(
        "       MULTI-ROW TXT POSITIONAL DATA EXTRACTOR"
    );

    console.log(
        "============================================================"
    );

    console.log(
        `File           : ${result.file}`
    );

    if (!result.success) {
        console.log(
            `Stage          : ${result.stage}`
        );

        console.dir(
            result,
            { depth: null }
        );

        return;
    }

    console.log(
        `Header Start   : ${result.detection.headerStart + 1}`
    );

    console.log(
        `Header End     : ${result.detection.headerEnd + 1}`
    );

    console.log(
        `Data Starts    : ${result.detection.dataStartsAt + 1}`
    );

    console.log(
        `Columns        : ${result.mapping.columns.length}`
    );

    console.log(
        `Records        : ${result.records.length}`
    );

    console.log(
        "------------------------------------------------------------"
    );

    for (
        const record of result.records
    ) {
        console.dir(
            record,
            { depth: null }
        );
    }

    console.log(
        "============================================================"
    );
}

module.exports = {
    extractMultiRowTXT,
    extractDataRows,
    extractPhysicalRow,
    scanCompleteNumericRuns,
    assignNumericRuns,
    assignCodeNameStockNumericRuns,
    resolveField,
    slicePhysical,
    isCodeNameStockPhysicalStructure,
    inferCodeNameStockCodeColumnUsage,
    extractCodeNameStockProduct,
    extractCodeNameStockPhysicalRow,
    isDataRow,
    readTXT,
    isDermasciScienceStructure,
    extractDermasciSciencePhysicalRow,
    isSiddarthaMedicalSurgicalAgenciesStructure,
    isSiddarthaMedicalSurgicalAgenciesSummaryLine,
    extractSiddarthaMedicalSurgicalAgenciesPhysicalRow,
    isMohakMedicosStructure,
    isMohakMedicosSummaryLine,
    extractMohakMedicosPhysicalRow,
    isMetaKrishnaMedicalStoreStructure,
    isMetaKrishnaSummaryLine,
    extractMetaKrishnaMedicalStorePhysicalRow,
    isJyotiMedicalHallStructure,
    isJyotiTotalSummaryLine,
    extractJyotiMedicalHallPhysicalRow
};

if (
    require.main === module
) {
    const input =
        process.argv[2];

    if (!input) {
        console.error(
            "Usage:"
        );

        console.error(
            'node validation/multiRow/multiRowDataExtractorTXT.js "path\\to\\statement.txt"'
        );

        process.exit(1);
    }

    try {
        const result =
            extractMultiRowTXT(
                input
            );

        printResult(
            result
        );

        process.exit(
            result.success
                ? 0
                : 2
        );
    }
    catch (error) {
        console.error(
            "\nERROR:"
        );

        console.error(
            error &&
            error.stack
                ? error.stack
                : error
        );

        process.exit(1);
    }
}
