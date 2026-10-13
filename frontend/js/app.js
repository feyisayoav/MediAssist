const GATEWAY_URL = (window.APP_CONFIG && window.APP_CONFIG.gatewayUrl != null ? window.APP_CONFIG.gatewayUrl : "http://localhost:8080");

const form = document.getElementById("diagnosis-form");
const resultEl = document.getElementById("result");
const checklistEl = document.getElementById("symptom-checklist");
const filterInput = document.getElementById("symptom-filter");
const countEl = document.getElementById("symptom-count");
const selectedEl = document.getElementById("selected-symptoms");
const selectedCountEl = document.getElementById("selected-count");
const submitButton = form.querySelector("button[type='submit']");

let allSymptoms = [];
const selectedSymptoms = new Set();

function displayLabel(symptom) {
  const spaced = symptom.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function renderChecklist(symptoms) {
  if (symptoms.length === 0) {
    checklistEl.innerHTML = '<p class="empty-text">No symptoms available. Is the model loaded?</p>';
    return;
  }

  checklistEl.innerHTML = symptoms
    .map(
      (symptom) => `
      <label data-symptom="${escapeHtml(symptom)}">
        <input type="checkbox" name="symptom" value="${escapeHtml(symptom)}" />
        ${escapeHtml(displayLabel(symptom))}
      </label>
    `
    )
    .join("");
}

function renderSelected() {
  selectedCountEl.textContent = selectedSymptoms.size;

  if (selectedSymptoms.size === 0) {
    selectedEl.innerHTML = '<p class="empty-text">None selected yet.</p>';
    return;
  }

  selectedEl.innerHTML = Array.from(selectedSymptoms)
    .map(
      (symptom) => `
      <span class="symptom-chip" data-symptom="${escapeHtml(symptom)}">
        ${escapeHtml(displayLabel(symptom))}
        <button type="button" class="chip-remove" data-symptom="${escapeHtml(symptom)}" aria-label="Remove ${escapeHtml(
          displayLabel(symptom)
        )}">×</button>
      </span>
    `
    )
    .join("");
}

checklistEl.addEventListener("change", (e) => {
  if (e.target.name !== "symptom") return;
  if (e.target.checked) {
    selectedSymptoms.add(e.target.value);
  } else {
    selectedSymptoms.delete(e.target.value);
  }
  renderSelected();
});

selectedEl.addEventListener("click", (e) => {
  if (!e.target.classList.contains("chip-remove")) return;
  const symptom = e.target.dataset.symptom;
  selectedSymptoms.delete(symptom);
  const checkbox = checklistEl.querySelector(`input[value="${cssEscape(symptom)}"]`);
  if (checkbox) checkbox.checked = false;
  renderSelected();
});

function applyFilter() {
  const query = filterInput.value.trim().toLowerCase();
  const labels = checklistEl.querySelectorAll("label[data-symptom]");
  let visibleCount = 0;

  labels.forEach((label) => {
    const matches = label.dataset.symptom.replace(/_/g, " ").includes(query);
    label.classList.toggle("hidden", !matches);
    if (matches) visibleCount++;
  });

  countEl.textContent = query
    ? `Showing ${visibleCount} of ${allSymptoms.length} symptoms`
    : `${allSymptoms.length} symptoms available`;
}

async function loadSymptoms() {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/diagnosis/symptoms`);
    const data = await res.json();

    if (!res.ok) {
      checklistEl.innerHTML = `<p class="empty-text">Could not load symptoms: ${escapeHtml(
        data.detail || data.error || "unknown error"
      )}</p>`;
      submitButton.disabled = true;
      return;
    }

    allSymptoms = data.symptoms || [];
    renderChecklist(allSymptoms);
    countEl.textContent = `${allSymptoms.length} symptoms available`;
  } catch (err) {
    checklistEl.innerHTML = `<p class="empty-text">Could not reach the API gateway at ${escapeHtml(GATEWAY_URL || location.origin)}.</p>`;
    submitButton.disabled = true;
  }
}

filterInput.addEventListener("input", applyFilter);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const age = Number(document.getElementById("age").value);
  const gender = document.getElementById("gender").value;
  const symptoms = Array.from(selectedSymptoms);

  if (symptoms.length === 0) {
    showError("Select at least one symptom.");
    return;
  }

  showLoading();
  submitButton.disabled = true;

  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/diagnosis/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        age,
        gender,
        symptoms,
        vital_signs: null,
        lab_values: null,
        medical_history: [],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.detail || data.error || "Request failed");
      return;
    }

    showResult(data);
  } catch (err) {
    showError("Could not reach the API gateway. Is it running at " + (GATEWAY_URL || location.origin) + "?");
  } finally {
    submitButton.disabled = false;
  }
});

function showLoading() {
  resultEl.classList.remove("hidden", "error");
  resultEl.innerHTML = '<p class="muted">Predicting…</p>';
}

function showError(message) {
  resultEl.classList.remove("hidden");
  resultEl.classList.add("error");
  resultEl.innerHTML = `<h2>${UI.icon("alert", 18)} Something went wrong</h2><p>${escapeHtml(message)}</p>`;
}

// SVG progress ring for the model's confidence in its top prediction.
function confidenceRing(pct) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return `
    <div class="ring" role="img" aria-label="Model confidence ${Math.round(pct)} percent">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle class="ring-track" cx="42" cy="42" r="${r}" fill="none" stroke-width="8"></circle>
        <circle class="ring-fill" cx="42" cy="42" r="${r}" fill="none" stroke-width="8" stroke-dasharray="${dash} ${c}"></circle>
      </svg>
      <span class="ring-label">${Math.round(pct)}%</span>
    </div>`;
}

function showResult(data) {
  resultEl.classList.remove("hidden", "error");

  const candidates = (data.top_candidates || [])
    .map((c) => {
      const pct = c.probability * 100;
      return `<li>
        <span>${escapeHtml(c.disease)}</span>
        <span class="bar"><span style="width:${pct.toFixed(1)}%"></span></span>
        <span>${pct.toFixed(1)}%</span>
      </li>`;
    })
    .join("");

  const precautions = (data.precautions || [])
    .map((p) => `<li>${UI.icon("check", 16)}<span>${escapeHtml(p)}</span></li>`)
    .join("");

  resultEl.innerHTML = `
    <div class="result-head">
      ${confidenceRing(data.confidence * 100)}
      <div>
        <div class="eyebrow">Most likely condition</div>
        <h2>${escapeHtml(data.predicted_disease)}</h2>
        <p>Model confidence</p>
      </div>
    </div>
    ${data.description ? `<p class="muted">${escapeHtml(data.description)}</p>` : ""}
    ${candidates ? `<div class="section-title">Top candidates</div><ul class="candidate-list">${candidates}</ul>` : ""}
    ${precautions ? `<div class="section-title">Suggested precautions</div><ul class="check-list">${precautions}</ul>` : ""}
    <div class="callout callout-warn" style="margin-top:20px">
      ${UI.icon("alert", 18)}
      <span>Educational estimate only — not a medical diagnosis. If you're worried about your health, speak to a qualified clinician.</span>
    </div>
    <div class="result-foot"><span class="badge badge-outline">Model ${escapeHtml(data.model_version)}</span></div>
  `;
}

// Escapes quotes too, so it is safe inside attribute values (the old
// textContent/innerHTML trick leaves " and ' untouched).
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function cssEscape(value) {
  return value.replace(/(["\\])/g, "\\$1");
}

loadSymptoms();
