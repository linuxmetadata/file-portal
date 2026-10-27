const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const pool = require("../services/postgresPool");

const { loadPriceList } = require("../matcher/priceLoader");
const { buildPriceIndex } = require("../matcher/priceIndex");
const { matchProduct } = require("../matcher");
const { calculate } = require("./calculationEngine");
const { mergePortalData } = require("./portalDataMerger");
const {
    MATCHED_MASTER_COLUMNS
} = require("./matchedMasterWriter");

const STORAGE = path.join(
    __dirname,
    "..",
    "storage",
    "extraction",
    "TXT"
);

const TXT_MASTER_FILE = path.join(
    STORAGE,
    "Master_Extraction.xlsx"
);

const MATCHED_MASTER_FILE = path.join(
    STORAGE,
    "Matched_Master_Extraction.xlsx"
);

const INVALID_STORAGE = path.join(
    __dirname,
    "..",
    "storage",
    "extraction",
    "INVALID",
    "TXT"
);

const INVALID_MATCHED_MASTER_FILE = path.join(
    INVALID_STORAGE,
    "Matched_Master_Extraction.xlsx"
);

const PRICE_FOLDER = path.join(
    __dirname,
    "..",
    "priceLists"
);

// TXT-only metadata. The existing SSS matched-master schema is untouched.
const TXT_MATCHED_COLUMNS = [
    ...MATCHED_MASTER_COLUMNS,
    "Source File",
    "Source Row"
];

const MOVEMENT_FIELDS = [
    {
        quantityColumn: "Common Opening",
        valueColumn: "Common Opening Value",
        rowField: "opening",
        calculationField: "OPENING_V"
    },
    {
        quantityColumn: "Common Purchase",
        valueColumn: "Common Purchase Value",
        rowField: "purchase",
        calculationField: "PURCHASE_V"
    },
    {
        quantityColumn: "Common Purchase Free",
        valueColumn: "Common Purchase Free Value",
        rowField: "purchaseFree",
        calculationField: "PUR_FREE"
    },
    {
        quantityColumn: "Common Purchase Return",
        valueColumn: "Common Purchase Return Value",
        rowField: "purchaseReturn",
        calculationField: "P_RET_VAL"
    },
    {
        quantityColumn: "Common Purchase Return Free",
        valueColumn: "Common Purchase Return Free Value",
        rowField: "purchaseReturnFree",
        calculationField: "P_RET_FREE_VAL"
    },
    {
        quantityColumn: "Common Replacement",
        valueColumn: "Common Replacement Value",
        rowField: "replacement",
        calculationField: "REPL"
    },
    {
        quantityColumn: "Common Sales Replacement",
        valueColumn: "Common Sales Replacement Value",
        rowField: "salesReplacement",
        calculationField: "SALES_REPL_V"
    },
    {
        quantityColumn: "Common Sales",
        valueColumn: "Common Sales Value",
        rowField: "sales",
        calculationField: "SALES_V"
    },
    {
        quantityColumn: "Common Sales Free",
        valueColumn: "Common Sales Free Value",
        rowField: "free",
        calculationField: "FREE"
    },
    {
        quantityColumn: "Common Sales Last",
        valueColumn: "Common Sales Last Value",
        rowField: "salesLast",
        calculationField: "SALES_LAST_V"
    },
    {
        quantityColumn: "Common Sales Return",
        valueColumn: "Common Sales Return Value",
        rowField: "salesReturn",
        calculationField: "SAL_RET_V"
    },
    {
        quantityColumn: "Common Sales Return Free",
        valueColumn: "Common Sales Return Free Value",
        rowField: "salesReturnFree",
        calculationField: "SAL_RET_FREE_V"
    },
    {
        quantityColumn: "Common TRN IN",
        valueColumn: "Common TRN IN Value",
        rowField: "trnIn",
        calculationField: "TRN_IN_V"
    },
    {
        quantityColumn: "Common TRN OUT",
        valueColumn: "Common TRN OUT Value",
        rowField: "trnOut",
        calculationField: "TRN_OUT_V"
    },
    {
        quantityColumn: "Common Credit",
        valueColumn: "Common Credit Value",
        rowField: "credit",
        calculationField: "CREDIT"
    },
    {
        quantityColumn: "Common Debit",
        valueColumn: "Common Debit Value",
        rowField: "debit",
        calculationField: "DEBIT"
    },
    {
        quantityColumn: "Common Adjustment",
        valueColumn: "Common Adjustment Value",
        rowField: "adjustment",
        calculationField: "ADJUSTMENT"
    },
    {
        quantityColumn: "Common Closing",
        valueColumn: "Common Closing Value",
        rowField: "closing",
        calculationField: "CLOSING_V"
    },
    {
        quantityColumn: "Common Closing Free",
        valueColumn: "Common Closing Free Value",
        rowField: "closingFree",
        calculationField: "CLOSING_FREE_V"
    },
    {
        quantityColumn: "Common Total Stock",
        valueColumn: "Common Total Stock Value",
        rowField: "totalStock",
        calculationField: "TOTAL_STOCK_V"
    }
];

function clean(value) {
    return String(value ?? "").trim();
}

function normalizeQuantity(value) {
    if (value === undefined || value === null) {
        return "";
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : "";
    }

    const text = String(value).trim();

    if (text === "") {
        return "";
    }

    const normalized = text.replace(/,/g, "");
    const number = Number(normalized);

    return Number.isFinite(number) ? number : value;
}

function keyPart(value) {
    return clean(value).toUpperCase();
}

function recordKey(sourceFile, sourceRow, code, stockist) {
    return [
        keyPart(sourceFile),
        keyPart(sourceRow),
        keyPart(code),
        keyPart(stockist)
    ].join("\u001f");
}

function commonCalculatedValue(
    quantity,
    existingValue,
    hasMatchedProduct,
    matchedPrice
) {
    if (!hasMatchedProduct) {
        return "";
    }

    if (
        existingValue !== undefined &&
        existingValue !== null &&
        existingValue !== ""
    ) {
        return existingValue;
    }

    if (
        quantity === undefined ||
        quantity === null ||
        String(quantity).trim() === ""
    ) {
        return "";
    }

    const qty = Number(quantity);

    return Number.isFinite(qty)
        ? qty * matchedPrice
        : "";
}

function buildCalculationInput(source) {
    return {
        rowNumber: source["Source Row"],
        product: clean(source["Common Product"]),
        pack: source["Common Pack"],
        purchaseRate: source["Common Purchase Rate"],
        rate: source["Common Rate"],
        price: source["Common Rate"],

        opening: source["Common Opening"],
        openingValue: source["Common Opening Value"],

        purchase: source["Common Purchase"],
        purchaseFree: source["Common Purchase Free"],
        purchaseFreeQty: source["Common Purchase Free"],
        purchaseValue: source["Common Purchase Value"],

        purchaseReturn: source["Common Purchase Return"],
        purchaseReturnFree:
            source["Common Purchase Return Free"],
        purchaseReturnFreeQty:
            source["Common Purchase Return Free"],

        replacement: source["Common Replacement"],
        salesReplacement: source["Common Sales Replacement"],

        sales: source["Common Sales"],
        free: source["Common Sales Free"],
        salesFree: source["Common Sales Free"],
        salesLast: source["Common Sales Last"],

        salesReturn: source["Common Sales Return"],
        salesReturnFree:
            source["Common Sales Return Free"],
        salesReturnFreeQty:
            source["Common Sales Return Free"],

        trnIn: source["Common TRN IN"],
        trnOut: source["Common TRN OUT"],
        credit: source["Common Credit"],
        debit: source["Common Debit"],
        adjustment: source["Common Adjustment"],

        closing: source["Common Closing"],
        closingFree: source["Common Closing Free"],
        closingValue: source["Common Closing Value"],
        totalStock: source["Common Total Stock"],
        age: source["Common Age"]
    };
}

function buildMatchedRecord(
    source,
    sourceFileName,
    portalData,
    priceIndex
) {
    const row = buildCalculationInput(source);

    const product = matchProduct(
        row.product,
        priceIndex
    );

    const hasMatchedProduct = Boolean(
        product?.matched &&
        product?.product
    );

    const calculated = calculate(
        row,
        product?.product || {}
    );

    const finalRecord = mergePortalData(
        calculated,
        portalData
    );

    const reviewReasons = Array.isArray(
        product?.reviewReasons
    )
        ? product.reviewReasons
        : product?.reviewReasons
            ? [product.reviewReasons]
            : [];

    const mismatchRemark = hasMatchedProduct
        ? (
            product.reviewRequired
                ? reviewReasons.join("; ")
                : ""
        )
        : (
            product?.reason ||
            "No matching product passed the attribute checks"
        );

    const output = {
        "Division": finalRecord.DIVISION ?? "",
        "State": finalRecord.STATE ?? "",
        "HQ": finalRecord.HQ ?? "",
        "Code": finalRecord.STKCODE ?? "",
        "Stockist Name": finalRecord.STOCKIST ?? "",

        "Extracted Product": row.product,

        "Matched Product": hasMatchedProduct
            ? (
                product.product["Product Description"] || ""
            )
            : "",

        "Mismatch Remark": mismatchRemark,

        "PTS": hasMatchedProduct
            ? (calculated.PRICE ?? "")
            : "",

        "Source File": path.basename(sourceFileName),
        "Source Row": source["Source Row"] ?? ""
    };

    
    const matchedPrice = Number(
        calculated.PRICE ?? 0
    );

    for (const field of MOVEMENT_FIELDS) {
    output[field.quantityColumn] =
        normalizeQuantity(row[field.rowField]);

    output[field.valueColumn] =
        commonCalculatedValue(
            row[field.rowField],
            calculated[field.calculationField],
            hasMatchedProduct,
            matchedPrice
        );
}

    return {
        output,
        matched: hasMatchedProduct
    };
}



async function appendMatchedRecords(
    records,
    uploadCategory = "REGULAR"
) {
    const category = String(uploadCategory).trim().toUpperCase();

    if (!["REGULAR", "INVALID"].includes(category)) {
        throw new Error(`Unsupported upload category: ${uploadCategory}`);
    }

    const masterKey = `${category}:SSS`;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `
            SELECT file_data
            FROM portal_matched_master_extraction_files
            WHERE master_key = $1
            FOR UPDATE
            `,
            [masterKey]
        );

        if (!result.rows.length || !result.rows[0].file_data) {
            throw new Error(
                `Existing SSS matched master not found: ${masterKey}. ` +
                "TXT matching will not create a separate matched master."
            );
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(result.rows[0].file_data);

        const worksheet = workbook.getWorksheet("Matched_Master");

        if (!worksheet) {
            throw new Error(
                `Matched_Master worksheet missing from ${masterKey}.`
            );
        }

        const same = (left, right) =>
            left.join("\u001f") === right.join("\u001f");

        const existingHeaders = worksheet
            .getRow(1)
            .values
            .slice(1)
            .map(value => String(value ?? ""));

        const sharedHeaders = existingHeaders.filter(
            header =>
                header !== "Source File" &&
                header !== "Source Row"
        );

        if (!same(sharedHeaders, MATCHED_MASTER_COLUMNS)) {
            throw new Error(
                `Existing ${masterKey} headers do not match the expected SSS schema.`
            );
        }

        // Add missing TXT source metadata without removing existing columns.
        for (const column of ["Source File", "Source Row"]) {
            if (!existingHeaders.includes(column)) {
                worksheet.getCell(
                    1,
                    worksheet.getRow(1).cellCount + 1
                ).value = column;

                existingHeaders.push(column);
            }
        }

        const headers = worksheet
            .getRow(1)
            .values
            .slice(1)
            .map(value => String(value ?? ""));

        const headerIndex = new Map(
            headers.map((header, index) => [header, index + 1])
        );

        const existingKeys = new Set();

        for (
            let rowNumber = 2;
            rowNumber <= worksheet.rowCount;
            rowNumber++
        ) {
            const row = worksheet.getRow(rowNumber);
            const sourceFile = row.getCell(
                headerIndex.get("Source File")
            ).value;

            // Existing SSS rows may not have TXT source metadata.
            if (!keyPart(sourceFile)) {
                continue;
            }

            existingKeys.add(
                recordKey(
                    sourceFile,
                    row.getCell(headerIndex.get("Source Row")).value,
                    row.getCell(headerIndex.get("Code")).value,
                    row.getCell(headerIndex.get("Stockist Name")).value
                )
            );
        }

        let appendedRecords = 0;
        let skippedDuplicates = 0;

        for (const record of records) {
            const key = recordKey(
                record["Source File"],
                record["Source Row"],
                record["Code"],
                record["Stockist Name"]
            );

            if (existingKeys.has(key)) {
                skippedDuplicates++;
                continue;
            }

            worksheet.addRow(
                headers.map(header => record[header] ?? "")
            );

            existingKeys.add(key);
            appendedRecords++;
        }

        headers.forEach((column, index) => {
            worksheet.getColumn(index + 1).width =
                Math.min(Math.max(column.length + 2, 14), 30);
        });

        const fileBuffer = Buffer.from(
            await workbook.xlsx.writeBuffer()
        );

        const saveResult = await client.query(
            `
            UPDATE portal_matched_master_extraction_files
            SET file_size_bytes = $1,
                original_filename = $2,
                mime_type = $3,
                file_data = $4,
                updated_at = NOW()
            WHERE master_key = $5
            `,
            [
                fileBuffer.length,
                "SSS_Matched_Master_Extraction.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileBuffer,
                masterKey
            ]
        );

        if (saveResult.rowCount !== 1) {
            throw new Error(
                `Failed to update the existing matched master: ${masterKey}`
            );
        }

        await client.query("COMMIT");

        return {
            success: true,
            file: masterKey,
            masterKey,
            appendedRecords,
            skippedDuplicates
        };
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}



async function runTxtProductMatching(options = {}) {
    const sourceFileName = path.basename(
        clean(options.sourceFileName)
    );

    if (!sourceFileName) {
        throw new Error(
            "Original TXT filename is required for product matching."
        );
    }

    const sourceResult = await pool.query(
    `
    SELECT *
    FROM "statement_extraction_master"
    WHERE UPPER(TRIM("Source File")) = UPPER($1)
    ORDER BY "Source Row"
    `,
    [sourceFileName]
);

const sourceRows = sourceResult.rows;

if (sourceRows.length === 0) {
    throw new Error(
        `No extracted master rows were found for ${sourceFileName}.`
    );
}

    if (!fs.existsSync(PRICE_FOLDER)) {
        throw new Error(
            `Price list folder was not found: ${PRICE_FOLDER}`
        );
    }

    const priceFiles = fs.readdirSync(PRICE_FOLDER)
        .filter(file => /\.(xlsx|xls)$/i.test(file));

    if (priceFiles.length !== 1) {
        throw new Error(
            `Expected exactly one price list; found ${priceFiles.length}.`
        );
    }

    const priceFile = path.join(
        PRICE_FOLDER,
        priceFiles[0]
    );

    const priceData = loadPriceList(priceFile);

    if (
        !priceData ||
        !Array.isArray(priceData.priceList) ||
        priceData.priceList.length === 0
    ) {
        throw new Error(
            "Price list could not be loaded or contains no products."
        );
    }

    const priceIndex = buildPriceIndex(
        priceData.priceList
    );

    

    const portalData = options.portalData || {};

    const matchedRecords = sourceRows.map(source =>
        buildMatchedRecord(
            source,
            sourceFileName,
            portalData,
            priceIndex
        )
    );

    const writeResult = await appendMatchedRecords(
    matchedRecords.map(item => item.output),
    options.uploadCategory || "REGULAR"
);

    const matchedCount = matchedRecords.filter(
        item => item.matched
    ).length;

    return {
        success: true,
        sourceFileName,
        totalProducts: matchedRecords.length,
        matchedProducts: matchedCount,
        unmatchedProducts: matchedRecords.length - matchedCount,
        ...writeResult
    };
}

module.exports = {
    runTxtProductMatching
};