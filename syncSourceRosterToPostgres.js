const XLSX = require("xlsx");
const path = require("path");
const pool = require("./services/postgresPool");

const SOURCE_FILE = path.join(__dirname, "data", "source.xlsx");
const BATCH_SIZE = 250;

function clean(value) {
    return String(value ?? "").trim();
}

function normalized(value) {
    return clean(value).toUpperCase();
}

function getRosterRecord(row, sourceRow) {
    return {
        sourceRow,
        division: normalized(row.Division),
        code: normalized(row.Code ?? row.CODE),
        stockist_name: clean(row["Stockist Name"] ?? row.Name),
        state: clean(row.STATE),
        bh_id: clean(row.BH_ID ?? row["BH ID"]),
        sm_id: clean(row.SM_ID ?? row["SM ID"]),
        zbm_id: clean(row.ZBM_ID ?? row["ZBM ID"]),
        rbm_id: clean(row.RBM_ID ?? row["RBM ID"]),
        abm_id: clean(row.ABM_ID ?? row["ABM ID"]),
        rbm_hq: clean(row.RBM_HQ ?? row["RBM HQ"]),
        abm_hq: clean(row.ABM_HQ ?? row["ABM HQ"]),
        bm_hq: clean(row["BM HQ"] ?? row.BM_HQ)
    };
}

const ROSTER_FIELDS = [
    "stockist_name", "state",
    "bh_id", "sm_id", "zbm_id", "rbm_id", "abm_id",
    "rbm_hq", "abm_hq", "bm_hq"
];

function conflictingFields(records) {
    return ROSTER_FIELDS.filter(field =>
        new Set(records.map(record => normalized(record[field]))).size > 1
    );
}

async function syncSourceRoster() {
    let client;
    let transactionStarted = false;

    try {
        console.log("Starting roster sync...");
        console.log("Reading latest source:", SOURCE_FILE);

        const workbook = XLSX.readFile(SOURCE_FILE);
        const sheetName = workbook.SheetNames[0];

        if (!sheetName) {
            throw new Error("Source workbook has no worksheets.");
        }

        const sourceRows = XLSX.utils.sheet_to_json(
            workbook.Sheets[sheetName],
            { defval: "" }
        );

        if (!sourceRows.length) {
            throw new Error("Source workbook contains no data rows.");
        }

        const requiredHeaders = ["Division", "Code", "Stockist Name"];
        const headers = new Set(Object.keys(sourceRows[0]));
        const missingHeaders = requiredHeaders.filter(
            header => !headers.has(header)
        );

        if (missingHeaders.length) {
            throw new Error(
                "Missing required headers: " + missingHeaders.join(", ")
            );
        }

        const records = sourceRows.map((row, index) =>
            getRosterRecord(row, index + 2)
        );

        const invalid = records.filter(
            record => !record.division || !record.code
        );

        if (invalid.length) {
            console.error("SYNC STOPPED: Missing Division or Code.");
            console.table(invalid.map(record => ({
                excelRow: record.sourceRow,
                division: record.division,
                code: record.code
            })));
            process.exitCode = 1;
            return;
        }

        const grouped = new Map();

        for (const record of records) {
            const key = `${record.division}::${record.code}`;

            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(record);
        }

        const conflicts = [];

        for (const [key, group] of grouped) {
            if (group.length > 1) {
                const fields = conflictingFields(group);

                if (fields.length) {
                    conflicts.push({ key, fields, records: group });
                }
            }
        }

        if (conflicts.length) {
            console.error("SYNC STOPPED: Conflicting duplicate keys.");
            console.error("No roster rows were written.");

            for (const conflict of conflicts) {
                console.log(
                    "Duplicate key:", conflict.key,
                    "| Conflicting fields:", conflict.fields.join(", ")
                );

                console.table(conflict.records.map(record => ({
                    excelRow: record.sourceRow,
                    stockistName: record.stockist_name,
                    state: record.state,
                    bmHQ: record.bm_hq
                })));
            }

            process.exitCode = 1;
            return;
        }

        const uniqueRecords = [...grouped.values()].map(group => group[0]);
        const batchCount = Math.ceil(uniqueRecords.length / BATCH_SIZE);

        console.log("Source rows:", sourceRows.length);
        console.log("Unique stockists:", uniqueRecords.length);
        console.log("Validation passed. Database writes starting.");
        console.log("Batch count:", batchCount);

        client = await pool.connect();
        await client.query("BEGIN");
        transactionStarted = true;

        const columns = [
            "division", "code", "stockist_name", "state",
            "bh_id", "sm_id", "zbm_id", "rbm_id", "abm_id",
            "rbm_hq", "abm_hq", "bm_hq"
        ];

        for (let offset = 0; offset < uniqueRecords.length; offset += BATCH_SIZE) {
            const batch = uniqueRecords.slice(offset, offset + BATCH_SIZE);
            const values = [];
            const placeholders = [];

            batch.forEach((record, rowIndex) => {
                const rowPlaceholders = columns.map((_, columnIndex) => {
                    values.push(record[columns[columnIndex]]);
                    return `$${rowIndex * columns.length + columnIndex + 1}`;
                });

                placeholders.push(`(${rowPlaceholders.join(", ")})`);
            });

            const sql = `
                INSERT INTO portal_stockist_metadata (
                    ${columns.join(", ")}
                )
                VALUES ${placeholders.join(", ")}
                ON CONFLICT (division, code)
                DO UPDATE SET
                    stockist_name = EXCLUDED.stockist_name,
                    state = EXCLUDED.state,
                    bh_id = EXCLUDED.bh_id,
                    sm_id = EXCLUDED.sm_id,
                    zbm_id = EXCLUDED.zbm_id,
                    rbm_id = EXCLUDED.rbm_id,
                    abm_id = EXCLUDED.abm_id,
                    rbm_hq = EXCLUDED.rbm_hq,
                    abm_hq = EXCLUDED.abm_hq,
                    bm_hq = EXCLUDED.bm_hq,
                    updated_at = NOW()
            `;

            await client.query(sql, values);

            const processed = Math.min(
                offset + batch.length,
                uniqueRecords.length
            );

            console.log(
                `Progress: ${processed}/${uniqueRecords.length} records ` +
                `(${Math.ceil(processed / BATCH_SIZE)}/${batchCount} batches)`
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        console.log("ROSTER SYNC SUCCESSFUL");
        console.log("Source rows:", sourceRows.length);
        console.log("Unique stockists synced:", uniqueRecords.length);
        console.log("Existing Sales values preserved.");
        console.log("Existing uploaded-file records preserved.");
        console.log("Database rows absent from the source were not deleted.");
        console.log("Existing statement_extraction_master was not modified.");

    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
                console.error("Transaction rolled back.");
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError.message);
            }
        }

        console.error("ROSTER SYNC FAILED:", error.message);
        process.exitCode = 1;
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

syncSourceRoster();
