// ---------- CSV PARSING ----------
function parseCSV(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (c === '"') {
      if (inQuotes && i + 1 < text.length && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      row.push(field);
      field = "";
      if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) {
        rows.push(row.map((s) => s.trim().replace(/^\ufeff/, "")));
      }
      row = [];
      if (c === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
        i++;
      }
    } else {
      field += c;
    }
  }

  if (field.length > 0 || row.length) {
    row.push(field);
    rows.push(row.map((s) => s.trim().replace(/^\ufeff/, "")));
  }

  if (!rows.length) return [];

  const header = rows[0];
  const dataRows = rows.slice(1);

  return dataRows.map((cols) => {
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    return obj;
  });
}

// ---------- DATE FORMAT HELPERS ----------
function formatDateDisplay(isoStr) {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  if (parts.length !== 3) return isoStr;
  const [y, m, d] = parts;
  if (!y || !m || !d) return isoStr;
  return `${m}-${d}-${y}`;
}

// ---------- SMALL HTML HELPERS ----------
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

function formatMultiLineBlock(label, text) {
  if (!text) return "";
  const safe = escapeHtml(text).replace(/\n/g, "<br />");
  return `<p><strong>${label}:</strong><br />${safe}</p>`;
}

// ---------- DATA ----------
let skillsData = [];
let skillsByPath = {};
let selectedSkills = [];
let skillNameSet = new Set();

let eventsData = [];
let editingEventIndex = null;

const EVENT_BASE_POINTS = {
  "Day Event": 1,
  Campout: 2,
  "Festival Event": 3,
  "Virtual Event": 1,
  "Work Weekend": 1,
  "Survey/Misc": 1
};

const QUALIFYING_FOR_TIER = new Set([
  "Day Event",
  "Campout",
  "Festival Event",
  "Virtual Event"
]);

// Paths considered professions (for cost + display)
const PROFESSION_NAMES = new Set(["Artificer", "Bard", "Merchant", "Scholar"]);

// Per-path / profession tiers inferred from skills + main tier
let pathTierMap = {};

// Selected-skills sort state
let skillSortState = {
  column: "default", // "default" | "tier" | "path" | "skill"
  direction: "asc" // "asc" | "desc"
};

// Dirty flag for unsaved changes
let isDirty = false;

// ---------- DOM REFS ----------
const skillPathSelect = document.getElementById("skillPath");
const skillSelect = document.getElementById("skillSelect");
const skillFreeFlag = document.getElementById("skillFreeFlag");
const addSkillBtn = document.getElementById("addSkillBtn");
const skillDescription = document.getElementById("skillDescription");
const selectedSkillsBody = document.getElementById("selectedSkillsBody");
const totalSkillCostSpan = document.getElementById("totalSkillCost");

const addEventBtn = document.getElementById("addEventBtn");
const eventsBody = document.getElementById("eventsBody");
const totalEventPointsSpan = document.getElementById("totalEventPoints");
const qualifyingEventsCountSpan = document.getElementById(
  "qualifyingEventsCount"
);

const eventNameInput = document.getElementById("eventNameInput");
const eventDateInput = document.getElementById("eventDateInput");
const eventTypeSelect = document.getElementById("eventTypeSelect");
const eventNpcInput = document.getElementById("eventNpcInput");
const eventMotInput = document.getElementById("eventMotInput");
const eventBonusInput = document.getElementById("eventBonusInput");

const tierInput = document.getElementById("tier");
const totalSkillPointsInput = document.getElementById("totalSkillPoints");

const saveCharacterBtn = document.getElementById("saveCharacterBtn");
const loadCharacterBtn = document.getElementById("loadCharacterBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const loadCharacterFile = document.getElementById("loadCharacterFile");

const organizationsContainer = document.getElementById(
  "organizationsContainer"
);

const characterNameInput = document.getElementById("characterName");
const playerNameInput = document.getElementById("playerName");
const pathDisplaySelect = document.getElementById("pathDisplay");
const mainPathTierBox = document.getElementById("mainPathTierBox");

const factionSelect = document.getElementById("faction");

const secondaryPathsDisplay = document.getElementById("secondaryPathsDisplay");
const professionsDisplay = document.getElementById("professionsDisplay");

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

// Modal
const skillModal = document.getElementById("skillModal");
const skillModalTitle = document.getElementById("skillModalTitle");
const skillModalBody = document.getElementById("skillModalBody");
const skillModalClose = document.getElementById("skillModalClose");

// Unspent SP header
const unspentSkillPointsHeader = document.getElementById(
  "unspentSkillPointsHeader"
);

// ---------- DIRTY HELPERS ----------
function markDirty() {
  isDirty = true;
}

function markClean() {
  isDirty = false;
}

window.addEventListener("beforeunload", function (e) {
  if (!isDirty) return;
  e.preventDefault();
  e.returnValue = "";
});

// ---------- HELPERS ----------
function getOrganizations() {
  return Array.from(
    organizationsContainer.querySelectorAll('input[type="checkbox"]:checked')
  ).map((cb) => cb.value);
}

function setOrganizations(values) {
  const set = new Set(values || []);
  organizationsContainer
    .querySelectorAll('input[type="checkbox"]')
    .forEach((cb) => {
      cb.checked = set.has(cb.value);
    });
}

function getCurrentTier() {
  return parseInt(tierInput.value, 10) || 0;
}

function normalizeSkillName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[\.\,\;\:\!\?]+$/g, "")
    .trim();
}

// Recompute per-path tiers and update Secondary/Profession fields
function updatePathAndProfessionDisplays() {
  const mainPath = pathDisplaySelect.value || "";
  const charTier = getCurrentTier();

  const tiers = {};

  // Tier inferred from skills
  selectedSkills.forEach((sk) => {
    if (!sk.path) return;
    const t = parseInt(sk.tier || 0, 10) || 0;
    if (!tiers[sk.path] || t > tiers[sk.path]) {
      tiers[sk.path] = t;
    }
  });

  // Main path gets character tier from events
  if (mainPath) {
    tiers[mainPath] = charTier;
  }

  pathTierMap = tiers;
  window.pathTierMap = tiers;

  const secondaryParts = [];
  const professionParts = [];

  Object.keys(tiers).forEach((path) => {
    const t = tiers[path];
    if (path === mainPath) return;

    if (PROFESSION_NAMES.has(path)) {
      // Professions: Artificer [2], Bard [1]
      const label = `${path} [${t}]`;
      professionParts.push(label);
    } else {
      // Secondary paths: Healer [2], Rogue [2]
      const label = `${path} [${t}]`;
      secondaryParts.push(label);
    }
  });

  secondaryPathsDisplay.value = secondaryParts.join(", ");
  professionsDisplay.value = professionParts.join(", ");

  // Show main path tier in the box next to the Path dropdown
  if (mainPathTierBox) {
    const t = tiers[mainPath] || charTier;
    mainPathTierBox.value = mainPath && t > 0 ? t : "";
  }
}

function computeSkillCost(record) {
  const mainPath = pathDisplaySelect.value || "";
  const tier = record.tier || 0;
  const free = !!record.free;
  const path = record.path || "";

  if (free) return 0;

  const isMainPath = path === mainPath;
  const isProfession = PROFESSION_NAMES.has(path);

if (isMainPath || isProfession) {
  if (tier === 0) return 0;
  return tier;
} else {
  // Secondary path cost: Tier 0 = 2 SP, higher tiers = 2 × tier
  if (tier === 0) return 2;
  return tier * 2;
}
}

function getMilestonesForPath(path) {
  let milestones = 1;

  if (path === "Bard") {
    if (bardMilestone2Checkbox && bardMilestone2Checkbox.checked) {
      milestones++;
    }
    if (bardMilestone3Checkbox && bardMilestone3Checkbox.checked) {
      milestones++;
    }
  } else if (path === "Artificer") {
    if (artificerMilestone2Checkbox && artificerMilestone2Checkbox.checked) {
      milestones++;
    }
    if (artificerMilestone3Checkbox && artificerMilestone3Checkbox.checked) {
      milestones++;
    }
  } else if (path === "Scholar") {
    if (scholarMilestone2Checkbox && scholarMilestone2Checkbox.checked) {
      milestones++;
    }
    if (scholarMilestone3Checkbox && scholarMilestone3Checkbox.checked) {
      milestones++;
    }
  }

  return milestones;
}

// Uses depend on the tier of the specific path/profession
function computeSkillUses(skill) {
  if (!skill) return null;

  const periodicity = (skill.periodicity || "").trim();
  const base =
    typeof skill.usesBasePerDay === "number"
      ? skill.usesBasePerDay
      : parseFloat(skill.usesBasePerDay || "0") || 0;
  const perExtra =
    typeof skill.usesPerExtraTier === "number"
      ? skill.usesPerExtraTier
      : parseFloat(skill.usesPerExtraTier || "0") || 0;
  const startTier = parseInt(skill.usesScaleStartTier || "0", 10) || 0;

  const perMilestone1 = !!skill.perMilestone1;
  const perMilestone2 = !!skill.perMilestone2;

  const path = skill.path || "";

  // Resolve effective tier for this path/profession
  const map = window.pathTierMap || {};
  let effectiveTier =
    typeof map[path] === "number" ? map[path] : getCurrentTier();

// Special-case: Scrolls & Potions uses the highest of Mage or Healer tier
try {
  const normName = normalizeSkillName(skill.name);
  if (normName === normalizeSkillName("Scrolls & Potions")) {
    const mageTier = typeof map["Mage"] === "number" ? map["Mage"] : 0;
    const healerTier = typeof map["Healer"] === "number" ? map["Healer"] : 0;
    effectiveTier = Math.max(mageTier, healerTier);
  }
} catch (e) {
  // no-op
}


  if (
    periodicity.toLowerCase().includes("unlimited") ||
    (!base && !perExtra && !startTier && !perMilestone1 && !perMilestone2)
  ) {
    const label = periodicity || "Unlimited";
    return { display: "∞", numeric: Infinity, periodicity: label };
  }

  // Milestone-based logic (Bard/Artificer/Scholar)
  if (
    (perMilestone1 || perMilestone2) &&
    (path === "Bard" || path === "Artificer" || path === "Scholar")
  ) {
    const milestones = getMilestonesForPath(path);
    const label = periodicity || "Per Event Day";

    if (perMilestone1 && perMilestone2) {
      const perMilestoneBase = base || 1;
      const total = perMilestoneBase * milestones;
      return {
        display: `${total} × ${label}`,
        numeric: total,
        periodicity: label
      };
    }

    if (!perMilestone1 && perMilestone2) {
      const baseUses = base || 1;
      const hasSecondOrMore = milestones > 1;
      const total = baseUses + (hasSecondOrMore ? 1 : 0);
      return {
        display: `${total} × ${label}`,
        numeric: total,
        periodicity: label
      };
    }

    if (perMilestone1 && !perMilestone2) {
      const perMilestoneBase = base || 1;
      const total = perMilestoneBase * milestones;
      return {
        display: `${total} × ${label}`,
        numeric: total,
        periodicity: label
      };
    }
  }

  // Linear scaling
  let total = base;

  if (effectiveTier > startTier && perExtra) {
    const delta = effectiveTier - startTier;
    total += delta * perExtra;
  }

  if (Number.isFinite(total) && total > 0) {
    total = Math.floor(total + 1e-6);
  } else {
    total = 0;
  }

  if (!periodicity) {
    return { display: String(total), numeric: total, periodicity: "" };
  }

  return {
    display: `${total} × ${periodicity}`,
    numeric: total,
    periodicity
  };
}

// ----- Prereq parsing -----
function extractPrereqSkillNames(prereqRaw) {
  const names = new Set();
  if (!prereqRaw) return [];

  const raw = prereqRaw.trim();
  if (!raw) return [];

  const lower = raw.toLowerCase();
  const bracketRegex = /\[([^\]]+)\]/g;
  let m;
  while ((m = bracketRegex.exec(raw)) !== null) {
    const partRaw = m[1].trim();
    const norm = normalizeSkillName(partRaw);
    if (norm && skillNameSet.has(norm)) {
      names.add(partRaw);
    }
  }

  function processChunk(text) {
    if (!text) return;
    let chunk = text.trim();
    const dotIdx = chunk.indexOf(".");
    if (dotIdx !== -1) {
      chunk = chunk.slice(0, dotIdx);
    }
    const pieces = chunk.split(/,| and /i);
    pieces.forEach((p) => {
      const partRaw = p.trim();
      const norm = normalizeSkillName(partRaw);
      if (norm && skillNameSet.has(norm)) {
        names.add(partRaw);
      }
    });
  }

  const reqIdx = lower.indexOf("requirement:");
  if (reqIdx !== -1) {
    const afterReq = raw.slice(reqIdx + "requirement:".length).trim();
    processChunk(afterReq);
  }

  if (names.size === 0) {
    const normWhole = normalizeSkillName(raw);
    if (normWhole && skillNameSet.has(normWhole)) {
      names.add(raw);
    }
  }

  return Array.from(names);
}

function checkPrerequisitesForSkill(skill) {
  const prereqRaw = (skill.prereq || "").trim();
  if (!prereqRaw) return { ok: true };

  const requiredNames = extractPrereqSkillNames(prereqRaw);
  if (!requiredNames.length) {
    return { ok: true };
  }

  const missing = [];
  requiredNames.forEach((rName) => {
    const normReq = normalizeSkillName(rName);
    const hasReq = selectedSkills.some(
      (sk) => normalizeSkillName(sk.name) === normReq
    );
    if (!hasReq) {
      missing.push(rName);
    }
  });

  if (missing.length) {
    return {
      ok: false,
      message:
        "This skill has prerequisites you don't meet yet: " +
        missing.join(", ") +
        "."
    };
  }

  return { ok: true };
}

// ---------- SKILLS LOADING ----------
function buildSkillsStructures(rows) {
  skillsData = [];
  skillsByPath = {};
  skillNameSet = new Set();

  rows.forEach((r) => {
    const name = (r["Skill Name"] || "").trim();
    const path = (r["Path"] || "").trim();
    if (!name || !path) return;

    const skill = {
      name,
      path,
      description: r["Description"] || "",
      augment: r["Augment"] || "",
      special: r["Special"] || "",
      tier: parseInt(r["Tier"], 10) || 0,
      limitations: r["Limitations"] || "",
      phys: r["Phys Rep"] || "",
      prereq: r["Prerequisite"] || "",
      usesBasePerDay: r["Uses Base Per Day"]
        ? parseFloat(r["Uses Base Per Day"]) || 0
        : 0,
      usesPerExtraTier: r["Uses Per Extra Tier"]
        ? parseFloat(r["Uses Per Extra Tier"]) || 0
        : 0,
      usesScaleStartTier: r["Uses Scale Start Tier"]
        ? parseInt(r["Uses Scale Start Tier"], 10) || 0
        : 0,
      periodicity: r["Periodicity"] || "",
      perMilestone1:
        (r["Per Milestone 1"] || "").trim().toUpperCase() === "Y",
      perMilestone2:
        (r["Per Milestone 2"] || "").trim().toUpperCase() === "Y"
    };

    skillsData.push(skill);
    skillNameSet.add(normalizeSkillName(name));
    if (!skillsByPath[path]) skillsByPath[path] = [];
    skillsByPath[path].push(skill);
  });

  const paths = Object.keys(skillsByPath).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  skillPathSelect.innerHTML =
    '<option value="">-- Select Path / Profession --</option>';
  paths.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    skillPathSelect.appendChild(opt);
  });

  populateSkillSelect();
  updatePathAndProfessionDisplays();
}

function populateSkillSelect() {
  const path = skillPathSelect.value;
  skillSelect.innerHTML = '<option value="">-- Select Skill --</option>';
  skillDescription.value = "";

  let skills = [];
  if (path && skillsByPath[path]) {
    skills = skillsByPath[path];
  } else {
    skills = skillsData;
  }

  const usedKeys = new Set(
    selectedSkills.map((sk) => `${sk.path}::${sk.name}`)
  );

  skills.forEach((s) => {
    const key = `${s.path}::${s.name}`;
    if (usedKeys.has(key)) return;
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `Tier ${s.tier || 0}: ${s.name}`;
    skillSelect.appendChild(opt);
  });
}

function updateSkillDescriptionFromSelect() {
  const val = skillSelect.value;
  if (!val) {
    skillDescription.value = "";
    return;
  }
  const [path, name] = val.split("::");
  const skill = (skillsByPath[path] || []).find((s) => s.name === name);
  if (!skill) {
    skillDescription.value = "";
    return;
  }

  let desc = skill.description || "";
  if (skill.augment) desc += `\n\nAugment: ${skill.augment}`;
  if (skill.special) desc += `\n\nSpecial: ${skill.special}`;
  if (skill.limitations) desc += `\n\nLimitations: ${skill.limitations}`;
  if (skill.phys) desc += `\n\nPhys Rep: ${skill.phys}`;
  if (skill.prereq) desc += `\n\nPrerequisite: ${skill.prereq}`;

  const usesInfo = computeSkillUses(skill);
  if (usesInfo && usesInfo.display) {
    desc += `\n\nUsage: ${usesInfo.display}`;
  }

  skillDescription.value = desc.trim();
}

// ---------- SORTED SKILLS ----------
function defaultSkillSort(arr) {
  const mainPath = pathDisplaySelect.value || "";

  return arr.slice().sort((a, b) => {
    const aMain = a.path === mainPath ? 0 : 1;
    const bMain = b.path === mainPath ? 0 : 1;
    if (aMain !== bMain) return aMain - bMain;

    if (!aMain && !bMain) {
      const pathCmp = a.path.localeCompare(b.path, undefined, {
        sensitivity: "base"
      });
      if (pathCmp !== 0) return pathCmp;
    }

    const tierDiff = (a.tier || 0) - (b.tier || 0);
    if (tierDiff !== 0) return tierDiff;

    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function getSortedSelectedSkills() {
  const arr = selectedSkills || [];

  if (skillSortState.column === "default") {
    return defaultSkillSort(arr);
  }

  const dir = skillSortState.direction === "desc" ? -1 : 1;

  return arr.slice().sort((a, b) => {
    let va, vb;

    if (skillSortState.column === "tier") {
      va = parseInt(a.tier || 0, 10);
      vb = parseInt(b.tier || 0, 10);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return (
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()) * dir
      );
    }

    if (skillSortState.column === "path") {
      va = a.path.toLowerCase();
      vb = b.path.toLowerCase();
      const cmp = va.localeCompare(vb);
      if (cmp !== 0) return cmp * dir;
      const ta = parseInt(a.tier || 0, 10);
      const tb = parseInt(b.tier || 0, 10);
      if (ta !== tb) return (ta - tb) * dir;
      return (
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()) * dir
      );
    }

    if (skillSortState.column === "skill") {
      va = a.name.toLowerCase();
      vb = b.name.toLowerCase();
      const cmp = va.localeCompare(vb);
      if (cmp !== 0) return cmp * dir;
      const ta = parseInt(a.tier || 0, 10);
      const tb = parseInt(b.tier || 0, 10);
      if (ta !== tb) return (ta - tb) * dir;
      return (
        a.path.toLowerCase().localeCompare(b.path.toLowerCase()) * dir
      );
    }

    return 0;
  });
}

function updateSkillSortHeaderIndicators() {
  const thTier = document.getElementById("thTier");
  const thPath = document.getElementById("thPath");
  const thSkill = document.getElementById("thSkill");

  const all = [thTier, thPath, thSkill];
  all.forEach((th) => {
    if (!th) return;
    const baseLabel =
      th.id === "thTier"
        ? "Tier"
        : th.id === "thPath"
        ? "Path/Profession"
        : "Skill";
    th.textContent = baseLabel;
  });

  const dirSymbol = skillSortState.direction === "desc" ? "▼" : "▲";

  if (skillSortState.column === "tier" && thTier) {
    thTier.textContent = `Tier ${dirSymbol}`;
  }
  if (skillSortState.column === "path" && thPath) {
    thPath.textContent = `Path/Profession ${dirSymbol}`;
  }
  if (skillSortState.column === "skill" && thSkill) {
    thSkill.textContent = `Skill ${dirSymbol}`;
  }
}

function attachSkillSortHandlers() {
  const thTier = document.getElementById("thTier");
  const thPath = document.getElementById("thPath");
  const thSkill = document.getElementById("thSkill");
  const resetBtn = document.getElementById("resetSkillSortBtn");

  if (thTier) {
    thTier.addEventListener("click", () => {
      if (skillSortState.column === "tier") {
        skillSortState.direction =
          skillSortState.direction === "asc" ? "desc" : "asc";
      } else {
        skillSortState.column = "tier";
        skillSortState.direction = "asc";
      }
      renderSelectedSkills();
      updateSkillSortHeaderIndicators();
      markDirty();
    });
  }

  if (thPath) {
    thPath.addEventListener("click", () => {
      if (skillSortState.column === "path") {
        skillSortState.direction =
          skillSortState.direction === "asc" ? "desc" : "asc";
      } else {
        skillSortState.column = "path";
        skillSortState.direction = "asc";
      }
      renderSelectedSkills();
      updateSkillSortHeaderIndicators();
      markDirty();
    });
  }

  if (thSkill) {
    thSkill.addEventListener("click", () => {
      if (skillSortState.column === "skill") {
        skillSortState.direction =
          skillSortState.direction === "asc" ? "desc" : "asc";
      } else {
        skillSortState.column = "skill";
        skillSortState.direction = "asc";
      }
      renderSelectedSkills();
      updateSkillSortHeaderIndicators();
      markDirty();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      skillSortState = { column: "default", direction: "asc" };
      renderSelectedSkills();
      updateSkillSortHeaderIndicators();
      markDirty();
    });
  }
}

// ---------- SKILL DETAIL MODAL ----------
function closeSkillModal() {
  if (!skillModal) return;
  skillModal.classList.add("hidden");
}

function showSkillDetail(selectedRecord) {
  if (!skillModal || !skillModalTitle || !skillModalBody) return;

  const { path, name } = selectedRecord;
  const list = skillsByPath[path] || [];
  const skill = list.find((s) => s.name === name);
  if (!skill) {
    alert("No detailed information found for this skill.");
    return;
  }

  const usesInfo = computeSkillUses(skill);

  skillModalTitle.textContent = skill.name || "Skill";

  let html = "";
  html += `<p><strong>Path/Profession:</strong> ${escapeHtml(
    skill.path || ""
  )}</p>`;
  html += `<p><strong>Tier:</strong> ${escapeHtml(String(skill.tier || 0))}</p>`;

  html += formatMultiLineBlock("Description", skill.description);
  html += formatMultiLineBlock("Augment", skill.augment);
  html += formatMultiLineBlock("Special", skill.special);
  html += formatMultiLineBlock("Limitations", skill.limitations);
  html += formatMultiLineBlock("Phys Rep", skill.phys);
  html += formatMultiLineBlock("Prerequisite", skill.prereq);

  if (usesInfo && usesInfo.display) {
    html += `<p><strong>Uses:</strong> ${escapeHtml(usesInfo.display)}</p>`;
  }

  if (!html.trim()) {
    html = "<p>No additional information.</p>";
  }

  skillModalBody.innerHTML = html;
  skillModal.classList.remove("hidden");
}

// ---------- ADD / RENDER SELECTED SKILLS ----------
function addSelectedSkill() {
  const val = skillSelect.value;
  if (!val) {
    alert("Please choose a skill first.");
    return;
  }

  const mainPath = pathDisplaySelect.value || "";
  if (!mainPath) {
    alert(
      "Please choose your main Path in Basic Information before selecting skills."
    );
    return;
  }

  const [path, name] = val.split("::");
  const skill = (skillsByPath[path] || []).find((s) => s.name === name);
  if (!skill) {
    alert("Could not find data for this skill.");
    return;
  }

  const already = selectedSkills.find(
    (sk) => sk.name === name && sk.path === path
  );
  if (already) {
    alert("That skill is already in your list.");
    return;
  }

  const currentTier = getCurrentTier();
  const isMainPathSkill = path === mainPath;
  const isExplicitProfession = PROFESSION_NAMES.has(path);
  const isProfessionSkill = isExplicitProfession;
  const isSecondaryPathSkill = !isMainPathSkill && !isProfessionSkill;

  // Recompute totals (and pathTierMap) before checks
  recomputeTotals();
  const available =
    parseInt(totalSkillPointsInput.value, 10) >= 0
      ? parseInt(totalSkillPointsInput.value, 10)
      : 0;

  // Profession gating
  if (isProfessionSkill) {
    if (currentTier < 3) {
      alert("You must be at least Tier 3 to purchase profession skills.");
      return;
    }
    if (skill.tier > currentTier) {
      alert(
        `You are Tier ${currentTier}. You cannot take a Tier ${skill.tier} profession skill yet.`
      );
      return;
    }
    if (skill.tier > 1) {
      const prevTier = skill.tier - 1;
      const hasPrev = selectedSkills.some(
        (sk) => sk.path === path && sk.tier === prevTier
      );
      if (!hasPrev) {
        alert(
          `You must have at least one Tier ${prevTier} ${path} skill before purchasing a Tier ${skill.tier} ${path} skill.`
        );
        return;
      }
    }

    // --- Artificer-specific "Appraise" rules ---
    if (path === "Artificer") {
      const isAppraise = /^Appraise\b/i.test(skill.name);

      const hasAnyArtificer = selectedSkills.some(
        (sk) => sk.path === "Artificer"
      );

      // 1) First Artificer skill must be an Appraise
      if (!hasAnyArtificer && !isAppraise) {
        alert(
          "Your first Artificer skill must be an Appraise (e.g., 'Appraise Armor'). Take one Appraise before any other Artificer skills."
        );
        return;
      }

      // 2) You can only have a number of Appraise skills equal to your Artificer tier
      if (isAppraise) {
        const existingAppraises = selectedSkills.filter(
          (sk) => sk.path === "Artificer" && /^Appraise\b/i.test(sk.name)
        ).length;

        const map = window.pathTierMap || {};
        const currentArtificerTier =
          typeof map["Artificer"] === "number" ? map["Artificer"] : 0;

        const newArtificerTier = Math.max(
          currentArtificerTier,
          skill.tier || 0
        );

        if (existingAppraises >= newArtificerTier) {
          alert(
            `You can only have a number of Appraise skills equal to your Artificer tier.\n\n` +
              `Current Artificer tier (including this purchase): ${newArtificerTier}\n` +
              `Existing Appraise skills: ${existingAppraises}`
          );
          return;
        }
      }
    }
  }

  // Main path gating
  if (isMainPathSkill && skill.tier > currentTier) {
    alert(
      `You are Tier ${currentTier}. You cannot take a Tier ${skill.tier} skill on your main path yet.`
    );
    return;
  }

  // Secondary path gating
  if (isSecondaryPathSkill) {
    let allowedSecondaryTier = 0;
    if (currentTier >= 6) {
      allowedSecondaryTier = 3;
    } else if (currentTier >= 4) {
      allowedSecondaryTier = 2;
    } else if (currentTier >= 2) {
      allowedSecondaryTier = 1;
    } else {
      allowedSecondaryTier = 0;
    }

    if (allowedSecondaryTier === 0) {
      alert("You cannot choose skills from other paths until you reach Tier 2.");
      return;
    }

    if (skill.tier > allowedSecondaryTier) {
      alert(
        `At Tier ${currentTier}, you may choose secondary-path skills up to Tier ${allowedSecondaryTier}, but this skill is Tier ${skill.tier}.`
      );
      return;
    }
  }

  const prereqCheck = checkPrerequisitesForSkill(skill);
  if (!prereqCheck.ok) {
    alert(
      prereqCheck.message ||
        "You do not meet the prerequisites for this skill."
    );
    return;
  }

  const free = skillFreeFlag.checked;

  const candidateRecord = {
    name,
    path,
    tier: skill.tier,
    free
  };
  const candidateCost = computeSkillCost(candidateRecord);

  if (candidateCost > available) {
    alert(
      `You don't have enough Skill Points for this skill.\n\nCost: ${candidateCost} SP\nAvailable: ${available} SP`
    );
    return;
  }

  selectedSkills.push(candidateRecord);
  markDirty();

  skillFreeFlag.checked = false;
  populateSkillSelect();
  recomputeTotals();
}

function renderSelectedSkills() {
  selectedSkillsBody.innerHTML = "";

  const sorted = getSortedSelectedSkills();

  sorted.forEach((sk) => {
    const tr = document.createElement("tr");

    const tdMinus = document.createElement("td");
    const minusBtn = document.createElement("button");
    minusBtn.textContent = "−";
    minusBtn.className = "button small secondary";
    minusBtn.title = "Remove skill";
    minusBtn.style.minWidth = "32px";
    minusBtn.addEventListener("click", () => {
      const originalIndex = selectedSkills.findIndex(
        (s) =>
          s.name === sk.name &&
          s.path === sk.path &&
          s.tier === sk.tier &&
          s.free === sk.free
      );
      if (originalIndex === -1) return;

      const skillToRemove = selectedSkills[originalIndex];

      // Extra Appraise safety: don't allow removing the last Appraise
      // if there are other Artificer skills left.
      if (
        skillToRemove.path === "Artificer" &&
        /^Appraise\b/i.test(skillToRemove.name)
      ) {
        const remainingAppraises = selectedSkills.filter((s, idx) => {
          if (idx === originalIndex) return false;
          return s.path === "Artificer" && /^Appraise\b/i.test(s.name);
        }).length;

        const remainingNonAppraiseArtificer = selectedSkills.filter(
          (s, idx) => {
            if (idx === originalIndex) return false;
            return s.path === "Artificer" && !/^Appraise\b/i.test(s.name);
          }
        ).length;

        if (remainingAppraises === 0 && remainingNonAppraiseArtificer > 0) {
          alert(
            "You must have at least one Appraise skill if you have other Artificer skills."
          );
          return;
        }
      }

      if (confirm("Are you sure you want to remove this skill?")) {
        selectedSkills.splice(originalIndex, 1);
        markDirty();
        populateSkillSelect();
        recomputeTotals();
      }
    });
    tdMinus.appendChild(minusBtn);
    tr.appendChild(tdMinus);

    const tdTier = document.createElement("td");
    tdTier.textContent = sk.tier;
    tdTier.classList.add("tier-cell");
    tr.appendChild(tdTier);

    const tdPath = document.createElement("td");
    tdPath.textContent = sk.path;
    tr.appendChild(tdPath);

    const tdName = document.createElement("td");
    tdName.textContent = sk.name;
    tdName.classList.add("skill-clickable");
    tdName.title = "Click for full details";
    tdName.addEventListener("click", () => {
      showSkillDetail(sk);
    });
    tr.appendChild(tdName);

    let usesDisplay = "—";
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

    const tdUses = document.createElement("td");
    tdUses.textContent = usesDisplay;
    tr.appendChild(tdUses);

    const tdCost = document.createElement("td");
    const tag = document.createElement("span");
    const cost = computeSkillCost(sk);
    if (cost === 0) {
      tag.classList.add("tag", "free");
      tag.textContent = "Free";
    } else {
      tag.classList.add("tag", "paid");
      tag.textContent = `-${cost} SP`;
    }
    tdCost.appendChild(tag);
    tr.appendChild(tdCost);

    selectedSkillsBody.appendChild(tr);
  });

  const totalCost = selectedSkills.reduce(
    (sum, sk) => sum + computeSkillCost(sk),
    0
  );
  totalSkillCostSpan.textContent = totalCost;

  updatePathAndProfessionDisplays();
}

// ---------- EVENTS ----------
function addEventFromInputs() {
  const name = eventNameInput.value.trim();
  const date = eventDateInput.value;
  const type = eventTypeSelect.value;
  const npc = !!eventNpcInput.checked;
  const mot = !!eventMotInput.checked;
  const bonus = parseInt(eventBonusInput.value, 10) || 0;

  if (!type) {
    alert("Please choose an event type.");
    return;
  }

  const ev = {
    name,
    date,
    type,
    npc,
    merchantOT: mot,
    bonusSP: bonus,
    skillPoints: 0
  };

  if (
    editingEventIndex !== null &&
    editingEventIndex >= 0 &&
    editingEventIndex < eventsData.length
  ) {
    eventsData[editingEventIndex] = ev;
  } else {
    eventsData.push(ev);
  }

  editingEventIndex = null;
  addEventBtn.textContent = "Add Event";

  eventNameInput.value = "";
  eventDateInput.value = "";
  eventTypeSelect.value = "";
  eventNpcInput.checked = false;
  eventMotInput.checked = false;
  eventBonusInput.value = "0";

  markDirty();
  recomputeTotals();
}

function renderEvents() {
  eventsBody.innerHTML = "";

  const labels = [
    "",
    "Name",
    "Date",
    "Type",
    "NPC?",
    "Merchant OT?",
    "Bonus SP",
    "Skill Pts"
  ];

  eventsData.forEach((ev) => {
    const tr = document.createElement("tr");

    const tdButtons = document.createElement("td");
    tdButtons.dataset.label = labels[0];

    const minusBtn = document.createElement("button");
    minusBtn.textContent = "−";
    minusBtn.className = "button small secondary";
    minusBtn.title = "Remove event";
    minusBtn.style.minWidth = "28px";
    minusBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to remove this event?")) {
        const idx = eventsData.indexOf(ev);
        if (idx !== -1) {
          eventsData.splice(idx, 1);
          markDirty();
          if (editingEventIndex === idx) {
            editingEventIndex = null;
            addEventBtn.textContent = "Add Event";
          }
          recomputeTotals();
        }
      }
    });

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.className = "button small secondary";
    editBtn.style.minWidth = "40px";
    editBtn.style.marginLeft = "4px";
    editBtn.title = "Edit event";
    editBtn.addEventListener("click", () => {
      const idx = eventsData.indexOf(ev);
      if (idx === -1) return;
      editingEventIndex = idx;

      eventNameInput.value = ev.name || "";
      eventDateInput.value = ev.date || "";
      eventTypeSelect.value = ev.type || "";
      eventNpcInput.checked = !!ev.npc;
      eventMotInput.checked = !!ev.merchantOT;
      eventBonusInput.value =
        ev.bonusSP != null && ev.bonusSP !== "" ? String(ev.bonusSP) : "0";

      addEventBtn.textContent = "Update Event";

      try {
        eventNameInput.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      } catch (e) {
        eventNameInput.scrollIntoView();
      }
      eventNameInput.focus();
    });

    tdButtons.appendChild(minusBtn);
    tdButtons.appendChild(editBtn);
    tr.appendChild(tdButtons);

    function addCell(text, labelIndex) {
      const td = document.createElement("td");
      td.textContent = text;
      td.dataset.label = labels[labelIndex] || "";
      tr.appendChild(td);
    }

    addCell(ev.name || "", 1);
    addCell(formatDateDisplay(ev.date || ""), 2);
    addCell(ev.type || "", 3);
    addCell(ev.npc ? "Yes" : "", 4);
    addCell(ev.merchantOT ? "Yes" : "", 5);
    addCell(
      ev.bonusSP != null && ev.bonusSP !== "" ? String(ev.bonusSP) : "",
      6
    );
    addCell(ev.skillPoints != null ? String(ev.skillPoints) : "0", 7);

    eventsBody.appendChild(tr);
  });
}

// ---------- TOTALS & TIER ----------
function computeTierFromEvents(qualifyingCount) {
  let remaining = qualifyingCount;
  let tier = 0;
  let needed = 1;
  while (remaining >= needed) {
    tier++;
    remaining -= needed;
    needed++;
  }
  return tier;
}

function recomputeTotals() {
  let totalEventPoints = 0;
  let qualifyingCount = 0;

  eventsData.forEach((ev) => {
    const type = ev.type || "";
    const base = EVENT_BASE_POINTS[type] || 0;
    const npc = ev.npc ? 1 : 0;
    const mot = ev.merchantOT ? 1 : 0;
    const bonus = ev.bonusSP ? parseInt(ev.bonusSP, 10) || 0 : 0;
    const total = base + npc + mot + bonus;
    ev.skillPoints = total;
    totalEventPoints += total;
    if (QUALIFYING_FOR_TIER.has(type)) {
      qualifyingCount++;
    }
  });

  totalEventPointsSpan.textContent = totalEventPoints;
  qualifyingEventsCountSpan.textContent = qualifyingCount;

  const tier = computeTierFromEvents(qualifyingCount);
  tierInput.value = tier;

  const totalSkillCost = selectedSkills.reduce(
    (sum, sk) => sum + computeSkillCost(sk),
    0
  );
  totalSkillCostSpan.textContent = totalSkillCost;

  const available = Math.max(0, totalEventPoints - totalSkillCost);
  totalSkillPointsInput.value = available;

  if (unspentSkillPointsHeader) {
    unspentSkillPointsHeader.textContent = available;
  }

  updatePathAndProfessionDisplays();
  renderEvents();
  renderSelectedSkills();
}

// ---------- SAVE / LOAD CHARACTER ----------
function collectCharacterState() {
  const organizations = getOrganizations();

  const events = eventsData.map((ev) => ({
    name: ev.name || "",
    date: ev.date || "",
    type: ev.type || "",
    npc: !!ev.npc,
    merchantOT: !!ev.merchantOT,
    bonusSP: ev.bonusSP ? parseInt(ev.bonusSP, 10) || 0 : 0,
    skillPoints: ev.skillPoints ? parseInt(ev.skillPoints, 10) || 0 : 0
  }));

  const professions = Array.from(
    new Set(
      selectedSkills
        .map((sk) => sk.path)
        .filter((p) => PROFESSION_NAMES.has(p))
    )
  );

  return {
    version: 16,
    characterName: characterNameInput.value || "",
    playerName: playerNameInput.value || "",
    pathDisplay: pathDisplaySelect.value || "",
    faction: factionSelect.value || "",
    professions,
    organizations,
    selectedSkills: selectedSkills.slice(),
    events,
    artificerMilestone2: !!(
      artificerMilestone2Checkbox && artificerMilestone2Checkbox.checked
    ),
    artificerMilestone3: !!(
      artificerMilestone3Checkbox && artificerMilestone3Checkbox.checked
    ),
    bardMilestone2: !!(bardMilestone2Checkbox && bardMilestone2Checkbox.checked),
    bardMilestone3: !!(bardMilestone3Checkbox && bardMilestone3Checkbox.checked),
    scholarMilestone2: !!(
      scholarMilestone2Checkbox && scholarMilestone2Checkbox.checked
    ),
    scholarMilestone3: !!(
      scholarMilestone3Checkbox && scholarMilestone3Checkbox.checked
    ),
    skillSortState: skillSortState
  };
}

function applyCharacterState(state) {
  if (!state || typeof state !== "object") return;

  characterNameInput.value = state.characterName || "";
  playerNameInput.value = state.playerName || "";
  pathDisplaySelect.value = state.pathDisplay || "";
  factionSelect.value = state.faction || "";

  const orgs = state.organizations;
  if (Array.isArray(orgs)) {
    setOrganizations(orgs);
  }

  if (artificerMilestone2Checkbox) {
    artificerMilestone2Checkbox.checked = !!state.artificerMilestone2;
  }
  if (artificerMilestone3Checkbox) {
    artificerMilestone3Checkbox.checked = !!state.artificerMilestone3;
  }
  if (bardMilestone2Checkbox) {
    bardMilestone2Checkbox.checked = !!state.bardMilestone2;
  }
  if (bardMilestone3Checkbox) {
    bardMilestone3Checkbox.checked = !!state.bardMilestone3;
  }
  if (scholarMilestone2Checkbox) {
    scholarMilestone2Checkbox.checked = !!state.scholarMilestone2;
  }
  if (scholarMilestone3Checkbox) {
    scholarMilestone3Checkbox.checked = !!state.scholarMilestone3;
  }

  selectedSkills = Array.isArray(state.selectedSkills)
    ? state.selectedSkills.slice()
    : [];

  if (state.skillSortState) {
    skillSortState = state.skillSortState;
  } else {
    skillSortState = { column: "default", direction: "asc" };
  }

  eventsData = Array.isArray(state.events)
    ? state.events.map((ev) => ({
        name: ev.name || "",
        date: ev.date || "",
        type: ev.type || "",
        npc: !!ev.npc,
        merchantOT: !!ev.merchantOT,
        bonusSP: ev.bonusSP ? parseInt(ev.bonusSP, 10) || 0 : 0,
        skillPoints: ev.skillPoints ? parseInt(ev.skillPoints, 10) || 0 : 0
      }))
    : [];

  editingEventIndex = null;
  addEventBtn.textContent = "Add Event";

  recomputeTotals();
  updateSkillSortHeaderIndicators();
  markClean();
}

function saveCharacter() {
  const state = collectCharacterState();
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  const defaultName =
    state.characterName && state.characterName.trim()
      ? state.characterName.trim()
      : "larp_character";

  let baseName = prompt("Enter a name for this character file:", defaultName);
  if (!baseName) {
    URL.revokeObjectURL(url);
    return;
  }
  baseName = baseName.replace(/[^a-z0-9_\-]+/gi, "_");

  a.href = url;
  a.download = baseName + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  markClean();
}

function handleLoadCharacterFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const state = JSON.parse(ev.target.result);
      applyCharacterState(state);
    } catch (err) {
      alert("Could not read character file. Is it a valid JSON save?");
    }
  };
  reader.readAsText(file);
}

// ---------- CSV AUTO-LOAD ----------
function tryAutoLoadCSV() {
  fetch("larp_skills.csv")
    .then((res) => {
      if (!res.ok) throw new Error("No CSV found");
      return res.text();
    })
    .then((text) => {
      const rows = parseCSV(text);
      if (!rows.length) throw new Error("Empty CSV");
      buildSkillsStructures(rows);
    })
    .catch(() => {
      console.warn(
        "Could not auto-load larp_skills.csv. Make sure it's alongside index.html."
      );
    });
}

// ---------- INIT ----------
window.addEventListener("DOMContentLoaded", () => {
  tryAutoLoadCSV();

  addEventBtn.addEventListener("click", () => {
    addEventFromInputs();
  });

  addSkillBtn.addEventListener("click", () => {
    addSelectedSkill();
  });

  skillPathSelect.addEventListener("change", () => {
    populateSkillSelect();
    skillDescription.value = "";
  });

  skillSelect.addEventListener("change", updateSkillDescriptionFromSelect);

  saveCharacterBtn.addEventListener("click", saveCharacter);

  loadCharacterBtn.addEventListener("click", () => {
    loadCharacterFile.click();
  });
  loadCharacterFile.addEventListener("change", handleLoadCharacterFile);

  exportPdfBtn.addEventListener("click", () => {
    if (typeof window.exportCharacterPDF === "function") {
      window.exportCharacterPDF();
    } else {
      alert("PDF export is not available. Make sure pdf-export.js is loaded.");
    }
  });

  pathDisplaySelect.addEventListener("change", () => {
    markDirty();
    recomputeTotals();
  });

  characterNameInput.addEventListener("input", markDirty);
  playerNameInput.addEventListener("input", markDirty);
  factionSelect.addEventListener("change", markDirty);

  organizationsContainer
    .querySelectorAll('input[type="checkbox"]')
    .forEach((cb) => {
      cb.addEventListener("change", markDirty);
    });

  function onMilestoneChange() {
    markDirty();
    updateSkillDescriptionFromSelect();
    recomputeTotals();
  }
  if (artificerMilestone2Checkbox)
    artificerMilestone2Checkbox.addEventListener("change", onMilestoneChange);
  if (artificerMilestone3Checkbox)
    artificerMilestone3Checkbox.addEventListener("change", onMilestoneChange);
  if (bardMilestone2Checkbox)
    bardMilestone2Checkbox.addEventListener("change", onMilestoneChange);
  if (bardMilestone3Checkbox)
    bardMilestone3Checkbox.addEventListener("change", onMilestoneChange);
  if (scholarMilestone2Checkbox)
    scholarMilestone2Checkbox.addEventListener("change", onMilestoneChange);
  if (scholarMilestone3Checkbox)
    scholarMilestone3Checkbox.addEventListener("change", onMilestoneChange);

  attachSkillSortHandlers();
  updateSkillSortHeaderIndicators();

  // Modal close handlers
  if (skillModalClose) {
    skillModalClose.addEventListener("click", closeSkillModal);
  }
  if (skillModal) {
    skillModal.addEventListener("click", (e) => {
      if (e.target === skillModal) {
        closeSkillModal();
      }
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && skillModal && !skillModal.classList.contains("hidden")) {
      closeSkillModal();
    }
  });

  recomputeTotals();
  markClean();
});
