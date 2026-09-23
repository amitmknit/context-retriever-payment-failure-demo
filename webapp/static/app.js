"use strict";

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const pretty = (v) => JSON.stringify(v, null, 2);

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

/* ------------------------------------------------ theme */

const THEME_KEY = "ctx-demo-theme";
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("#themeToggle").textContent = theme === "dark2" ? "Light" : "Dark";
  localStorage.setItem(THEME_KEY, theme);
}
$("#themeToggle").addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark2" ? "light2" : "dark2");
});
applyTheme(localStorage.getItem(THEME_KEY) || "light2");

/* ------------------------------------------------ nav */

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.setAttribute("aria-current", "false"));
    btn.setAttribute("aria-current", "true");
    const target = btn.dataset.section;
    document.querySelectorAll(".section").forEach((s) => {
      s.hidden = s.id !== `section-${target}`;
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  });
});

/* ------------------------------------------------ drawer */

function openDrawer(title, sub, buildBody) {
  $("#drawerTitle").textContent = title;
  $("#drawerSub").textContent = sub || "";
  const body = $("#drawerBody");
  body.replaceChildren();
  buildBody(body);
  $("#drawer").dataset.open = "true";
  $("#drawerBackdrop").dataset.open = "true";
  $("#drawerClose").focus();
}
function closeDrawer() {
  $("#drawer").dataset.open = "false";
  $("#drawerBackdrop").dataset.open = "false";
}
$("#drawerClose").addEventListener("click", closeDrawer);
$("#drawerBackdrop").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

/* ------------------------------------------------ health */

function renderHealth(node, payload) {
  node.classList.remove("is-pending", "is-ok", "is-bad");
  node.classList.add(payload && payload.ok ? "is-ok" : "is-bad");
  node.querySelector(".detail").textContent = payload ? payload.detail : "unavailable";
  if (payload && payload.endpoint) node.title = payload.endpoint;
}

let healthCache = null;

async function loadHealth() {
  ["#healthRedis", "#healthCtx", "#healthMem"].forEach((sel) => {
    const n = $(sel);
    n.classList.remove("is-ok", "is-bad");
    n.classList.add("is-pending");
    n.querySelector(".detail").textContent = "checking…";
  });
  try {
    const data = await api("/api/health");
    healthCache = data;
    renderHealth($("#healthRedis"), data.redis);
    renderHealth($("#healthCtx"), data.context_retriever);
    renderHealth($("#healthMem"), data.agent_memory);
    return data;
  } catch (err) {
    ["#healthRedis", "#healthCtx", "#healthMem"].forEach((sel) => renderHealth($(sel), { ok: false, detail: err.message }));
    return null;
  }
}
$("#refreshHealth").addEventListener("click", loadHealth);

/* ------------------------------------------------ overview tiles */

function renderTiles(model, health) {
  const redisKeys = health && health.redis && health.redis.ok ? health.redis.detail.replace(" keys", "") : "—";
  const tiles = [
    [model ? model.entity_count : "—", "Entities modeled"],
    [model ? model.tool_count : "—", "Generated MCP tools"],
    [model ? model.relationship_count : "—", "Declared relationships"],
    [redisKeys, "Keys in Redis"],
  ];
  const wrap = $("#overviewTiles");
  wrap.replaceChildren();
  tiles.forEach(([value, label]) => {
    const tile = el("div", "tile");
    tile.append(el("div", "tile-value", String(value)), el("div", "tile-label", label));
    wrap.append(tile);
  });
}

/* ------------------------------------------------ keyspace */

async function loadKeyspace() {
  const out = $("#keyspaceResult");
  try {
    const payload = await api("/api/redis/keyspace");
    const wrap = el("div", "table-wrap");
    const table = el("table");
    const thead = el("thead");
    const hrow = el("tr");
    ["Key prefix", "Keys", "Owned by"].forEach((h) => hrow.append(el("th", null, h)));
    thead.append(hrow);
    const tbody = el("tbody");
    payload.groups.forEach((g) => {
      const tr = el("tr");
      tr.append(el("td", "mono", g.prefix));
      tr.append(el("td", "mono", String(g.count)));
      const ownerTd = el("td");
      ownerTd.append(
        el("span", g.owner === "Agent Memory" ? "badge is-episodic" : "badge is-semantic", g.owner),
      );
      tr.append(ownerTd);
      tbody.append(tr);
    });
    table.append(thead, tbody);
    wrap.append(table);
    out.replaceChildren(el("p", "inline-note", `${payload.total} keys total in one database`), wrap);
  } catch (err) {
    out.replaceChildren(el("div", "empty", `Could not read the keyspace: ${err.message}`));
  }
}

/* ------------------------------------------------ entity model */

function indexChips(field) {
  const frag = document.createDocumentFragment();
  if (field.is_key) frag.append(el("span", "chip is-key", "key"));
  (field.indexes || []).forEach((idx) => {
    const cls = idx === "tag" ? "is-tag" : idx === "text" ? "is-text" : idx === "numeric" ? "is-numeric" : "";
    frag.append(el("span", `chip ${cls}`, idx));
  });
  if (!field.is_key && (!field.indexes || field.indexes.length === 0)) {
    frag.append(el("span", "chip", "not indexed"));
  }
  return frag;
}

function entityDrawer(entity) {
  openDrawer(entity.name, entity.key_template, (body) => {
    // fields table
    const fieldsPanel = el("div");
    fieldsPanel.append(el("p", "code-label", "Fields"));
    const wrap = el("div", "table-wrap");
    const table = el("table");
    const thead = el("thead");
    const hrow = el("tr");
    ["Field", "Type", "Indexes", "Description"].forEach((h) => hrow.append(el("th", null, h)));
    thead.append(hrow);
    const tbody = el("tbody");
    entity.fields.forEach((f) => {
      const tr = el("tr");
      tr.append(el("td", "mono", f.name));
      tr.append(el("td", "mono", f.type));
      const idxTd = el("td");
      idxTd.append(indexChips(f));
      tr.append(idxTd);
      const desc = el("td", null, f.description || "—");
      if (f.allowed_values && f.allowed_values.length) {
        desc.append(el("br"));
        f.allowed_values.forEach((v) => desc.append(el("span", "chip", v)));
      }
      tr.append(desc);
      tbody.append(tr);
    });
    table.append(thead, tbody);
    wrap.append(table);
    fieldsPanel.append(wrap);
    body.append(fieldsPanel);

    // relationships
    if (entity.relationships && entity.relationships.length) {
      const relPanel = el("div");
      relPanel.append(el("p", "code-label", "Declared relationships"));
      entity.relationships.forEach((r) => {
        const line = el("div", "inline-note");
        line.append(
          el("span", "chip is-fk", r.name),
          document.createTextNode(` follows ${r.source_field} → `),
          el("span", "chip", r.target),
        );
        relPanel.append(line);
      });
      body.append(relPanel);
    }

    // live redis doc
    const docPanel = el("div");
    docPanel.append(el("p", "code-label", "Live document in Redis"));
    const status = el("div", "inline-note", "Loading…");
    docPanel.append(status);
    body.append(docPanel);

    const sampleKey = sampleKeyFor(entity);
    if (!sampleKey) {
      status.textContent = "No sample key known for this entity.";
      return;
    }
    api(`/api/redis/doc?key=${encodeURIComponent(sampleKey)}`)
      .then((doc) => {
        status.remove();
        const meta = el("div", "inline-note");
        meta.append(
          document.createTextNode("Redis type: "),
          el("span", "chip", doc.type),
          document.createTextNode(` — key `),
          el("span", "chip", doc.key),
        );
        docPanel.append(meta, Object.assign(el("pre", "code"), { textContent: pretty(doc.value) }));
      })
      .catch((err) => {
        status.textContent = `Could not read ${sampleKey}: ${err.message}`;
      });
  });
}

// Known sample record per entity, so the drawer can show a real document.
const SAMPLE_IDS = {
  Customer: "customer:1042",
  PaymentMethod: "payment_method:pm_5",
  Transaction: "transaction:tx_5",
  PaymentFailureEvent: "payment_failure:pf_3",
  SupportTicket: "support_ticket:st_1",
};
function sampleKeyFor(entity) {
  return SAMPLE_IDS[entity.name] || null;
}

function renderModel(model) {
  $("#surfaceName").textContent = model.surface_name || "—";

  const tbody = $("#entityRows");
  tbody.replaceChildren();
  model.entities.forEach((entity) => {
    const tr = el("tr", "is-clickable");
    tr.tabIndex = 0;
    tr.append(el("td", null, entity.name));
    tr.append(el("td", "mono", entity.key_template || "—"));

    const fieldsTd = el("td");
    entity.fields.slice(0, 6).forEach((f) => fieldsTd.append(el("span", "chip", f.name)));
    if (entity.fields.length > 6) fieldsTd.append(el("span", "chip", `+${entity.fields.length - 6}`));
    tr.append(fieldsTd);

    const relTd = el("td");
    if (entity.relationships.length === 0) {
      relTd.append(el("span", "inline-note", "none"));
    } else {
      entity.relationships.forEach((r) => relTd.append(el("span", "chip is-fk", `${r.name} → ${r.target}`)));
    }
    tr.append(relTd);

    const open = () => {
      tbody.querySelectorAll("tr").forEach((row) => row.classList.remove("is-selected"));
      tr.classList.add("is-selected");
      entityDrawer(entity);
    };
    tr.addEventListener("click", open);
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
    tbody.append(tr);
  });

  const groups = $("#toolGroups");
  groups.replaceChildren();
  const order = ["get", "filter", "search", "count", "summarize", "list", "expand", "union", "intersect", "except"];
  const keys = Object.keys(model.tools_grouped).sort(
    (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99),
  );
  keys.forEach((prefix) => {
    const row = el("div", "stack");
    row.style.marginBottom = "var(--sp-3)";
    row.append(el("div", "field-label", `${prefix}_* (${model.tools_grouped[prefix].length})`));
    const chips = el("div");
    model.tools_grouped[prefix].forEach((t) => chips.append(el("span", "chip", t)));
    row.append(chips);
    groups.append(row);
  });
}

/* ------------------------------------------------ resolution */

let resolutionMeta = null;
let sessionId = null;

function newSessionId() {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `support-1042-${stamp}`;
}

function turnNode(role, actor, text) {
  const node = el("div", `turn is-${role.toLowerCase().includes("user") ? "user" : "assistant"}`);
  const meta = el("div", "turn-meta");
  meta.append(el("span", null, role), el("span", "mono", actor));
  node.append(meta, el("div", "turn-text", text));
  return node;
}

function resetResolution() {
  sessionId = null;
  $("#sessionIdLabel").textContent = "—";
  $("#stepList").replaceChildren(
    Object.assign(el("div", "empty"), { innerHTML: "Press <strong>Run resolution</strong> to start. Steps appear one at a time." }),
  );
  $("#finalAnswerWrap").replaceChildren();
  $("#liveTranscript").replaceChildren(
    Object.assign(el("div", "empty"), { textContent: "No turns recorded yet.", style: "padding: var(--sp-4)" }),
  );
  $("#resolutionStatus").textContent = "";
}
$("#resetResolution").addEventListener("click", resetResolution);

function renderStep(payload) {
  const step = el("div", "step");

  const head = el("div", "step-head");
  head.append(el("div", "step-num-badge", String(payload.index + 1)));
  const titles = el("div");
  titles.append(el("div", "step-title", payload.title), el("div", "step-question", payload.question));
  head.append(titles);
  head.append(el("div", "step-timing", `${payload.elapsed_ms} ms`));
  step.append(head);

  const body = el("div", "step-body");

  const callWrap = el("div");
  callWrap.append(el("p", "code-label", "Tool call"));
  callWrap.append(
    Object.assign(el("pre", "code"), {
      textContent: `${payload.tool}(${pretty(payload.arguments)})`,
    }),
  );
  body.append(callWrap);

  const resWrap = el("div");
  resWrap.append(el("p", "code-label", "Response"));
  resWrap.append(Object.assign(el("pre", "code"), { textContent: pretty(payload.result) }));
  body.append(resWrap);

  body.append(el("div", "step-takeaway", payload.takeaway));
  step.append(body);
  return step;
}

async function runResolution() {
  const btn = $("#runResolution");
  btn.disabled = true;
  btn.classList.add("is-loading");
  try {
    resetResolution();
    sessionId = newSessionId();
    $("#sessionIdLabel").textContent = sessionId;
    const list = $("#stepList");
    list.replaceChildren();
    const transcript = $("#liveTranscript");
    transcript.replaceChildren();

    if (!resolutionMeta) resolutionMeta = await api("/api/resolution");

    transcript.append(turnNode("USER", "customer-1042", resolutionMeta.prompt));

    for (let i = 0; i < resolutionMeta.steps.length; i += 1) {
      $("#resolutionStatus").textContent = `Step ${i + 1} of ${resolutionMeta.steps.length}…`;
      const payload = await api("/api/resolution/step", {
        method: "POST",
        body: JSON.stringify({ index: i, session_id: sessionId }),
      });
      list.append(renderStep(payload));
      transcript.append(turnNode("ASSISTANT", "payment-ops-agent", `${payload.title}: ${payload.takeaway}`));
      await new Promise((r) => setTimeout(r, 250));
    }

    $("#resolutionStatus").textContent = "Writing durable facts to long-term memory…";
    const finish = await api("/api/resolution/finish", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    });

    transcript.append(turnNode("ASSISTANT", "payment-ops-agent", finish.final_answer));

    const answer = el("div", "final-answer");
    answer.append(el("p", "code-label", "Agent's answer"));
    answer.append(el("p", null, finish.final_answer));
    const wrote = el("div", "inline-note");
    wrote.style.marginTop = "var(--sp-3)";
    wrote.append(document.createTextNode("Written to long-term memory: "));
    (finish.long_term_written.semantic || []).forEach((id) =>
      wrote.append(el("span", "chip is-key", `semantic: ${id}`)),
    );
    (finish.long_term_written.episodic || []).forEach((id) =>
      wrote.append(el("span", "chip is-text", `episodic: ${id}`)),
    );
    answer.append(wrote);
    $("#finalAnswerWrap").replaceChildren(answer);
    $("#resolutionStatus").textContent = "Done. Session recorded; two durable facts written.";
  } catch (err) {
    const banner = el("div", "banner is-danger");
    const inner = el("div");
    inner.append(el("p", "banner-title", "Resolution failed"), el("p", null, err.message));
    banner.append(inner);
    $("#stepList").append(banner);
    $("#resolutionStatus").textContent = "";
  } finally {
    btn.disabled = false;
    btn.classList.remove("is-loading");
  }
}
$("#runResolution").addEventListener("click", runResolution);

/* ------------------------------------------------ capabilities */

async function loadCapabilities() {
  const data = await api("/api/capabilities");
  const tbody = $("#capabilityRows");
  tbody.replaceChildren();
  data.capabilities.forEach((cap) => {
    const tr = el("tr");
    tr.append(el("td", null, cap.label));
    tr.append(el("td", "mono", cap.tool));
    tr.append(el("td", null, cap.blurb));
    const actionTd = el("td");
    const btn = el("button", "btn is-sm is-primary", "Run");
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.classList.add("is-loading");
      try {
        const payload = await api(`/api/capabilities/${cap.key}`, { method: "POST" });
        renderCapabilityResult(payload);
      } catch (err) {
        renderCapabilityError(cap, err);
      } finally {
        btn.disabled = false;
        btn.classList.remove("is-loading");
      }
    });
    actionTd.append(btn);
    tr.append(actionTd);
    tbody.append(tr);
  });
}

function renderCapabilityResult(payload) {
  const panel = el("div", "panel");
  const head = el("div");
  head.append(el("h2", null, `${payload.label} — ${payload.tool}`));
  head.append(el("p", "panel-sub", `${payload.blurb}  ·  ${payload.elapsed_ms} ms`));
  panel.append(head);
  const split = el("div", "split");
  const left = el("div");
  left.append(el("p", "code-label", "Request"), Object.assign(el("pre", "code"), { textContent: pretty(payload.arguments) }));
  const right = el("div");
  right.append(el("p", "code-label", "Response"), Object.assign(el("pre", "code"), { textContent: pretty(payload.result) }));
  split.append(left, right);
  panel.append(split);
  $("#capabilityResult").replaceChildren(panel);
  panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderCapabilityError(cap, err) {
  const banner = el("div", "banner is-danger");
  const inner = el("div");
  inner.append(el("p", "banner-title", `${cap.label} failed`), el("p", null, err.message));
  banner.append(inner);
  $("#capabilityResult").replaceChildren(banner);
}

/* ------------------------------------------------ memory */

$("#threshold").addEventListener("input", (e) => {
  $("#thresholdValue").textContent = Number(e.target.value).toFixed(2);
});

async function runRecall() {
  const btn = $("#runRecall");
  btn.disabled = true;
  btn.classList.add("is-loading");
  const out = $("#recallResult");
  try {
    const payload = await api("/api/memory/recall", {
      method: "POST",
      body: JSON.stringify({
        query: $("#recallQuery").value,
        similarity_threshold: Number($("#threshold").value),
        limit: 8,
      }),
    });
    out.replaceChildren();
    if (payload.count === 0) {
      const banner = el("div", "banner is-attention");
      const inner = el("div");
      inner.append(
        el("p", "banner-title", `No memories above threshold ${payload.similarity_threshold.toFixed(2)}`),
        el(
          "p",
          null,
          "The records exist — they are retrievable by ID and by structured filter. This is the threshold being too strict for this query, which is exactly the calibration point worth showing a customer.",
        ),
      );
      banner.append(inner);
      out.append(banner);
      return;
    }
    const wrap = el("div", "table-wrap");
    const table = el("table");
    const thead = el("thead");
    const hrow = el("tr");
    ["Type", "Memory", "Topics"].forEach((h) => hrow.append(el("th", null, h)));
    thead.append(hrow);
    const tbody = el("tbody");
    payload.memories.forEach((m) => {
      const tr = el("tr");
      const typeTd = el("td");
      typeTd.append(el("span", `badge is-${m.memory_type}`, m.memory_type || "—"));
      tr.append(typeTd);
      tr.append(el("td", null, m.text));
      const topicsTd = el("td");
      (m.topics || []).forEach((t) => topicsTd.append(el("span", "chip", t)));
      tr.append(topicsTd);
      tbody.append(tr);
    });
    table.append(thead, tbody);
    wrap.append(table);
    out.append(el("p", "inline-note", `${payload.count} recalled at threshold ${payload.similarity_threshold.toFixed(2)}`), wrap);
  } catch (err) {
    const banner = el("div", "banner is-danger");
    const inner = el("div");
    inner.append(el("p", "banner-title", "Recall failed"), el("p", null, err.message));
    banner.append(inner);
    out.replaceChildren(banner);
  } finally {
    btn.disabled = false;
    btn.classList.remove("is-loading");
  }
}
$("#runRecall").addEventListener("click", runRecall);

async function runBrowse() {
  const btn = $("#runBrowse");
  btn.disabled = true;
  btn.classList.add("is-loading");
  const out = $("#browseResult");
  try {
    const payload = await api("/api/memory/browse");
    $("#browseSummary").textContent =
      `${payload.total} total — ${payload.direct_written_count} written deliberately, ${payload.auto_promoted_count} auto-promoted from conversation`;
    const wrap = el("div", "table-wrap");
    const table = el("table");
    const thead = el("thead");
    const hrow = el("tr");
    ["Origin", "Type", "Memory", "ID"].forEach((h) => hrow.append(el("th", null, h)));
    thead.append(hrow);
    const tbody = el("tbody");
    payload.memories.forEach((m) => {
      const tr = el("tr");
      const originTd = el("td");
      originTd.append(el("span", `badge is-${m.origin}`, m.origin));
      tr.append(originTd);
      const typeTd = el("td");
      typeTd.append(el("span", `badge is-${m.memory_type}`, m.memory_type || "—"));
      tr.append(typeTd);
      tr.append(el("td", null, m.text));
      const idTd = el("td", "mono cell-ellipsis", m.id);
      idTd.title = m.id;
      tr.append(idTd);
      tbody.append(tr);
    });
    table.append(thead, tbody);
    wrap.append(table);
    out.replaceChildren(wrap);
  } catch (err) {
    const banner = el("div", "banner is-danger");
    const inner = el("div");
    inner.append(el("p", "banner-title", "Browse failed"), el("p", null, err.message));
    banner.append(inner);
    out.replaceChildren(banner);
  } finally {
    btn.disabled = false;
    btn.classList.remove("is-loading");
  }
}
$("#runBrowse").addEventListener("click", runBrowse);

/* ------------------------------------------------ boot */

(async function boot() {
  const health = await loadHealth();
  let model = null;
  try {
    model = await api("/api/model");
    renderModel(model);
  } catch (err) {
    $("#entityRows").replaceChildren(
      Object.assign(el("tr"), {
        innerHTML: `<td colspan="4"><div class="banner is-danger"><div><p class="banner-title">Could not load the entity model</p><p>${err.message}</p></div></div></td>`,
      }),
    );
  }
  renderTiles(model, health);
  loadKeyspace();

  try {
    resolutionMeta = await api("/api/resolution");
    $("#resolutionPrompt").textContent = resolutionMeta.prompt;
  } catch (_) {
    $("#resolutionPrompt").textContent = "Unavailable — check service health above.";
  }

  loadCapabilities().catch((err) => {
    $("#capabilityRows").replaceChildren(
      Object.assign(el("tr"), { innerHTML: `<td colspan="4">${err.message}</td>` }),
    );
  });
})();
