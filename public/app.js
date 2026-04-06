let fullData = [];
let activeCardFilter = null;

let currentPreviewFile = null;
let currentPreviewCode = null;
let currentPreviewType = null;

/* =========================
   LOAD DATA
========================= */
async function loadData() {
  const res = await fetch("/data/list");
  fullData = await res.json();
  applyFilters();
}

/* =========================
   MESSAGE CARD
========================= */
function showMessage(message, isError = false) {

  const box = document.getElementById("errorBox");
  const card = document.getElementById("errorCard");

  if (!box || !card) {
    alert(message);
    return;
  }

  box.style.display = "block";

  if (message.toLowerCase().includes("pdfparse")) {
    message = "INVALID PDF";
  }

  card.innerText = message;
  card.style.background = isError ? "#e74c3c" : "#27ae60";

  card.classList.add("message-show");

  setTimeout(() => {
    box.style.display = "none";
  }, 2500);
}

/* =========================
   FILTER
========================= */
function applyFilters() {

  const global = document.getElementById("globalSearch")?.value.toLowerCase() || "";

  let data = fullData.filter(row => {
    const combined =
      `${row.division} ${row.state} ${row.bmhq} ${row.code} ${row.name}`.toLowerCase();

    return combined.includes(global);
  });

  renderTable(data);
  updateCards(data);
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
   PREVIEW
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

  if (ext === "pdf") {
    frame.src = URL.createObjectURL(file);
  }

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

  else if (ext === "html") {

    const reader = new FileReader();
    reader.onload = e => frame.srcdoc = e.target.result;
    reader.readAsText(file);
  }

  else if (ext === "txt") {

    const reader = new FileReader();
    reader.onload = e => frame.srcdoc = `<pre style="padding:20px">${e.target.result}</pre>`;
    reader.readAsText(file);
  }

  else {
    frame.srcdoc = "<h3 style='padding:20px'>Preview not available</h3>";
  }

  modal.classList.remove("hidden");
}

/* =========================
   CLOSE
========================= */
function closePreview() {
  document.getElementById("filePreviewModal").classList.add("hidden");
  document.getElementById("previewFrame").src = "";

  currentPreviewFile = null;
  currentPreviewCode = null;
  currentPreviewType = null;
}

/* =========================
   SUBMIT (AUTO REFRESH FIX)
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

      delete window[`temp_${currentPreviewType}_${currentPreviewCode}`];
      closePreview();
      applyFilters();
      return;
    }

    showMessage("UPLOAD SUCCESSFUL");

    delete window[`temp_${currentPreviewType}_${currentPreviewCode}`];

    // 🔥 INSTANT UI UPDATE
    applyFilters();

    // 🔄 BACKEND SYNC
    setTimeout(loadData, 500);

    closePreview();
  })
  .catch(() => {
    showMessage("Upload error", true);
    closePreview();
  });
}

/* =========================
   DELETE
========================= */
function deleteFile(code, type) {
  if (!confirm("Delete file?")) return;

  fetch(`/data/delete/${code}/${type}`, { method: "DELETE" });

  // instant refresh
  applyFilters();
  setTimeout(loadData, 500);
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

  let awsDone = 0, sssDone = 0;

  data.forEach(row => {
    if (row.awsFile) awsDone++;
    if (row.sssFile) sssDone++;
  });

  const total = data.length || 1;

  document.getElementById("awsDone").innerText =
    `${awsDone} (${Math.round((awsDone/total)*100)}%)`;

  document.getElementById("sssDone").innerText =
    `${sssDone} (${Math.round((sssDone/total)*100)}%)`;

  document.getElementById("awsPending").innerText = total - awsDone;
  document.getElementById("sssPending").innerText = total - sssDone;

  document.getElementById("total").innerText = data.length;
}

window.onload = loadData;