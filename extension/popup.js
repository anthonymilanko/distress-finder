// Popup: show current settings and link to the options page.
chrome.storage.sync.get(["dfAppUrl", "dfToken"]).then(({ dfAppUrl, dfToken }) => {
  document.getElementById("url").textContent = dfAppUrl || "http://localhost:3000 (default)";
  document.getElementById("tok").textContent = dfToken ? "set" : "NOT set";
});
document.getElementById("opt").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
