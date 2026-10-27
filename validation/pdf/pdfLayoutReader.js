
const fs = require("fs");
const path = require("path");
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");

/**
 * PDF EXTRACTION MASTER — LAYOUT READER
 *
 * Extracts positioned text items from digital PDFs.
 * Does not identify product rows or map common columns.
 */

async function readPDFLayout(filePath) {
    try {
        if (!filePath) {
            throw new Error("PDF file path was not supplied.");
        }

        const absolutePath = path.resolve(filePath);

        if (!fs.existsSync(absolutePath)) {
            throw new Error(`File not found: ${absolutePath}`);
        }

        if (path.extname(absolutePath).toLowerCase() !== ".pdf") {
            throw new Error("Unsupported file format. Expected a PDF.");
        }

        const data = new Uint8Array(
            await fs.promises.readFile(absolutePath)
        );

        if (data.length === 0) {
            throw new Error("The PDF file is empty.");
        }

        const loadingTask = pdfjs.getDocument({
            data,
            useSystemFonts: true
        });

        const pdf = await loadingTask.promise;
        const pages = [];
        let totalItems = 0;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1 });

            const items = content.items
                .filter(item =>
                    typeof item.str === "string" &&
                    item.str.trim().length > 0 &&
                    Array.isArray(item.transform)
                )
                .map(item => {
                    const transform = item.transform;
                    const x = transform[4];
                    const y = transform[5];
                    const height = Math.hypot(
                        transform[2],
                        transform[3]
                    );

                    return {
                        text: item.str,
                        x,
                        y,
                        width: item.width,
                        height,
                        xEnd: x + item.width,
                        yEnd: y + height,
                        hasEOL: Boolean(item.hasEOL)
                    };
                });

            totalItems += items.length;

            pages.push({
                pageNumber,
                width: viewport.width,
                height: viewport.height,
                totalItems: items.length,
                items
            });

            page.cleanup();
        }

        await pdf.destroy();

        return {
            success: true,
            stage: "PDF_LAYOUT_READER",
            file: absolutePath,
            fileName: path.basename(absolutePath),
            totalPages: pages.length,
            totalItems,
            pages
        };
    } catch (error) {
        return {
            success: false,
            stage: "PDF_LAYOUT_READER",
            file: filePath || "",
            message: error.message,
            error: error.stack || error.message
        };
    }
}

module.exports = { readPDFLayout };

if (require.main === module) {
    const filePath = process.argv[2];

    if (!filePath) {
        console.error(
            'Usage: node validation\\pdf\\pdfLayoutReader.js "path\\statement.pdf"'
        );
        process.exitCode = 1;
    } else {
        readPDFLayout(filePath)
            .then(result => {
                if (!result.success) {
                    console.error(JSON.stringify(result, null, 2));
                    process.exitCode = 1;
                    return;
                }

                console.log(JSON.stringify({
                    success: result.success,
                    stage: result.stage,
                    file: result.file,
                    totalPages: result.totalPages,
                    totalItems: result.totalItems,
                    pages: result.pages.map(page => ({
                        pageNumber: page.pageNumber,
                        width: page.width,
                        height: page.height,
                        totalItems: page.totalItems,
                        sampleItems: page.items.slice(0, 15)
                    }))
                }, null, 2));
            })
            .catch(error => {
                console.error(error.stack || error.message);
                process.exitCode = 1;
            });
    }
}
