const GATEWAY_URL = (window.APP_CONFIG && window.APP_CONFIG.gatewayUrl != null ? window.APP_CONFIG.gatewayUrl : "http://localhost:8080");

const chatForm = document.getElementById("chat-form");
const chatLog = document.getElementById("chat-log");
const questionInput = document.getElementById("question-input");
const contextDiseaseInput = document.getElementById("context-disease");
const askButton = document.getElementById("ask-button");
const categoryGrid = document.getElementById("category-grid");
const suggestionPanel = document.getElementById("suggestion-panel");

// Generated once per page load, accepted-but-unused by the service today —
// included now for forward compatibility with future conversation memory.
const conversationId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

// Starter questions, phrased like the MedQuAD question types (symptoms / causes /
// treatment / prevention). They only pre-fill the input — nothing is sent automatically.
const CATEGORIES = [
  { key: "symptoms", label: "Symptoms", icon: "stethoscope", items: [
    "What are the symptoms of Diabetes?",
    "What are the symptoms of Asthma?",
    "What are the symptoms of Anemia?",
  ] },
  { key: "causes", label: "Causes", icon: "activity", items: [
    "What causes High Blood Pressure?",
    "What causes Migraine?",
    "What causes Kidney Stones?",
  ] },
  { key: "treatment", label: "Treatment", icon: "pill", items: [
    "What are the treatments for Migraine?",
    "How is Pneumonia treated?",
    "What are the treatments for Psoriasis?",
  ] },
  { key: "prevention", label: "Prevention", icon: "shield", items: [
    "How can Heart Disease be prevented?",
    "How can Type 2 Diabetes be prevented?",
    "How can Osteoporosis be prevented?",
  ] },
];

let activeCategory = null;
let busy = false;

function updateSendState() {
  askButton.disabled = busy || !questionInput.value.trim();
}

function renderCategories() {
  categoryGrid.innerHTML = CATEGORIES.map(
    (c) => `<button type="button" class="category-btn${c.key === activeCategory ? " active" : ""}" data-key="${c.key}">
      ${UI.icon(c.icon, 20)}<span>${c.label}</span></button>`
  ).join("");

  const cat = CATEGORIES.find((c) => c.key === activeCategory);
  if (!cat) {
    suggestionPanel.classList.add("hidden");
    return;
  }
  suggestionPanel.innerHTML = `
    <h3>${cat.label} — try asking</h3>
    <ul>${cat.items
      .map((q) => `<li><button type="button" data-question="${escapeHtml(q)}">${UI.icon("book", 16)}<span>${escapeHtml(q)}</span></button></li>`)
      .join("")}</ul>`;
  suggestionPanel.classList.remove("hidden");
}

categoryGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".category-btn");
  if (!btn) return;
  activeCategory = activeCategory === btn.dataset.key ? null : btn.dataset.key;
  renderCategories();
});

suggestionPanel.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-question]");
  if (!btn) return;
  questionInput.value = btn.dataset.question;
  activeCategory = null;
  renderCategories();
  updateSendState();
  questionInput.focus();
});

questionInput.addEventListener("input", updateSendState);

function clearEmptyState() {
  const empty = document.getElementById("chat-empty");
  if (empty) empty.remove();
}

function appendUserMessage(question) {
  clearEmptyState();
  const el = document.createElement("div");
  el.className = "chat-message chat-message-user";
  el.innerHTML = `<div class="chat-bubble chat-bubble-user">${escapeHtml(question)}</div>`;
  chatLog.appendChild(el);
  scrollToBottom();
}

function appendLoadingMessage() {
  const el = document.createElement("div");
  el.className = "chat-message chat-message-assistant";
  el.id = "loading-message";
  el.innerHTML = `
    <div class="chat-avatar">${UI.icon("heartPulse", 17)}</div>
    <div class="chat-bubble chat-bubble-assistant" aria-label="Thinking"><span class="typing"><span></span><span></span><span></span></span></div>`;
  chatLog.appendChild(el);
  scrollToBottom();
}

function removeLoadingMessage() {
  const el = document.getElementById("loading-message");
  if (el) el.remove();
}

function appendAssistantMessage(data) {
  const el = document.createElement("div");
  el.className = "chat-message chat-message-assistant";

  const confidenceNote = !data.confident
    ? `<div class="chat-confidence-warning">⚠ Low-confidence match — this may not directly answer your question.</div>`
    : "";

  // data.generated / data.source_answer are v4 fields — a v1-v3 response simply
  // omits the AI badge and source toggle, so this degrades cleanly.
  const generatedBadge = data.generated
    ? `<span class="chat-generated-badge">${UI.icon("sparkles", 12)} AI-generated</span><br />`
    : "";

  const sourceToggle = data.generated
    ? `
      <button type="button" class="chat-source-toggle" data-expanded="false">View original source</button>
      <div class="chat-source-answer hidden">${escapeHtml(data.source_answer)}</div>`
    : "";

  el.innerHTML = `
    <div class="chat-avatar">${UI.icon("heartPulse", 17)}</div>
    <div class="chat-bubble chat-bubble-assistant">
      ${generatedBadge}${escapeHtml(data.answer)}
      ${sourceToggle}
      ${confidenceNote}
      <div class="chat-meta">Matched: “${escapeHtml(data.matched_question)}” (similarity ${data.similarity_score.toFixed(2)})</div>
      <div class="chat-meta">${escapeHtml(data.disclaimer)}</div>
      <div class="chat-meta">Sources: ${data.sources.map(escapeHtml).join(", ")} · ${escapeHtml(data.model_version)}</div>
    </div>`;
  chatLog.appendChild(el);
  scrollToBottom();
}

function appendErrorMessage(message) {
  const el = document.createElement("div");
  el.className = "chat-message chat-message-assistant";
  el.innerHTML = `
    <div class="chat-avatar" style="background:var(--danger)">${UI.icon("alert", 17)}</div>
    <div class="chat-bubble chat-bubble-error">${escapeHtml(message)}</div>`;
  chatLog.appendChild(el);
  scrollToBottom();
}

function scrollToBottom() {
  chatLog.scrollTop = chatLog.scrollHeight;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const question = questionInput.value.trim();
  if (!question || busy) return;

  appendUserMessage(question);
  questionInput.value = "";
  busy = true;
  updateSendState();
  appendLoadingMessage();

  const payload = {
    question,
    context_disease: contextDiseaseInput.value.trim() || null,
    conversation_id: conversationId,
  };

  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/chatbot/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    removeLoadingMessage();

    if (res.status === 503) {
      appendErrorMessage(`The chatbot data isn't available right now: ${data.detail || ""}`);
      return;
    }
    if (res.status === 422) {
      appendErrorMessage(data.detail || "There's a problem with the question.");
      return;
    }
    if (!res.ok) {
      appendErrorMessage(data.detail || data.error || "Request failed");
      return;
    }

    appendAssistantMessage(data);
  } catch (err) {
    removeLoadingMessage();
    appendErrorMessage("Could not reach the API gateway. Is it running at " + (GATEWAY_URL || location.origin) + "?");
  } finally {
    busy = false;
    updateSendState();
    questionInput.focus();
  }
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Event delegation: one listener handles every "View original source" button.
chatLog.addEventListener("click", (e) => {
  if (!e.target.classList.contains("chat-source-toggle")) return;

  const button = e.target;
  const sourceDiv = button.nextElementSibling;
  const expanded = button.dataset.expanded === "true";

  sourceDiv.classList.toggle("hidden", expanded);
  button.dataset.expanded = String(!expanded);
  button.textContent = expanded ? "View original source" : "Hide original source";
});

renderCategories();
updateSendState();
