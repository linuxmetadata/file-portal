let fullData = [];
let activeCardFilter = null;

let currentPreviewFile = null;
let currentPreviewCode = null;
let currentPreviewType = null;
let currentObjectURL = null;

/* =========================
   LOAD DATA
========================= */
async function loadData() {
  const res = await fetch("/data/list");
  fullData = await res.json();
  applyFilters();
}

/* =========================
   MESSAGE
========================= */
function showMessage(message, isError = false) {

  const box = document.getElementById("errorBox");
  const card = document.getElementById("errorCard");

  box.style.display = "block";

  if (message.toLowerCase().includes("pdfparse")) {
    message = "INVALID PDF";
  }

  card.innerText = message;
  card.style.background = isError ? "#e74c3c" : "#27ae60";

  setTimeout(() => {
    box.style.display = "none";
  }, 2500);
}

/* =========================
   FILTER
========================= */
function applyFilters() {
  renderTable(fullData);
  updateCards(fullData);
}

/* =========================
   TABLE
========================= */
function renderTable(data) {

  let html = "";

  data.forEach(row => {

    const code = row.code || "";

    html += `
      <tr>
        <td>${row.division || ""}</td>
        <td>${row.state || ""}</td>
        <td>${row.bmhq || ""}</td>
        <td>${code}</td>
        <td>${row.name || ""}</td>

        <td>
          <input value="${row.sales || ""}"
          oninput="updateSales('${code}', this.value)">
        </td>

        <td>${getUploadUI(row, code, "aws")}</td>
        <td>${getUploadUI(row, code, "sss")}</td>
      </tr>
    `;
  });

  document.getElementById("tableData").innerHTML = html;
}

/* =========================
   SALES
========================= */
function updateSales(code, value) {
  let row = fullData.find(r => String(r.code) === String(code));
  if (row) row.sales = value;
}

/* =========================
   UPLOAD UI
========================= */
function getUploadUI(row, code, type) {

  const fileKey = type === "aws" ? row.awsFile : row.sssFile;

  if (fileKey) {
    return `
      <button onclick="viewFile('${fileKey}')">View</button>
      ${isAdmin() ? `<button onclick="deleteFile('${code}','${type}')">Delete</button>` : ""}
    `;
  }

  if (window[`temp_${type}_${code}`]) {
    return `
      <button onclick="openPreview('${type}','${code}')">View</button>
      <button onclick="submitFile()">Submit</button>
    `;
  }

  return `<button onclick="chooseFile('${code}','${type}')">Upload</button>`;
}

/* =========================
   CHOOSE FILE
========================= */
function chooseFile(code, type) {

  const input = document.createElement("input");
  input.type = "file";

  input.onchange = () => {

    const file = input.files[0];
    if (!file) return;

    window[`temp_${type}_${code}`] = file;

    currentPreviewFile = file;
    currentPreviewCode = code;
    currentPreviewType = type;

    openPreview(type, code);
  };

  input.click();
}

/* =========================
   PREVIEW (FULL FIX)
========================= */
function openPreview(type, code) {

  const file = window[`temp_${type}_${code}`];
  if (!file) return;

  currentPreviewFile = file;
  currentPreviewCode = code;
  currentPreviewType = type;

  const modal = document.getElementById("filePreviewModal");
  const frame = document.getElementById("previewFrame");

  const ext = file.name.split(".").pop().toLowerCase();

  // CLEAR OLD
  if (currentObjectURL) {
    URL.revokeObjectURL(currentObjectURL);
    currentObjectURL = null;
  }

  frame.src = "";
  frame.srcdoc = "";

  // PDF
  if (ext === "pdf") {
    currentObjectURL = URL.createObjectURL(file);
    frame.src = currentObjectURL;
  }

  // EXCEL
  else if (ext === "xlsx" || ext === "xls") {

    const reader = new FileReader();

    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      frame.srcdoc = XLSX.utils.sheet_to_html(sheet);
    };

    reader.readAsArrayBuffer(file);
  }

  // WORD (.docx)
  else if (ext === "docx") {

    const reader = new FileReader();

    reader.onload = function (e) {

      mammoth.convertToHtml({ arrayBuffer: e.target.result })
        .then(result => {
          frame.srcdoc = result.value;
        })
        .catch(() => {
          frame.srcdoc = "<h3 style='padding:20px'>Preview not available</h3>";
        });
    };

    reader.readAsArrayBuffer(file);
  }

  // HTML
  else if (ext === "html") {
    const reader = new FileReader();
    reader.onload = e => frame.srcdoc = e.target.result;
    reader.readAsText(file);
  }

  // TXT
  else if (ext === "txt") {
    const reader = new FileReader();
    reader.onload = e => frame.srcdoc = `<pre style="padding:20px;white-space:pre-wrap">${e.target.result}</pre>`;
    reader.readAsText(file);
  }

  // FALLBACK
  else {
    frame.srcdoc = "<h3 style='padding:20px'>Preview not available</h3>";
  }

  modal.classList.remove("hidden");
}

/* =========================
   CLOSE
========================= */
function closePreview() {

  const frame = document.getElementById("previewFrame");

  frame.src = "";
  frame.srcdoc = "";

  if (currentObjectURL) {
    URL.revokeObjectURL(currentObjectURL);
    currentObjectURL = null;
  }

  document.getElementById("filePreviewModal").classList.add("hidden");

  currentPreviewFile = null;
  currentPreviewCode = null;
  currentPreviewType = null;
}

/* =========================
   SUBMIT
========================= */
function submitFile() {

  if (!currentPreviewFile) {
    showMessage("No file selected", true);
    return;
  }

  const form = new FormData();
  form.append("file", currentPreviewFile);
  form.append("code", currentPreviewCode);
  form.append("type", currentPreviewType);

  fetch("/data/upload", {
    method: "POST",
    body: form
  })
  .then(res => res.json())
  .then(res => {

    if (!res.success) {
      showMessage(res.message, true);
      closePreview();
      return;
    }

    showMessage("UPLOAD SUCCESSFUL");

    delete window[`temp_${currentPreviewType}_${currentPreviewCode}`];

    closePreview();

    applyFilters();
    setTimeout(loadData, 300);
  })
  .catch(() => showMessage("Upload error", true));
}

/* =========================
   DELETE
========================= */
function deleteFile(code, type) {
  if (!confirm("Delete file?")) return;

  fetch(`/data/delete/${code}/${type}`, { method: "DELETE" });

  applyFilters();
  setTimeout(loadData, 300);
}

/* =========================
   VIEW
========================= */
function viewFile(url) {
  window.open(url);
}

/* =========================
   UTIL
========================= */
function isAdmin() {
  return localStorage.getItem("role") === "admin";
}

function updateCards(data) {
  document.getElementById("total").innerText = data.length;
}

window.onload = loadData;