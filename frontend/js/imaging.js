const GATEWAY_URL = (window.APP_CONFIG && window.APP_CONFIG.gatewayUrl != null ? window.APP_CONFIG.gatewayUrl : "http://localhost:8080");

const form = document.getElementById("imaging-form");
const resultEl = document.getElementById("result");
const imageTypeSelect = document.getElementById("image-type");
const conditionsNoteEl = document.getElementById("conditions-note");
const fileInput = document.getElementById("image-file");
const dropzone = document.getElementById("dropzone");
const previewWrap = document.getElementById("image-preview-wrap");
const previewImg = document.getElementById("image-preview");
const previewName = document.getElementById("preview-name");
const previewSize = document.getElementById("preview-size");
const previewRemove = document.getElementById("preview-remove");
const overrideToggle = document.getElementById("threshold-override-toggle");
const sliderWrap = document.getElementById("threshold-slider-wrap");
const thresholdInput = document.getElementById("threshold");
const thresholdValueEl = document.getElementById("threshold-value");
const analyzeButton = document.getElementById("analyze-button");

let lastHeatmapSrc = null; // data: URL of the Grad-CAM overlay from the most recent result

function displayLabel(name) {
  return name.replace(/_/g, " ");
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadConditions() {
  const imageType = imageTypeSelect.value;
  conditionsNoteEl.textContent = "Loading…";
  analyzeButton.disabled = false;

  try {
    const res = await fetch(
      `${GATEWAY_URL}/api/v1/imaging/conditions?image_type=${encodeURIComponent(imageType)}`
    );
    const data = await res.json();

    if (res.status === 501) {
      conditionsNoteEl.textContent = `${displayLabel(imageType)} isn't built yet — analysis is disabled for this image type.`;
      analyzeButton.disabled = true;
      return;
    }

    if (!res.ok) {
      conditionsNoteEl.textContent = `Could not load conditions: ${data.detail || data.error || "unknown error"}`;
      analyzeButton.disabled = true;
      return;
    }

    const conditions = (data.conditions || []).map(displayLabel).join(", ");
    conditionsNoteEl.textContent = `This model checks for: ${conditions}`;
  } catch (err) {
    conditionsNoteEl.textContent = `Could not reach the API gateway at ${GATEWAY_URL || location.origin}.`;
    analyzeButton.disabled = true;
  }
}

imageTypeSelect.addEventListener("change", loadConditions);

// ---- File selection: browse, drag-and-drop, preview, remove ----
function showPreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    previewName.textContent = file.name;
    previewSize.textContent = formatBytes(file.size);
    previewWrap.classList.remove("hidden");
    dropzone.classList.add("hidden");
  };
  reader.readAsDataURL(file);
}

function clearPreview() {
  fileInput.value = "";
  previewImg.removeAttribute("src");
  previewWrap.classList.add("hidden");
  dropzone.classList.remove("hidden");
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) {
    clearPreview();
    return;
  }
  showPreview(file);
});

previewRemove.addEventListener("click", clearPreview);

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("is-dragging");
  })
);
["dragleave", "dragend", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, () => dropzone.classList.remove("is-dragging"))
);
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer && e.dataTransfer.files[0];
  if (!file) return;
  if (!/^image\/(png|jpeg)$/.test(file.type)) {
    showError("Please choose a PNG or JPEG image.");
    return;
  }
  // Assigning .files requires a DataTransfer; this keeps the real <input> as the source of truth.
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
});

// The slider only matters (and is only sent) when the override is on —
// by default the backend picks each condition's own tuned threshold, which
// means simply not including the field in the request.
overrideToggle.addEventListener("change", () => {
  sliderWrap.classList.toggle("hidden", !overrideToggle.checked);
});

thresholdInput.addEventListener("input", () => {
  thresholdValueEl.textContent = Number(thresholdInput.value).toFixed(2);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = fileInput.files[0];
  if (!file) {
    showError("Choose an image to upload.");
    return;
  }

  const formData = new FormData();
  formData.append("image", file);
  formData.append("image_type", imageTypeSelect.value);
  if (overrideToggle.checked) {
    formData.append("threshold", thresholdInput.value);
  }
  // else: omit entirely, so the backend defaults to per-class tuned thresholds

  showLoading();
  analyzeButton.disabled = true;

  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/imaging/analyze`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (res.status === 501) {
      showError(`This image type isn't supported yet: ${data.detail || ""}`);
      return;
    }
    if (res.status === 422) {
      showError(`There's a problem with the upload: ${data.detail || ""}`);
      return;
    }
    if (res.status === 503) {
      showError(`The imaging model isn't available right now: ${data.detail || ""}`);
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
    analyzeButton.disabled = false;
  }
});

function showLoading() {
  resultEl.classList.remove("hidden", "error");
  resultEl.innerHTML = '<p class="muted">Analyzing…</p>';
}

function showError(message) {
  resultEl.classList.remove("hidden");
  resultEl.classList.add("error");
  resultEl.innerHTML = `<h2>${UI.icon("alert", 18)} Something went wrong</h2><p>${escapeHtml(message)}</p>`;
}

function showResult(data) {
  resultEl.classList.remove("hidden", "error");

  // Sort by probability descending so the most notable findings come first.
  const sortedFindings = [...data.findings].sort((a, b) => b.probability - a.probability);

  const findingsHtml = sortedFindings
    .map((f) => {
      const pct = (f.probability * 100).toFixed(1);
      const thresholdPct = (f.threshold_used * 100).toFixed(1);
      const positiveClass = f.positive ? "finding-positive" : "";
      return `
        <li class="finding-row ${positiveClass}">
          <span class="finding-name" title="${escapeHtml(displayLabel(f.condition))}">${escapeHtml(displayLabel(f.condition))}</span>
          <span class="finding-bar-track">
            <span class="finding-bar-fill" style="width: ${pct}%"></span>
            <span class="finding-threshold-tick" style="left: ${thresholdPct}%" title="Threshold: ${thresholdPct}%"></span>
          </span>
          <span class="finding-pct">${pct}%</span>
        </li>`;
    })
    .join("");

  const positives = data.positive_findings.length
    ? data.positive_findings
        .map((p) => `<span class="badge badge-danger">${UI.icon("alert", 13)} ${escapeHtml(displayLabel(p))}</span>`)
        .join("")
    : `<span class="badge badge-outline">No findings above threshold</span>`;

  const thresholdModeText =
    data.threshold_mode === "global_override"
      ? `Fixed threshold: ${data.global_threshold}`
      : "Per-condition tuned thresholds (tick marks show each cutoff)";

  lastHeatmapSrc = data.heatmap_base64 ? `data:image/png;base64,${data.heatmap_base64}` : null;

  const heatmapHtml = lastHeatmapSrc
    ? `
      <div class="heatmap-wrap">
        <div class="heatmap-toggle" role="group" aria-label="Image view">
          <button type="button" class="active" data-view="heatmap">Heatmap</button>
          <button type="button" data-view="original">Original</button>
        </div>
        <div class="heatmap-frame"><img id="heatmap-img" src="${lastHeatmapSrc}" alt="Grad-CAM heatmap overlay" /></div>
        <p class="heatmap-caption">Grad-CAM shows where the model looked for its top-ranked finding — even when that finding fell below its threshold.</p>
      </div>`
    : "";

  resultEl.innerHTML = `
    ${heatmapHtml}
    <div class="section-title" style="margin-top:${heatmapHtml ? 18 : 0}px">Flagged findings</div>
    <div class="positive-summary">${positives}</div>
    <div class="section-title">All findings</div>
    <ul class="findings-list">${findingsHtml}</ul>
    <div class="result-foot">
      <span class="badge badge-outline">Model ${escapeHtml(data.model_version)}</span>
      <span>${escapeHtml(thresholdModeText)}</span>
    </div>
    <div class="callout callout-warn" style="margin-top:14px">
      ${UI.icon("alert", 18)}
      <span>Educational demo — not a diagnostic tool. Have any real scan reviewed by a qualified clinician.</span>
    </div>
  `;
}

// Heatmap / Original toggle (delegated: the buttons are re-created on every result).
resultEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".heatmap-toggle button");
  if (!btn) return;
  const img = document.getElementById("heatmap-img");
  if (!img) return;
  const showOriginal = btn.dataset.view === "original";
  if (showOriginal && !previewImg.getAttribute("src")) return; // no original available
  img.src = showOriginal ? previewImg.getAttribute("src") : lastHeatmapSrc;
  resultEl.querySelectorAll(".heatmap-toggle button").forEach((b) => b.classList.toggle("active", b === btn));
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

loadConditions();
