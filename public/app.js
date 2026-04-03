async function loadData() {

  // ❌ REMOVE SEARCH DEPENDENCY (FIX)
  const search = "";

  const res = await fetch("/data/list");
  const data = await res.json();

  let html = "";

  let awsDone = 0, awsPending = 0, sssDone = 0, sssPending = 0;

  data.forEach(row => {

    // ✅ SAFE MAPPING (ALL FORMATS)
    const division = row.division || row.Division || row.DIVISION || "";
    const state = row.state || row.State || row.STATE || "";
    const bmhq = row.bmhq || row["BM HQ"] || row["BM HQ "] || "";
    const code = row.code || row.Code || row.CODE || "";
    const name = row.name || row.Name || row.NAME || "";

    if (search && !name.toLowerCase().includes(search)) return;

    if (row.awsFile) awsDone++; else awsPending++;
    if (row.sssFile) sssDone++; else sssPending++;

    html += `
      <tr>
        <td>${division}</td>
        <td>${state}</td>
        <td>${bmhq}</td>
        <td>${code}</td>
        <td>${name}</td>

        <td>
          <input placeholder="Enter value">
        </td>

        <td>
          ${row.awsFile
            ? `<button class="view" onclick="viewFile('${row.awsFile}')">View</button>
               ${isAdmin() ? `<button class="delete" onclick="deleteFile('${code}','aws')">Delete</button>` : ""}`
            : `<button class="upload" onclick="upload('${code}','aws')">Upload AWS</button>`
          }
        </td>

        <td>
          ${row.sssFile
            ? `<button class="view" onclick="viewFile('${row.sssFile}')">View</button>
               ${isAdmin() ? `<button class="delete" onclick="deleteFile('${code}','sss')">Delete</button>` : ""}`
            : `<button class="upload" onclick="upload('${code}','sss')">Upload SSS</button>`
          }
        </td>
      </tr>
    `;
  });

  document.getElementById("tableData").innerHTML = html;

  document.getElementById("awsDone").innerText = awsDone;
  document.getElementById("awsPending").innerText = awsPending;
  document.getElementById("sssDone").innerText = sssDone;
  document.getElementById("sssPending").innerText = sssPending;
  document.getElementById("total").innerText = data.length;
}

/* =========================
   UPLOAD
========================= */
function upload(code, type) {
  const input = document.createElement("input");
  input.type = "file";

  input.onchange = async () => {
    const form = new FormData();
    form.append("file", input.files[0]);
    form.append("code", code);
    form.append("type", type);

    await fetch("/data/upload", { method: "POST", body: form });

    loadData();
  };

  input.click();
}

/* =========================
   VIEW
========================= */
function viewFile(url) {
  window.open(url);
}

/* =========================
   DELETE
========================= */
function deleteFile(code, type) {
  fetch(`/data/delete/${code}/${type}`, { method: "DELETE" });
  loadData();
}

/* =========================
   ROLE CHECK
========================= */
function isAdmin() {
  return localStorage.getItem("role") === "admin";
}

/* =========================
   DOWNLOAD
========================= */
function downloadExcel() {
  window.open("/data/download/excel");
}

/* =========================
   LOGOUT
========================= */
function logout() {
  localStorage.clear();
  window.location = "/";
}

/* INIT */
window.onload = loadData;