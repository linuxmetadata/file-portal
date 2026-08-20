/**
 * ============================================================
 * SHOW STATEMENT FILE CONTENTS
 * ============================================================
 *
 * Usage:
 *
 * node validation/tests/showStatementContents.js "testData\statements\TXT"
 *
 * It will:
 *   1. Read all files inside the folder
 *   2. Print filename
 *   3. Print file extension
 *   4. Print complete text content
 *   5. Separate each file clearly
 *
 * ============================================================
 */

"use strict";

const fs = require("fs");
const path = require("path");


// ============================================================
// FOLDER
// ============================================================

const folderPath =
    process.argv[2] ||
    path.join(
        "testData",
        "statements",
        "TXT"
    );


// ============================================================
// RESOLVE
// ============================================================

const absoluteFolder =
    path.resolve(folderPath);


// ============================================================
// CHECK FOLDER
// ============================================================

if (!fs.existsSync(absoluteFolder)) {

    console.error("");
    console.error("ERROR: Folder not found");
    console.error("");
    console.error(absoluteFolder);
    console.error("");

    process.exit(1);
}


if (
    !fs.statSync(absoluteFolder).isDirectory()
) {

    console.error("");
    console.error("ERROR: Path is not a folder");
    console.error("");
    console.error(absoluteFolder);
    console.error("");

    process.exit(1);
}


// ============================================================
// GET FILES
// ============================================================

const files =
    fs.readdirSync(
        absoluteFolder,
        {
            withFileTypes: true
        }
    )
    .filter(
        item =>
            item.isFile()
    )
    .map(
        item =>
            item.name
    )
    .sort(
        (a, b) =>
            a.localeCompare(
                b,
                undefined,
                {
                    numeric: true,
                    sensitivity: "base"
                }
            )
    );


// ============================================================
// HEADER
// ============================================================

console.log("");
console.log("============================================================");
console.log("STATEMENT FOLDER CONTENT INSPECTOR");
console.log("============================================================");

console.log("");
console.log("Folder:");
console.log(absoluteFolder);

console.log("");
console.log("Files Found:", files.length);
console.log("");


// ============================================================
// NO FILES
// ============================================================

if (!files.length) {

    console.log(
        "No files found in this folder."
    );

    console.log("");

    process.exit(0);
}


// ============================================================
// READ FILES
// ============================================================

for (
    let i = 0;
    i < files.length;
    i++
) {

    const fileName =
        files[i];

    const filePath =
        path.join(
            absoluteFolder,
            fileName
        );

    const extension =
        path.extname(
            fileName
        )
        .toLowerCase();


    console.log("");
    console.log("");
    console.log("============================================================");
    console.log(
        `FILE ${i + 1} OF ${files.length}`
    );
    console.log("============================================================");

    console.log("");
    console.log("File Name :", fileName);
    console.log("Extension :", extension || "(none)");
    console.log("Full Path :", filePath);

    console.log("");
    console.log("-------------------- CONTENT --------------------");
    console.log("");


    try {

        const content =
            fs.readFileSync(
                filePath,
                "utf8"
            );


        /*
         * Preserve the original lines.
         */

        const lines =
            content.split(/\r?\n/);


        console.log(
            "Total Lines:",
            lines.length
        );

        console.log("");


        /*
         * Print every line with line number.
         */

        lines.forEach(
            (line, index) => {

                console.log(
                    `${String(index + 1).padStart(4, " ")} | ${line}`
                );

            }
        );


    }
    catch (error) {

        console.log("");
        console.log(
            "ERROR READING FILE:"
        );

        console.log(
            error.message
        );

    }


    console.log("");
    console.log("--------------------------------------------------");
}


// ============================================================
// END
// ============================================================

console.log("");
console.log("");
console.log("============================================================");
console.log("INSPECTION COMPLETED");
console.log("============================================================");
console.log("");