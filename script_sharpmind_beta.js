// Sharp Mind beta overlay - non-destructive tester
// This file is meant to be loaded AFTER script.js in a test HTML (e.g. index-sharpmind-beta.html)

(function () {
  if (!window.addSelectedSkill || !window.selectedSkills) {
    console.warn("Sharp Mind beta: addSelectedSkill or selectedSkills not found; beta overlay not applied.");
    return;
  }

  console.log("Sharp Mind beta overlay loaded.");

  const original_addSelectedSkill = window.addSelectedSkill;
  const sharpMindAssignments_beta = [];
  window.sharpMindAssignments_beta = sharpMindAssignments_beta;

  function getScholarTier_beta() {
    let maxTier = 0;
    (window.selectedSkills || []).forEach((sk) => {
      if (sk.path === "Scholar") {
        const t = parseInt(sk.tier || 0, 10) || 0;
        if (t > maxTier) maxTier = t;
      }
    });
    return maxTier;
  }

  function handleSharpMindSelection_beta(sharpMindSkill) {
    const pathSelect = window.pathDisplaySelect;
    const mainPath = pathSelect ? (pathSelect.value || "") : "";

    if (!mainPath) {
      alert("Sharp Mind (beta): Please choose your main Path in Basic Information first.");
      return;
    }

    const scholarTier = getScholarTier_beta();

    // Skills on main path, not above Scholar tier, not already boosted
    const alreadyBoosted = new Set(
      sharpMindAssignments_beta.map((a) => `${a.targetPath}::${a.targetName}`)
    );

    const eligible = (window.selectedSkills || []).filter((sk) => {
      if (sk.path !== mainPath) return false;
      const key = `${sk.path}::${sk.name}`;
      if (alreadyBoosted.has(key)) return false;
      const t = parseInt(sk.tier || 0, 10) || 0;
      if (scholarTier > 0 && t > scholarTier) return false; // strict RAW
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
      // user cancelled
      return;
    }

    const index = parseInt(choiceStr, 10) - 1;
    if (isNaN(index) || index < 0 || index >= eligible.length) {
      alert("Sharp Mind (beta): invalid choice. No skill was enhanced.");
      return;
    }

    const target = eligible[index];

    sharpMindAssignments_beta.push({
      sharpPath: sharpMindSkill.path,
      sharpName: sharpMindSkill.name,
      sharpTier: parseInt(sharpMindSkill.tier || 0, 10) || 0,
      targetPath: target.path,
      targetName: target.name,
      targetTier: parseInt(target.tier || 0, 10) || 0
    });

    alert(
      "Sharp Mind applied (beta):\n\n" +
      `Source: ${sharpMindSkill.name} (Scholar Tier ${sharpMindSkill.tier || "?"})\n` +
      `Target: ${target.name} (Tier ${target.tier || 0})\n\n` +
      "This is a TEST ONLY overlay; it does not yet change uses/day or printed text."
    );
  }

  window.addSelectedSkill_beta_original = original_addSelectedSkill;

  window.addSelectedSkill = function () {
    const beforeCount = (window.selectedSkills || []).length;

    // Call the real function
    original_addSelectedSkill();

    const afterCount = (window.selectedSkills || []).length;
    if (afterCount <= beforeCount) {
      // Skill was not actually added (failed validation etc.)
      return;
    }

    const last = window.selectedSkills[afterCount - 1];
    if (!last) return;

    if (last.path === "Scholar" && /Sharp Mind\b/i.test(last.name)) {
      try {
        handleSharpMindSelection_beta(last);
      } catch (e) {
        console.warn("Sharp Mind beta error:", e);
      }
    }
  };
})();
