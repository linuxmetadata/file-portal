const mammoth = require("mammoth");
const XLSX = require("xlsx");

async function readWorkbook(filePath) {

    try {

        const result = await mammoth.extractRawText({
            path: filePath
        });

        const lines = result.value
            .split(/\r?\n/)
            .filter(line => line.trim().length > 0);

        const data = lines.map(line => [line]);

        const worksheet = XLSX.utils.aoa_to_sheet(data);

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Sheet1"
        );

        return workbook;

    } catch (err) {

        console.error("DOCX Reader Error:", err.message);

        return null;

    }

}

module.exports = {
    readWorkbook
};