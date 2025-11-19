// tier-calculations.js
// -----------------------------------------
// Tier calculations for Events
// -----------------------------------------

/**
 * Returns character Tier based on qualifying events.
 * Tier progression is triangular (1 → 1, 2 → 3, 3 → 6, 4 → 10, ...)
 * Hard-capped at Tier 10 for the current season.
 */
function computeTierFromEvents(qualifyingCount) {
  let remaining = qualifyingCount;
  let tier = 0;
  let needed = 1;

  while (remaining >= needed && tier < 10) {
    tier++;
    remaining -= needed;
    needed++;
  }

  return Math.min(tier, 10);
}

/**
 * Returns how many qualifying events remain until next Tier.
 * If already Tier 10, returns 0.
 */
function computeEventsToNextTier(qualifyingCount, currentTier) {
  if (currentTier >= 10) return 0;

  const nextTier = currentTier + 1;
  const totalNeededForNext =
    (nextTier * (nextTier + 1)) / 2; // Triangular number T(n)

  const remaining = totalNeededForNext - qualifyingCount;
  return remaining > 0 ? remaining : 0;
}
