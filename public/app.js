let fullData = [];
let activeCardFilter = null;

let currentPreviewFile = null;
let currentPreviewFiles = [];
let currentPreviewCode = null;
let currentPreviewType = null;

/* =========================
   LOAD DATA
========================= */
async function loadData() {
  try {

    const user = localStorage.getItem("user");
    const role = localStorage.getItem("role");

    const res = await fetch(`/data/list?user=${user}&role=${role}`);

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

  const division = document.querySelector("input[placeholder='Division']")?.value.toLowerCase() || "";
  const state = document.querySelector("input[placeholder='State']")?.value.toLowerCase() || "";
  const bmhq = document.querySelector("input[placeholder='BM HQ']")?.value.toLowerCase() || "";
  const code = document.querySelector("input[placeholder='Code']")?.value.toLowerCase() || "";
  const name = document.querySelector("input[placeholder='Name']")?.value.toLowerCase() || "";

  const filtered = fullData.filter(row => {

    if (
      !(row.division || "").toLowerCase().includes(division) ||
      !(row.state || "").toLowerCase().includes(state) ||
      !(row.bmhq || "").toLowerCase().includes(bmhq) ||
      !String(row.code || "").toLowerCase().includes(code) ||
      !(row.name || "").toLowerCase().includes(name)
    ) return false;

    const aws = (row.awsFile || "").toString().trim();
    const sss = (row.sssFile || "").toString().trim();

    switch (activeCardFilter) {
      case "awsSubmitted": return aws !== "";
      case "awsPending": return aws === "";
      case "sssSubmitted": return sss !== "";
      case "sssPending": return sss === "";
      default: return true;
    }
  });

  renderTable(filtered);
  updateCards(filtered);
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

  const fileString = type === "aws" ? row.awsFile : row.sssFile;

  let buttons = "";

  if (fileString && fileString.toString().trim() !== "") {

    const fileIds = fileString.split(",");

    buttons += fileIds.map(id => {

      let url = id.trim();

      if (!url.startsWith("http")) {
        url = `https://drive.google.com/file/d/${url}/view`;
      }

      return `<button onclick="viewFile('${url}')">View</button>`;
    }).join(" ");

    if (isAdmin()) {
      buttons += `<button onclick="deleteFile('${code}','${type}')">Delete</button>`;
    }

  } else {

    buttons += `<button onclick="chooseFile('${code}','${type}')">Upload</button>`;
  }

  return buttons;
}

/* =========================
   CHOOSE FILE (FIXED)
========================= */
function chooseFile(code, type) {

  currentPreviewFile = null;
  currentPreviewFiles = [];
  currentPreviewCode = null;
  currentPreviewType = null;

  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;

  input.onchange = () => {

    const files = Array.from(input.files);
    if (!files.length) return;

    const allowed = ["pdf", "xlsx", "xls", "doc", "docx", "txt", "html", "htm"];

    for (let file of files) {
      const ext = file.name.split(".").pop().toLowerCase();

      if (!allowed.includes(ext)) {
        showMessage("INVALID FORMAT", true);
        return;
      }
    }

    currentPreviewFiles = files;
    currentPreviewFile = files[0];
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

  if (!currentPreviewFiles.length) return;

  const modal = document.getElementById("filePreviewModal");
  const frame = document.getElementById("previewFrame");

  frame.innerHTML = "";

  currentPreviewFiles.forEach(file => {

    const ext = file.name.split(".").pop().toLowerCase();
    const container = document.createElement("div");
    container.style.marginBottom = "20px";

    if (ext === "pdf") {
      const url = URL.createObjectURL(file);
      container.innerHTML = `<embed src="${url}" type="application/pdf" width="100%" height="400px">`;
    }

    else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        container.innerHTML = XLSX.utils.sheet_to_html(sheet);
      };
      reader.readAsArrayBuffer(file);
    }

    else if (ext === "docx") {
      const reader = new FileReader();
      reader.onload = function (e) {
        mammoth.convertToHtml({ arrayBuffer: e.target.result })
          .then(result => container.innerHTML = result.value)
          .catch(() => container.innerHTML = `<p>${file.name} (Preview failed)</p>`);
      };
      reader.readAsArrayBuffer(file);
    }

    else if (ext === "txt") {
      const reader = new FileReader();
      reader.onload = e => container.innerHTML = `<pre>${e.target.result}</pre>`;
      reader.readAsText(file);
    }

    else {
      container.innerHTML = `<p>${file.name} (Preview not available)</p>`;
    }

    frame.appendChild(container);
  });

  modal.classList.remove("hidden");
}

/* =========================
   CLOSE
========================= */
function closePreview() {
  document.getElementById("previewFrame").innerHTML = "";
  document.getElementById("filePreviewModal").classList.add("hidden");

  currentPreviewFile = null;
  currentPreviewFiles = [];
  currentPreviewCode = null;
  currentPreviewType = null;
}

/* =========================
   SUBMIT (VALIDATION ADDED)
========================= */
async function submitFile(btn) {

  if (!currentPreviewFiles.length) {
    showMessage("No file selected", true);
    return;
  }

  try {

    const allowed = ["pdf", "xlsx", "xls", "doc", "docx", "txt", "html", "htm"];

    for (let file of currentPreviewFiles) {

      const ext = file.name.split(".").pop().toLowerCase();

      if (!allowed.includes(ext)) {
        showMessage("INVALID FORMAT", true);
        return;
      }

      if (ext === "pdf") {
        const form = new FormData();
        form.append("file", file);

        const res = await fetch("/validate", {
          method: "POST",
          body: form
        });

        const data = await res.json();

        if (!res.ok) {
          showMessage(data.error || "INVALID PDF", true);
          return;
        }
      }
    }

    for (let file of currentPreviewFiles) {

      const form = new FormData();
      form.append("file", file);
      form.append("code", currentPreviewCode);
      form.append("type", currentPreviewType);

      const res = await fetch("/data/upload", {
        method: "POST",
        body: form
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage(data.error || "Upload failed", true);
        return;
      }
    }

    showMessage("UPLOAD COMPLETED");
    closePreview();
    await loadData();

  } catch (err) {
    showMessage("Upload error", true);
  }
}

/* =========================
   UTIL
========================= */
function isAdmin() {
  return localStorage.getItem("role") === "admin";
}

window.onload = loadData;