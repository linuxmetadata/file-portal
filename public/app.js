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
   FILTER (UPDATED)
========================= */
function applyFilters() {

  const division = document.querySelector("input[placeholder='Division']")?.value.toLowerCase() || "";
  const state = document.querySelector("input[placeholder='State']")?.value.toLowerCase() || "";
  const bmhq = document.querySelector("input[placeholder='BM HQ']")?.value.toLowerCase() || "";
  const code = document.querySelector("input[placeholder='Code']")?.value.toLowerCase() || "";
  const name = document.querySelector("input[placeholder='Name']")?.value.toLowerCase() || "";

  const filtered = fullData.filter(row => {

    return (
      (row.division || "").toLowerCase().includes(division) &&
      (row.state || "").toLowerCase().includes(state) &&
      (row.bmhq || "").toLowerCase().includes(bmhq) &&
      String(row.code || "").toLowerCase().includes(code) &&
      (row.name || "").toLowerCase().includes(name)
    );
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
   UPLOAD UI (UNCHANGED)
========================= */
function getUploadUI(row, code, type) {

  const fileString = type === "aws" ? row.awsFile : row.sssFile;

  let buttons = "";

  if (fileString) {

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
  }

  buttons += `<button onclick="chooseFile('${code}','${type}')">Upload</button>`;

  return buttons;
}

/* =========================
   CHOOSE FILE (UNCHANGED)
========================= */
function chooseFile(code, type) {

  currentPreviewFile = null;
  currentPreviewFiles = [];
  currentPreviewCode = null;
  currentPreviewType = null;

  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;

  input.onchange = async () => {

    const files = Array.from(input.files);
    if (!files.length) return;

    currentPreviewFiles = files;
    currentPreviewFile = files[0];

    currentPreviewCode = code;
    currentPreviewType = type;

    openPreview();
  };

  input.click();
}

/* =========================
   PREVIEW (UNCHANGED)
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

    else if (ext === "txt") {
      const reader = new FileReader();
      reader.onload = e => {
        container.innerHTML = `<pre>${e.target.result}</pre>`;
      };
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
   SUBMIT (UNCHANGED)
========================= */
async function submitFile(btn) {

  if (btn) {
    btn.disabled = true;
    btn.innerText = "Uploading...";
  }

  if (!currentPreviewFiles.length) {
    showMessage("No file selected", true);
    return;
  }

  try {

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
        break;
      }
    }

    showMessage("UPLOAD COMPLETED");

    closePreview();
    await loadData();

  } catch (err) {
    showMessage("Upload error", true);
  }

  if (btn) {
    btn.disabled = false;
    btn.innerText = "Submit";
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

/* =========================
   🔥 AUTO FILTER LISTENER (NEW)
========================= */
document.addEventListener("input", function(e) {
  if (e.target.closest("thead")) {
    applyFilters();
  }
});

window.onload = loadData;