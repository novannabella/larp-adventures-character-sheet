// ---------- PARCHMENT & TITLE IMAGES FOR PDF ----------
let parchmentImg = null;
let titleImg = null;

// preload parchment.jpg
(function preloadParchment() {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = "parchment.jpg";

  img.onload = function () {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    parchmentImg = canvas.toDataURL("image/jpeg");
  };
})();

// preload la_title.png
(function preloadTitle() {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = "la_title.png";

  img.onload = function () {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    titleImg = canvas.toDataURL("image/png");
  };
})();

function drawParchmentBackground(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  if (parchmentImg) {
    doc.addImage(parchmentImg, "JPEG", 0, 0, pageWidth, pageHeight);
  } else {
    doc.setFillColor(245, 233, 210);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
  }
}

// ---------- PDF EXPORT ----------
function exportCharacterPDF() {
  let jsPDFConstructor = null;

  if (window.jspdf) {
    if (typeof window.jspdf.jsPDF === "function") {
      jsPDFConstructor = window.jspdf.jsPDF;
    } else if (typeof window.jspdf.default === "function") {
      jsPDFConstructor = window.jspdf.default;
    }
  }

  if (!jsPDFConstructor && typeof window.jsPDF === "function") {
    jsPDFConstructor = window.jsPDF;
  }

  if (!jsPDFConstructor) {
    alert(
      "PDF library (jsPDF) not loaded. Try a hard refresh (Ctrl+F5 or Cmd+Shift+R) and make sure the jsPDF <script> tag is still in index.html."
    );
    return;
  }

  const doc = new jsPDFConstructor({ unit: "pt", format: "letter" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  drawParchmentBackground(doc);

  const margin = 40;
  let y = margin;

  // Grab everything directly from the DOM
  const charName =
    document.getElementById("characterName")?.value.trim() || "";
  const playerName =
    document.getElementById("playerName")?.value.trim() || "";
  const path = document.getElementById("pathDisplay")?.value || "";
  const faction = document.getElementById("faction")?.value || "";
  const secondaryPaths =
    document.getElementById("secondaryPathsDisplay")?.value || "";
  const professions =
    document.getElementById("professionsDisplay")?.value || "";
  const tier = document.getElementById("tier")?.value || "0";
  const remainingSP =
    document.getElementById("totalSkillPoints")?.value || "0";

  let organizations = "";
  if (typeof getOrganizations === "function") {
    organizations = getOrganizations().join(", ");
  } else {
    const orgContainer = document.getElementById("organizationsContainer");
    if (orgContainer) {
      organizations = Array.from(
        orgContainer.querySelectorAll('input[type="checkbox"]:checked')
      )
        .map((cb) => cb.value)
        .join(", ");
    }
  }

  // ---------- HEADER: TITLE + PLAYER ----------
  let titleBottomY;

  if (titleImg) {
    // Image title
    const imgRatio = 158 / 684;
    const maxWidth = Math.min(400, pageWidth - margin * 2);
    const titleWidth = maxWidth;
    const titleHeight = titleWidth * imgRatio;
    const x = margin;

    doc.addImage(titleImg, "PNG", x, y, titleWidth, titleHeight);
    titleBottomY = y + titleHeight;

    // Player on the right, aligned near the bottom of the image
    const playerLabel =
      playerName && playerName.trim().length > 0
        ? `Player: ${playerName}`
        : "Player:";
    doc.setFont("Times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    const playerLabelWidth = doc.getTextWidth(playerLabel);
    const playerY = titleBottomY - 8; // a bit above the bottom of the image

    doc.text(playerLabel, pageWidth - margin - playerLabelWidth, playerY);

    y = titleBottomY + 10;
  } else {
    // Text title fallback
    doc.setFont("Times", "bold");
    doc.setFontSize(24);
    doc.setTextColor(0, 0, 0);
    doc.text("Larp Adventures", margin, y);

    const sheetY = y + 18;
    doc.setFontSize(16);
    doc.setFont("Times", "bold");
    doc.text("Character Sheet", margin, sheetY);

    // Player to the right on the same baseline as "Character Sheet"
    const playerLabel =
      playerName && playerName.trim().length > 0
        ? `Player: ${playerName}`
        : "Player:";
    doc.setFontSize(14);
    const playerLabelWidth = doc.getTextWidth(playerLabel);
    doc.text(playerLabel, pageWidth - margin - playerLabelWidth, sheetY);

    titleBottomY = sheetY;
    y = sheetY + 20;
  }

  // Separator under title/player line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.7);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // ---------- BASIC INFO + MILESTONES LAYOUT ----------
  // Precompute widths so we can place headings *above* the boxes
  const totalInfoWidth = pageWidth - margin * 2;
  const basicBoxWidth = totalInfoWidth * 0.7; // 70% for basic info
  const milestonesWidth = totalInfoWidth - basicBoxWidth - 16; // gap of 16
  const basicBoxX = margin;
  const milestonesBoxX = basicBoxX + basicBoxWidth + 16;

  // Headings above boxes
  const labelsY = y;
  doc.setFont("Times", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text("Basic Information", basicBoxX, labelsY);
  doc.text("Milestones:", milestonesBoxX, labelsY);

  // Now place the boxes a bit below the headings
  y = labelsY + 10;

  const basicBoxTop = y;
  const basicBoxHeight = 78; // tightened a bit vs previous 90
  const milestonesBoxTop = y;
  const milestonesBoxHeight = basicBoxHeight;

  // Basic box border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.roundedRect(
    basicBoxX - 4,
    basicBoxTop,
    basicBoxWidth + 8,
    basicBoxHeight,
    6,
    6
  );

  const colLeftX = basicBoxX;
  const colRightX = basicBoxX + basicBoxWidth / 2 + 4;
  let infoY = basicBoxTop + 14; // top padding inside box

  doc.setFont("Times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);

  // Helper that can wrap Organizations
  function labelValue(label, value, x, yLine) {
    const labelText = `${label}:`;

    if (label === "Organizations") {
      doc.setFont("Times", "bold");
      doc.setFontSize(13);
      doc.text(labelText, x, yLine);

      const labelWidth = doc.getTextWidth(labelText);
      const valueX = x + labelWidth + 6;

      const maxValueWidth = basicBoxX + basicBoxWidth - valueX - 8;

      doc.setFontSize(11);
      const lines = doc.splitTextToSize(value || "-", maxValueWidth);
      doc.text(lines, valueX, yLine);
      return;
    }

    doc.setFont("Times", "bold");
    doc.setFontSize(13);
    doc.text(labelText, x, yLine);

    const labelWidth = doc.getTextWidth(labelText);
    const valueX = x + labelWidth + 6;

    doc.setFontSize(11);
    doc.text(value || "-", valueX, yLine);
  }

  labelValue("Character", charName, colLeftX, infoY);
  labelValue("Secondary", secondaryPaths, colRightX, infoY);

  labelValue("Faction", faction, colLeftX, infoY + 16);
  labelValue("Professions", professions, colRightX, infoY + 16);

  labelValue("Path", path, colLeftX, infoY + 32);
  labelValue("Organizations", organizations, colRightX, infoY + 32);

  labelValue("Tier", tier, colLeftX, infoY + 48);
  labelValue("Skill Pts", remainingSP, colRightX, infoY + 48);

  // Milestones box to the right
  doc.roundedRect(
    milestonesBoxX,
    milestonesBoxTop,
    milestonesWidth,
    milestonesBoxHeight,
    6,
    6
  );

  // Milestone checkboxes
  const artificerMilestone2Checkbox = document.getElementById(
    "artificerMilestone2"
  );
  const artificerMilestone3Checkbox = document.getElementById(
    "artificerMilestone3"
  );
  const bardMilestone2Checkbox = document.getElementById("bardMilestone2");
  const bardMilestone3Checkbox = document.getElementById("bardMilestone3");
  const scholarMilestone2Checkbox = document.getElementById("scholarMilestone2");
  const scholarMilestone3Checkbox = document.getElementById("scholarMilestone3");

  function isMilestoneChecked(pathName, level) {
    if (pathName === "Artificer") {
      if (level === 2) return !!(artificerMilestone2Checkbox?.checked);
      if (level === 3) return !!(artificerMilestone3Checkbox?.checked);
    } else if (pathName === "Bard") {
      if (level === 2) return !!(bardMilestone2Checkbox?.checked);
      if (level === 3) return !!(bardMilestone3Checkbox?.checked);
    } else if (pathName === "Scholar") {
      if (level === 2) return !!(scholarMilestone2Checkbox?.checked);
      if (level === 3) return !!(scholarMilestone3Checkbox?.checked);
    }
    return false;
  }

  const milestonePaths = ["Artificer", "Bard", "Scholar"];

  // reduce fonts inside milestone box by 2 points
  doc.setFont("Times", "bold");
  doc.setFontSize(10); // was 12

  const innerX = milestonesBoxX + 6;
  const innerTopY = milestonesBoxTop + 6; // padding inside box
  const colCount = 3;
  const colWidth = (milestonesWidth - 12) / colCount;
  const squareSize = 10;
  const rowOffset = 8;

  milestonePaths.forEach((p, idx) => {
    const startX = innerX + idx * colWidth;
    const labelY = innerTopY + 10;

    doc.text(`${p}:`, startX, labelY);

    const box2Y = labelY + rowOffset;
    const box2X = startX;
    doc.rect(box2X, box2Y, squareSize, squareSize);
    if (isMilestoneChecked(p, 2)) {
      doc.text("X", box2X + 3, box2Y + 8);
    }
    doc.setFontSize(9); // label for "2"
    doc.text("2", box2X + squareSize + 4, box2Y + 8);

    const box3Y = box2Y + squareSize + 4;
    const box3X = startX;
    doc.rect(box3X, box3Y, squareSize, squareSize);
    if (isMilestoneChecked(p, 3)) {
      doc.text("X", box3X + 3, box3Y + 8);
    }
    doc.text("3", box3X + squareSize + 4, box3Y + 8);

    doc.setFontSize(10); // restore for next path label
  });

  const boxesBottom = basicBoxTop + basicBoxHeight;
  y = boxesBottom + 24;

  // ---------- SKILLS TABLE ----------
  doc.setFont("Times", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text("Skills", margin, y);
  y += 10;

  const tableWidth = pageWidth - margin * 2;
  const headerHeight = 28; // slightly taller so text sits fully inside

  // Table header background
  doc.setFillColor(60, 40, 20);
  doc.setDrawColor(60, 40, 20);
  doc.rect(margin, y, tableWidth, headerHeight, "F");

  doc.setFont("Times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);

  const colTierX = margin + 6;
  const colPathX = margin + 60;
  const colSkillX = margin + 140;
  const colUsesX = margin + tableWidth * 0.65;

  doc.text("Tier", colTierX, y + 16);

  // More spacing between "Path /" and "Profession"
  doc.text("Path /", colPathX, y + 12);
  doc.text("Profession", colPathX, y + 26);

  doc.text("Skill Name", colSkillX, y + 16);
  doc.text("Uses", colUsesX, y + 16);

  y += headerHeight + 4;

  doc.setFont("Times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);

  const sorted =
    typeof getSortedSelectedSkills === "function"
      ? getSortedSelectedSkills()
      : [];
  const rowLineHeight = 14;

  sorted.forEach((sk) => {
    if (y > pageHeight - margin - 60) {
      doc.addPage();
      drawParchmentBackground(doc);

      y = margin;

      doc.setFont("Times", "bold");
      doc.setFontSize(15);
      doc.setTextColor(0, 0, 0);
      doc.text("Skills (continued)", margin, y);
      y += 10;

      doc.setFillColor(60, 40, 20);
      doc.setDrawColor(60, 40, 20);
      doc.rect(margin, y, tableWidth, headerHeight, "F");

      doc.setFont("Times", "bold");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text("Tier", colTierX, y + 16);
      doc.text("Path /", colPathX, y + 12);
      doc.text("Profession", colPathX, y + 26);
      doc.text("Skill Name", colSkillX, y + 16);
      doc.text("Uses", colUsesX, y + 16);

      y += headerHeight + 4;
      doc.setFont("Times", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);
    }

    const rowTop = y;
    const textBaseline = rowTop + 12;

    // Tier
    doc.text(String(sk.tier), colTierX, textBaseline);

    // Path
    doc.text(sk.path, colPathX, textBaseline);

    // Uses (computed from CSV meta)
    let usesDisplay = "—";
    if (
      typeof computeSkillUses === "function" &&
      typeof skillsByPath !== "undefined"
    ) {
      const metaSkillList = skillsByPath[sk.path] || [];
      const metaSkill = metaSkillList.find((s) => s.name === sk.name);
      if (metaSkill) {
        const usesInfo = computeSkillUses(metaSkill);
        if (usesInfo) {
          if (usesInfo.numeric === Infinity) {
            usesDisplay = "Unlimited";
          } else if (usesInfo.display) {
            usesDisplay = usesInfo.display;
          } else if (usesInfo.periodicity) {
            usesDisplay = usesInfo.periodicity;
          }
        }
      }
    }

    const skillLine = sk.name;
    const maxSkillWidth = colUsesX - colSkillX - 10;
    const skillLines = doc.splitTextToSize(skillLine, maxSkillWidth);

    const maxUsesWidth = pageWidth - margin - colUsesX;
    const usesLines = doc.splitTextToSize(usesDisplay, maxUsesWidth);

    doc.text(skillLines, colSkillX, textBaseline);
    doc.text(usesLines, colUsesX, textBaseline);

    const rowLines = Math.max(skillLines.length, usesLines.length);
    const rowTextHeight = rowLineHeight * rowLines;

    const lineY = rowTop + rowTextHeight + 4;
    doc.line(margin, lineY, margin + tableWidth, lineY);

    y = lineY + 6;
  });

  let suggestedName = charName ? charName : "larp_character";
  let baseName = prompt("Enter a name for the exported PDF:", suggestedName);
  if (!baseName) {
    return;
  }
  baseName = baseName.replace(/[^a-z0-9_\-]+/gi, "_");

  doc.save(baseName + "_sheet.pdf");
}

// expose globally so script.js can hook the button
window.exportCharacterPDF = exportCharacterPDF;
