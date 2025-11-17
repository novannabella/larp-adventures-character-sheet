// Sharp Mind beta overlay v2 - non-destructive tester
// Load this AFTER script.js in a test HTML (e.g. index-sharpmind-beta.html)

(function () {
  // We only require addSelectedSkill to exist; selectedSkills is a top-level binding, not window property.
  if (typeof addSelectedSkill !== "function") {
    console.warn("Sharp Mind beta v2: addSelectedSkill not found; overlay not applied.");
    return;
  }

  console.log("Sharp Mind beta overlay v2 loaded.");

  const original_addSelectedSkill = addSelectedSkill;
  const sharpMindAssignments_beta = [];
  // Expose for debugging if desired
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

  function handleSharpMindSelection_beta(sharpMindSkill) {
    const pathSelect = window.pathDisplaySelect;
    const mainPath = pathSelect ? (pathSelect.value || "") : "";

    if (!mainPath) {
      alert("Sharp Mind (beta): Please choose your main Path in Basic Information first.");
      return;
    }

    const scholarTier = getScholarTier_beta();

    // Build set of already-boosted skills (by path+name)
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

  // Wrap the existing addSelectedSkill in a beta layer
  addSelectedSkill = function () {
    const beforeCount = (selectedSkills || []).length;

    // Call original logic
    original_addSelectedSkill();

    const afterCount = (selectedSkills || []).length;
    if (afterCount <= beforeCount) {
      // No new skill was actually added
      return;
    }

    const last = (selectedSkills || [])[afterCount - 1];
    if (!last) return;

    if (last.path === "Scholar" && /Sharp Mind\b/i.test(last.name)) {
      try {
        handleSharpMindSelection_beta(last);
      } catch (e) {
        console.warn("Sharp Mind beta v2 error:", e);
      }
    }
  };
})();
