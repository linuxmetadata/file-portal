let fullData = [];
let activeCardFilter = null;

let currentPreviewFile = null;
let currentPreviewFiles = [];
let currentPreviewCode = null;
let currentPreviewType = null;
let isValidFile = true;

/* =========================
   LOAD DATA
========================= */
async function loadData() {

  try {

    const user = localStorage.getItem("user") || "";
    const role = localStorage.getItem("role") || "";

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

  const toast = document.getElementById("toastMessage");

  if (!toast) {
    console.error("toastMessage div missing");
    return;
  }

  toast.innerHTML = `
    <div style="font-size:16px;font-weight:600;margin-bottom:5px;">
      ${isError ? "⚠ Error" : "✓ Success"}
    </div>

    <div>${message}</div>
  `;

  toast.style.position = "fixed";
  toast.style.top = "20px";
  toast.style.right = "20px";
  toast.style.padding = "14px 20px";
  toast.style.borderRadius = "8px";
  toast.style.color = "#fff";
  toast.style.fontWeight = "600";
  toast.style.zIndex = "999999";
  toast.style.display = "block";

  toast.style.background =
    isError
      ? "#dc2626"
      : "#16a34a";

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(() => {
    toast.style.display = "none";
  }, 4000);
}

function showPreviewError(message) {

  const errorDiv = document.getElementById("previewError");

  if (!errorDiv) return;

  errorDiv.innerText = message;

  errorDiv.style.display = "block";
}

function clearPreviewError() {

  const errorDiv = document.getElementById("previewError");

  if (!errorDiv) return;

  errorDiv.innerText = "";

  errorDiv.style.display = "none";
}

/* =========================
   FILTER
========================= */
function applyFilters() {

  const division =
    document.querySelector("input[placeholder='Division']")?.value.toLowerCase() || "";

  const state =
    document.querySelector("input[placeholder='State']")?.value.toLowerCase() || "";

  const bmhq =
    document.querySelector("input[placeholder='BM HQ']")?.value.toLowerCase() || "";

  const code =
    document.querySelector("input[placeholder='Code']")?.value.toLowerCase() || "";

  const name =
    document.querySelector("input[placeholder='Name']")?.value.toLowerCase() || "";

  const filtered = fullData.filter(row => {

    if (
      !(row.division || "").toLowerCase().includes(division) ||
      !(row.state || "").toLowerCase().includes(state) ||
      !(row.bmhq || "").toLowerCase().includes(bmhq) ||
      !String(row.code || "").toLowerCase().includes(code) ||
      !(row.name || "").toLowerCase().includes(name)
    ) {
      return false;
    }

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
          <input
            value="${row.sales || ""}"
            oninput="updateSales(\`${code}\`, this.value)"
          >
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

  let row =
    fullData.find(r => String(r.code) === String(code));

  if (row) {
    row.sales = value;
  }
}

/* =========================
   UPLOAD UI
========================= */
function getUploadUI(row, code, type) {

  const fileString =
    type === "aws"
      ? row.awsFile
      : row.sssFile;

  let buttons = "";

  if (fileString && fileString.toString().trim() !== "") {

    const fileIds = fileString.split(",");

    buttons += fileIds.map(id => {

      let url = id.trim();

      if (!url.startsWith("http")) {
        url = `https://drive.google.com/file/d/${url}/view`;
      }

      return `
        <button onclick="viewFile('${url}')">
          View
        </button>
      `;
    }).join(" ");

    if (isAdmin()) {

      buttons += `
        <button onclick="deleteFile('${code}','${type}')">
          Delete
        </button>
      `;
    }

  } else {

    buttons += `
      <button onclick="chooseFile('${code}','${type}')">
        Upload
      </button>
    `;
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

    clearPreviewError();

    const files = Array.from(input.files);

    if (!files.length) return;

    const allowed = [
      "pdf",
      "xlsx",
      "xls",
      "doc",
      "docx",
      "txt",
      "html",
      "htm"
    ];

    /* =========================
       LOCAL VALIDATION
    ========================== */
    for (let file of files) {

      if (!file.name || !file.name.includes(".")) {

        showPreviewError("INVALID FORMAT");

        return;
      }

      const ext =
        file.name
          .split(".")
          .pop()
          .toLowerCase();

      if (!allowed.includes(ext)) {

        showPreviewError("INVALID FORMAT");

        return;
      }
    }

    /* =========================
       SERVER VALIDATION
    ========================== */
    const form = new FormData();

    form.append("file", files[0]);

    try {

      const validateRes = await fetch("/validate", {
        method: "POST",
        body: form
      });

      let validateData = {};

      try {

        validateData = await validateRes.json();

      } catch {

        validateData = {
          error: "Invalid or scanned PDF"
        };
      }

      if (!validateRes.ok) {
        openPreview();
        showPreviewError(
          validateData.error || "INVALID FILE"
        );

        return;
      }

    } catch (err) {

      console.error("VALIDATE ERROR:", err);

      showPreviewError("Validation failed");

      return;
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

  const modal =
    document.getElementById("filePreviewModal");

  const frame =
    document.getElementById("previewFrame");

  frame.innerHTML = "";

  currentPreviewFiles.forEach(file => {

    const ext =
      file.name.split(".").pop().toLowerCase();

    const container =
      document.createElement("div");

    container.style.marginBottom = "20px";

    /* PDF */
    if (ext === "pdf") {

      const url = URL.createObjectURL(file);

      container.innerHTML = `
        <embed
          src="${url}"
          type="application/pdf"
          width="100%"
          height="400px"
        >
      `;
    }

    /* EXCEL */
    else if (ext === "xlsx" || ext === "xls") {

      const reader = new FileReader();

      reader.onload = function (e) {

        const data =
          new Uint8Array(e.target.result);

        const workbook =
          XLSX.read(data, { type: "array" });

        const sheet =
          workbook.Sheets[workbook.SheetNames[0]];

        const tableHTML =
          XLSX.utils.sheet_to_html(sheet);

        container.innerHTML = `
          <div style="
            max-width:100%;
            max-height:400px;
            overflow:auto;
            border:1px solid #ddd;
            background:#fff;
          ">
            <div style="min-width:800px">
              ${tableHTML}
            </div>
          </div>
        `;
      };

      reader.readAsArrayBuffer(file);
    }

    /* DOCX */
    else if (ext === "docx") {

      const reader = new FileReader();

      reader.onload = function (e) {

        mammoth.convertToHtml({
          arrayBuffer: e.target.result
        })

        .then(result => {

          container.innerHTML = `
            <div style="
              max-height:400px;
              overflow:auto;
              padding:10px;
              background:#fff;
              border:1px solid #ddd;
            ">
              ${result.value}
            </div>
          `;
        })

        .catch(() => {

          container.innerHTML = `
            <p>${file.name} (Preview failed)</p>
          `;
        });
      };

      reader.readAsArrayBuffer(file);
    }

    /* HTML */
    else if (ext === "html" || ext === "htm") {

      const reader = new FileReader();

      reader.onload = function (e) {

        const safeHtml =
          e.target.result.replace(/"/g, '&quot;');

        container.innerHTML = `
          <iframe
            srcdoc="${safeHtml}"
            style="
              width:100%;
              height:400px;
              border:1px solid #ddd;
              background:#fff;
            ">
          </iframe>
        `;
      };

      reader.readAsText(file);
    }

    /* TEXT */
    else if (ext === "txt") {

      const reader = new FileReader();

      reader.onload = e => {

        container.innerHTML = `
          <pre>${e.target.result}</pre>
        `;
      };

      reader.readAsText(file);
    }

    /* UNKNOWN */
    else {

      container.innerHTML = `
        <p>${file.name} (Preview not available)</p>
      `;
    }

    frame.appendChild(container);
  });

  modal.classList.remove("hidden");
}

/* =========================
   CLOSE
========================= */
function closePreview() {

  document
    .getElementById("previewFrame")
    .innerHTML = "";

  document
    .getElementById("filePreviewModal")
    .classList.add("hidden");

  currentPreviewFile = null;
  currentPreviewFiles = [];
  currentPreviewCode = null;
  currentPreviewType = null;
}

/* =========================
   SUBMIT
========================= */
async function submitFile(btn) {

  try {

    if (btn) {
      btn.disabled = true;
      btn.innerText = "Uploading...";
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

        showMessage(
          data.error || "Upload failed",
          true
        );

        if (btn) {
          btn.disabled = false;
          btn.innerText = "Submit";
        }

        return;
      }
    }

    showMessage("UPLOAD COMPLETED");

    closePreview();

    await loadData();

  } catch (err) {

    console.error(err);

    showMessage("Upload error", true);

  } finally {

    if (btn) {
      btn.disabled = false;
      btn.innerText = "Submit";
    }
  }
}

/* =========================
   DELETE
========================= */
async function deleteFile(code, type) {

  if (!confirm("Delete file?")) return;

  await fetch(`/data/delete/${code}/${type}`, {
    method: "DELETE"
  });

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
   CARDS
========================= */
function updateCards(data) {

  let awsSubmitted = 0;
  let awsPending = 0;
  let sssSubmitted = 0;
  let sssPending = 0;

  data.forEach(row => {

    const aws =
      (row.awsFile || "").toString().trim();

    const sss =
      (row.sssFile || "").toString().trim();

    if (aws !== "") awsSubmitted++;
    else awsPending++;

    if (sss !== "") sssSubmitted++;
    else sssPending++;
  });

  const total = data.length || 1;

  const awsDoneEl =
    document.getElementById("awsDone");

  if (awsDoneEl)
    awsDoneEl.innerText = awsSubmitted;

  const awsPenEl =
    document.getElementById("awsPending");

  if (awsPenEl)
    awsPenEl.innerText =
      `${awsPending} (${Math.round((awsPending / total) * 100)}%)`;

  const sssDoneEl =
    document.getElementById("sssDone");

  if (sssDoneEl)
    sssDoneEl.innerText = sssSubmitted;

  const sssPenEl =
    document.getElementById("sssPending");

  if (sssPenEl)
    sssPenEl.innerText =
      `${sssPending} (${Math.round((sssPending / total) * 100)}%)`;

  const totalEl =
    document.getElementById("total");

  if (totalEl)
    totalEl.innerText = data.length;
}

/* =========================
   FILTER LISTENER
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

    input.oninput = applyFilters;
  });
}

/* =========================
   CLEAR FILTERS
========================= */
function clearFilters() {

  activeCardFilter = null;

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

  const exportData =
    fullData.map((row, index) => {

      const aws =
        (row.awsFile || "").toString().trim();

      const sss =
        (row.sssFile || "").toString().trim();

      return {

        ID: index + 1,

        Division: row.division || "",

        State: row.state || "",

        BM_HQ: row.bmhq || "",

        Code: row.code || "",

        Name: row.name || "",

        Sales: row.sales || "",

        AWS: aws
          ? "Submitted"
          : "Pending",

        SSS: sss
          ? "Submitted"
          : "Pending"
      };
    });

  const ws =
    XLSX.utils.json_to_sheet(exportData);

  const wb =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    "Dashboard"
  );

  XLSX.writeFile(
    wb,
    "dashboard_data.xlsx"
  );
}

/* =========================
   LOGOUT
========================= */
function logout() {

  localStorage.removeItem("role");

  window.location.href = "index.html";
}

/* =========================
   CARD FILTER
========================= */
function setCardFilter(type) {

  activeCardFilter = type;

  applyFilters();
}

window.onload = loadData;