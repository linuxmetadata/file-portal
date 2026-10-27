"use strict";
const token=localStorage.getItem("token")||"", role=(localStorage.getItem("role")||"").trim().toLowerCase(), user=localStorage.getItem("user")||"";
const body=document.getElementById("statementTableBody"), search=document.getElementById("searchInput"), typeFilter=document.getElementById("typeFilter"), selectAll=document.getElementById("selectAllCheckbox"), zipButton=document.getElementById("downloadZipButton"), countLabel=document.getElementById("statementCount");
let statements=[],visible=[],selected=new Set();
function status(msg,error=false){const el=document.getElementById("statusMessage");el.textContent=msg;el.classList.toggle("error",error);el.style.display="block"}
function clearStatus(){const el=document.getElementById("statusMessage");el.textContent="";el.style.display="none";el.classList.remove("error")}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function headers(extra={}){return {...extra,Authorization:`Bearer ${token}`}}
function dateText(v){if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString()}
function render(){const q=search.value.trim().toLowerCase(),t=typeFilter.value;visible=statements.filter(f=>(!t||String(f.statement_type).toUpperCase()===t)&&[f.division,f.state,f.code,f.original_filename,f.uploaded_by].some(v=>String(v??"").toLowerCase().includes(q)));
body.innerHTML=visible.length?visible.map(f=>{const id=String(f.file_id),isSss=String(f.statement_type).toUpperCase()==="SSS";return `<tr><td><input class="statement-checkbox" type="checkbox" value="${esc(id)}" ${selected.has(id)?"checked":""}></td><td><span class="type-pill ${isSss?"sss":""}">${esc(f.statement_type)}</span></td><td>${esc(f.division)}</td><td>${esc(f.state)}</td><td>${esc(f.code)}</td><td>${esc(f.original_filename)}</td><td>${esc(f.uploaded_by||"—")}</td><td>${esc(dateText(f.uploaded_at))}</td><td><button class="download-one" data-download-id="${esc(id)}" type="button">Download</button></td></tr>`}).join(""):'<tr><td colspan="9" class="empty">No statements match the current filters.</td></tr>';
const n=visible.filter(f=>selected.has(String(f.file_id))).length;selectAll.checked=visible.length>0&&n===visible.length;selectAll.indeterminate=n>0&&n<visible.length;countLabel.textContent=`${visible.length} statement(s) shown · ${selected.size} selected`;zipButton.disabled=!selected.size;if(window.lucide)window.lucide.createIcons()}
async function load(){if(!token){location.replace("/index.html");return}if(role&&role!=="admin"){document.querySelector(".reports-main").innerHTML='<section class="report-panel"><h1>Admin access required</h1><a href="/overview.html">Return to Overview</a></section>';return}
try{const r=await fetch("/data/reports/files",{headers:headers()});if(r.status===401||r.status===403){document.querySelector(".reports-main").innerHTML='<section class="report-panel"><h1>Admin access required</h1><p>Your account cannot access Reports.</p><a href="/overview.html">Return to Overview</a></section>';return}if(!r.ok)throw Error(`Request failed (${r.status})`);const data=await r.json();if(!Array.isArray(data))throw Error("Unexpected statement list response");statements=data;render()}catch(e){console.error(e);status("Unable to load statements. Check your connection and try Refresh.",true)}}
async function download(url,fallback){const r=await fetch(url,{headers:headers()});if(!r.ok){let m=`Download failed (${r.status}).`;try{m=(await r.json()).error||m}catch{}throw Error(m)}const blob=await r.blob(),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=fallback;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u)}
body.addEventListener("change",e=>{if(!e.target.classList.contains("statement-checkbox"))return;e.target.checked?selected.add(e.target.value):selected.delete(e.target.value);render()});
body.addEventListener("click",async e=>{const b=e.target.closest("[data-download-id]");if(!b)return;clearStatus();const f=statements.find(x=>String(x.file_id)===b.dataset.downloadId);try{await download(`/data/reports/download/${encodeURIComponent(b.dataset.downloadId)}`,f?.original_filename||"statement")}catch(err){status(err.message,true)}});
search.addEventListener("input",render);typeFilter.addEventListener("change",render);selectAll.addEventListener("change",()=>{visible.forEach(f=>selectAll.checked?selected.add(String(f.file_id)):selected.delete(String(f.file_id)));render()});
document.getElementById("selectVisibleButton").addEventListener("click",()=>{visible.forEach(f=>selected.add(String(f.file_id)));render()});document.getElementById("clearSelectionButton").addEventListener("click",()=>{selected.clear();render()});
zipButton.addEventListener("click",async()=>{clearStatus();zipButton.disabled=true;try{const r=await fetch("/data/reports/download-zip",{method:"POST",headers:headers({"Content-Type":"application/json"}),body:JSON.stringify({fileIds:[...selected]})});if(!r.ok){let m=`ZIP download failed (${r.status}).`;try{m=(await r.json()).error||m}catch{}throw Error(m)}const blob=await r.blob(),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="Selected_Statements.zip";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);status("ZIP download started.")}catch(e){status(e.message,true)}finally{zipButton.disabled=!selected.size}});


document.querySelectorAll(".master-download").forEach(b =>
  b.addEventListener("click", async () => {
    clearStatus();
    b.disabled = true;

    const masterKey = b.dataset.master;

    const downloads = {
      excel: [
        {
          key: "excel",
          filename: "EXCEL_Master_Extraction.xlsx"
        },
        {
          key: "excel-invalid",
          filename: "INVALID_EXCEL_Master_Extraction.xlsx"
        }
      ],

      txt: [
        {
          key: "txt",
          filename: "TXT_Master_Extraction.xlsx"
        },
        {
          key: "txt-invalid",
          filename: "INVALID_TXT_Master_Extraction.xlsx"
        }
      ],

            "sss-matched": [
        {
          key: "sss-matched",
          filename: "SSS_Matched_Master_Extraction.xlsx"
        },
        {
          key: "sss-matched-invalid",
          filename: "INVALID_SSS_Matched_Master_Extraction.xlsx"
        }
      ],

      "txt-matched": [
        {
          key: "txt-matched",
          filename: "TXT_Matched_Master_Extraction.xlsx"
        },
        {
          key: "txt-matched-invalid",
          filename: "INVALID_TXT_Matched_Master_Extraction.xlsx"
        }
      ]
    };

    try {
      const files = downloads[masterKey];

      if (!files) {
        throw new Error("Unknown master download.");
      }

      for (const file of files) {
        await download(
          `/data/reports/master/${encodeURIComponent(file.key)}`,
          file.filename
        );
      }

      status("Regular and Invalid master downloads started.");
    } catch (e) {
      status(e.message, true);
    } finally {
      b.disabled = false;
    }
  })
);




/* Delete all extraction masters or all uploaded statements */
async function deleteAllRecords(button, endpoint, confirmation) {
  if (role !== "admin") {
    status("Admin access required.", true);
    return;
  }

  if (!window.confirm(confirmation)) {
    return;
  }

  clearStatus();
  button.disabled = true;

  try {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: headers()
    });

    let result = {};
    try {
      result = await response.json();
    } catch {
      throw new Error(`Delete request failed (${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(
        result.error || `Delete request failed (${response.status}).`
      );
    }

    status(
      `${result.message || "Deletion completed."} ` +
      `Deleted: ${result.deletedCount ?? 0} record(s).`
    );

    // Refresh the statement list only after deleting statements.
    if (endpoint === "/data/reports/statements") {
      selected.clear();
      await load();
    }
  } catch (err) {
    status(err.message || "Deletion failed.", true);
  } finally {
    button.disabled = false;
  }
}


const deleteMastersButton = document.getElementById(
  "deleteAllExtractionMastersButton"
);

if (!deleteMastersButton) {
  console.error(
    'Extraction master delete button not found. Check reports.html for id="deleteAllExtractionMastersButton".'
  );
} else {
  deleteMastersButton.addEventListener("click", async () => {
    await deleteAllRecords(
      deleteMastersButton,
      "/data/reports/masters",
      "Permanently delete ALL extraction master records? This cannot be undone."
    );
  });
}


const deleteStatementsButton = document.getElementById(
  "deleteAllStatementsButton"
);

if (deleteStatementsButton) {
  deleteStatementsButton.addEventListener("click", () => {
    deleteAllRecords(
      deleteStatementsButton,
      "/data/reports/statements",
      "Permanently delete ALL uploaded statement records? Extraction masters and stockist records will be preserved."
    );
  });
}


/* Download all regular or invalid statements as separate ZIP files */
async function downloadAllStatementsZip(category, button) {
  clearStatus();
  button.disabled = true;

  const downloads = {
    regular: {
      url: "/data/reports/download-all-regular-zip",
      filename: "ALL Division Statements.zip"
    },
    invalid: {
      url: "/data/reports/download-all-invalid-zip",
      filename: "ALL Division Invalid Statements.zip"
    }
  };

  try {
    const item = downloads[category];

    if (!item) {
      throw new Error("Unknown ZIP download category.");
    }

    await download(item.url, item.filename);
    status("ZIP download started.");
  } catch (err) {
    status(err.message, true);
  } finally {
    button.disabled = false;
  }
}

document
  .getElementById("downloadAllRegularZipButton")
  .addEventListener("click", function () {
    downloadAllStatementsZip("regular", this);
  });

document
  .getElementById("downloadAllInvalidZipButton")
  .addEventListener("click", function () {
    downloadAllStatementsZip("invalid", this);
  });

document.getElementById("refreshButton").addEventListener("click",()=>{clearStatus();load()});document.getElementById("logoutButton").addEventListener("click",()=>{["token","user","role"].forEach(k=>localStorage.removeItem(k));location.href="/index.html"});
document.getElementById("signedInUser").textContent=user||"Administrator";document.getElementById("userInitial").textContent=(user.trim().charAt(0)||"A").toUpperCase();if(window.lucide)window.lucide.createIcons();load();
