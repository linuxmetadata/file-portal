let fullData = [];
let activeCardFilter = null;

let currentPreviewFile = null;
let currentPreviewCode = null;
let currentPreviewType = null;

/* =========================
   LOAD DATA
========================= */
async function loadData() {
  try {
    const res = await fetch("/data/list");

    if (!res.ok) {
      console.error("API failed");
      return;
    }

    fullData = await res.json();
    applyFilters();

  } catch (err) {
    console.error("Load error:", err);
  }
}

/* =========================
   MESSAGE
========================= */
function showMessage(message, isError = false) {

  const card = document.getElementById("errorCard");

  card.innerText = message;
  card.className = "message-card " + (isError ? "error" : "success");
  card.style.display = "block";

  setTimeout(() => {
    card.style.display = "none";
  }, 3000);
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

  return `<button onclick="chooseFile('${code}','${type}')">Upload</button>`;
}

/* =========================
   CHOOSE FILE
========================= */
function chooseFile(code, type) {

  currentPreviewFile = null;
  currentPreviewCode = null;
  currentPreviewType = null;

  const input = document.createElement("input");
  input.type = "file";

  input.onchange = async () => {

    const file = input.files[0];
    if (!file) return;

    currentPreviewFile = file;
    currentPreviewCode = code;
    currentPreviewType = type;

    openPreview();
  };

  input.click();
}

/* =========================
   PREVIEW
========================= */
function openPreview() {

  if (!currentPreviewFile) return;

  const modal = document.getElementById("filePreviewModal");
  const frame = document.getElementById("previewFrame");

  const file = currentPreviewFile;
  const ext = file.name.split(".").pop().toLowerCase();

  frame.innerHTML = `
    <div style="text-align:center;padding:40px">
      <div class="spinner"></div>
      <p>Loading preview...</p>
    </div>
  `;

  const loadPreview = () => {
    frame.innerHTML = "";
  };

  if (ext === "pdf") {
    const url = URL.createObjectURL(file);
    frame.innerHTML = `<embed src="${url}" type="application/pdf" width="100%" height="600px">`;
  }

  else if (ext === "xlsx" || ext === "xls") {
    const reader = new FileReader();
    reader.onload = function (e) {
      loadPreview();
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      frame.innerHTML = XLSX.utils.sheet_to_html(sheet);
    };
    reader.readAsArrayBuffer(file);
  }

  else if (ext === "docx") {
    const reader = new FileReader();
    reader.onload = function (e) {
      loadPreview();
      mammoth.convertToHtml({ arrayBuffer: e.target.result })
        .then(result => frame.innerHTML = result.value)
        .catch(() => frame.innerHTML = "<h3>Preview not available</h3>");
    };
    reader.readAsArrayBuffer(file);
  }

  else if (ext === "html") {
    const reader = new FileReader();
    reader.onload = e => {
      loadPreview();
      frame.innerHTML = e.target.result;
    };
    reader.readAsText(file);
  }

  else if (ext === "txt") {
    const reader = new FileReader();
    reader.onload = e => {
      loadPreview();
      frame.innerHTML = `<pre>${e.target.result}</pre>`;
    };
    reader.readAsText(file);
  }

  else {
    frame.innerHTML = "<h3>Preview not available</h3>";
  }

  modal.classList.remove("hidden");
}

/* =========================
   CLOSE
========================= */
function closePreview() {
  document.getElementById("previewFrame").innerHTML = "";
  document.getElementById("filePreviewModal").classList.add("hidden");

  currentPreviewFile = null;
  currentPreviewCode = null;
  currentPreviewType = null;
}

/* =========================
   SUBMIT
========================= */
async function submitFile(btn) {

  if (btn) {
    btn.disabled = true;
    btn.innerText = "Uploading...";
  }

  if (!currentPreviewFile) {
    showMessage("No file selected", true);
    return;
  }

  const form = new FormData();
  form.append("file", currentPreviewFile);
  form.append("code", currentPreviewCode);
  form.append("type", currentPreviewType);

  try {
    const res = await fetch("/data/upload", {
      method: "POST",
      body: form
    });

    const data = await res.json();

    if (!res.ok) {
      showMessage(data.error || "Upload failed", true);
      if (btn) {
        btn.disabled = false;
        btn.innerText = "Submit";
      }
      return;
    }

    showMessage("UPLOAD SUCCESSFUL");

    closePreview();
    await loadData();

  } catch (err) {
    showMessage("Upload error", true);
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Submit";
    }
  }
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