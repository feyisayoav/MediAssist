/* Overview hub: every figure comes from a live gateway request — nothing is hard-coded.
 * If a service can't be reached the card says so rather than showing a plausible-looking number.
 * Wrapped in an IIFE so it can't collide with other scripts' globals. */
(function () {
  "use strict";
  var GW = (window.APP_CONFIG && window.APP_CONFIG.gatewayUrl != null ? window.APP_CONFIG.gatewayUrl : "http://localhost:8080");

  function get(path) {
    return fetch(GW + path)
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .catch(function () { return { ok: false, status: 0, data: null }; });
  }

  function el(id) { return document.getElementById(id); }

  function setStat(id, value, online) {
    var node = el(id);
    node.textContent = value;
    node.classList.toggle("is-offline", !online);
  }

  function setChip(id, online) {
    var chip = el(id);
    if (!chip) return;
    chip.dataset.state = online ? "online" : "offline";
    // Imaging chips keep their model name; the single-service chips get a status word.
    if (id === "svc-diagnosis-status" || id === "svc-drugs-status") {
      chip.textContent = online ? "Online" : "Offline";
    }
  }

  Promise.all([
    get("/api/v1/health"),
    get("/api/v1/diagnosis/symptoms"),
    get("/api/v1/imaging/conditions?image_type=chest_xray"),
    get("/api/v1/imaging/conditions?image_type=skin_lesion"),
    get("/api/v1/drugs/conditions")
  ]).then(function (res) {
    var health = res[0], symptoms = res[1], chest = res[2], skin = res[3], drugs = res[4];

    setStat("stat-gateway", health.ok ? "Online" : "Offline", health.ok);

    var symptomCount = symptoms.ok && symptoms.data && symptoms.data.symptoms ? symptoms.data.symptoms.length : null;
    setStat("stat-symptoms", symptomCount === null ? "—" : symptomCount.toLocaleString(), symptomCount !== null);
    setChip("svc-diagnosis-status", symptomCount !== null);

    var online = [];
    if (chest.ok) online.push("Chest X-ray");
    if (skin.ok) online.push("Skin lesion");
    setStat("stat-imaging", String(online.length), online.length > 0);
    el("stat-imaging-hint").textContent = online.length ? online.join(" · ") : "Imaging service unreachable";
    setChip("svc-chest-status", chest.ok);
    setChip("svc-skin-status", skin.ok);

    var drugCount = drugs.ok && drugs.data && drugs.data.count != null ? drugs.data.count : null;
    setStat("stat-drugs", drugCount === null ? "—" : drugCount.toLocaleString(), drugCount !== null);
    setChip("svc-drugs-status", drugCount !== null);
  });
})();
