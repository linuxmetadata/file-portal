const fs = require("fs");
const pdf = require("pdf-parse");

exports.validatePDF = async (filePath) => {
  try {
    const data = await pdf(fs.readFileSync(filePath));

    // ✅ Allow PDF if it has at least some readable text
    if (data.text && data.text.trim().length > 10) {
      return true;
    }

    // ⚠️ If no text, still allow (optional – to avoid blocking scanned PDFs)
    // Change to "return false" if you want strict validation
    return true;

  } catch (error) {
    console.error("PDF validation error:", error.message);
    return false;
  }
};