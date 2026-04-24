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

    const data = await res.json();

    console.log("SAMPLE DATA:", data[0]); // DEBUG

    const user = (localStorage.getItem("user") || "").toLowerCase();
    const role = localStorage.getItem("role");

    if (role === "admin") {
      fullData = data;
    } else {
      fullData = data.filter(row => {
        return (
          (row.bh_id || "").toLowerCase().includes(user) ||
          (row.sm_id || "").toLowerCase().includes(user) ||
          (row.zbm_id || "").toLowerCase().includes(user) ||
          (row.rbm_id || "").toLowerCase().includes(user) ||
          (row.abm_id || "").toLowerCase().includes(user)
        );
      });
    }

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

  // TEXT FILTER
  if (
    !(row.division || "").toLowerCase().includes(division) ||
    !(row.state || "").toLowerCase().includes(state) ||
    !(row.bmhq || "").toLowerCase().includes(bmhq) ||
    !String(row.code || "").toLowerCase().includes(code) ||
    !(row.name || "").toLowerCase().includes(name)
  ) {
    return false;
  }

  // CARD FILTER
  const aws = (row.awsFile || "").toString().trim();
  const sss = (row.sssFile || "").toString().trim();

  switch (activeCardFilter) {
    case "awsSubmitted":
      return aws !== "";

    case "awsPending":
      return aws === "";

    case "sssSubmitted":
      return sss !== "";

    case "sssPending":
      return sss === "";

    default:
      return true;
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
   UPLOAD UI (UNCHANGED)
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
   CHOOSE FILE
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

    // ✅ Allowed formats
    const allowed = ["xlsx", "xls", "docx", "txt", "html", "htm", "pdf"];

    for (let file of files) {

      const ext = file.name.split(".").pop().toLowerCase();

      // ❌ INVALID FORMAT
      if (!allowed.includes(ext)) {
        showMessage("INVALID FORMAT", true);
        return;
      }

      // ❌ INVALID PDF (basic scanned check)
      if (ext === "pdf") {
        try {
          const text = await file.text();

          // if no readable text → likely scanned
          if (!text || text.trim().length < 50) {
            showMessage("INVALID PDF", true);
            return;
          }

        } catch (err) {
          showMessage("INVALID PDF", true);
          return;
        }
      }
    }

    // ✅ IF ALL FILES VALID → CONTINUE (NO CHANGE BELOW)
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

        const tableHTML = XLSX.utils.sheet_to_html(sheet);

        container.innerHTML = `
          <div style="max-width:100%; max-height:400px; overflow:auto; border:1px solid #ddd; background:#fff;">
            <div style="min-width:800px">
              ${tableHTML}
            </div>
          </div>
        `;
      };

      reader.readAsArrayBuffer(file);
    }

    else if (ext === "docx") {

      const reader = new FileReader();

      reader.onload = function (e) {

        mammoth.convertToHtml({ arrayBuffer: e.target.result })
          .then(result => {

            container.innerHTML = `
              <div style="max-height:400px; overflow:auto; padding:10px; background:#fff; border:1px solid #ddd;">
                ${result.value}
              </div>
            `;

          })
          .catch(() => {
            container.innerHTML = `<p>${file.name} (Preview failed)</p>`;
          });
      };

      reader.readAsArrayBuffer(file);
    }

    else if (ext === "html" || ext === "htm") {

      const reader = new FileReader();

      reader.onload = function (e) {
        const safeHtml = e.target.result.replace(/"/g, '&quot;');

        container.innerHTML = `
          <iframe 
            srcdoc="${safeHtml}"
            style="width:100%; height:400px; border:1px solid #ddd; background:#fff;">
          </iframe>
        `;
      };

      reader.readAsText(file);
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
   SUBMIT
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

/* =========================
   CARDS (UNCHANGED)
========================= */
function updateCards(data) {

  let awsSubmitted = 0;
  let awsPending = 0;
  let sssSubmitted = 0;
  let sssPending = 0;

  data.forEach(row => {

    const aws = (row.awsFile || "").toString().trim();
    const sss = (row.sssFile || "").toString().trim();

    if (aws !== "") awsSubmitted++;
    else awsPending++;

    if (sss !== "") sssSubmitted++;
    else sssPending++;
  });

  const total = data.length || 1;

  const awsDoneEl = document.getElementById("awsDone");
  if (awsDoneEl) awsDoneEl.innerText = awsSubmitted;

  const awsPenEl = document.getElementById("awsPending");
  if (awsPenEl) awsPenEl.innerText = `${awsPending} (${Math.round((awsPending / total) * 100)}%)`;

  const sssDoneEl = document.getElementById("sssDone");
  if (sssDoneEl) sssDoneEl.innerText = sssSubmitted;

  const sssPenEl = document.getElementById("sssPending");
  if (sssPenEl) sssPenEl.innerText = `${sssPending} (${Math.round((sssPending / total) * 100)}%)`;

  const totalEl = document.getElementById("total");
  if (totalEl) totalEl.innerText = data.length;
}

/* =========================
   ✅ FIXED FILTER LISTENER
========================= */
function bindHeaderFilters() {
  const inputs = document.querySelectorAll(
    "input[placeholder='Division'], \
     input[placeholder='State'], \
     input[placeholder='BM HQ'], \
     input[placeholder='Code'], \
     input[placeholder='Name']"
  );
  inputs.forEach(input => {
    input.oninput = applyFilters; // direct binding, no duplicates
  });
}
/* =========================
   CLEAR FILTERS
========================= */
  function clearFilters() {

  activeCardFilter = null; // ✅ ADD THIS LINE

  document.getElementById("globalSearch").value = "";

  document.getElementById("f_division").value = "";
  document.getElementById("f_state").value = "";
  document.getElementById("f_bmhq").value = "";
  document.getElementById("f_code").value = "";
  document.getElementById("f_name").value = "";

  applyFilters();
}

/* =========================
   DOWNLOAD EXCEL
========================= */
  function downloadExcel() {

  // 🔄 Transform data before export
  const exportData = fullData.map((row, index) => {

    const aws = (row.awsFile || "").toString().trim();
    const sss = (row.sssFile || "").toString().trim();

    return {
      ID: index + 1, // ✅ Serial number starts from 1
      Division: row.division || "",
      State: row.state || "",
      BM_HQ: row.bmhq || "",
      Code: row.code || "",
      Name: row.name || "",
      Sales: row.sales || "",

      // ✅ Convert file → status
      AWS: aws ? "Submitted" : "Pending",
      SSS: sss ? "Submitted" : "Pending"
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Dashboard");

  XLSX.writeFile(wb, "dashboard_data.xlsx");
}

/* =========================
   LOGOUT
========================= */
function logout() {

  localStorage.removeItem("role");

  window.location.href = "index.html";
}
function setCardFilter(type) {
  activeCardFilter = type;
  applyFilters();
}
window.onload = loadData;