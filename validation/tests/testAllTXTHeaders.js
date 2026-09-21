"use strict";

const fs = require("fs");
const path = require("path");

const {
    readTXT
} = require("../readers/txtReader");

const {
    detectTXTHeader
} = require("../detectors/headerDetectorTXT");

const {
    mapTXTHeader
} = require("../mappers/headerMapperTXT");


const folder =
    path.resolve(
        "testData",
        "statements",
        "TXT"
    );


console.log("");
console.log("==============================================");
console.log("TXT HEADER MAPPER - ALL FILES TEST");
console.log("==============================================");
console.log("Folder:", folder);
console.log("");


if (!fs.existsSync(folder)) {

    console.error(
        "Folder not found:",
        folder
    );

    process.exit(1);
}


const files =
    fs.readdirSync(folder)
        .filter(
            file =>
                file.toLowerCase().endsWith(".txt")
        );


console.log(
    "TXT Files Found:",
    files.length
);

console.log("");


for (const file of files) {

    const filePath =
        path.join(
            folder,
            file
        );


    console.log("");
    console.log("----------------------------------------------");
    console.log("FILE:", file);
    console.log("----------------------------------------------");


    try {

        const reader =
            readTXT(filePath);


        if (!reader || !reader.success) {

            console.log(
                "READER: FAILED"
            );

            console.log(
                reader &&
                reader.message
                    ? reader.message
                    : ""
            );

            continue;

        }


        const lines =
            reader.lines;


        const detection =
            detectTXTHeader(
                lines
            );


        if (!detection || !detection.success) {

            console.log(
                "DETECTOR: FAILED"
            );

            console.log(
                detection &&
                detection.message
                    ? detection.message
                    : ""
            );

            continue;

        }


        const mapping =
            mapTXTHeader(
                detection
            );


        console.log("");
        console.log(
            "Detection :",
            detection.detection
        );

        console.log(
            "Confidence:",
            detection.confidence
        );

        console.log(
            "Header:",
            detection.headerStart,
            "-",
            detection.headerEnd
        );

        console.log(
            "Data Start:",
            detection.dataStartsAt
        );

        console.log("");

        console.log(
            "Mapper Success:",
            mapping.success
        );

        console.log(
            "Structure:",
            mapping.format
        );

        console.log(
            "Mapper Confidence:",
            mapping.confidence
        );


        console.log("");
        console.log("COLUMNS:");

        if (
            mapping.columns &&
            mapping.columns.length
        ) {

            for (
                const column
                of mapping.columns
            ) {

                console.log(

                    String(
                        column.position
                    ).padStart(4),

                    "|",

                    String(
                        column.header
                    ).padEnd(25),

                    "|",

                    String(
                        column.field
                    ).padEnd(20),

                    "|",

                    column.type

                );

            }

        }
        else {

            console.log(
                "NO COLUMNS MAPPED"
            );

        }


        console.log("");

        if (!mapping.success) {

            console.log(
                "STATUS: REVIEW REQUIRED"
            );

            console.log(
                "MESSAGE:",
                mapping.message || ""
            );

        }
        else {

            console.log(
                "STATUS: OK"
            );

        }

    }
    catch (error) {

        console.log(
            "ERROR:",
            error.message
        );

    }

}


console.log("");
console.log("==============================================");
console.log("TEST COMPLETED");
console.log("==============================================");