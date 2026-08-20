const fs = require("fs");

const filePath = process.argv[2];

if (!filePath) {
    console.error(
        'Usage: node validation/tests/testTxtFixedWidth.js "file.txt"'
    );
    process.exit(1);
}

if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
}

const text =
    fs.readFileSync(
        filePath,
        "utf8"
    );

const lines =
    text.split(/\r?\n/);

console.log("");
console.log("==============================================");
console.log("TXT FIXED WIDTH INSPECTOR");
console.log("==============================================");

console.log("");
console.log("File:", filePath);
console.log("Total Lines:", lines.length);

console.log("");
console.log("==============================================");
console.log("HEADER / DATA POSITIONS");
console.log("==============================================");

for (
    let i = 8;
    i <= Math.min(lines.length - 1, 25);
    i++
) {

    const line =
        lines[i] || "";

    console.log("");
    console.log(
        `LINE ${i + 1}:`
    );

    console.log(line);

    console.log(
        "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789"
    );

    console.log(
        "Line Length:",
        line.length
    );

}

console.log("");
console.log("==============================================");
console.log("CHARACTER POSITION DUMP");
console.log("==============================================");

const startLine = 11;
const endLine =
    Math.min(
        lines.length - 1,
        20
    );

for (
    let i = startLine;
    i <= endLine;
    i++
) {

    const line =
        lines[i] || "";

    console.log("");
    console.log(
        `LINE ${i + 1}`
    );

    for (
        let p = 0;
        p < line.length;
        p += 10
    ) {

        const chunk =
            line.substring(
                p,
                p + 10
            );

        console.log(
            `${String(p).padStart(3, " ")}-${String(
                Math.min(
                    p + 9,
                    line.length - 1
                )
            ).padStart(3, " ")} :`,
            JSON.stringify(chunk)
        );

    }

}

console.log("");
console.log("==============================================");
console.log("INSPECTION COMPLETED");
console.log("==============================================");