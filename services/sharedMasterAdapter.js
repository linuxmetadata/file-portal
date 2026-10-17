
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");

const {
    MASTER_COLUMNS,
    VALUE_COLUMNS,
    createEmptyMasterRow
} = require("./masterSchema");

const SHARED_MASTER_FILE = path.resolve(
    __dirname,
    "../storage/extraction/SHARED/Master_Extraction.xlsx"
);

const MATCH_COLUMNS = [
    "Match Status",
    "Matched Product",
    "Matched Product Code",
    "Matched PTS",
    "Match Reason"
];

const SOURCE_COLUMNS = [
    "Source File",
    "Source Row",
    "Statement Structure",
    "Raw Source Values",
    "Header Mapping",
    "Unidentified Headers"
];

function clean(value) {
    return String(value ?? "").trim();
}

function normalizeFileName(value) {
    return path.basename(clean(value)).toUpperCase();
}

function createRecordId(sourceRow, metadata) {
    const identity = {
        division: clean(metadata.division).toUpperCase(),
        code: clean(metadata.code).toUpperCase(),
        sourceFile: normalizeFileName(sourceRow["Source File"]),
        sourceRow: clean(sourceRow["Source Row"]),
        statementStructure: clean(
            sourceRow["Statement Structure"]
        ).toUpperCase(),
        rawSourceValues: clean(
            sourceRow["Raw Source Values"]
        ),
        headerMapping: clean(
            sourceRow["Header Mapping"]
        )
    };

    return crypto
        .createHash("sha256")
        .update(JSON.stringify(identity))
        .digest("hex");
}

function readWorkbookRows(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(
            `Extraction master not found: ${filePath}`
        );
    }

    const workbook = XLSX.readFile(filePath);

    if (!workbook.SheetNames.length) {
        return [];
    }

    const worksheet =
        workbook.Sheets[workbook.SheetNames[0]];

    return XLSX.utils.sheet_to_json(worksheet, {
        defval: ""
    });
}

function readSharedMaster(masterPath = SHARED_MASTER_FILE) {
    if (!fs.existsSync(masterPath)) {
        return [];
    }

    return readWorkbookRows(masterPath);
}

function normalizeRawRow(sourceRow, metadata) {
    const row = createEmptyMasterRow();

    // Portal metadata.
    row["Division"] = clean(metadata.division);
    row["BM HQ"] = clean(metadata.bmHQ);
    row["Code"] = clean(metadata.code);
    row["Stockist Name"] = clean(metadata.stockistName);

    // Source identity and extraction evidence.
    for (const column of SOURCE_COLUMNS) {
        row[column] = sourceRow[column] ?? "";
    }

    // The legacy master does not reliably retain sheet identity.
    row["Source Sheet"] = "";

    // Copy recognized raw common fields only.
    // Do not import legacy calculated values.
    for (const column of MASTER_COLUMNS) {
        if (
            column.startsWith("Common ") &&
            !VALUE_COLUMNS.includes(column) &&
            Object.prototype.hasOwnProperty.call(
                sourceRow,
                column
            )
        ) {
            row[column] = sourceRow[column] ?? "";
        }
    }

    // Every calculated value remains blank during raw extraction.
    for (const column of VALUE_COLUMNS) {
        row[column] = "";
    }

    row["Record ID"] = createRecordId(
        sourceRow,
        metadata
    );

    row["Match Status"] = "PENDING";

    for (const column of MATCH_COLUMNS.slice(1)) {
        row[column] = "";
    }

    return row;
}

function mergePreservingResults(existingRow, incomingRow) {
    const merged = {
        ...existingRow,
        ...incomingRow
    };

    // Preserve previously calculated values.
    for (const column of VALUE_COLUMNS) {
        merged[column] =
            clean(existingRow[column]) !== ""
                ? existingRow[column]
                : "";
    }

    // Preserve matching results, including explicit statuses.
    for (const column of MATCH_COLUMNS) {
        merged[column] =
            clean(existingRow[column]) !== ""
                ? existingRow[column]
                : incomingRow[column] ?? "";
    }

    return merged;
}


function writeSharedMaster(
    rows,
    masterPath = SHARED_MASTER_FILE
) {
    fs.mkdirSync(path.dirname(masterPath), {
        recursive: true
    });

    const workbook = XLSX.utils.book_new();

    const normalizedRows = rows.map(sourceRow => {
        const row = createEmptyMasterRow();

        for (const column of MASTER_COLUMNS) {
            row[column] = sourceRow[column] ?? "";
        }

        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(
        normalizedRows,
        { header: MASTER_COLUMNS }
    );

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Master Extraction"
    );

    const suffix = `${process.pid}.${Date.now()}`;

    const temporaryFile =
        `${masterPath}.${suffix}.tmp.xlsx`;

    const backupFile =
        `${masterPath}.${suffix}.bak`;

    let originalMoved = false;

    try {
        XLSX.writeFile(workbook, temporaryFile);

        if (fs.existsSync(masterPath)) {
            fs.renameSync(masterPath, backupFile);
            originalMoved = true;
        }

        fs.renameSync(temporaryFile, masterPath);

        if (originalMoved && fs.existsSync(backupFile)) {
            fs.unlinkSync(backupFile);
        }
    } catch (error) {
        if (fs.existsSync(temporaryFile)) {
            fs.unlinkSync(temporaryFile);
        }

        if (
            originalMoved &&
            fs.existsSync(backupFile) &&
            !fs.existsSync(masterPath)
        ) {
            fs.renameSync(backupFile, masterPath);
        }

        throw error;
    }
}


async function updateSharedMaster({
    sourceMasterPath,
    originalName,
    sourceFileName = originalName,
    metadata,
    sharedMasterPath = SHARED_MASTER_FILE
}) {
    if (!sourceMasterPath) {
        throw new Error("sourceMasterPath is required.");
    }

    if (!originalName) {
        throw new Error("originalName is required.");
    }

    if (
        !metadata ||
        !clean(metadata.division) ||
        !clean(metadata.code)
    ) {
        throw new Error(
            "Portal Division and Code are required."
        );
    }

    const sourceRows = readWorkbookRows(sourceMasterPath);
const expectedFileName = normalizeFileName(sourceFileName);

// The legacy master may contain records from previous uploads.
// Import only records belonging to this uploaded file.
const currentFileRows = sourceRows.filter(
    row =>
        normalizeFileName(row["Source File"]) ===
        expectedFileName
);

    if (!currentFileRows.length) {
        throw new Error(
            `No records for "${originalName}" were found in ${sourceMasterPath}.`
        );
    }

    const existingRows = readSharedMaster(sharedMasterPath);
    const recordMap = new Map();

    // Load existing records by stable Record ID.
    for (const existingRow of existingRows) {
        const id = clean(existingRow["Record ID"]);

        if (id) {
            recordMap.set(id, existingRow);
        }
    }

    let inserted = 0;
    let updated = 0;

    for (const sourceRow of currentFileRows) {
        const incomingRow = normalizeRawRow(
            sourceRow,
            metadata
        );

        const id = incomingRow["Record ID"];
        const existingRow = recordMap.get(id);

        if (existingRow) {
            recordMap.set(
                id,
                mergePreservingResults(
                    existingRow,
                    incomingRow
                )
            );

            updated++;
        } else {
            recordMap.set(id, incomingRow);
            inserted++;
        }
    }

    const finalRows = Array.from(recordMap.values());

    writeSharedMaster(finalRows, sharedMasterPath);

    return {
        success: true,
        outputMaster: sharedMasterPath,
        sourceFile: originalName,
        sourceRecordsFound: currentFileRows.length,
        inserted,
        updated,
        totalRecords: finalRows.length
    };
}

module.exports = {
    updateSharedMaster,
    SHARED_MASTER_FILE
};
