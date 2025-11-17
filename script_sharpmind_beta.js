// Sharp Mind beta overlay v6 - label + description notes + better detail support
// Load this AFTER script.js in a test HTML (e.g. index-sharpmind-beta.html)

(function () {
  if (typeof addSelectedSkill !== "function") {
    console.warn("Sharp Mind beta v6: addSelectedSkill not found; overlay not applied.");
    return;
  }

  console.log("Sharp Mind beta overlay v6 loaded.");

  const original_addSelectedSkill = addSelectedSkill;
  const sharpMindAssignments_beta = [];
  window.sharpMindAssignments_beta = sharpMindAssignments_beta;

  function getScholarTier_beta() {
    let maxTier = 0;
    (selectedSkills || []).forEach((sk) => {
      if (sk.path === "Scholar") {
        const t = parseInt(sk.tier || 0, 10) || 0;
        if (t > maxTier) maxTier = t;
      }
    });
    return maxTier;
  }

  function buildSharpMindNotes_beta(path, name) {
    if (!path || !sharpMindAssignments_beta.length) return "";

    const asTarget = sharpMindAssignments_beta.filter(
      (a) => a.targetPath === path && a.targetName === name
    );

    // For source (Sharp Mind itself), match by path only so it works for both
    // "Sharp Mind" and "Sharp Mind - X" views.
    const asSource = sharpMindAssignments_beta.filter(
      (a) => a.sharpPath === path
    );

    const parts = [];

    if (asTarget.length) {
      const tiers = Array.from(
        new Set(asTarget.map((a) => parseInt(a.sharpTier || 0, 10) || 0))
      ).sort((a, b) => a - b);
      const tierLabel = tiers.map((t) => `Scholar Tier ${t}`).join(", ");
      const bonus = asTarget.length; // normally 1 per rules
      parts.push(
        `This skill has been enhanced by Sharp Mind (${tierLabel}): +${bonus} use(s) per day.`
      );
    }

    if (asSource.length && /^Sharp Mind\b/.test(name || "")) {
      const targets = asSource.map(
        (a) => `${a.targetName} (Tier ${a.targetTier || 0})`
      );
      const tierSet = Array.from(
        new Set(asSource.map((a) => parseInt(a.sharpTier || 0, 10) || 0))
      ).sort((a, b) => a - b);
      const tierLabel = tierSet.map((t) => `Scholar Tier ${t}`).join(", ");
      parts.push(
        `This Sharp Mind (${tierLabel}) is applied to: ${targets.join(", ")}.`
      );
    }

    return parts.join("\n");
  }

  function handleSharpMindSelection_beta(sharpMindSkill) {
    const pathSelect = document.getElementById("pathDisplay");
    const mainPath = pathSelect ? (pathSelect.value || "") : "";

    if (!mainPath) {
      alert("Sharp Mind (beta): Please choose your main Path in Basic Information first.");
      return;
    }

    const scholarTier = getScholarTier_beta();

    const alreadyBoosted = new Set(
      sharpMindAssignments_beta.map((a) => `${a.targetPath}::${a.targetName}`)
    );

    const eligible = (selectedSkills || []).filter((sk) => {
      if (sk.path !== mainPath) return false;
      const key = `${sk.path}::${sk.name}`;
      if (alreadyBoosted.has(key)) return false;
      const t = parseInt(sk.tier || 0, 10) || 0;
      if (scholarTier > 0 && t > scholarTier) return false; // strict RAW; relax if desired
      return true;
    });

    if (!eligible.length) {
      alert(
        "Sharp Mind (beta): You have no eligible Main Path skills to apply this to.\n\n" +
          "It cannot be applied to the same skill more than once,\n" +
          "and cannot be applied to a Main Path skill above your Scholar tier."
      );
      return;
    }

    const listText = eligible
      .map((s, i) => `${i + 1}. ${s.name} (Tier ${s.tier || 0})`)
      .join("\n");

    const choiceStr = prompt(
      "Sharp Mind (beta): choose a Main Path skill to enhance.\n\n" +
        listText +
        "\n\nEnter the number of the skill:"
    );

    if (choiceStr === null) {
      return;
    }

    const index = parseInt(choiceStr, 10) - 1;
    if (isNaN(index) || index < 0 || index >= eligible.length) {
      alert("Sharp Mind (beta): invalid choice. No skill was enhanced.");
      return;
    }

    const target = eligible[index];

    const assignment = {
      sharpPath: sharpMindSkill.path,
      sharpName: "", // will fill after rename
      sharpTier: parseInt(sharpMindSkill.tier || 0, 10) || 0,
      targetPath: target.path,
      targetName: target.name,
      targetTier: parseInt(target.tier || 0, 10) || 0
    };
    sharpMindAssignments_beta.push(assignment);

    try {
      if (sharpMindSkill && target && sharpMindSkill.name) {
        const originalName = sharpMindSkill.name;
        const newName = `${originalName} - ${target.name}`;
        sharpMindSkill.name = newName;
        assignment.sharpName = newName;

        if (typeof renderSelectedSkills === "function") {
          renderSelectedSkills();
        }
      }
    } catch (e) {
      console.warn("Sharp Mind beta v6 rename error:", e);
    }

    alert(
      "Sharp Mind applied (beta):\n\n" +
        `Source: ${sharpMindSkill.name} (Scholar Tier ${sharpMindSkill.tier || "?"})\n` +
        `Target: ${target.name} (Tier ${target.tier || 0})\n\n` +
        "Uses/day display is still original; notes are shown in descriptions/details only."
    );
  }

  // ---- Wrap addSelectedSkill ----
  addSelectedSkill = function () {
    const beforeCount = (selectedSkills || []).length;

    original_addSelectedSkill();

    const afterCount = (selectedSkills || []).length;
    if (afterCount <= beforeCount) {
      return;
    }

    const last = (selectedSkills || [])[afterCount - 1];
    if (!last) return;

    if (last.path === "Scholar" && /Sharp Mind\b/i.test(last.name)) {
      try {
        handleSharpMindSelection_beta(last);
      } catch (e) {
        console.warn("Sharp Mind beta v6 error:", e);
      }
    }
  };

  // ---- Description hook ----
  if (typeof updateSkillDescriptionFromSelect === "function") {
    const original_updateDesc = updateSkillDescriptionFromSelect;
    updateSkillDescriptionFromSelect = function () {
      original_updateDesc();
      try {
        if (!skillSelect || !skillDescription) return;
        const val = skillSelect.value;
        if (!val) return;
        const parts = val.split("::");
        const path = parts[0] || "";
        const name = parts[1] || "";
        const note = buildSharpMindNotes_beta(path, name);
        if (note) {
          const base = skillDescription.value || "";
          if (!base.includes("This skill has been enhanced by Sharp Mind") &&
              !base.includes("This Sharp Mind (Scholar Tier")) {
            skillDescription.value = (base + "\n\n" + note).trim();
          }
        }
      } catch (e) {
        console.warn("Sharp Mind beta v6 description hook error:", e);
      }
    };
  }

  // ---- Detail modal hook ----
  if (typeof showSkillDetail === "function") {
    const original_showSkillDetail = showSkillDetail;
    showSkillDetail = function (selectedRecord) {
      let recordToUse = selectedRecord;
      let fullSharpMindName = null;

      try {
        if (
          selectedRecord &&
          selectedRecord.path === "Scholar" &&
          /^Sharp Mind\b/.test(selectedRecord.name || "")
        ) {
          fullSharpMindName = selectedRecord.name;
          recordToUse = Object.assign({}, selectedRecord, { name: "Sharp Mind" });
        }
      } catch (e) {
        console.warn("Sharp Mind beta v6 pre-call detail logic error:", e);
      }

      original_showSkillDetail(recordToUse);

      try {
        if (!selectedRecord || !window.skillModalBody) return;

        // If this is a Sharp Mind - X, fix the heading to show the full name
        if (fullSharpMindName) {
          const heading = skillModalBody.querySelector("h3");
          if (heading) {
            heading.textContent = fullSharpMindName;
          }
        }

        const path = selectedRecord.path;
        const name = selectedRecord.name;
        const note = buildSharpMindNotes_beta(path, name);
        if (!note) return;

        const p = document.createElement("p");
        p.textContent = note;
        skillModalBody.appendChild(p);
      } catch (e) {
        console.warn("Sharp Mind beta v6 detail hook error:", e);
      }
    };
  }
})();
