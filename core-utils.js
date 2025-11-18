// ---------- CORE UTILS (moved from script.js) ----------

// CSV parsing
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

// Date format helper
function formatDateDisplay(isoStr) {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  if (parts.length !== 3) return isoStr;
  const [y, m, d] = parts;
  if (!y || !m || !d) return isoStr;
  return `${m}-${d}-${y}`;
}

// HTML escaping + multi-line formatter
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

// Event / tier constants
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
