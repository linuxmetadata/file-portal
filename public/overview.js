const hasFile = value => String(value ?? "").trim() !== "";
function numericValue(value){if(typeof value==="number")return value;const cleaned=String(value??"").replace(/[,₹\\s]/g,"");return cleaned?Number(cleaned):NaN}
function setCount(id,value){const el=document.getElementById(id);if(el)el.textContent=String(value)}
function showStatus(message){const el=document.getElementById("statusMessage");if(el){el.textContent=message;el.style.display="block"}}
function renderOverview(rows){
  const awsSubmitted=rows.filter(r=>hasFile(r.awsFile)).length;
  const sssSubmitted=rows.filter(r=>hasFile(r.sssFile)).length;
  const awsPending=rows.length-awsSubmitted;
  const sssPending=rows.length-sssSubmitted;
  const zeroSale=rows.filter(r=>{const n=numericValue(r.sales);return Number.isFinite(n)&&n===0}).length;
  // Currently "No AWS" means no AWS file exists; this is not a separate "not applicable" status.
  const noAws=rows.filter(r=>!hasFile(r.awsFile)).length;
  setCount("awsPendingCount",awsPending);setCount("awsSubmittedCount",awsSubmitted);
  setCount("sssPendingCount",sssPending);setCount("sssSubmittedCount",sssSubmitted);
  setCount("zeroSaleCount",zeroSale);setCount("noAwsCount",noAws);
}
async function loadOverview(){
  const token=localStorage.getItem("token")||"",user=localStorage.getItem("user")||"",role=localStorage.getItem("role")||"";
  document.getElementById("signedInUser").textContent=user||(role==="admin"?"Administrator":"Portal User");
  document.getElementById("userInitial").textContent=((user||(role==="admin"?"A":"U")).trim().charAt(0)||"U").toUpperCase();
  document.getElementById("roleChip").textContent=role||"Portal";
  if(!token){window.location.href="/index.html";return}
  try{
    const response=await fetch("/data/list",{headers:{Authorization:`Bearer ${token}`}});
    if(!response.ok)throw new Error(`Request failed (${response.status})`);
    const rows=await response.json();if(!Array.isArray(rows))throw new Error("Unexpected response from /data/list");
    renderOverview(rows);
  }catch(error){
    console.error("OVERVIEW LOAD ERROR:",error);
    ["awsPendingCount","awsSubmittedCount","sssPendingCount","sssSubmittedCount","zeroSaleCount","noAwsCount"].forEach(id=>setCount(id,"—"));
    showStatus("Unable to load overview counts. Please refresh or open Upload Statements to continue.");
  }
}
document.getElementById("logoutButton").addEventListener("click",()=>{localStorage.removeItem("token");localStorage.removeItem("user");localStorage.removeItem("role");window.location.href="/index.html"});
document.querySelectorAll(".summary-card").forEach(card=>card.addEventListener("click",()=>{window.location.href="/dashboard.html"}));
if(window.lucide)window.lucide.createIcons();
loadOverview();
