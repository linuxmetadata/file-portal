"use strict";

const fs = require("fs/promises");
const path = require("path");
const pool = require("./postgresPool");

const ALLOWED_TYPES = new Set(["AWS", "SSS"]);

const ALLOWED_CATEGORIES = new Set(["REGULAR", "INVALID"]);

function normalizeCategory(value = "REGULAR") {
    const category = clean(value).toUpperCase();

    if (!ALLOWED_CATEGORIES.has(category)) {
        throw new Error(
            "Upload category must be REGULAR or INVALID."
        );
    }

    return category;
}

function clean(value) {
    return String(value ?? "").trim();
}

function normalizeKey(value) {
    return clean(value).toUpperCase();
}

function normalizeType(value) {
    const type = clean(value).toUpperCase();

    if (!ALLOWED_TYPES.has(type)) {
        throw new Error("Statement type must be AWS or SSS.");
    }

    return type;
}

function normalizeFileId(value) {
    const id = clean(value);

    if (!/^\d+$/.test(id) || !/[1-9]/.test(id)) {
        throw new Error("A valid file ID is required.");
    }

    return id;
}

function safeFilename(value, fallback) {
    const normalized = clean(value || fallback).replace(/\\/g, "/");
    const filename = path.posix.basename(normalized);

    if (!filename || filename === "." || filename === "..") {
        throw new Error("A valid original filename is required.");
    }

    return filename;
}

async function storeUploadedFile({
    filePath,
    originalFilename,
    division,
    code,
    type,
    state = "General",
    uploadedBy = "",
    mimeType = "application/octet-stream",
    uploadCategory = "REGULAR"
}) {
    if (!filePath) {
        throw new Error("Uploaded file path is required.");
    }

    const normalizedDivision = normalizeKey(division);
    const normalizedCode = normalizeKey(code);
    const statementType = normalizeType(type);
    const category = normalizeCategory(uploadCategory);

    if (!normalizedDivision || !normalizedCode) {
        throw new Error("Division and Code are required.");
    }

    const filename = safeFilename(
        originalFilename,
        path.basename(filePath)
    );

    const buffer = await fs.readFile(filePath);

    if (buffer.length === 0) {
        throw new Error("Cannot store an empty file.");
    }

    const result = await pool.query(
    `
    INSERT INTO portal_uploaded_files (
        division,
        code,
        statement_type,
        original_filename,
        mime_type,
        file_size_bytes,
        file_data,
        state,
        uploaded_by,
        upload_category
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING
        file_id,
        division,
        code,
        statement_type,
        original_filename,
        mime_type,
        file_size_bytes,
        state,
        uploaded_by,
        upload_category,
        uploaded_at
    `,
    [
        normalizedDivision,
        normalizedCode,
        statementType,
        filename,
        clean(mimeType) || "application/octet-stream",
        buffer.length,
        buffer,
        clean(state) || "General",
        clean(uploadedBy),
        category
    ]
);

    return result.rows[0];
}

async function listUploadedFiles({
    division,
    code,
    type,
    uploadCategory
} = {}) {
    const conditions = [];
    const values = [];

    if (division !== undefined) {
        values.push(normalizeKey(division));
        conditions.push(`division = $${values.length}`);
    }

    if (code !== undefined) {
        values.push(normalizeKey(code));
        conditions.push(`code = $${values.length}`);
    }

    if (type !== undefined) {
        values.push(normalizeType(type));
        conditions.push(`statement_type = $${values.length}`);
    }

    if (uploadCategory !== undefined) {
    values.push(normalizeCategory(uploadCategory));
    conditions.push(`upload_category = $${values.length}`);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const result = await pool.query(
        `
        SELECT
            file_id,
            division,
            code,
            statement_type,
            original_filename,
            mime_type,
            file_size_bytes,
            state,
            uploaded_by,
            upload_category,
            uploaded_at
        FROM portal_uploaded_files
        ${whereClause}
        ORDER BY uploaded_at DESC, file_id DESC
        `,
        values
    );

    return result.rows;
}

async function getUploadedFile(fileId) {
    const id = normalizeFileId(fileId);

    const result = await pool.query(
        `
        SELECT
            file_id,
            division,
            code,
            statement_type,
            original_filename,
            mime_type,
            file_size_bytes,
            file_data,
            state,
            uploaded_by,
            upload_category,
            uploaded_at
        FROM portal_uploaded_files
        WHERE file_id = $1
        `,
        [id]
    );

    return result.rows[0] || null;
}

async function deleteUploadedFile({
    fileId,
    division,
    code,
    type
}) {
    const id = normalizeFileId(fileId);
    const normalizedDivision = normalizeKey(division);
    const normalizedCode = normalizeKey(code);
    const statementType = normalizeType(type);

    if (!normalizedDivision || !normalizedCode) {
        throw new Error("Division and Code are required for deletion.");
    }

    const result = await pool.query(
        `
        DELETE FROM portal_uploaded_files
        WHERE file_id = $1
          AND division = $2
          AND code = $3
          AND statement_type = $4
        RETURNING
            file_id,
            division,
            code,
            statement_type,
            original_filename
        `,
        [
            id,
            normalizedDivision,
            normalizedCode,
            statementType
        ]
    );

    return result.rows[0] || null;
}

module.exports = {
    storeUploadedFile,
    listUploadedFiles,
    getUploadedFile,
    deleteUploadedFile
};
