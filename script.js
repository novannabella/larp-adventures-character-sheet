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

const PROFESSION_NAMES = new Set(["Artificer", "Bard", "Merchant", "Scholar"]);

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

function updatePathAndProfessionDisplays() {
  const mainPath = pathDisplaySelect.value || "";
  const secondaryPaths = new Set();
  const professionPaths = new Set();

  selectedSkills.forEach((sk) => {
    if (!sk.path) return;
    if (sk.path === mainPath) return;
    if (PROFESSION_NAMES.has(sk.path)) {
      professionPaths.add(sk.path);
    } else {
      secondaryPaths.add(sk.path);
    }
  });

  secondaryPathsDisplay.value = Array.from(secondaryPaths).join(", ");
  professionsDisplay.value = Array.from(professionPaths).join(", ");
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
    if (tier === 0) return 1;
    return tier * 2;
  }
}

// Milestone counts per path
function getMilestonesForPath(path) {
  let milestones = 1; // baseline milestone 1

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
  }

  return milestones;
}

// Compute Uses, including:
// - Tier scaling
// - Milestone-based behavior via Per Milestone 1 & Per Milestone 2
function computeSkillUses(skill) {
  if (!skill) return null;

  const periodicity = (skill.periodicity || "").trim();
  const base = typeof skill.usesBasePerDay === "number"
    ? skill.usesBasePerDay
    : parseFloat(skill.usesBasePerDay || "0") || 0;
  const perExtra = typeof skill.usesPerExtraTier === "number"
    ? skill.usesPerExtraTier
    : parseFloat(skill.usesPerExtraTier || "0") || 0;
  const startTier = parseInt(skill.usesScaleStartTier || "0", 10) || 0;

  const perMilestone1 = !!skill.perMilestone1;
  const perMilestone2 = !!skill.perMilestone2;

  // Unlimited if explicitly indicated or no numeric usage info at all
  if (
    periodicity.toLowerCase().includes("unlimited") ||
    (!base && !perExtra && !startTier && !perMilestone1 && !perMilestone2)
  ) {
    const label = periodicity || "Unlimited";
    return { display: "∞", numeric: Infinity, periodicity: label };
  }

  const path = skill.path || "";

  // Milestone-based variants for Bard/Artificer
  if ((perMilestone1 || perMilestone2) && (path === "Bard" || path === "Artificer")) {
    const milestones = getMilestonesForPath(path);
    const label = periodicity || "Per Event Day";

    // Case 1: Per Milestone 1 AND Per Milestone 2 => fully per milestone
    if (perMilestone1 && perMilestone2) {
      const perMilestoneBase = base || 1;
      const total = perMilestoneBase * milestones;
      return {
        display: `${total} × ${label}`,
        numeric: total,
        periodicity: label
      };
    }

    // Case 2: Only Per Milestone 2 => extra use once at milestone 2+
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

    // If somehow only Per Milestone 1 is set, treat like per-milestone
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

  // Normal tier-based scaling
  const currentTier = getCurrentTier();
  let total = base;

  if (currentTier > startTier && perExtra) {
    const delta = currentTier - startTier;
    total += delta * perExtra;
  }

  if (Number.isFinite(total) && total > 0) {
    // For fractional perExtra (e.g. 0.5 / tier), floor to integer uses
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
  if (skill.prereq) desc += `\n\nPrerequisite: ${skill.prereq}`;
  if (skill.limitations) desc += `\n\nLimitations: ${skill.limitations}`;
  if (skill.phys) desc += `\n\nPhys Rep: ${skill.phys}`;

  const usesInfo = computeSkillUses(skill);
  if (usesInfo && usesInfo.display) {
    desc += `\n\nUsage: ${usesInfo.display}`;
  }

  skillDescription.value = desc.trim();
}

function getSortedSelectedSkills() {
  const mainPath = pathDisplaySelect.value || "";
  return selectedSkills.slice().sort((a, b) => {
    const aMain = a.path === mainPath;
    const bMain = b.path === mainPath;

    if (aMain && !bMain) return -1;
    if (bMain && !aMain) return 1;

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
  }

  if (isMainPathSkill && skill.tier > currentTier) {
    alert(
      `You are Tier ${currentTier}. You cannot take a Tier ${skill.tier} skill on your main path yet.`
    );
    return;
  }

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

  // Recompute totals first so we know current SP
  recomputeTotals();
  const available =
    parseInt(totalSkillPointsInput.value, 10) >= 0
      ? parseInt(totalSkillPointsInput.value, 10)
      : 0;

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

  skillFreeFlag.checked = false;
  populateSkillSelect();
  renderSelectedSkills();
  recomputeTotals();
  updatePathAndProfessionDisplays();
}

function renderSelectedSkills() {
  selectedSkillsBody.innerHTML = "";

  const sorted = getSortedSelectedSkills();

  sorted.forEach((sk) => {
    const tr = document.createElement("tr");

    // Remove button (left-most)
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
      if (originalIndex !== -1) {
        if (confirm("Are you sure you want to remove this skill?")) {
          selectedSkills.splice(originalIndex, 1);
          populateSkillSelect();
          renderSelectedSkills();
          recomputeTotals();
          updatePathAndProfessionDisplays();
        }
      }
    });
    tdMinus.appendChild(minusBtn);
    tr.appendChild(tdMinus);

    // Tier
    const tdTier = document.createElement("td");
    tdTier.textContent = sk.tier;
    tr.appendChild(tdTier);

    // Path
    const tdPath = document.createElement("td");
    tdPath.textContent = sk.path;
    tr.appendChild(tdPath);

    // Name
    const tdName = document.createElement("td");
    tdName.textContent = sk.name;
    tr.appendChild(tdName);

    // Uses & Periodicity
    let usesDisplay = "—";
    let periodicityText = "—";
    const metaSkillList = skillsByPath[sk.path] || [];
    const metaSkill = metaSkillList.find((s) => s.name === sk.name);
    if (metaSkill) {
      const usesInfo = computeSkillUses(metaSkill);
      if (usesInfo) {
        if (usesInfo.display) usesDisplay = usesInfo.display;
        if (usesInfo.periodicity) periodicityText = usesInfo.periodicity;
        if (usesInfo.display === "∞" && !usesInfo.periodicity) {
          periodicityText = "Unlimited";
        }
      }
    }

    const tdUses = document.createElement("td");
    tdUses.textContent = usesDisplay;
    tr.appendChild(tdUses);

    const tdPeriod = document.createElement("td");
    tdPeriod.textContent = periodicityText;
    tr.appendChild(tdPeriod);

    // Cost
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

  renderEvents();
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
    version: 9,
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
    bardMilestone3: !!(bardMilestone3Checkbox && bardMilestone3Checkbox.checked)
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

  selectedSkills = Array.isArray(state.selectedSkills)
    ? state.selectedSkills.slice()
    : [];
  renderSelectedSkills();

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
  updatePathAndProfessionDisplays();
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

  // Parchment-like background
  doc.setFillColor(245, 233, 210);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  const margin = 40;
  let y = margin;

  const charName = characterNameInput.value || "";
  const playerName = playerNameInput.value || "";
  const path = pathDisplaySelect.value || "";
  const faction = factionSelect.value || "";
  const secondaryPaths = secondaryPathsDisplay.value || "";
  const professions = professionsDisplay.value || "";
  const tier = tierInput.value || "0";
  const remainingSP = totalSkillPointsInput.value || "0";
  const organizations = getOrganizations().join(", ");

  // Header
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 30);
  doc.text("Larp Adventures", margin, y);

  doc.setFontSize(14);
  doc.setFont("Helvetica", "normal");
  doc.setTextColor(70, 70, 90);
  doc.text("Character Sheet", margin, y + 18);

  if (playerName) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 140);
    const label = `Player: ${playerName}`;
    const labelWidth = doc.getTextWidth(label);
    doc.text(label, pageWidth - margin - labelWidth, y);
  }

  y += 32;
  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.7);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // Basic Information box
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(40, 40, 60);
  doc.text("Basic Information", margin, y);
  y += 10;

  const basicBoxTop = y - 8;
  const basicBoxHeight = 90;
  const basicBoxWidth = pageWidth - margin * 2;
  doc.setDrawColor(210, 210, 225);
  doc.setLineWidth(0.8);
  doc.roundedRect(
    margin - 4,
    basicBoxTop,
    basicBoxWidth + 8,
    basicBoxHeight,
    6,
    6
  );

  const colLeftX = margin;
  const colRightX = margin + basicBoxWidth / 2 + 4;
  let infoY = y + 6;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 80);

  function labelValue(label, value, x, yLine) {
    const labelText = `${label}:`;

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(80, 80, 110);
    doc.text(labelText, x, yLine);

    const labelWidth = doc.getTextWidth(labelText);
    const valueX = x + labelWidth + 6;

    doc.setFont("Helvetica", "normal");
    doc.setTextColor(20, 20, 30);
    doc.text(value || "-", valueX, yLine);
  }

  labelValue("Character", charName, colLeftX, infoY);
  labelValue("Path", path, colLeftX, infoY + 16);
  labelValue("Secondary", secondaryPaths, colLeftX, infoY + 32);
  labelValue("Professions", professions, colLeftX, infoY + 48);

  labelValue("Faction", faction, colRightX, infoY);
  labelValue("Tier", tier, colRightX, infoY + 16);
  labelValue("Skill Pts", remainingSP, colRightX, infoY + 32);
  labelValue("Organizations", organizations, colRightX, infoY + 48);

  y = basicBoxTop + basicBoxHeight + 24;

  // Skills header
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(40, 40, 60);
  doc.text("Skills", margin, y);
  y += 10;

  const tableWidth = pageWidth - margin * 2;
  const headerHeight = 22;

  // Table header background
  doc.setFillColor(32, 40, 70);
  doc.setDrawColor(32, 40, 70);
  doc.rect(margin, y, tableWidth, headerHeight, "F");

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(245, 245, 255);

  // Column positions: Tier | Path / Profession (two-line label) | Skill Name | Uses
  const colTierX = margin + 6;
  const colPathX = margin + 60;
  const colSkillX = margin + 190;
  const colUsesX = margin + tableWidth - 120; // leave more breathing room for Uses

  doc.text("Tier", colTierX, y + 12);

  // Two-line header: "Path /" then "Profession" under it
  doc.text("Path /", colPathX, y + 9);
  doc.text("Profession", colPathX, y + 18);

  doc.text("Skill Name", colSkillX, y + 12);
  doc.text("Uses", colUsesX, y + 12);

  y += headerHeight + 4;

  doc.setFont("Helvetica", "normal");
  doc.setTextColor(20, 20, 30);
  doc.setLineWidth(0.25);
  doc.setDrawColor(200, 200, 210);

  const sorted = getSortedSelectedSkills();
  const rowLineHeight = 14;

  sorted.forEach((sk, index) => {
    // New page if needed
    if (y > pageHeight - margin - 40) {
      doc.addPage();

      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      doc.setFillColor(245, 233, 210);
      doc.rect(0, 0, pw, ph, "F");

      y = margin;

      // Continued header
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(40, 40, 60);
      doc.text("Skills (continued)", margin, y);
      y += 10;

      doc.setFillColor(32, 40, 70);
      doc.setDrawColor(32, 40, 70);
      doc.rect(margin, y, tableWidth, headerHeight, "F");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(245, 245, 255);
      doc.text("Tier", colTierX, y + 12);
      doc.text("Path /", colPathX, y + 9);
      doc.text("Profession", colPathX, y + 18);
      doc.text("Skill Name", colSkillX, y + 12);
      doc.text("Uses", colUsesX, y + 12);

      y += headerHeight + 4;
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(20, 20, 30);
      doc.setLineWidth(0.25);
      doc.setDrawColor(200, 200, 210);
    }

    // Zebra striping
    if (index % 2 === 0) {
      doc.setFillColor(245, 246, 252);
      doc.rect(margin, y - 2, tableWidth, rowLineHeight + 3, "F");
    }

    // Row separator
    doc.line(margin, y + rowLineHeight, margin + tableWidth, y + rowLineHeight);

    // Tier & Path
    doc.text(String(sk.tier), colTierX, y + 10);
    doc.text(sk.path, colPathX, y + 10);

    // Compute Uses info from meta skill
    let usesDisplay = "—";
    const metaSkillList = skillsByPath[sk.path] || [];
    const metaSkill = metaSkillList.find((s) => s.name === sk.name);
    if (metaSkill) {
      const usesInfo = computeSkillUses(metaSkill);
      if (usesInfo) {
        if (usesInfo.display === "∞") {
          usesDisplay = "Unlimited";
        } else if (usesInfo.display) {
          usesDisplay = usesInfo.display;
        }
      }
    }

    // Skill name (no uses mashed in here)
    const skillLine = sk.name;

    // Wrapping widths
    const maxSkillWidth = colUsesX - colSkillX - 10;
    const skillLines = doc.splitTextToSize(skillLine, maxSkillWidth);

    // Uses column may also need wrapping
    const maxUsesWidth = pageWidth - margin - colUsesX;
    const usesLines = doc.splitTextToSize(usesDisplay, maxUsesWidth);

    // Draw skill text
    doc.text(skillLines, colSkillX, y + 10);

    // Draw uses text (possibly multi-line)
    doc.text(usesLines, colUsesX, y + 10);

    // Row height is max of both columns
    const rowLines = Math.max(skillLines.length, usesLines.length);
    y += rowLineHeight * rowLines;
  });

  // Save PDF with character-based name
  let suggestedName = charName ? charName : "larp_character";
  let baseName = prompt("Enter a name for the exported PDF:", suggestedName);
  if (!baseName) {
    return;
  }
  baseName = baseName.replace(/[^a-z0-9_\-]+/gi, "_");

  doc.save(baseName + "_sheet.pdf");
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

  addEventBtn.addEventListener("click", addEventFromInputs);

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

  exportPdfBtn.addEventListener("click", exportCharacterPDF);

  pathDisplaySelect.addEventListener("change", () => {
    renderSelectedSkills();
    recomputeTotals();
    updatePathAndProfessionDisplays();
  });

  function onMilestoneChange() {
    updateSkillDescriptionFromSelect();
    renderSelectedSkills();
  }
  if (artificerMilestone2Checkbox)
    artificerMilestone2Checkbox.addEventListener("change", onMilestoneChange);
  if (artificerMilestone3Checkbox)
    artificerMilestone3Checkbox.addEventListener("change", onMilestoneChange);
  if (bardMilestone2Checkbox)
    bardMilestone2Checkbox.addEventListener("change", onMilestoneChange);
  if (bardMilestone3Checkbox)
    bardMilestone3Checkbox.addEventListener("change", onMilestoneChange);

  recomputeTotals();
  updatePathAndProfessionDisplays();
});
