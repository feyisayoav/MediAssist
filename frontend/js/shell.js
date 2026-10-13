/* Shared app shell: sidebar, topbar, theme toggle, live API status.
 * Wrapped in an IIFE on purpose — page scripts declare top-level
 * `const GATEWAY_URL`, and a second global declaration would be a SyntaxError.
 * Exposes window.UI.icon() for page scripts that render icons dynamically. */
(function () {
  "use strict";

  var GATEWAY = (window.APP_CONFIG && window.APP_CONFIG.gatewayUrl != null ? window.APP_CONFIG.gatewayUrl : "http://localhost:8080");

  // Lucide-style 24px stroke icons, inlined so the UI has no CDN dependency.
  var ICONS = {
    heartPulse: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
    layoutGrid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    stethoscope: '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
    pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    panelLeft: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    sparkles: '<path d="M9.94 14.06 9 17l-.94-2.94L5 13l3.06-.94L9 9l.94 3.06L13 13Z"/><path d="M19 3v4"/><path d="M21 5h-4"/><path d="M17 14l.6 1.9L19.5 16.5l-1.9.6L17 19l-.6-1.9-1.9-.6 1.9-.6Z"/>',
    book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };

  function icon(name, size, cls) {
    size = size || 18;
    return '<svg class="icon ' + (cls || "") + '" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }

  var NAV = [
    { id: "overview", href: "index.html", label: "Overview", icon: "layoutGrid" },
    { id: "diagnosis", href: "diagnosis.html", label: "Disease Diagnosis", icon: "stethoscope" },
    { id: "imaging", href: "imaging.html", label: "Image Analysis", icon: "scan" },
    { id: "drugs", href: "drugs.html", label: "Drug Recommendation", icon: "pill" },
    { id: "chatbot", href: "chatbot.html", label: "Medical Chatbot", icon: "message" }
  ];

  var body = document.body;
  var page = body.dataset.page || "";
  var title = body.dataset.title || "MediAssist";
  var subtitle = body.dataset.subtitle || "";

  function renderSidebar() {
    var el = document.getElementById("sidebar");
    if (!el) return;
    var items = NAV.map(function (n) {
      var active = n.id === page;
      return '<a class="nav-item' + (active ? " active" : "") + '" href="' + n.href + '"' +
        (active ? ' aria-current="page"' : "") + ' title="' + n.label + '">' +
        icon(n.icon, 19) + '<span class="nav-label">' + n.label + "</span></a>";
    }).join("");

    el.innerHTML =
      '<div class="sidebar-head"><a class="brand" href="index.html">' +
      '<span class="brand-mark">' + icon("heartPulse", 20) + "</span>" +
      '<span class="brand-text"><strong>MediAssist</strong><small>AI health assistant</small></span></a></div>' +
      '<nav class="nav" aria-label="Main"><div class="nav-title">Tools</div>' + items + "</nav>" +
      '<div class="sidebar-foot"><div class="sidebar-note" title="Educational demo — not a medical device">' +
      icon("shield", 18) + "<p><strong>Educational demo</strong>Not a medical device. " +
      "Never use it for real medical decisions.</p></div></div>";
  }

  function renderTopbar() {
    var el = document.getElementById("topbar");
    if (!el) return;
    el.innerHTML =
      '<button class="btn-icon" id="sidebar-toggle" aria-label="Toggle navigation">' + icon("panelLeft", 20) + "</button>" +
      '<div class="topbar-title"><h1>' + title + "</h1>" + (subtitle ? "<p>" + subtitle + "</p>" : "") + "</div>" +
      '<div class="topbar-actions">' +
      '<span class="status-pill" id="gateway-status" data-state="checking" title="Gateway status">' +
      '<span class="dot"></span><span class="status-text">Checking…</span></span>' +
      '<button class="btn-icon" id="theme-toggle" aria-label="Toggle dark mode"></button></div>';
  }

  // ---- Theme ----
  function currentTheme() { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; }
  function paintThemeIcon() {
    var btn = document.getElementById("theme-toggle");
    if (btn) btn.innerHTML = icon(currentTheme() === "dark" ? "sun" : "moon", 19);
  }
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("theme", t); } catch (e) { /* storage blocked — theme just won't persist */ }
    paintThemeIcon();
  }

  // ---- Sidebar ----
  var MOBILE = "(max-width: 900px)";
  function toggleSidebar() {
    if (window.matchMedia(MOBILE).matches) {
      body.classList.toggle("sidebar-open");
    } else {
      var collapsed = body.classList.toggle("sidebar-collapsed");
      try { localStorage.setItem("sidebar", collapsed ? "collapsed" : "open"); } catch (e) { /* ignore */ }
    }
  }

  // ---- Live gateway status (a real request, not a decoration) ----
  function checkGateway() {
    var pill = document.getElementById("gateway-status");
    if (!pill) return;
    var text = pill.querySelector(".status-text");
    fetch(GATEWAY + "/api/v1/health")
      .then(function (r) { if (!r.ok) throw new Error("bad status"); return r.json(); })
      .then(function () { pill.dataset.state = "online"; text.textContent = "API online"; })
      .catch(function () { pill.dataset.state = "offline"; text.textContent = "API offline"; });
  }

  // Static pages mark icon slots with <span data-icon="name" data-size="20">.
  function fillIcons() {
    document.querySelectorAll("[data-icon]").forEach(function (el) {
      el.innerHTML = icon(el.dataset.icon, parseInt(el.dataset.size, 10) || 20);
    });
  }

  function init() {
    renderSidebar();
    renderTopbar();
    paintThemeIcon();
    fillIcons();
    try { if (localStorage.getItem("sidebar") === "collapsed") body.classList.add("sidebar-collapsed"); } catch (e) { /* ignore */ }

    document.getElementById("sidebar-toggle").addEventListener("click", toggleSidebar);
    document.getElementById("theme-toggle").addEventListener("click", function () {
      setTheme(currentTheme() === "dark" ? "light" : "dark");
    });
    var scrim = document.getElementById("scrim");
    if (scrim) scrim.addEventListener("click", function () { body.classList.remove("sidebar-open"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") body.classList.remove("sidebar-open"); });

    checkGateway();
    setInterval(checkGateway, 30000);
  }

  window.UI = { icon: icon, gateway: GATEWAY };
  init();
})();
