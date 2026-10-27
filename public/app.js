let fullData = [];
let activeCardFilter = null;

let currentPreviewFile = null;
let currentPreviewFiles = [];
let currentPreviewCode = null;
let currentPreviewType = null;
let currentPreviewDivision = null;
let isValidFile = true;
let pendingStockistWarning = null;
let stockistConfirmationInProgress = false;
let isUploadInProgress = false;

function resetValidationState() {

  currentPreviewFile = null;
  currentPreviewFiles = [];
  currentPreviewCode = null;
  currentPreviewType = null;
  pendingStockistWarning = null;

const stockistConfirmModal =
    document.getElementById("stockistConfirmModal");

if (stockistConfirmModal) {
    stockistConfirmModal.style.display = "none";
}

  isValidFile = true;

  clearPreviewError();

  console.log("VALIDATION STATE RESET");
}

/* =========================
   LOAD DATA
========================= */
async function loadData() {

  try {

    const user = localStorage.getItem("user") || "";
    const role = localStorage.getItem("role") || "";

    const res = await fetch("/data/list", {
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`
  }
});

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

  const fileId = id.trim();

  return `
    <div style="margin-bottom:6px;display:flex;gap:5px;justify-content:center;">

      <button onclick="viewFile('${fileId}')">
  View
</button>

      ${
        isAdmin()
        ? `<button onclick="deleteSingleFile(
            '${row.division}',
            '${code}',
            '${type}',
            '${fileId}'
          )">
            Delete
          </button>`
        : ""
      }

    </div>
  `;

}).join("");

  } else {

    buttons += `
      <button onclick="chooseFile('${row.division}','${code}','${type}')">
        Upload
      </button>
    `;
  }


  return buttons;
}

/* =========================
   CHOOSE FILE
========================= */
function chooseFile(division, code, type) {

  currentPreviewFile = null;
  currentPreviewFiles = [];
  currentPreviewCode = null;
  currentPreviewType = null;

  const input = document.createElement("input");

  input.type = "file";
  input.multiple = true;

  input.onchange = async () => {

    resetValidationState();
    clearPreviewError();

    const files = Array.from(input.files);

    console.log("FILES SELECTED:", files.length);

    files.forEach(f => {
    console.log("SELECTED:", f.name);
  });

    if (!files.length) return;

    const allowed = [
      "pdf",
      "xlsx",
      "xls",
      "csv",
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

        showMessage("INVALID FORMAT", true);

        return;
      }

      const ext =
        file.name
          .split(".")
          .pop()
          .toLowerCase();

      if (!allowed.includes(ext)) {

        showMessage("INVALID FORMAT", true);

        return;
      }
    }

    /* =========================
       SERVER VALIDATION
    ========================== */
    try {

    for (const file of files) {

    const form = new FormData();

    form.append("file", file);

    const row = fullData.find(
    r => String(r.code) === String(code)
  );

  form.append(
    "stockistName",
    row ? row.name : ""
);

    const validateRes = await fetch("/validate", {
      method: "POST",
      body: form
    });

    let validateData = {};

    try {

      validateData = await validateRes.json();

    } catch {

      validateData = {
        error: "VALIDATION FAILED"
      };
    }

    
   // STOCKIST NAME MISMATCH WARNING
if (validateRes.ok && validateData.stockistWarning) {
    if (!pendingStockistWarning) {
        pendingStockistWarning = {
            message:
                validateData.stockistMessage ||
                "Stockist name not matched. Please confirm.",
            reason: validateData.stockistReason || "",
            extractedStockistName:
                validateData.extractedStockistName || "",
            expectedStockistName: row ? row.name : "",
            fileName: file.name
        };
    }
}

    // BLOCK FILES THAT FAIL VALIDATION
    if (!validateRes.ok) {
        console.log(
            "FAILED FILE:",
            file.name,
            validateData
        );

        showMessage(
            validateData.error || "INVALID FILE",
            true
        );

        return;
    }

  }

} catch (err) {

  console.error("VALIDATE ERROR:", err);

  showMessage(
    "Validation failed",
    true
  );

  return;
}

    currentPreviewFiles = files;
    currentPreviewFile = files[0];
    currentPreviewDivision = division;
    currentPreviewCode = code;
    currentPreviewType = type;

    console.log(
    "OPENING PREVIEW:",
    currentPreviewFiles.map(f => f.name)
    );
        openPreview();

    // Show stockist mismatch confirmation over the preview.
    if (pendingStockistWarning) {
      const warningModal =
        document.getElementById("stockistConfirmModal");

      const warningMessage =
        document.getElementById("stockistConfirmMessage");

      if (warningMessage) {
        const expectedName =
      pendingStockistWarning.expectedStockistName || "Not available";

      warningMessage.textContent =
      `Stockist name not matched. The correct stockist name is ${expectedName}. Please confirm.`;
      }

      if (warningModal) {
        warningModal.style.display = "flex";
      }
    }
  };

  input.click();
}


/* =========================
   INVALID SSS UPLOAD
========================= */
function chooseInvalidFile(division, code) {
  if (isUploadInProgress) return;

  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;

  input.onchange = async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;

    if (isUploadInProgress) return;
    isUploadInProgress = true;

    try {
      const row = fullData.find(
        r =>
          String(r.code) === String(code) &&
          String(r.division) === String(division)
      );

      for (const file of files) {
        const form = new FormData();

        form.append("file", file);
        form.append("division", division);
        form.append("code", code);
        form.append("type", "SSS");
        form.append("stockistName", row ? row.name : "");

        const res = await fetch("/data/invalid-upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`
          },
          body: form
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          showMessage(
            `${file.name}: ${data.error || "Invalid upload failed"}`,
            true
          );
          return;
        }

        if (data.extractionSuccess === false) {
        showMessage(
        `${file.name} uploaded, but extraction was skipped or failed.`,
        true
        );
        return;
        }
      }

      showMessage("Invalid SSS upload process completed.");
      await loadData();

    } catch (err) {
      console.error("INVALID SSS UPLOAD ERROR:", err);
      showMessage("Invalid SSS upload failed.", true);

    } finally {
      isUploadInProgress = false;
    }
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
    container.style.fontSize = "16px";
    container.style.lineHeight = "1.6";
    container.style.color = "#111";
    container.style.background = "#fff";

    /* PDF */
    if (ext === "pdf") {

      const url = URL.createObjectURL(file);

      container.innerHTML = `
      <embed
      src="${url}#zoom=150"
      type="application/pdf"
      width="100%"
      height="800px"
      style="border:1px solid #ddd;"
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

    /* DOC */

else if (ext === "doc") {

  const reader = new FileReader();

  reader.onload = function (e) {

    try {

      const text =
        new TextDecoder("latin1")
        .decode(e.target.result);

      container.innerHTML = `
        <div style="
          max-height:400px;
          overflow:auto;
          padding:10px;
          background:#fff;
          border:1px solid #ddd;
          white-space:pre-wrap;
          font-family:monospace;
        ">
          ${text
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}
        </div>
      `;

    } catch {

      container.innerHTML = `
        <p>${file.name} (Preview failed)</p>
      `;
    }
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

    /* TEXT / CSV */
      else if (ext === "txt" || ext === "csv") {

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

  frame.style.fontSize = "16px";
  frame.style.lineHeight = "1.6";
  frame.style.zoom = "110%";
  modal.classList.remove("hidden");
}

/* =========================
   STOCKIST MISMATCH CONFIRMATION
========================= */
async function confirmStockistMismatch() {

  if (
    !pendingStockistWarning ||
    stockistConfirmationInProgress ||
    isUploadInProgress ||
    !currentPreviewFiles.length
  ) {
    return;
  }

  stockistConfirmationInProgress = true;

  const confirmBtn =
    document.getElementById("confirmStockistBtn");

  const warningModal =
    document.getElementById("stockistConfirmModal");

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerText = "Please wait...";
  }

  if (warningModal) {
    warningModal.style.display = "none";
  }

  try {
    await submitFile(
      document.getElementById("submitBtn")
    );
  } finally {
    stockistConfirmationInProgress = false;

    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerText = "Confirm & Continue";
    }
  }
}

function cancelStockistMismatch() {

  if (isUploadInProgress) {
    return;
  }

  const warningModal =
    document.getElementById("stockistConfirmModal");

  if (warningModal) {
    warningModal.style.display = "none";
  }

  pendingStockistWarning = null;

  closePreview();
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

  if (pendingStockistWarning && !stockistConfirmationInProgress) {
    return;
  }

  if (isUploadInProgress) {
    return;
  }

  isUploadInProgress = true;

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

      const row = fullData.find(
        r =>
        String(r.code) === String(currentPreviewCode) &&
        String(r.division) === String(currentPreviewDivision)
      );

        form.append("division", row ? row.division : "");
        form.append("stockistName", row ? row.name : "");

      const res = await fetch("/data/upload", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`
  },
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

    isUploadInProgress = false;

    if (btn) {
      btn.disabled = false;
      btn.innerText = "Submit";
    }
  }
}

/* =========================
   DELETE
========================= */
async function deleteSingleFile(
    division,
    code,
    type,
    fileId
) {

    if (!confirm("Delete this file?"))
        return;

    const res = await fetch(

        `/data/delete/${encodeURIComponent(division)}/${encodeURIComponent(code)}/${type}/${fileId}`,

        {
    method: "DELETE",
    headers: {
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`
    }
}

    );

    const data = await res.json();

    if (!res.ok) {

        showMessage(
            data.error || "Delete failed",
            true
        );

        return;
    }

    showMessage("File deleted");

    await loadData();

}

/* =========================
   VIEW
========================= */
async function viewFile(fileId) {
  const token = localStorage.getItem("token") || "";

  if (!token) {
    alert("Your session has expired. Please log in again.");
    window.location.href = "/index.html";
    return;
  }

  // Open the tab immediately to avoid popup blockers.
  const previewWindow = window.open("about:blank", "_blank");

  if (!previewWindow) {
    alert("Please allow pop-ups to preview files.");
    return;
  }

  try {
    const res = await fetch(
      `/data/file/${encodeURIComponent(fileId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      previewWindow.close();

      alert(data.error || "Unable to open the file.");
      return;
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    previewWindow.location.href = objectUrl;

    // Release the temporary browser URL after the preview has had time to load.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

  } catch (err) {
    console.error("FILE PREVIEW ERROR:", err);
    previewWindow.close();
    alert("Unable to retrieve the file. Please try again.");
  }
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

  localStorage.removeItem("user");
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

if (document.getElementById("tableData")) {
  window.onload = loadData;
}