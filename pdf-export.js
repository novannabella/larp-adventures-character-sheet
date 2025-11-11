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

// Helper: compute display string for uses
function getUsesDisplayForSkill(sk) {
  if (
    typeof computeSkillUses !== "function" ||
    typeof skillsByPath === "undefined"
  ) {
    return "—";
  }
  const metaSkillList = skillsByPath[sk.path] || [];
  const metaSkill = metaSkillList.find((s) => s.name === sk.name);
  if (!metaSkill) return "—";

  const usesInfo = computeSkillUses(metaSkill);
  if (!usesInfo) return "—";

  if (usesInfo.numeric === Infinity) return "Unlimited";
  if (usesInfo.display) return usesInfo.display;
  if (usesInfo.periodicity) return usesInfo.periodicity;
  return "—";
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

  // Export options
  const fullSkillInfo =
    document.getElementById("fullSkillInfoCheckbox")?.checked || false;
  const includeEvents =
    document.getElementById("eventSummaryCheckbox")?.checked || false;

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
    const titleWidth = maxWidth * 0.8; // 80%
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
    const playerY = titleBottomY - 8;

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
  // Milestones label is inside the box now

  // Now place the boxes a bit below the headings
  y = labelsY + 10;

  const basicBoxTop = y;
  const basicBoxHeight = 85; // tightened
  const milestonesBoxTop = y;
  const milestonesBoxHeight = 85; // tightened

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

  function labelValue(label, value, x, yLine) {
    const labelText = `${label}:`;

    doc.setFont("Times", "bold");
    doc.setFontSize(13);
    doc.text(labelText, x, yLine);

    const labelWidth = doc.getTextWidth(labelText);
    const valueX = x + labelWidth + 6;

    doc.setFont("Times", "normal");
    doc.setFontSize(11);
    doc.text(value || "-", valueX, yLine);
  }

  // Row 1: Character | Secondary
  labelValue("Character", charName, colLeftX, infoY);
  labelValue("Secondary", secondaryPaths, colRightX, infoY);

  // Row 2: Faction | Professions
  labelValue("Faction", faction, colLeftX, infoY + 16);
  labelValue("Professions", professions, colRightX, infoY + 16);

  // Row 3: Path (left) and Tier / Skill Pts (right)
  labelValue("Path", path, colLeftX, infoY + 32);

  // On the right side, put Tier and Skill Pts on the same line
  const row3Y = infoY + 32;
  const tierLabelText = "Tier:";
  doc.setFont("Times", "bold");
  doc.setFontSize(13);
  doc.text(tierLabelText, colRightX, row3Y);
  let tempWidth = doc.getTextWidth(tierLabelText);
  let valueX = colRightX + tempWidth + 6;

  doc.setFont("Times", "normal");
  doc.setFontSize(11);
  doc.text(tier || "0", valueX, row3Y);

  const skillLabelText = "Skill Pts:";
  doc.setFont("Times", "bold");
  doc.setFontSize(13);
  const skillLabelX = valueX + 24;
  doc.text(skillLabelText, skillLabelX, row3Y);
  tempWidth = doc.getTextWidth(skillLabelText);
  const skillValueX = skillLabelX + tempWidth + 6;

  doc.setFont("Times", "normal");
  doc.setFontSize(11);
  doc.text(remainingSP || "0", skillValueX, row3Y);

  // Organizations on their own row, spanning the width of the box
  const orgLabelY = infoY + 48;
  const orgLabelText = "Organizations:";
  doc.setFont("Times", "bold");
  doc.setFontSize(13);
  doc.text(orgLabelText, colLeftX, orgLabelY);

  const orgLabelWidth = doc.getTextWidth(orgLabelText);
  const orgValueX = colLeftX + orgLabelWidth + 6;
  const orgMaxWidth = basicBoxX + basicBoxWidth - orgValueX - 8;

  const orgValueText = organizations || "-";
  doc.setFont("Times", "normal");
  doc.setFontSize(11);
  const orgLines = doc.splitTextToSize(orgValueText, orgMaxWidth);
  doc.text(orgLines, orgValueX, orgLabelY);

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
  const scholarMilestone2Checkbox =
    document.getElementById("scholarMilestone2");
  const scholarMilestone3Checkbox =
    document.getElementById("scholarMilestone3");

  function isMilestoneChecked(pathName, level) {
    if (pathName === "Artificer") {
      if (level === 2) return !!artificerMilestone2Checkbox?.checked;
      if (level === 3) return !!artificerMilestone3Checkbox?.checked;
    } else if (pathName === "Bard") {
      if (level === 2) return !!bardMilestone2Checkbox?.checked;
      if (level === 3) return !!bardMilestone3Checkbox?.checked;
    } else if (pathName === "Scholar") {
      if (level === 2) return !!scholarMilestone2Checkbox?.checked;
      if (level === 3) return !!scholarMilestone3Checkbox?.checked;
    }
    return false;
  }

  const milestonePaths = ["Artificer", "Bard", "Scholar"];

  // slightly smaller fonts inside milestone box
  doc.setFont("Times", "bold");
  doc.setFontSize(10);

  const innerX = milestonesBoxX + 6;
  const innerTopY = milestonesBoxTop + 6;

  // "Milestones:" INSIDE the box
  doc.text("Milestones:", innerX, innerTopY + 8);

  const colCount = 3;
  const colWidth = (milestonesWidth - 12) / colCount;
  const squareSize = 10;
  const rowOffset = 8;

  const labelBaseY = innerTopY + 24; // move path labels down slightly

  milestonePaths.forEach((p, idx) => {
    const startX = innerX + idx * colWidth;
    const labelY = labelBaseY;

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

  // ---------- SKILLS ----------
  doc.setFont("Times", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text("Skills", margin, y);
  y += 10;

  const tableWidth = pageWidth - margin * 2;
  const headerHeight = 28;

  const sorted =
    typeof getSortedSelectedSkills === "function"
      ? getSortedSelectedSkills()
      : [];

  // If NOT fullSkillInfo: keep the brown table layout
  let colTierCenterX, colPathX, colSkillX, colUsesX;

  if (!fullSkillInfo) {
    // Table header background
    doc.setFillColor(60, 40, 20);
    doc.setDrawColor(60, 40, 20);
    doc.rect(margin, y, tableWidth, headerHeight, "F");

    doc.setFont("Times", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);

    colTierCenterX = margin + 30;
    colPathX = margin + 60;
    colSkillX = margin + 140;
    colUsesX = margin + tableWidth * 0.65;

    // Center "Tier"
    const tierLabel = "Tier";
    const tierLabelWidth = doc.getTextWidth(tierLabel);
    doc.text(tierLabel, colTierCenterX - tierLabelWidth / 2, y + 16);

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
  } else {
    // Full skill info mode: no brown bar, just give a bit of space
    doc.setFont("Times", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    y += 4;
  }

  const rowLineHeight = 14;

  // For full-skill cards in single-column layout
  let cardCurrentY = y;
  const cardWidthFull = pageWidth - margin * 2;
  const cardPadding = 6; // tighter padding

  // helper to compute card height BEFORE drawing, so we don't run off the page
  function computeCardHeightForSkill(sk, metaSkill) {
    const rowLH = rowLineHeight;
    const nameMaxWidth = cardWidthFull - cardPadding * 2;
    const skillName = sk.name || "";
    const skillNameLines = doc.splitTextToSize(skillName, nameMaxWidth);

    let current = 0;

    // Top padding + offset for first line
    current += cardPadding + 8;
    // Skill name block
    current += rowLH * skillNameLines.length;

    // Space for Path line (baseline + some gap below)
    current += 20; // matches linePathY + 16 pattern

    // Now all the labeled blocks
    function measureBlock(text) {
      if (!text) return 0;
      const maxW = cardWidthFull - cardPadding * 2 - 10;
      const lines = doc.splitTextToSize(text, maxW);
      // label (11) + lines*12 + 3
      return 11 + lines.length * 12 + 3;
    }

    if (metaSkill) {
      current += measureBlock(metaSkill.description);
      current += measureBlock(metaSkill.augment);
      current += measureBlock(metaSkill.special);
      current += measureBlock(metaSkill.limitations);
      current += measureBlock(metaSkill.phys);
      current += measureBlock(metaSkill.prereq);
    }

    const usesDisplay = getUsesDisplayForSkill(sk);
    current += measureBlock(usesDisplay);

    // bottom padding
    current += cardPadding;

    return current;
  }

  sorted.forEach((sk) => {
    if (!fullSkillInfo) {
      // ---------- COMPACT TABLE MODE ----------
      const bottomMargin = 60;
      if (y > pageHeight - margin - bottomMargin) {
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

        const tierLabel2 = "Tier";
        const tierLabelWidth2 = doc.getTextWidth(tierLabel2);
        doc.text(tierLabel2, colTierCenterX - tierLabelWidth2 / 2, y + 16);
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

      // Tier centered
      const tierStr = String(sk.tier);
      const tierStrWidth = doc.getTextWidth(tierStr);
      doc.text(
        tierStr,
        colTierCenterX - tierStrWidth / 2,
        textBaseline
      );

      // Path
      doc.text(sk.path, colPathX, textBaseline);

      // Uses
      const usesDisplay = getUsesDisplayForSkill(sk);

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
    } else {
      // ---------- FULL SKILL CARD MODE (SINGLE COLUMN) ----------

      // find meta-skill once
      let metaSkill = null;
      if (typeof skillsByPath !== "undefined") {
        const metaSkillList = skillsByPath[sk.path] || [];
        metaSkill = metaSkillList.find((s) => s.name === sk.name) || null;
      }

      // compute how tall this card needs to be
      const neededHeight = computeCardHeightForSkill(sk, metaSkill);

      // if not enough room on this page, go to next page first
      if (cardCurrentY + neededHeight > pageHeight - margin) {
        doc.addPage();
        drawParchmentBackground(doc);

        let newY = margin;
        doc.setFont("Times", "bold");
        doc.setFontSize(15);
        doc.setTextColor(0, 0, 0);
        doc.text("Skills (continued)", margin, newY);
        newY += 10;

        doc.setFont("Times", "bold");
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);

        cardCurrentY = newY + 4;
      }

      const cardWidth = cardWidthFull;
      const cardX = margin;
      const cardTop = cardCurrentY;

      // Tighter space between top border and skill name
      let currentY = cardTop + cardPadding + 8;

      // Top of card: Skill Name (left) and Tier (right, same line)
      doc.setFont("Times", "bold");
      doc.setFontSize(12);

      const skillName = sk.name || "";
      const nameMaxWidth = cardWidth - cardPadding * 2;
      const skillNameLines = doc.splitTextToSize(skillName, nameMaxWidth);

      // baseline for first line
      const nameBaselineY = currentY;
      doc.text(skillNameLines, cardX + cardPadding, nameBaselineY);

      // Tier text on same line, right-justified
      const tierText = `Tier ${sk.tier}`;
      const tierWidth = doc.getTextWidth(tierText);
      const tierX = cardX + cardWidth - cardPadding - tierWidth;
      doc.text(tierText, tierX, nameBaselineY);

      // move currentY down by height of name block
      currentY += rowLineHeight * skillNameLines.length;

      doc.setFont("Times", "normal");
      doc.setFontSize(10);

      const detailMaxWidth = cardWidth - cardPadding * 2;

      // Bold label headers (Description, Augment, Special, Limitations, Phys Rep, Prerequisite, # of uses)
      function addLabeledBlock(label, text) {
        if (!text) return;

        // Label line, bold
        doc.setFont("Times", "bold");
        doc.setFontSize(10);
        doc.text(`${label}:`, cardX + cardPadding, currentY);

        // Value text, normal, slightly indented & below label
        doc.setFont("Times", "normal");
        doc.setFontSize(10);
        currentY += 11;
        const lines = doc.splitTextToSize(text, detailMaxWidth - 10);
        doc.text(lines, cardX + cardPadding + 10, currentY);
        currentY += lines.length * 12 + 3;
      }

      // Path / Profession directly under the skill name block
      doc.setFont("Times", "bold");
      doc.setFontSize(11);
      const jobText = sk.path || "";
      const linePathY = currentY + 4;
      doc.text(jobText, cardX + cardPadding, linePathY);

      currentY = linePathY + 16;

      // Then show detailed fields from the CSV
      if (metaSkill) {
        addLabeledBlock("Description", metaSkill.description);
        addLabeledBlock("Augment", metaSkill.augment);
        addLabeledBlock("Special", metaSkill.special);
        addLabeledBlock("Limitations", metaSkill.limitations);
        addLabeledBlock("Phys Rep", metaSkill.phys);
        addLabeledBlock("Prerequisite", metaSkill.prereq);
      }

      // # of uses (label bold via addLabeledBlock)
      const usesDisplay = getUsesDisplayForSkill(sk);
      addLabeledBlock("# of uses", usesDisplay);

      // Tighter, symmetric bottom padding
      const cardBottom = currentY + cardPadding;
      const cardHeight = cardBottom - cardTop;

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.7);
      doc.roundedRect(cardX, cardTop, cardWidth, cardHeight, 5, 5);

      // Advance vertical position for next card
      cardCurrentY = cardTop + cardHeight + 8;
    }
  });

  // ---------- EVENT SUMMARY (optional) ----------
  if (includeEvents) {
    doc.addPage();
    drawParchmentBackground(doc);

    y = margin;

    doc.setFont("Times", "bold");
    doc.setFontSize(15);
    doc.setTextColor(0, 0, 0);
    doc.text("Event Summary", margin, y);
    y += 10;

    const eventTableWidth = pageWidth - margin * 2;
    const eventHeaderHeight = 30;

    // header bar
    doc.setFillColor(60, 40, 20);
    doc.setDrawColor(60, 40, 20);
    doc.rect(margin, y, eventTableWidth, eventHeaderHeight, "F");

    doc.setFont("Times", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);

    // Narrow columns so headers fit within the brown bar
    const colNameX = margin + 6;
    const colDateX = margin + 170;
    const colTypeX = margin + 240;
    const colNpcX = margin + 310;
    const colMotX = margin + 360;
    const colBonusX = margin + 430;
    const colPtsX = margin + 495;

    doc.text("Event Name", colNameX, y + 18);
    doc.text("Date", colDateX, y + 18);
    doc.text("Type", colTypeX, y + 18);
    doc.text("NPC?", colNpcX, y + 18);

    // Wrap "Merchant OT?"
    doc.text("Merchant", colMotX, y + 14);
    doc.text("OT?", colMotX, y + 24);

    // Wrap "Bonus SP" and "Skill Pts"
    doc.text("Bonus", colBonusX, y + 14);
    doc.text("SP", colBonusX, y + 24);

    doc.text("Skill", colPtsX, y + 14);
    doc.text("Pts", colPtsX, y + 24);

    y += eventHeaderHeight + 4;

    doc.setFont("Times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    const rowHeight = 14;

    const events = typeof eventsData !== "undefined" ? eventsData : [];

    if (!events || !events.length) {
      doc.text("(No events recorded)", margin, y + 10);
    } else {
      events.forEach((ev) => {
        if (y > pageHeight - margin - 40) {
          doc.addPage();
          drawParchmentBackground(doc);

          y = margin + 10;
          doc.setFont("Times", "bold");
          doc.setFontSize(15);
          doc.text("Event Summary (continued)", margin, y);
          y += 10;

          doc.setFillColor(60, 40, 20);
          doc.setDrawColor(60, 40, 20);
          doc.rect(margin, y, eventTableWidth, eventHeaderHeight, "F");

          doc.setFont("Times", "bold");
          doc.setFontSize(11);
          doc.setTextColor(255, 255, 255);

          doc.text("Event Name", colNameX, y + 18);
          doc.text("Date", colDateX, y + 18);
          doc.text("Type", colTypeX, y + 18);
          doc.text("NPC?", colNpcX, y + 18);
          doc.text("Merchant", colMotX, y + 14);
          doc.text("OT?", colMotX, y + 24);
          doc.text("Bonus", colBonusX, y + 14);
          doc.text("SP", colBonusX, y + 24);
          doc.text("Skill", colPtsX, y + 14);
          doc.text("Pts", colPtsX, y + 24);

          y += eventHeaderHeight + 4;
          doc.setFont("Times", "bold");
          doc.setFontSize(10);
          doc.setTextColor(0, 0, 0);
        }

        const dateStr =
          typeof formatDateDisplay === "function"
            ? formatDateDisplay(ev.date || "")
            : ev.date || "";

        doc.text(ev.name || "", colNameX, y + 10);
        doc.text(dateStr || "", colDateX, y + 10);
        doc.text(ev.type || "", colTypeX, y + 10);
        doc.text(ev.npc ? "Yes" : "", colNpcX, y + 10);
        doc.text(ev.merchantOT ? "Yes" : "", colMotX, y + 10);
        doc.text(
          ev.bonusSP != null && ev.bonusSP !== "" ? String(ev.bonusSP) : "",
          colBonusX,
          y + 10
        );
        doc.text(
          ev.skillPoints != null ? String(ev.skillPoints) : "0",
          colPtsX,
          y + 10
        );

        const lineY = y + rowHeight;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(margin, lineY, margin + eventTableWidth, lineY);

        y = lineY + 4;
      });
    }
  }

  // ---------- SAVE ----------
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
