const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const ExcelJS = require("exceljs");

const verifyToken = require("../middleware/authMiddleware");
const auth = require("../services/googleAuth");

const drive = google.drive({ version: "v3", auth });

const baseData = [
  { state: "ANDHRA PRADESH", code: "AP183", name: "LAHARI MEDICAL" },
  { state: "ANDHRA PRADESH", code: "AP220", name: "SADHU PHARMA" },
  { state: "ANDHRA PRADESH", code: "AP242", name: "SURYA MEDICAL" }
];

function getUploads() {
  const filePath = path.join(__dirname, "../data/files.json");
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath));
}

router.get("/list", verifyToken, (req, res) => {
  const uploads = getUploads();

  const result = baseData.map(row => {
    const aws = uploads.find(f => f.code === row.code && f.type === "AWS");
    const sss = uploads.find(f => f.code === row.code && f.type === "SSS");

    return {
      ...row,
      awsUploaded: !!aws,
      sssUploaded: !!sss,
      awsFileId: aws?.fileId || null,
      sssFileId: sss?.fileId || null
    };
  });

  res.json(result);
});

router.get("/stats", verifyToken, (req, res) => {
  const uploads = getUploads();
  const total = baseData.length;

  const awsSubmitted = uploads.filter(f => f.type === "AWS").length;
  const sssSubmitted = uploads.filter(f => f.type === "SSS").length;

  res.json({
    awsSubmitted,
    awsPending: total - awsSubmitted,
    sssSubmitted,
    sssPending: total - sssSubmitted,
    total
  });
});

router.get("/view/:id", verifyToken, (req, res) => {
  res.json({
    url: `https://drive.google.com/file/d/${req.params.id}/view`
  });
});

router.get("/download/:id", verifyToken, async (req, res) => {
  const file = await drive.files.get(
    { fileId: req.params.id, alt: "media" },
    { responseType: "stream" }
  );
  file.data.pipe(res);
});

router.delete("/delete/:id", verifyToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Not allowed" });
  }

  await drive.files.delete({ fileId: req.params.id });

  let data = getUploads();
  data = data.filter(d => d.fileId !== req.params.id);

  fs.writeFileSync(
    path.join(__dirname, "../data/files.json"),
    JSON.stringify(data, null, 2)
  );

  res.json({ message: "Deleted" });
});

router.get("/excel", verifyToken, async (req, res) => {
  const uploads = getUploads();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");

  sheet.columns = [
    { header: "State", key: "state" },
    { header: "Code", key: "code" },
    { header: "Name", key: "name" },
    { header: "AWS", key: "aws" },
    { header: "SSS", key: "sss" }
  ];

  baseData.forEach(row => {
    const aws = uploads.find(f => f.code === row.code && f.type === "AWS");
    const sss = uploads.find(f => f.code === row.code && f.type === "SSS");

    sheet.addRow({
      state: row.state,
      code: row.code,
      name: row.name,
      aws: aws ? "Submitted" : "Pending",
      sss: sss ? "Submitted" : "Pending"
    });
  });

  res.setHeader(
    "Content-Disposition",
    "attachment; filename=report.xlsx"
  );

  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;