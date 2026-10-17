"use strict";

const pool = require("./postgresPool");

function clean(value) {
    return String(value ?? "").trim();
}

function normalizeKey(value) {
    return clean(value).toUpperCase();
}

async function listPortalStockists({ user = "", role = "" } = {}) {
    const values = [];
    let accessFilter = "";

    const userId = clean(user).toLowerCase();

    if (clean(role).toLowerCase() !== "admin" && userId) {
        values.push(userId);

        const parameter = `$${values.length}`;

        accessFilter = `
            WHERE LOWER(BTRIM(COALESCE(m.bh_id, ''))) = ${parameter}
               OR LOWER(BTRIM(COALESCE(m.sm_id, ''))) = ${parameter}
               OR LOWER(BTRIM(COALESCE(m.zbm_id, ''))) = ${parameter}
               OR LOWER(BTRIM(COALESCE(m.rbm_id, ''))) = ${parameter}
               OR LOWER(BTRIM(COALESCE(m.abm_id, ''))) = ${parameter}
        `;
    }

    const result = await pool.query(
        `
        SELECT
            m.division,
            m.state,
            m.bm_hq,
            m.code,
            m.stockist_name,
            m.bh_id,
            m.sm_id,
            m.zbm_id,
            m.rbm_id,
            m.abm_id,
            m.sales,
            COALESCE(aws.file_ids, '') AS aws_file_ids,
            COALESCE(sss.file_ids, '') AS sss_file_ids
        FROM portal_stockist_metadata m

        LEFT JOIN LATERAL (
            SELECT STRING_AGG(
                f.file_id::text,
                ','
                ORDER BY f.uploaded_at DESC, f.file_id DESC
            ) AS file_ids
            FROM portal_uploaded_files f
            WHERE f.division = m.division
              AND f.code = m.code
              AND f.statement_type = 'AWS'
        ) aws ON TRUE

        LEFT JOIN LATERAL (
            SELECT STRING_AGG(
                f.file_id::text,
                ','
                ORDER BY f.uploaded_at DESC, f.file_id DESC
            ) AS file_ids
            FROM portal_uploaded_files f
            WHERE f.division = m.division
              AND f.code = m.code
              AND f.statement_type = 'SSS'
        ) sss ON TRUE

        ${accessFilter}

        ORDER BY m.division, m.code
        `,
        values
    );

    return result.rows.map((row, index) => ({
        id: index,
        division: row.division || "",
        state: row.state || "",
        bmhq: row.bm_hq || "",
        code: row.code || "",
        name: row.stockist_name || "",
        bh_id: row.bh_id || "",
        sm_id: row.sm_id || "",
        zbm_id: row.zbm_id || "",
        rbm_id: row.rbm_id || "",
        abm_id: row.abm_id || "",
        sales: row.sales || "",
        awsFile: row.aws_file_ids || "",
        sssFile: row.sss_file_ids || ""
    }));
}

async function getStockist(division, code) {
    const result = await pool.query(
        `
        SELECT *
        FROM portal_stockist_metadata
        WHERE division = $1
          AND code = $2
        LIMIT 1
        `,
        [normalizeKey(division), normalizeKey(code)]
    );

    return result.rows[0] || null;
}

async function updateStockistSales(division, code, sales) {
    const result = await pool.query(
        `
        UPDATE portal_stockist_metadata
        SET sales = $3,
            updated_at = NOW()
        WHERE division = $1
          AND code = $2
        RETURNING division, code, sales
        `,
        [
            normalizeKey(division),
            normalizeKey(code),
            clean(sales)
        ]
    );

    return result.rows[0] || null;
}

module.exports = {
    listPortalStockists,
    getStockist,
    updateStockistSales
};
