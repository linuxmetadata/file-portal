let fullData = [];
let activeCardFilter = null;
let uploadStatus = {}; // track upload state

async function loadData() {
  const res = await fetch("/data/list");
  fullData = await res.json();
  applyFilters();
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

  let data = fullData.filter(row => {

    const division = row.division || row.Division || row.DIVISION || "";
    const st = row.state || row.State || row.STATE || "";
    const hq = row.bmhq || row["BM HQ"] || row["BM HQ "] || "";
    const cd = row.code || row.Code || row.CODE || "";
    const nm = row.name || row.Name || row.NAME || "";

    return (
      division.toLowerCase().includes(div) &&
      st.toLowerCase().includes(state) &&
      hq.toLowerCase().includes(bmhq) &&
      cd.toLowerCase().includes(code) &&
      nm.toLowerCase().includes(name)
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

    const code = row.code || row.Code || row.CODE || "";

    html += `
      <tr>
        <td>${row.division || ""}</td>
        <td>${row.state || ""}</td>
        <td>${row.bmhq || ""}</td>
        <td>${code}</td>
        <td>${row.name || ""}</td>

        <td>
          <input id="sales_${code}" value="${row.sales || ""}"
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
   UPLOAD UI
========================= */
function getUploadUI(row, code, type) {

  const key = `${code}_${type}`;
  const fileKey = type === "aws" ? row.awsFile : row.sssFile;

  // uploaded
  if (fileKey) {
    return `
      <button onclick="viewFile('${fileKey}')">View</button>
      ${isAdmin() ? `<button onclick="deleteFile('${code}','${type}')">Delete</button>` : ""}
    `;
  }

  // uploading
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

  // error retry
  if (uploadStatus[key]?.status === "error") {
    return `<button onclick="submitFile('${code}','${type}')">Retry</button>`;
  }

  // temp selected
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

  const row = fullData.find(r => r.code == code);

  if (!isAdmin()) {
    if (row.awsFile || row.sssFile) {
      alert("Already uploaded.");
      return;
    }
  }

  const input = document.createElement("input");
  input.type = "file";

  input.onchange = () => {
    window[`temp_${type}_${code}`] = input.files[0];
    applyFilters();
  };

  input.click();
}

/* =========================
   ADVANCED UPLOAD (XHR)
========================= */
function submitFile(code, type) {

  const file = window[`temp_${type}_${code}`];
  if (!file) return;

  const key = `${code}_${type}`;
  uploadStatus[key] = { status: "uploading", progress: 0 };

  const form = new FormData();
  form.append("file", file);
  form.append("code", code);
  form.append("type", type);
  form.append("sales", document.getElementById(`sales_${code}`).value);

  const xhr = new XMLHttpRequest();

  xhr.upload.onprogress = function (e) {
    if (e.lengthComputable) {
      uploadStatus[key].progress = Math.round((e.loaded / e.total) * 100);
      applyFilters();
    }
  };

  xhr.onload = function () {
    uploadStatus[key] = { status: "done" };
    delete window[`temp_${type}_${code}`];
    loadData();
  };

  xhr.onerror = function () {
    uploadStatus[key] = { status: "error" };
    applyFilters();
  };

  xhr.open("POST", "/data/upload");
  xhr.send(form);
}

/* =========================
   DELETE (FAST)
========================= */
function deleteFile(code, type) {

  if (!confirm("Delete file?")) return;

  fetch(`/data/delete/${code}/${type}`, { method: "DELETE" });
  loadData();
}

/* =========================
   OTHER
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