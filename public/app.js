let fullData = [];
let activeCardFilter = null;

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

    const division = row.division || row.Division || row.DIVISION || "";
    const state = row.state || row.State || row.STATE || "";
    const bmhq = row.bmhq || row["BM HQ"] || row["BM HQ "] || "";
    const code = row.code || row.Code || row.CODE || "";
    const name = row.name || row.Name || row.NAME || "";

    html += `
      <tr>
        <td>${division}</td>
        <td>${state}</td>
        <td>${bmhq}</td>
        <td>${code}</td>
        <td>${name}</td>

        <!-- SALES -->
        <td>
          <input 
            id="sales_${code}" 
            placeholder="Enter value"
            value="${row.sales || ""}"
            ${(!isAdmin() && (row.awsFile || row.sssFile)) ? "disabled" : ""}
          >
        </td>

        <!-- AWS -->
        <td>${getUploadUI(row, code, "aws")}</td>

        <!-- SSS -->
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

  const fileKey = type === "aws" ? row.awsFile : row.sssFile;

  if (fileKey) {
    return `
      <button class="view" onclick="viewFile('${fileKey}')">View</button>
      ${isAdmin() ? `<button class="delete" onclick="deleteFile('${code}','${type}')">Delete</button>` : ""}
    `;
  }

  if (window[`temp_${type}_${code}`]) {
    return `
      <button class="view" onclick="previewFile('${type}','${code}')">View</button>
      <button class="upload" onclick="submitFile('${code}','${type}')">Submit</button>
    `;
  }

  return `<button class="upload" onclick="chooseFile('${code}','${type}')">Upload ${type.toUpperCase()}</button>`;
}

/* =========================
   CHOOSE FILE (FINAL FIX)
========================= */
function chooseFile(code, type) {

  const salesInput = document.getElementById(`sales_${code}`);
  const row = fullData.find(r => r.code == code);

  // 🔴 USER RULES
  if (!isAdmin()) {

    if (!salesInput.value) {
      alert("Sales is mandatory before upload");
      return;
    }

    // ❌ block second upload
    if (row.awsFile || row.sssFile) {
      alert("Already uploaded. Cannot upload another type.");
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
   PREVIEW
========================= */
function previewFile(type, code) {
  const file = window[`temp_${type}_${code}`];
  const url = URL.createObjectURL(file);
  window.open(url);
}

/* =========================
   SUBMIT
========================= */
async function submitFile(code, type) {

  const file = window[`temp_${type}_${code}`];
  if (!file) return;

  const salesValue = document.getElementById(`sales_${code}`).value;

  const form = new FormData();
  form.append("file", file);
  form.append("code", code);
  form.append("type", type);
  form.append("sales", salesValue);

  await fetch("/data/upload", {
    method: "POST",
    body: form
  });

  delete window[`temp_${type}_${code}`];
  loadData();
}

/* =========================
   CARDS
========================= */
function updateCards(data) {

  let awsDone = 0, awsPending = 0, sssDone = 0, sssPending = 0;

  data.forEach(row => {
    if (row.awsFile) awsDone++; else awsPending++;
    if (row.sssFile) sssDone++; else sssPending++;
  });

  const total = data.length || 1;

  document.getElementById("awsDone").innerText =
    `${awsDone} (${Math.round((awsDone/total)*100)}%)`;

  document.getElementById("awsPending").innerText =
    `${awsPending} (${Math.round((awsPending/total)*100)}%)`;

  document.getElementById("sssDone").innerText =
    `${sssDone} (${Math.round((sssDone/total)*100)}%)`;

  document.getElementById("sssPending").innerText =
    `${sssPending} (${Math.round((sssPending/total)*100)}%)`;

  document.getElementById("total").innerText = data.length;
}

/* =========================
   OTHER
========================= */
function filterByCard(type) {
  activeCardFilter = type;
  applyFilters();
}

function clearFilters() {
  activeCardFilter = null;

  ["f_division","f_state","f_bmhq","f_code","f_name"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  applyFilters();
}

function viewFile(url) {
  window.open(url);
}

function deleteFile(code, type) {
  fetch(`/data/delete/${code}/${type}`, { method: "DELETE" });
  loadData();
}

function isAdmin() {
  return localStorage.getItem("role") === "admin";
}

function downloadExcel() {
  window.open("/data/download/excel");
}

function logout() {
  localStorage.clear();
  window.location = "/";
}

/* INIT */
window.onload = loadData;