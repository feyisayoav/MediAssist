const GATEWAY_URL = (window.APP_CONFIG && window.APP_CONFIG.gatewayUrl != null ? window.APP_CONFIG.gatewayUrl : "http://localhost:8080");

const form = document.getElementById("drugs-form");
const resultEl = document.getElementById("result");
const conditionInput = document.getElementById("condition-input");
const conditionOptionsEl = document.getElementById("condition-options");
const conditionCountEl = document.getElementById("condition-count");
const ageInput = document.getElementById("age");
const medsInput = document.getElementById("current-medications");
const allergiesInput = document.getElementById("allergies");
const recommendButton = document.getElementById("recommend-button");

let allConditions = [];

function parseCommaList(value) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadConditions() {
  conditionCountEl.textContent = "Loading conditions…";
  recommendButton.disabled = false;

  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/drugs/conditions`);
    const data = await res.json();

    if (!res.ok) {
      conditionCountEl.textContent = `Could not load conditions: ${data.detail || data.error || "unknown error"}`;
      recommendButton.disabled = true;
      return;
    }

    allConditions = data.conditions || [];
    conditionOptionsEl.innerHTML = allConditions.map((c) => `<option value="${escapeHtml(c)}"></option>`).join("");
    conditionCountEl.textContent = `${allConditions.length} conditions available — start typing to see suggestions`;
  } catch (err) {
    conditionCountEl.textContent = `Could not reach the API gateway at ${GATEWAY_URL || location.origin}.`;
    recommendButton.disabled = true;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const condition = conditionInput.value.trim();
  if (!condition) {
    showError("Enter a condition.");
    return;
  }

  const payload = {
    condition,
    age: ageInput.value ? Number(ageInput.value) : null,
    current_medications: parseCommaList(medsInput.value),
    allergies: parseCommaList(allergiesInput.value),
  };

  showLoading();
  recommendButton.disabled = true;

  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/drugs/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.status === 503) {
      showError(`The drug recommendation data isn't available right now: ${data.detail || ""}`);
      return;
    }
    if (res.status === 422) {
      showError(data.detail || "There's a problem with the request.");
      return;
    }
    if (!res.ok) {
      showError(data.detail || data.error || "Request failed");
      return;
    }

    showResult(data);
  } catch (err) {
    showError("Could not reach the API gateway. Is it running at " + (GATEWAY_URL || location.origin) + "?");
  } finally {
    recommendButton.disabled = false;
  }
});

function showLoading() {
  resultEl.classList.remove("hidden", "error");
  resultEl.innerHTML = '<p class="muted">Looking up recommendations…</p>';
}

function showError(message) {
  resultEl.classList.remove("hidden");
  resultEl.classList.add("error");
  resultEl.innerHTML = `<h2>${UI.icon("alert", 18)} Something went wrong</h2><p>${escapeHtml(message)}</p>`;
}

function showResult(data) {
  resultEl.classList.remove("hidden", "error");

  // No match — point the user toward real vocabulary rather than leaving them guessing.
  if (!data.condition_matched) {
    const suggestions = allConditions.slice(0, 8).map(escapeHtml).join(", ");
    resultEl.innerHTML = `
      <div class="eyebrow">No data</div>
      <h2 style="font-size:1.25rem;margin:4px 0 8px">“${escapeHtml(data.condition)}” isn't in the dataset</h2>
      <p class="muted">A few conditions that are: ${suggestions}${allConditions.length > 8 ? ", …" : ""}</p>
    `;
    return;
  }

  // The backend sends contraindication_rules_loaded:false when no rules file exists. In that
  // case "not flagged" means "not checked", never "confirmed safe" — so say so loudly.
  const rulesWarning = !data.contraindication_rules_loaded
    ? `<div class="callout callout-warn">${UI.icon("alert", 18)}<span>No contraindication rules are loaded — every unflagged result below is <strong>unchecked</strong>, not confirmed safe.</span></div>`
    : "";

  const sorted = [...data.recommendations].sort((a, b) => b.score - a.score);

  const cards = sorted
    .map((rec, i) => {
      const pct = ((rec.score / 10) * 100).toFixed(1);
      // Deliberately NO "safe"/"no flags" badge for unflagged drugs: the rules table is
      // illustrative and non-exhaustive, so absence of a flag is not a safety signal.
      const reasons = rec.contraindication_reasons.length
        ? `<div class="contraindication-reasons">${rec.contraindication_reasons
            .map((r) => `<span class="badge badge-danger">${UI.icon("alert", 13)} ${escapeHtml(r)}</span>`)
            .join("")}</div>`
        : "";
      return `
        <li class="drug-card ${rec.contraindicated ? "flagged" : ""}">
          <div class="drug-rank">${i + 1}</div>
          <div>
            <div class="drug-name">${escapeHtml(rec.drug)}</div>
            <div class="drug-meta">${Number(rec.review_count).toLocaleString()} reviews</div>
          </div>
          <div class="drug-score"><strong>${rec.score.toFixed(1)}</strong><span>/10</span></div>
          <span class="bar"><span style="width:${pct}%"></span></span>
          ${reasons}
        </li>`;
    })
    .join("");

  resultEl.innerHTML = `
    <div class="eyebrow">Condition</div>
    <h2 style="font-size:1.45rem;letter-spacing:-.02em;margin:2px 0 4px">${escapeHtml(data.condition_matched)}</h2>
    <p class="muted" style="font-size:.86rem;margin-bottom:16px">Top ${sorted.length} medications ranked from aggregated patient reviews</p>
    ${rulesWarning}
    <ul class="drug-list">${cards}</ul>
    <div class="callout callout-info" style="margin-top:16px">${UI.icon("info", 18)}<span>${escapeHtml(data.disclaimer)}</span></div>
    <div class="result-foot"><span class="badge badge-outline">Model ${escapeHtml(data.model_version)}</span></div>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

loadConditions();
