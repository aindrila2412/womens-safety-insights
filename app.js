(function () {
  "use strict";

  const D = window.SAFETY_DATA;
  const YEARS = D.years;
  const LAST = YEARS.length - 1;
  const fmt = new Intl.NumberFormat("en-IN");
  const fmt1 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const $ = (id) => document.getElementById(id);

  // localStorage can throw (private mode, blocked storage), so fall back to memory.
  const store = (() => {
    const mem = {};
    let ok = false;
    try {
      localStorage.setItem("wsi-probe", "1");
      localStorage.removeItem("wsi-probe");
      ok = true;
    } catch (e) { /* use memory */ }
    return {
      get(k, fallback) {
        try {
          const raw = ok ? localStorage.getItem("wsi:" + k) : mem[k];
          return raw == null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
      },
      set(k, v) {
        const raw = JSON.stringify(v);
        if (ok) { try { localStorage.setItem("wsi:" + k, raw); return; } catch (e) { /* fall through */ } }
        mem[k] = raw;
      },
    };
  })();

  const stateByCode = Object.fromEntries(D.states.map((s) => [s.code, s]));
  const headByKey = Object.fromEntries(D.heads.map((h) => [h.key, h]));
  const NATIONAL = { name: "All India", code: "IN", region: "All India" };

  const ui = {
    tab: store.get("tab", "overview"),
    yearIdx: LAST,
    metric: "rate",
    head: "total",
    selected: store.get("selected", "HR"),
    compare: store.get("compare", ["HR", "DL", "MH"]),
    cmpHead: "total",
    cmpMetric: "rate",
    resFilter: "all",
  };

  // ---- data access -------------------------------------------------------
  function cases(code, head, i) {
    const row = D.cases[code] && D.cases[code][head];
    return row ? row[i] : null;
  }
  function rate(code, head, i) {
    const c = cases(code, head, i);
    const p = D.femalePop[code] && D.femalePop[code][i];
    return c == null || !p ? null : (c / p) * 1e5;
  }
  function value(code, head, i, metric) {
    return metric === "rate" ? rate(code, head, i) : cases(code, head, i);
  }
  function show(v, metric) {
    if (v == null) return "n/a";
    return metric === "rate" ? fmt1.format(v) : fmt.format(v);
  }
  function series(code, head, metric) {
    return YEARS.map((_, i) => value(code, head, i, metric));
  }

  // ---- theme-aware chart colours ------------------------------------------
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  const charts = {};
  function draw(id, config) {
    if (charts[id]) charts[id].destroy();
    Chart.defaults.color = css("--muted");
    Chart.defaults.borderColor = css("--line");
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    charts[id] = new Chart($(id), config);
  }
  const palette = () => [css("--c1"), css("--c2"), css("--c3"), css("--c4"), css("--c5")];

  function table(el, head, rows) {
    const th = head.map((h) => "<th scope=\"col\">" + h + "</th>").join("");
    const tr = rows.map((r) => "<tr>" + r.map((c, i) => (i ? "<td>" : "<th scope=\"row\">") + c + (i ? "</td>" : "</th>")).join("") + "</tr>").join("");
    el.innerHTML = "<table><thead><tr>" + th + "</tr></thead><tbody>" + tr + "</tbody></table>";
  }

  function fillSelect(sel, items, current) {
    sel.innerHTML = items.map((it) => "<option value=\"" + it[0] + "\"" + (it[0] === current ? " selected" : "") + ">" + it[1] + "</option>").join("");
  }
  const headOptions = D.heads.map((h) => [h.key, h.label]);

  // ---- overview -------------------------------------------------------------
  function renderKpis() {
    const total = (i) => cases("IN", "total", i);
    const i24 = LAST, i19 = YEARS.indexOf(2019), i20 = YEARS.indexOf(2020);
    const change = ((total(i24) / total(i19)) - 1) * 100;
    const items = [
      [fmt.format(total(i24)), "cases registered in " + YEARS[i24]],
      [fmt1.format(rate("IN", "total", i24)), "per 100,000 women in " + YEARS[i24]],
      [(change >= 0 ? "+" : "") + fmt1.format(change) + "%", "cases, 2019 to " + YEARS[i24]],
      [fmt1.format(((total(i20) / total(i19)) - 1) * 100) + "%", "dip in 2020 (pandemic year)"],
    ];
    $("kpis").innerHTML = items.map((k) => "<div class=\"kpi\"><b>" + k[0] + "</b><span>" + k[1] + "</span></div>").join("");
  }

  function renderTrend() {
    const head = $("trend-head").value;
    ui.trendHead = head;
    const h = headByKey[head];
    $("trend-note").textContent = h.note || "";
    const c = series("IN", head, "cases");
    const r = series("IN", head, "rate");
    draw("trend-chart", {
      data: {
        labels: YEARS,
        datasets: [
          { type: "bar", label: "Cases", data: c, backgroundColor: css("--c2"), yAxisID: "y", order: 2 },
          { type: "line", label: "Per 100,000 women", data: r, borderColor: css("--c1"), backgroundColor: css("--c1"), yAxisID: "y1", tension: .25, pointRadius: 3, order: 1 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom" } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Cases" }, ticks: { callback: (v) => fmt.format(v) } },
          y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Per 100,000" } },
        },
      },
    });
    table($("trend-table"), ["Year", "Cases", "Per 100,000"], YEARS.map((y, i) => [y, show(c[i], "cases"), show(r[i], "rate")]));
  }

  function renderMix() {
    const i = YEARS.indexOf(+$("mix-year").value);
    const rows = D.heads
      .filter((h) => h.key !== "total")
      .map((h) => [h.label, cases("IN", h.key, i)])
      .filter((r) => r[1] != null && r[1] > 0)
      .sort((a, b) => b[1] - a[1]);
    const total = cases("IN", "total", i);
    draw("mix-chart", {
      type: "bar",
      data: {
        labels: rows.map((r) => r[0]),
        datasets: [{ label: "Share of all registered cases (%)", data: rows.map((r) => +(r[1] / total * 100).toFixed(1)), backgroundColor: css("--c2") }],
      },
      options: {
        indexAxis: "y",
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ctx.parsed.x + "% (" + fmt.format(rows[ctx.dataIndex][1]) + " cases)" } },
        },
        scales: { x: { title: { display: true, text: "% of all registered cases" } } },
      },
    });
  }

  // ---- states tab -------------------------------------------------------------
  const STOPS = [[247, 231, 214], [232, 87, 59], [52, 18, 63]];
  function colour(t) {
    t = Math.max(0, Math.min(1, t));
    const seg = t < .5 ? 0 : 1;
    const u = t < .5 ? t * 2 : (t - .5) * 2;
    const a = STOPS[seg], b = STOPS[seg + 1];
    const c = a.map((v, k) => Math.round(v + (b[k] - v) * u));
    const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    const L = .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
    // pick whichever label colour has more contrast against this tile
    const darkText = (L + .05) / (.0117 + .05) > 1.05 / (L + .05);
    return { bg: "rgb(" + c.join(",") + ")", fg: darkText ? "#251630" : "#fff" };
  }

  function stateValues() {
    return D.states.map((s) => ({ s, v: value(s.code, ui.head, ui.yearIdx, ui.metric) }));
  }

  function renderTiles() {
    const vals = stateValues();
    const nums = vals.map((x) => x.v).filter((v) => v != null).sort((a, b) => a - b);
    const lo = nums[0] || 0;
    // cap the colour scale at the 90th percentile so one outlier doesn't wash out everyone else
    const hi = nums.length ? nums[Math.floor(nums.length * .9)] : 1;
    $("leg-min").textContent = show(lo, ui.metric);
    $("leg-max").textContent = show(hi, ui.metric) + "+";

    const byPos = {};
    vals.forEach((x) => { byPos[x.s.row + "," + x.s.col] = x; });
    let html = "";
    for (let r = 0; r <= 7; r++) {
      for (let c = 0; c <= 8; c++) {
        const x = byPos[r + "," + c];
        if (!x) { html += "<span class=\"tile blank\" aria-hidden=\"true\"></span>"; continue; }
        const label = x.s.name + ": " + show(x.v, ui.metric) + (ui.metric === "rate" ? " per 100,000 women" : " cases");
        if (x.v == null) {
          html += "<button class=\"tile na\" data-code=\"" + x.s.code + "\" aria-label=\"" + x.s.name + ": no data\" aria-pressed=\"" + (x.s.code === ui.selected) + "\">" + x.s.code + "</button>";
        } else {
          const col = colour(hi > lo ? (x.v - lo) / (hi - lo) : 0);
          const shortVal = ui.metric === "rate" ? Math.round(x.v) : (x.v >= 1000 ? Math.round(x.v / 1000) + "k" : x.v);
          html += "<button class=\"tile\" data-code=\"" + x.s.code + "\" style=\"background:" + col.bg + ";color:" + col.fg + "\" title=\"" + label + "\" aria-label=\"" + label + "\" aria-pressed=\"" + (x.s.code === ui.selected) + "\">" + x.s.code + "<small>" + shortVal + "</small></button>";
        }
      }
    }
    $("tilemap").innerHTML = html;
  }

  function renderRank() {
    const vals = stateValues().filter((x) => x.v != null).sort((a, b) => b.v - a.v);
    const max = vals.length ? vals[0].v : 1;
    $("rank").innerHTML = vals.map((x, i) =>
      "<li class=\"" + (x.s.code === ui.selected ? "sel" : "") + "\"><button data-code=\"" + x.s.code + "\">" +
      "<span class=\"pos\">" + (i + 1) + "</span><span class=\"name\">" + x.s.name + "</span>" +
      "<span><div class=\"bar\" style=\"width:" + Math.max(1, x.v / max * 100) + "%\"></div></span>" +
      "<span class=\"val\">" + show(x.v, ui.metric) + "</span></button></li>").join("");
  }

  // Survey view of the same place: NFHS spousal violence, shown beside (never mixed into) the police series.
  function nfhsBlock(code, name) {
    const n = D.nfhs[code];
    if (!n) {
      return "<div class=\"survey\"><h4>NFHS-6 survey</h4><p class=\"note\">" + name + " is not in the NFHS-6 fact sheets (Manipur was not surveyed).</p></div>";
    }
    const pct = (v) => (v == null ? "suppressed" : fmt1.format(v) + "%");
    const small = n.flag === "small" ? " <span class=\"flag\">small sample</span>" : "";
    const change = n.n6 != null && n.n5 != null ? n.n6 - n.n5 : null;
    return "<div class=\"survey\"><h4>Survey: spousal violence (NFHS-6, 2023-24)</h4>" +
      "<p class=\"big small\">" + pct(n.n6) + small + "</p>" +
      "<dl><dt>NFHS-5 (2019-21)</dt><dd>" + pct(n.n5) + "</dd>" +
      (change != null ? "<dt>Change</dt><dd>" + (change > 0 ? "+" : "") + fmt1.format(change) + " points</dd>" : "") +
      "<dt>Urban / rural (NFHS-6)</dt><dd>" + pct(n.n6u) + " / " + pct(n.n6r) + "</dd></dl>" +
      "<p class=\"note\">Ever-married women 18-49 who ever experienced physical and/or sexual violence from a spouse. A survey of women, so it is not comparable with the registered cases above. NFHS-6 results are provisional; state changes between rounds can reflect sampling and fieldwork, so read big swings with care.</p></div>";
  }

  function renderDetail() {
    const code = ui.selected;
    const s = stateByCode[code];
    if (!s) { $("detail").innerHTML = "<p>Choose a state or UT on the map.</p>"; return; }
    const i = ui.yearIdx;
    const v = value(code, ui.head, i, ui.metric);
    const rk = stateValues().filter((x) => x.v != null).sort((a, b) => b.v - a.v);
    const pos = rk.findIndex((x) => x.s.code === code);
    const nat = value("IN", ui.head, i, ui.metric);
    const unit = ui.metric === "rate" ? "per 100,000 women" : "cases";
    $("detail").innerHTML =
      "<h3>" + s.name + "</h3><div class=\"sub\">" + s.region + " &middot; " + headByKey[ui.head].label + " &middot; " + YEARS[i] + "</div>" +
      "<p class=\"big\">" + show(v, ui.metric) + " <span class=\"sub\">" + unit + "</span></p>" +
      "<dl><dt>Rank this year</dt><dd>" + (pos >= 0 ? (pos + 1) + " of " + rk.length : "n/a") + "</dd>" +
      "<dt>All India</dt><dd>" + show(nat, ui.metric) + "</dd>" +
      "<dt>Female population (proj.)</dt><dd>" + (D.femalePop[code][i] ? fmt.format(D.femalePop[code][i]) : "n/a") + "</dd></dl>" +
      nfhsBlock(code, s.name) +
      "<div class=\"chart-box\"><canvas id=\"detail-chart\" role=\"img\" aria-label=\"" + s.name + " compared with All India over time\"></canvas></div>" +
      "<p class=\"note\">A high or low figure mostly reflects how many cases get reported and registered here. It does not rank how safe a place is.</p>" +
      "<button class=\"btn ghost\" id=\"add-compare\">Add to Compare</button>";
    draw("detail-chart", {
      type: "line",
      data: {
        labels: YEARS,
        datasets: [
          { label: s.name, data: series(code, ui.head, ui.metric), borderColor: css("--c1"), backgroundColor: css("--c1"), tension: .25, pointRadius: 2, spanGaps: false },
          { label: "All India", data: series("IN", ui.head, ui.metric), borderColor: css("--c2"), borderDash: [5, 4], pointRadius: 0, tension: .25 },
        ],
      },
      options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } }, scales: { y: { beginAtZero: true } } },
    });
    $("add-compare").addEventListener("click", () => {
      if (!ui.compare.includes(code)) {
        ui.compare = ui.compare.length >= 4 ? [...ui.compare.slice(1), code] : [...ui.compare, code];
        store.set("compare", ui.compare);
      }
      setTab("compare");
    });
  }

  function renderStates() {
    $("year-out").textContent = YEARS[ui.yearIdx];
    $("state-note").textContent = headByKey[ui.head].note || "";
    renderTiles();
    renderRank();
    renderDetail();
  }

  function selectState(code) {
    ui.selected = code;
    store.set("selected", code);
    renderStates();
  }

  // ---- compare -----------------------------------------------------------------
  function renderChips() {
    $("cmp-chips").innerHTML = D.states.map((s) =>
      "<button class=\"chip\" data-code=\"" + s.code + "\" aria-pressed=\"" + ui.compare.includes(s.code) + "\">" + s.name + "</button>").join("");
  }

  function renderCompare() {
    renderChips();
    const codes = ui.compare;
    const datasets = codes.map((c, k) => ({
      label: stateByCode[c].name, data: series(c, ui.cmpHead, ui.cmpMetric),
      borderColor: palette()[k % 5], backgroundColor: palette()[k % 5], tension: .25, pointRadius: 2,
    }));
    datasets.push({ label: "All India", data: series("IN", ui.cmpHead, ui.cmpMetric), borderColor: "#888", borderDash: [5, 4], pointRadius: 0, tension: .25 });
    draw("cmp-chart", {
      type: "line",
      data: { labels: YEARS, datasets },
      options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } },
    });
    table($("cmp-table"), ["Year"].concat(datasets.map((d) => d.label)),
      YEARS.map((y, i) => [y].concat(datasets.map((d) => show(d.data[i], ui.cmpMetric)))));
  }


  // ---- data freshness (overview) ---------------------------------------------------
  const longDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  function renderFreshness() {
    const F = D.freshness;
    $("fresh-stamp").textContent = "Last checked " + longDate(F.last_checked);
    $("fresh-note").textContent = F.note;
    $("fresh-list").innerHTML = F.sources.map((s) =>
      "<li><div class=\"fy\"><b>" + s.latest_year + "</b><span>latest year</span></div>" +
      "<div class=\"fb\"><a href=\"" + s.url + "\" rel=\"noopener\">" + s.name + "</a>" +
      "<p>" + s.status + "</p>" +
      "<small>" + s.kind + " &middot; Published " + (/^\d{4}-\d{2}-\d{2}$/.test(s.published) ? longDate(s.published) : s.published) + " &middot; Checked " + longDate(F.last_checked) + " &middot; Used in: " + s.used_in + "</small></div></li>").join("");
  }

  // ---- world -------------------------------------------------------------------------
  const W = D.world;
  const WORLD = W.countries.slice().sort((a, b) => b.v - a.v);
  WORLD.forEach((c) => { c.rank = WORLD.findIndex((x) => x.v === c.v) + 1; });
  const WORLD_VIEWS = {
    neighbours: ["India and neighbours", ["India", "Bangladesh", "Pakistan", "Nepal", "Sri Lanka", "Bhutan", "Afghanistan", "Maldives", "China", "Myanmar"]],
    around: ["Around India in the ranking", null],
    highest: ["Highest 15", null],
    lowest: ["Lowest 15", null],
    large: ["Some of the most populous", ["India", "China", "Indonesia", "Pakistan", "Nigeria", "Brazil", "Bangladesh", "Mexico", "Ethiopia", "Japan", "Philippines", "United States of America"]],
  };
  const worldUi = { view: "neighbours", sort: "v", dir: -1, find: "" };

  function worldRows(view) {
    const idx = WORLD.findIndex((c) => c.n === "India");
    if (view === "highest") return WORLD.slice(0, 15).concat(idx >= 15 ? [WORLD[idx]] : []);
    if (view === "lowest") return [WORLD[idx]].concat(WORLD.slice(-15));
    if (view === "around") return WORLD.slice(Math.max(0, idx - 7), idx + 8);
    const names = WORLD_VIEWS[view][1];
    return WORLD.filter((c) => names.includes(c.n));
  }

  function renderWorldChart() {
    const rows = worldRows(worldUi.view);
    const wk = W.regions.find((r) => r.n === "World");
    $("world-view-note").textContent = "Bars show the central estimate for " + W.year + ". The world figure is " + fmt1.format(wk.v) + "% (" + fmt1.format(wk.lo) + " to " + fmt1.format(wk.hi) + "). Hover or tap a bar for the 95% range.";
    const coral = css("--c1"), plain = css("--c2");
    draw("world-chart", {
      type: "bar",
      data: {
        labels: rows.map((c) => c.n.replace(" of Great Britain and Northern Ireland", "").replace(" (Kingdom of the)", "")),
        datasets: [{ label: "Estimate, %", data: rows.map((c) => c.v), backgroundColor: rows.map((c) => (c.n === "India" ? coral : plain)) }],
      },
      options: {
        indexAxis: "y", maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => { const c = rows[ctx.dataIndex]; return fmt1.format(c.v) + "% (95% range " + fmt1.format(c.lo) + " to " + fmt1.format(c.hi) + ")"; } } },
        },
        scales: { x: { beginAtZero: true, title: { display: true, text: "% of women 15-49, past 12 months" } } },
      },
    });
    $("world-chart").setAttribute("aria-label", "Bar chart of the estimate for " + rows.length + " countries: " + rows.map((c) => c.n + " " + fmt1.format(c.v) + " percent").join("; "));
  }

  function renderWorldTable() {
    const cols = [["n", "Country"], ["v", "Estimate %"], ["lo", "95% range"], ["rank", "Rank"], ["legal", "Legal score"]];
    const f = worldUi.find.trim().toLowerCase();
    let rows = WORLD.filter((c) => !f || c.n.toLowerCase().includes(f));
    const k = worldUi.sort;
    rows = rows.slice().sort((a, b) => {
      const x = a[k], y = b[k];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * worldUi.dir;
    });
    $("world-table").querySelector("thead tr").innerHTML = cols.map((c) => {
      const on = c[0] === k;
      return "<th scope=\"col\" aria-sort=\"" + (on ? (worldUi.dir > 0 ? "ascending" : "descending") : "none") + "\"><button data-sort=\"" + c[0] + "\">" + c[1] +
        "<span aria-hidden=\"true\">" + (on ? (worldUi.dir > 0 ? " \u25b2" : " \u25bc") : "") + "</span></button></th>";
    }).join("");
    $("world-table").querySelector("tbody").innerHTML = rows.map((c) =>
      "<tr" + (c.n === "India" ? " class=\"me\"" : "") + "><th scope=\"row\">" + c.n + "</th><td>" + fmt1.format(c.v) + "</td><td>" + fmt1.format(c.lo) + " to " + fmt1.format(c.hi) +
      "</td><td>" + c.rank + "</td><td>" + (c.legal == null ? "n/a" : Math.round(c.legal) + " (" + c.ly + ")") + "</td></tr>").join("");
    $("world-count").textContent = rows.length + " of " + WORLD.length + " countries. Legal score: SDG 5.1.1 area on violence against women, 0 to 100, latest assessed year in brackets; n/a means not assessed. Rank 1 is the highest estimate.";
  }

  function renderWorld() {
    const S = W.summary, ind = S.india;
    $("world-kpis").innerHTML = [
      [fmt1.format(ind.ipv_15_49) + "%", "India, women 15-49, " + W.year + " (95% range " + fmt1.format(ind.ci95[0]) + " to " + fmt1.format(ind.ci95[1]) + ")"],
      [fmt1.format(S.world_15_49) + "%", "World estimate, same measure"],
      [ind.rank_high_to_low + " of " + S.countries_with_estimate, "India's place, 1 = highest estimate"],
      [fmt1.format(S.central_southern_asia_15_49) + "%", "Central and Southern Asia region"],
    ].map((k) => "<div class=\"kpi\"><b>" + k[0] + "</b><span>" + k[1] + "</span></div>").join("");
    $("world-notes").innerHTML = W.notes.map((n) => "<li>" + n + "</li>").join("") +
      "<li>India's interval (" + fmt1.format(ind.ci95[0]) + " to " + fmt1.format(ind.ci95[1]) + ") overlaps those of many countries ranked close to it, so the exact rank is not firm.</li>";
    $("world-source").textContent = "Source: UN SDG Global Database (series VC_VAW_MARR, release " + W.release + ", downloaded " + W.downloaded + "), estimates by WHO and UN partners for " + W.year + ". UNdata terms of use.";
    const sel = $("world-view");
    if (!sel.options.length) fillSelect(sel, Object.entries(WORLD_VIEWS).map(([k, v]) => [k, v[0]]), worldUi.view);
    renderWorldChart();
    renderWorldTable();
    const ORDER = ["World", "Sub-Saharan Africa", "Northern Africa and Western Asia", "Central and Southern Asia", "Eastern and South-Eastern Asia", "Latin America and the Caribbean", "Oceania (exc. Australia and New Zealand)", "Australia and New Zealand", "Europe and Northern America"];
    table($("world-regions"), ["Region", "Estimate %", "95% range"], ORDER.map((n) => {
      const r = W.regions.find((x) => x.n === n);
      return [n, fmt1.format(r.v), fmt1.format(r.lo) + " to " + fmt1.format(r.hi)];
    }));
  }

  // ---- recent updates (non-official) ------------------------------------------------
  const updUi = { topic: "all" };
  function renderUpdates() {
    const U = D.updates;
    $("updates-scope").textContent = U.scope + " Items were read at the source on " + longDate(U.accessed_on) + ".";
    $("updates-limits").innerHTML = U.limitations.map((l) => "<li>" + l + "</li>").join("");
    const topics = ["all"].concat(Array.from(new Set(U.items.map((i) => i.topic))));
    $("updates-chips").innerHTML = topics.map((t) =>
      "<button class=\"chip\" data-topic=\"" + t + "\" aria-pressed=\"" + (updUi.topic === t) + "\">" + (t === "all" ? "All" : t) + "</button>").join("");
    const items = U.items.filter((i) => updUi.topic === "all" || i.topic === updUi.topic).slice().sort((a, b) => b.date.localeCompare(a.date));
    $("updates-list").innerHTML = items.map((i) =>
      "<li class=\"upd\"><div class=\"meta\"><time datetime=\"" + i.date + "\">" + longDate(i.date) + "</time><span>" + i.type + "</span></div>" +
      "<h3><a href=\"" + i.url + "\" rel=\"noopener\">" + i.title + "</a></h3>" +
      "<p class=\"pub\">" + i.publisher + "</p><p>" + i.summary + "</p>" +
      "<p class=\"lim\"><strong>Limit:</strong> " + i.limitation + "</p>" +
      "<p class=\"acc\">Accessed " + longDate(i.accessed_on) + "</p></li>").join("");
    $("updates-note").textContent = items.length + " of " + U.items.length + " items shown. Not an official record; always open the linked source.";
  }

  // ---- help directory -------------------------------------------------------------
  const CAT_LABEL = { international: "Outside India", all: "All", emergency: "Emergency", women: "Women", children: "Children", legal: "Legal aid", cyber: "Cyber crime", counselling: "Counselling" };

  function renderResources() {
    const R = D.resources;
    const cats = ["all"].concat(Array.from(new Set(R.resources.flatMap((r) => r.categories))));
    $("help-chips").innerHTML = cats.map((c) =>
      "<button class=\"chip\" data-cat=\"" + c + "\" aria-pressed=\"" + (ui.resFilter === c) + "\">" + (CAT_LABEL[c] || c) + "</button>").join("");
    const list = R.resources.filter((r) => ui.resFilter === "all" || r.categories.includes(ui.resFilter));
    $("res-grid").innerHTML = list.map((r) => {
      const num = r.number ? "<a class=\"num\" href=\"tel:" + r.number.replace(/\s/g, "") + "\" aria-label=\"Call " + r.name + " on " + r.number.split("").join(" ") + "\">" + r.number + "</a>" : "";
      const also = r.also_see ? " &middot; <a href=\"" + r.also_see + "\" rel=\"noopener\">more</a>" : "";
      return "<article class=\"res\"><h3>" + r.name + "</h3>" + num + "<p>" + r.summary + "</p>" +
        "<div class=\"tags\">" + r.categories.map((c) => CAT_LABEL[c] || c).join(" &middot; ") + "</div>" +
        "<div class=\"links\">Source: <a href=\"" + r.source + "\" rel=\"noopener\">" + r.source_name + "</a>" + also + "</div></article>";
    }).join("");
    $("res-verified").textContent = R.note + " Last checked " + R.verified_on + ".";
  }

  // ---- about / install -------------------------------------------------------------
  function renderAbout() {
    $("sources").innerHTML = D.sources.map((s) =>
      "<li><a href=\"" + s.url + "\" rel=\"noopener\">" + s.name + "</a><br><small>Licence: " + s.licence + "</small></li>").join("");
    $("build-note").textContent = "Data bundle built " + D.built + ".";
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    let html = "";
    if (standalone) {
      html = "<p>You are running the installed app.</p>";
    } else if (ios) {
      html = "<p>On iPhone or iPad, open this page in <strong>Safari</strong>, tap the Share button, then choose <strong>Add to Home Screen</strong>.</p>";
    } else {
      html = "<p>On Android with Chrome, use the <strong>Install app</strong> button when it appears, or open the browser menu and choose <strong>Install app</strong> / <strong>Add to Home screen</strong>.</p>";
    }
    html += "<p class=\"note\">Once installed the app works offline.</p>";
    $("install-help").innerHTML = html;
  }

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $("install-btn").hidden = false;
  });
  $("install-btn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("install-btn").hidden = true;
  });

  // ---- tabs and events --------------------------------------------------------------
  const TABS = ["overview", "states", "world", "compare", "updates", "help", "about"];
  function setTab(name) {
    if (!TABS.includes(name)) name = "overview";
    ui.tab = name;
    store.set("tab", name);
    TABS.forEach((t) => { $("tab-" + t).hidden = t !== name; });
    document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
    if (name === "overview") { renderTrend(); renderMix(); }
    if (name === "states") renderStates();
    if (name === "world") renderWorld();
    if (name === "compare") renderCompare();
    if (name === "updates") renderUpdates();
    if (history.replaceState) history.replaceState(null, "", "#" + name);
    window.scrollTo(0, 0);
  }

  function init() {
    fillSelect($("trend-head"), headOptions, "total");
    fillSelect($("state-head"), headOptions, "total");
    fillSelect($("cmp-head"), headOptions, "total");
    fillSelect($("mix-year"), YEARS.slice().reverse().map((y) => [y, y]), YEARS[LAST]);
    $("year-range").max = LAST;
    $("year-range").value = LAST;

    renderKpis();
    renderFreshness();
    renderResources();
    renderAbout();

    $("tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setTab(b.dataset.tab); });
    $("trend-head").addEventListener("change", renderTrend);
    $("mix-year").addEventListener("change", renderMix);
    $("year-range").addEventListener("input", (e) => { ui.yearIdx = +e.target.value; renderStates(); });
    $("state-head").addEventListener("change", (e) => { ui.head = e.target.value; renderStates(); });
    document.querySelectorAll("input[name=metric]").forEach((r) => r.addEventListener("change", (e) => { ui.metric = e.target.value; renderStates(); }));
    $("tilemap").addEventListener("click", (e) => { const b = e.target.closest("[data-code]"); if (b) selectState(b.dataset.code); });
    $("rank").addEventListener("click", (e) => { const b = e.target.closest("[data-code]"); if (b) selectState(b.dataset.code); });

    $("cmp-head").addEventListener("change", (e) => { ui.cmpHead = e.target.value; renderCompare(); });
    document.querySelectorAll("input[name=cmetric]").forEach((r) => r.addEventListener("change", (e) => { ui.cmpMetric = e.target.value; renderCompare(); }));
    $("cmp-chips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-code]");
      if (!b) return;
      const c = b.dataset.code;
      if (ui.compare.includes(c)) ui.compare = ui.compare.filter((x) => x !== c);
      else if (ui.compare.length < 4) ui.compare = ui.compare.concat(c);
      store.set("compare", ui.compare);
      renderCompare();
    });
    $("world-view").addEventListener("change", (e) => { worldUi.view = e.target.value; renderWorldChart(); });
    $("world-find").addEventListener("input", (e) => { worldUi.find = e.target.value; renderWorldTable(); });
    $("world-table").addEventListener("click", (e) => {
      const b = e.target.closest("[data-sort]");
      if (!b) return;
      const k = b.dataset.sort;
      worldUi.dir = worldUi.sort === k ? -worldUi.dir : (k === "n" || k === "rank" ? 1 : -1);
      worldUi.sort = k;
      renderWorldTable();
    });
    $("updates-chips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-topic]");
      if (b) { updUi.topic = b.dataset.topic; renderUpdates(); }
    });
    document.addEventListener("click", (e) => { const a = e.target.closest("[data-go]"); if (a) { e.preventDefault(); setTab(a.dataset.go); } });
    $("help-chips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]");
      if (b) { ui.resFilter = b.dataset.cat; renderResources(); }
    });

    const fromHash = location.hash.replace("#", "");
    setTab(TABS.includes(fromHash) ? fromHash : ui.tab);
    window.addEventListener("hashchange", () => {
      const h = location.hash.replace("#", "");
      if (TABS.includes(h) && h !== ui.tab) setTab(h);
    });

    // re-draw charts when the OS colour scheme flips so axis text stays readable
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const redraw = () => setTab(ui.tab);
      if (mq.addEventListener) mq.addEventListener("change", redraw);
      else if (mq.addListener) mq.addListener(redraw); // older Safari
    }
  }

  init();

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
