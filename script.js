
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("uiModeToggle");
  const defaultMode = localStorage.getItem("uiMode") || "modern";

  function isMobileView() {
    return window.innerWidth <= 700;
  }

  function getStylesheetPath(mode, isMobile) {
    const base = mode === "fantasy" ? "styles-fantasy" : "styles";
    return isMobile ? `${base}-mobile.css` : `${base}-desktop.css`;
  }

  function applyUIMode(mode) {
    const isMobile = isMobileView();
    const stylesheetPath = getStylesheetPath(mode, isMobile);

    // Remove all style links for theme handling
    document.querySelectorAll("link[rel=stylesheet]").forEach(link => {
      const href = link.getAttribute("href");
      if (href && (
        href.includes("styles-desktop.css") ||
        href.includes("styles-mobile.css") ||
        href.includes("styles-fantasy.css") ||
        href.includes("styles-fantasy-mobile.css")
      )) {
        link.remove();
      }
    });

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = stylesheetPath;
    document.head.appendChild(link);

    localStorage.setItem("uiMode", mode);
    if (toggleBtn) {
      toggleBtn.textContent = mode === "fantasy" ? "Switch to Modern" : "Switch to Fantasy";
    }
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const current = localStorage.getItem("uiMode") || "modern";
      const newMode = current === "fantasy" ? "modern" : "fantasy";
      applyUIMode(newMode);
    });
  }

  applyUIMode(defaultMode);
});
