
// ========== UI MODE TOGGLE SCRIPT ==========

const toggleBtn = document.getElementById("uiModeToggle");
const desktopModernCSS = document.getElementById("desktopModernStylesheet");
const mobileModernCSS = document.getElementById("mobileModernStylesheet");
const fantasyCSS = document.getElementById("fantasyStylesheet");
const fantasyMobileCSS = document.getElementById("fantasyMobileStylesheet");

function applyUIMode(mode) {
  const isFantasy = mode === "fantasy";

  // Enable/disable all 4 modes
  if (desktopModernCSS) desktopModernCSS.disabled = isFantasy;
  if (mobileModernCSS) mobileModernCSS.disabled = isFantasy;
  if (fantasyCSS) fantasyCSS.disabled = !isFantasy;
  if (fantasyMobileCSS) fantasyMobileCSS.disabled = !isFantasy;

  // Update button label
  if (toggleBtn) {
    toggleBtn.textContent = isFantasy ? "Modern Mode" : "Fantasy Mode";
  }

  // Save preference
  localStorage.setItem("uiMode", mode);
}

// Initial load — restore mode or default to modern
const savedMode = localStorage.getItem("uiMode") || "modern";
applyUIMode(savedMode);

// Hook up toggle button
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    const currentMode = localStorage.getItem("uiMode") || "modern";
    const newMode = currentMode === "fantasy" ? "modern" : "fantasy";
    applyUIMode(newMode);
  });
}
