let fullData = [];
let activeCardFilter = null;
let uploadStatus = {};

/* =========================
   LOAD DATA
========================= */
async function loadData() {
  const res = await fetch("/data/list");
  fullData = await res.json();
  applyFilters();
}

/* =========================
   SHOW MESSAGE (CARD + ANIMATION)
========================= */
function showMessage(message, isError = false) {

  const box = document.getElementById("errorBox");
  const card = document.getElementById("errorCard");

  if (!box || !card) {
    alert(message);
    return;
  }

  box.style.display = "block";

  card.classList.remove("message-show", "message-hide");

  card.innerText = message;
  card.style.background = isError ? "#e74c3c" : "#27ae60";

  // show animation
  card.classList.add("message-show");

  setTimeout(() => {

    card.classList.remove("message-show");
    card.classList.add("message-hide");

    setTimeout(() => {
      box.style.display = "none";
    }, 400);

  }, 3000);
}

/* =========================
   APPLY FILTERS
========================= */
function applyFilters() {

  const div = document.getElementById("f_division")?.value.toLowerCase() || "";
  const state = document.getElementById("f_state")?.value.toLowerCase() || "";
  const bmhq = document.getElementById("f_bmhq")?.value.toLowerCase() || "";
  const code = document.getElementById("f_code")?.value.toLowerCase() || "";
  const name = document.getElementById("f_name")?.value.toLowerCase() || "";
  const global = document.getElementById("globalSearch")?.value.toLowerCase() || "";

  let data = fullData.filter(row => {

    const combined =
      `${row.division} ${row.state} ${row.bmhq} ${row.code} ${row.name}`.toLowerCase();

    return (
      combined.includes(global) &&
      (row.division || "").toLowerCase().includes(div) &&
      (row.state || "").toLowerCase().includes(state) &&
      (row.bmhq || "").toLowerCase().includes(bmhq) &&
      (row.code || "").toLowerCase().includes(code) &&
      (row.name || "").toLowerCase().includes(name)
    );
  });

  if (activeCardFilter) {
    data = data.filter(row => {
      if (activeCardFilter === "awsDone") return row.awsFile;
      if (activeCardFilter === "awsPending") return !row.awsFile;
      if (activeCardFilter === "sssDone") return row.sssFile;
      if (activeCardFilter === "sssPending") return !row.sssFile;
      return true;
    });
  }

  renderTable(data);
  updateCards(data);
}

/* =========================
   TABLE RENDER
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
          <input id="sales_${code}" 
          value="${row.sales || ""}"
          oninput="updateSales('${code}', this.value)"
          ${(!isAdmin() && (row.awsFile || row.sssFile)) ? "disabled" : ""}>
        </td>

        <td>${getUploadUI(row, code, "aws")}</td>
        <td>${getUploadUI(row, code, "sss")}</td>
      </tr>
    `;
  });

  document.getElementById("tableData").innerHTML = html;
}

/* =========================
   SAVE SALES
========================= */
function updateSales(code, value) {
  let row = fullData.find(r => String(r.code) === String(code));
  if (row) row.sales = value;
}

/* =========================
   UPLOAD UI
========================= */
function getUploadUI(row, code, type) {

  const key = `${code}_${type}`;
  const fileKey = type === "aws" ? row.awsFile : row.sssFile;

  if (fileKey) {
    return `
      <button onclick="viewFile('${fileKey}')">View</button>
      ${isAdmin() ? `<button onclick="deleteFile('${code}','${type}')">Delete</button>` : ""}
    `;
  }

  if (uploadStatus[key]?.status === "uploading") {
    return `
      <div style="width:100%">
        <div style="background:#ddd;height:6px">
          <div style="width:${uploadStatus[key].progress}%;background:green;height:6px"></div>
        </div>
        <small>${uploadStatus[key].progress}%</small>
      </div>
    `;
  }

  if (window[`temp_${type}_${code}`]) {
    return `
      <button onclick="previewFile('${type}','${code}')">View</button>
      <button onclick="submitFile('${code}','${type}')">Submit</button>
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
    window[`temp_${type}_${code}`] = input.files[0];
    applyFilters();
  };

  input.click();
}

/* =========================
   SUBMIT FILE (FIXED RESET)
========================= */
function submitFile(code, type) {

  const file = window[`temp_${type}_${code}`];
  if (!file) return;

  const row = fullData.find(r => String(r.code) === String(code));
  const salesValue = row?.sales || "";

  const key = `${code}_${type}`;
  uploadStatus[key] = { status: "uploading", progress: 0 };

  const form = new FormData();
  form.append("file", file);
  form.append("code", code);
  form.append("type", type);
  form.append("sales", salesValue);

  const xhr = new XMLHttpRequest();

  xhr.upload.onprogress = function (e) {
    if (e.lengthComputable) {
      uploadStatus[key].progress = Math.round((e.loaded / e.total) * 100);
      applyFilters();
    }
  };

  xhr.onload = function () {

    if (xhr.status !== 200) {

      let errorMsg = "Upload failed";

      try {
        const res = JSON.parse(xhr.responseText);
        errorMsg = res.error || errorMsg;
      } catch {}

      showMessage(errorMsg, true);

      // ✅ FULL RESET
      uploadStatus[key] = {};
      delete window[`temp_${type}_${code}`];

      applyFilters();
      return;
    }

    showMessage("UPLOAD SUCCESSFUL");

    uploadStatus[key] = {};
    delete window[`temp_${type}_${code}`];

    loadData();
  };

  xhr.onerror = function () {

    showMessage("Network Error", true);

    // ✅ FULL RESET
    uploadStatus[key] = {};
    delete window[`temp_${type}_${code}`];

    applyFilters();
  };

  xhr.open("POST", "/data/upload");
  xhr.send(form);
}

/* =========================
   DELETE
========================= */
function deleteFile(code, type) {
  if (!confirm("Delete file?")) return;
  fetch(`/data/delete/${code}/${type}`, { method: "DELETE" });
  loadData();
}

/* =========================
   UTIL
========================= */
function previewFile(type, code) {
  const file = window[`temp_${type}_${code}`];
  window.open(URL.createObjectURL(file));
}

function viewFile(url) {
  window.open(url);
}

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

function filterByCard(type) {
  activeCardFilter = type;
  applyFilters();
}

function clearFilters() {
  activeCardFilter = null;
  ["f_division","f_state","f_bmhq","f_code","f_name"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value="";
  });
  document.getElementById("globalSearch").value = "";
  applyFilters();
}

function downloadExcel() {
  window.open("/data/download/excel");
}

function logout() {
  localStorage.clear();
  window.location = "/";
}

window.onload = loadData;