"use strict";

requireUser({ admin: true });

/* ---------- Données (comptes et demandes : navigateur ; messages : serveur) ---------- */
const subjectOf = (r) => r.subject.split(" – ")[0];

function collect() {
  const requests = state.requests;
  const open = requests.filter((r) => r.status !== "done").length;
  const done = requests.length - open;

  const bySubject = state.subjects
    .map((s) => ({ label: s.name, value: requests.filter((r) => subjectOf(r) === s.name).length, archived: s.archived }))
    .filter((d) => !d.archived || d.value > 0);

  const byYear = ALL_LEVELS.map((l) => ({ label: l, value: state.users.filter((u) => u.year === l).length }));

  const statusCount = (key) => requests.filter((r) => r.status === key).length;
  return {
    activeUsers: state.users.filter((u) => u.status === "active").length,
    totalUsers: state.users.length,
    open, done, total: requests.length,
    rate: requests.length ? Math.round((done / requests.length) * 100) : 0,
    upcoming: upcomingSessions().length,
    past: pastSessions().length,
    bySubject, byYear,
    requestStatus: ["open", "wait", "prop", "done"].map((k) => ({ key: k, value: statusCount(k) }))
  };
}

/* ---------- Tooltip partagé ---------- */
const tip = document.createElement("div");
tip.className = "viz-tip";
tip.hidden = true;
document.body.appendChild(tip);
const showTip = (x, y, html) => { tip.innerHTML = html; tip.style.left = x + "px"; tip.style.top = y + "px"; tip.hidden = false; };
const hideTip = () => { tip.hidden = true; };

/* ---------- Outils de dessin SVG ---------- */
const niceMax = (v) => {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v)), n = v / pow;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
};
// Barre horizontale : extrémité (côté données) arrondie à 4 px, ancrée sur la base.
const barH = (x, y, w, h, r = 4) => {
  if (w <= 0) return "";
  r = Math.min(r, w, h / 2);
  return `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;
};
const barV = (x, y, w, h, r = 4) => {
  if (h <= 0) return "";
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
};

/** Barres horizontales : une ligne par catégorie, valeur écrite au bout de la barre. */
function hBars(data, unit) {
  const W = 420, rowH = 38, labelW = 110, valueW = 30, barMax = W - labelW - valueW;
  const max = Math.max(1, ...data.map((d) => d.value));
  const H = data.length * rowH;
  const rows = data.map((d, i) => {
    const y = i * rowH, w = (d.value / max) * barMax;
    return `<g class="row" data-tip="${esc(d.label)} : <b>${d.value}</b> ${unit}">
      <rect class="bar-hit" x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent"/>
      <text x="0" y="${y + rowH / 2 + 4}">${esc(d.label)}</text>
      <path class="bar" d="${barH(labelW, y + (rowH - 14) / 2, w, 14)}"/>
      <text class="val" x="${labelW + w + 8}" y="${y + rowH / 2 + 4}">${d.value}</text>
    </g>`;
  }).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${rows}</svg>`;
}

/** Barres verticales : une colonne par catégorie. */
function vBars(data, unit) {
  const W = 420, H = 230, left = 28, bottom = 26, top = 22;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const plotH = H - bottom - top, slot = (W - left) / data.length, bw = Math.min(36, slot * 0.5);
  const grid = [0, 0.5, 1].map((f) => {
    const y = top + plotH * (1 - f);
    return `<line class="grid" x1="${left}" x2="${W}" y1="${y}" y2="${y}"/><text x="0" y="${y + 4}">${Math.round(max * f)}</text>`;
  }).join("");
  const bars = data.map((d, i) => {
    const h = (d.value / max) * plotH, x = left + i * slot + (slot - bw) / 2, y = top + plotH - h;
    return `<g class="row" data-tip="${esc(d.label)} : <b>${d.value}</b> ${unit}">
      <rect class="bar-hit" x="${left + i * slot}" y="${top}" width="${slot}" height="${plotH + bottom}" fill="transparent"/>
      <path class="bar" d="${barV(x, y, bw, h)}"/>
      <text class="val" x="${x + bw / 2}" y="${y - 6}" text-anchor="middle">${d.value}</text>
      <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>
    </g>`;
  }).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${grid}${bars}</svg>`;
}

/** Courbe : une série, repère et infobulle au survol. */
function lineChart(data) {
  const W = 860, H = 240, left = 30, right = 16, top = 18, bottom = 28;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const plotW = W - left - right, plotH = H - top - bottom;
  const x = (i) => left + (plotW * i) / (data.length - 1);
  const y = (v) => top + plotH * (1 - v / max);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) =>
    `<line class="grid" x1="${left}" x2="${W - right}" y1="${y(max * f)}" y2="${y(max * f)}"/><text x="0" y="${y(max * f) + 4}">${Math.round(max * f)}</text>`).join("");
  const labels = data.map((d, i) => (i % 2 === 0 || i === data.length - 1)
    ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${d.label}</text>` : "").join("");
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const last = data.at(-1);
  return `<svg class="chart" id="lineSvg" viewBox="0 0 ${W} ${H}" role="img" data-w="${W}">
    ${grid}${labels}
    <path class="line" d="${path}"/>
    <circle class="dot" cx="${x(data.length - 1)}" cy="${y(last.value)}" r="4.5"/>
    <text class="val" x="${x(data.length - 1) - 8}" y="${y(last.value) - 10}" text-anchor="end">${last.value}</text>
    <line class="cross" id="cross" y1="${top}" y2="${top + plotH}" visibility="hidden"/>
    <circle class="dot" id="hoverDot" r="4.5" visibility="hidden"/>
    <rect id="lineHit" x="${left}" y="${top}" width="${plotW}" height="${plotH + bottom}" fill="transparent"/>
  </svg>`;
}

function bindLineHover(data) {
  const svg = $("#lineSvg"), hit = $("#lineHit");
  if (!svg) return;
  const W = +svg.dataset.w, left = 30, right = 16, top = 18, plotH = 194;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  hit.addEventListener("mousemove", (e) => {
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.max(0, Math.min(data.length - 1, Math.round(((px - left) / (W - left - right)) * (data.length - 1))));
    const cx = left + ((W - left - right) * i) / (data.length - 1), cy = top + plotH * (1 - data[i].value / max);
    const cross = $("#cross"), dot = $("#hoverDot");
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
    dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("visibility", "visible");
    showTip(box.left + (cx / W) * box.width, box.top + (cy / (240)) * box.height, `${data[i].full}<br><b>${data[i].value}</b> message${data[i].value > 1 ? "s" : ""}`);
  });
  hit.addEventListener("mouseleave", () => {
    $("#cross").setAttribute("visibility", "hidden"); $("#hoverDot").setAttribute("visibility", "hidden"); hideTip();
  });
}

/* ---------- Page ---------- */
const tableOf = (data, col1, col2) => `
  <table class="chart-table"><thead><tr><th>${col1}</th><th>${col2}</th></tr></thead>
  <tbody>${data.map((d) => `<tr><td>${esc(d.full || d.label)}</td><td>${d.value}</td></tr>`).join("")}</tbody></table>`;

const card = (id, title, sub, wide) => `
  <section class="chart-card ${wide ? "wide" : ""}" id="${id}">
    <div class="chart-head"><div><h2>${title}</h2><div class="hint">${sub}</div></div>
      <button type="button" data-action="toggle-view" data-card="${id}">Voir en tableau</button></div>
    <div class="chart-body"></div>
  </section>`;

const views = {};   // id -> { chart, table }
function fillCard(id, chartHtml, tableHtml) {
  views[id] = { chart: chartHtml, table: tableHtml, showTable: false };
  $(`#${id} .chart-body`).innerHTML = chartHtml;
}

actions["toggle-view"] = (btn) => {
  const v = views[btn.dataset.card];
  if (!v) return;
  v.showTable = !v.showTable;
  $(`#${btn.dataset.card} .chart-body`).innerHTML = v.showTable ? v.table : v.chart;
  btn.textContent = v.showTable ? "Voir le graphique" : "Voir en tableau";
  if (btn.dataset.card === "cMsg" && !v.showTable) bindLineHover(v.data);
};

document.addEventListener("mousemove", (e) => {
  const g = e.target.closest && e.target.closest("[data-tip]");
  if (!g) { if (!e.target.closest || !e.target.closest("#lineSvg")) hideTip(); return; }
  tip.innerHTML = g.dataset.tip;
  tip.style.left = e.clientX + "px";
  tip.style.top = e.clientY + "px";
  tip.hidden = false;
});

function render(serverStats) {
  const d = collect();
  const ratePlural = (n, w) => `${n} ${w}${n > 1 ? "s" : ""}`;
  mountShell("admin-stats", `
    <div class="viz-root">
      <h1>Statistiques</h1>
      <div class="kpis">
        <div class="kpi"><div class="v">${d.activeUsers}</div><div class="l">Comptes actifs</div><div class="s">sur ${d.totalUsers} comptes</div></div>
        <div class="kpi"><div class="v">${d.open}</div><div class="l">Demandes en cours</div><div class="s">${ratePlural(d.total, "demande")} au total</div></div>
        <div class="kpi"><div class="v">${d.rate} %</div><div class="l">Demandes résolues</div><div class="s">${d.done} sur ${d.total}</div></div>
        <div class="kpi"><div class="v">${d.upcoming}</div><div class="l">Séances à venir</div><div class="s">${d.past} passée${d.past > 1 ? "s" : ""}</div></div>
      </div>
      <div class="chart-grid">
        ${card("cSubject", "Demandes par matière", "Nombre de demandes déposées", false)}
        ${card("cYear", "Utilisateurs par année", "Répartition des comptes", false)}
        ${card("cMsg", "Messages envoyés par jour", serverStats ? `${serverStats.messages} messages · ${serverStats.conversations} discussion${serverStats.conversations > 1 ? "s" : ""} · 14 derniers jours` : "14 derniers jours", true)}
        <section class="chart-card wide">
          <div class="chart-head"><div><h2>Demandes par statut</h2><div class="hint">État actuel de toutes les demandes</div></div></div>
          <div class="status-list">${d.requestStatus.map((s) => `<span>${badge(s.key)} <b>${s.value}</b></span>`).join("")}</div>
        </section>
      </div>
    </div>`);

  fillCard("cSubject", hBars(d.bySubject, "demande(s)"), tableOf(d.bySubject, "Matière", "Demandes"));
  fillCard("cYear", vBars(d.byYear, "compte(s)"), tableOf(d.byYear, "Année", "Comptes"));

  if (!serverStats) {
    $("#cMsg .chart-body").innerHTML = `<p class="empty">Statistiques de messagerie indisponibles : lancez <code>node server.js</code>.</p>`;
    $("#cMsg button").hidden = true;
    return;
  }
  const data = serverStats.messagesPerDay.map((m) => {
    const dt = new Date(m.day + "T12:00");
    return { label: dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
             full: dt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }), value: m.count };
  });
  fillCard("cMsg", lineChart(data), tableOf(data, "Jour", "Messages"));
  views.cMsg.data = data;
  bindLineHover(data);
}

(async () => {
  let stats = null;
  try { stats = await (await fetch("/api/stats")).json(); } catch { /* serveur absent */ }
  if (!state.user.admin) {
    mountShell("accueil", '<h1>Statistiques</h1><p class="empty card">Accès réservé aux administrateurs.</p>');
    return;
  }
  render(stats);
})();
