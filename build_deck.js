const pptxgen = require("pptxgenjs");

const C = {
  RED: "FF4438",
  MIDNIGHT: "091A23",
  DUSK: "163341",
  DUSK30: "B9C2C6",
  LIME: "DCFF1E",
  SKY: "80DBFF",
  PURPLE: "C795E3",
  WHITE: "FFFFFF",
  OFFWHITE: "F2F2F2",
  MIDGRAY: "5C707A",
};
const F = { HEAD: "Space Grotesk", BODY: "Space Grotesk", CODE: "Space Mono" };

function addFooter(s, pageNum) {
  s.addText("Redis", {
    x: 0.28, y: 5.18, w: 0.75, h: 0.24,
    fontSize: 11, bold: true, color: C.RED, fontFace: F.HEAD, margin: 0,
  });
  s.addText("© 2026 Redis Ltd. All rights reserved.", {
    x: 1.10, y: 5.20, w: 4.5, h: 0.20,
    fontSize: 6.5, color: C.MIDGRAY, fontFace: F.BODY, margin: 0,
  });
  if (pageNum) {
    s.addText(String(pageNum), {
      x: 9.60, y: 5.22, w: 0.30, h: 0.20,
      fontSize: 7, color: C.MIDGRAY, align: "right", fontFace: F.BODY, margin: 0,
    });
  }
}

// Rough line-wrap estimate for layout. At fontSize 11.5 in a 9.2in box this
// lands close enough to keep sections from colliding; erring long is safe.
const CHARS_PER_LINE = 112;
const LINE_H = 0.215;
function wrappedLines(text, charsPerLine) {
  return String(text)
    .split("\n")
    .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

function bulletText(s, items, opts) {
  const rich = items.map((t, i) => ({
    text: t,
    options: { bullet: { indent: 18 }, breakLine: i < items.length - 1 },
  }));
  s.addText(rich, opts);
}

// ---------- Slide builders ----------

function titleSlide(pres) {
  const s = pres.addSlide();
  s.background = { color: C.RED };
  s.addText("Redis", {
    x: 0.42, y: 0.38, w: 1.4, h: 0.38,
    fontSize: 20, bold: true, color: C.WHITE, fontFace: F.HEAD, margin: 0,
  });
  s.addText("Redis Context Retriever", {
    x: 0.42, y: 1.55, w: 8.8, h: 1.0,
    fontSize: 40, color: C.WHITE, fontFace: F.HEAD, margin: 0,
  });
  s.addText("Context Retriever + Agent Memory: resolving a payment failure", {
    x: 0.42, y: 2.55, w: 8.8, h: 0.55,
    fontSize: 20, color: C.WHITE, fontFace: F.BODY, margin: 0,
  });
  s.addText("Amit Malik, Redis Solutions Architect", {
    x: 0.42, y: 3.55, w: 6.0, h: 0.4,
    fontSize: 14, color: C.WHITE, fontFace: F.BODY, margin: 0,
  });
  s.addText("© 2026 Redis Ltd. All rights reserved.", {
    x: 0.42, y: 5.22, w: 5.0, h: 0.20,
    fontSize: 6.5, color: C.WHITE, fontFace: F.BODY, transparency: 40, margin: 0,
  });
  return s;
}

function dividerSlide(pres, label, title, dark) {
  const s = pres.addSlide();
  s.background = { color: dark ? C.MIDNIGHT : C.RED };
  s.addShape(pres.shapes.OVAL, {
    x: 0.42, y: 0.34, w: 0.14, h: 0.14, fill: { color: C.LIME }, line: { color: C.LIME },
  });
  s.addText(label.toUpperCase(), {
    x: 0.64, y: 0.30, w: 8.0, h: 0.22,
    fontSize: 10, bold: true, color: C.WHITE, fontFace: F.HEAD, charSpacing: 2, margin: 0,
  });
  s.addText(title, {
    x: 0.42, y: 0.60, w: 9.0, h: 1.2,
    fontSize: 34, color: C.WHITE, fontFace: F.HEAD, margin: 0,
  });
  addFooter(s, null);
  return s;
}

function contentSlideSingle(pres, title, subtitle, sections, pageNum) {
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  s.addText(title, {
    x: 0.42, y: 0.26, w: 9.2, h: 0.52,
    fontSize: 30, color: C.MIDNIGHT, fontFace: F.HEAD, margin: 0,
  });
  if (subtitle) {
    s.addText(subtitle, {
      x: 0.42, y: 0.78, w: 9.2, h: 0.28,
      fontSize: 13, color: C.MIDGRAY, fontFace: F.BODY, margin: 0,
    });
  }
  let y = subtitle ? 1.22 : 1.00;
  sections.forEach((sec) => {
    if (sec.header) {
      s.addText(sec.header, {
        x: 0.42, y, w: 9.2, h: 0.28,
        fontSize: 13, bold: true, color: C.MIDNIGHT, fontFace: F.HEAD, margin: 0,
      });
      y += 0.30;
    }
    if (sec.body) {
      // Advance by the wrapped height, not a fixed guess -- a fixed height let
      // 3-line bodies collide with the next header.
      const h = wrappedLines(sec.body, CHARS_PER_LINE) * LINE_H + 0.06;
      s.addText(sec.body, {
        x: 0.42, y, w: 9.2, h,
        fontSize: 11.5, color: C.MIDNIGHT, fontFace: F.BODY, margin: 0, valign: "top",
      });
      y += h + 0.06;
    }
    if (sec.bullets) {
      // Same for bullets: a long bullet wraps and needs the extra line.
      const lines = sec.bullets.reduce(
        (n, b) => n + wrappedLines(b, CHARS_PER_LINE - 4),
        0,
      );
      const h = lines * LINE_H + 0.12;
      bulletText(s, sec.bullets, {
        x: 0.55, y, w: 9.0, h,
        fontSize: 11.5, color: C.MIDNIGHT, fontFace: F.BODY, margin: 0, valign: "top",
      });
      y += h + 0.10;
    }
  });
  addFooter(s, pageNum);
  return s;
}

function cardSlideDark(pres, title, subtitle, cards, pageNum) {
  const s = pres.addSlide();
  s.background = { color: C.MIDNIGHT };
  s.addText(title, {
    x: 0.42, y: 0.26, w: 9.2, h: 0.52,
    fontSize: 30, color: C.WHITE, fontFace: F.HEAD, margin: 0,
  });
  s.addText(subtitle, {
    x: 0.42, y: 0.78, w: 9.2, h: 0.28,
    fontSize: 13, color: C.DUSK30, fontFace: F.BODY, margin: 0,
  });
  const cardW = 2.9, cardH = 3.6, gap = 0.22;
  const totalW = cards.length * cardW + (cards.length - 1) * gap;
  const startX = (10 - totalW) / 2;
  cards.forEach((c, i) => {
    const cx = startX + i * (cardW + gap);
    const cy = 1.28;
    s.addShape(pres.shapes.RECTANGLE, {
      x: cx, y: cy, w: cardW, h: cardH,
      fill: { color: C.DUSK }, line: { color: C.LIME, width: 1 },
    });
    s.addShape(pres.shapes.OVAL, {
      x: cx + 0.16, y: cy + 0.18, w: 0.12, h: 0.12, fill: { color: C.LIME }, line: { color: C.LIME },
    });
    s.addText(c.label.toUpperCase(), {
      x: cx + 0.32, y: cy + 0.14, w: cardW - 0.44, h: 0.22,
      fontSize: 9, bold: true, color: C.LIME, fontFace: F.HEAD, charSpacing: 1, margin: 0,
    });
    s.addText(c.body, {
      x: cx + 0.16, y: cy + 0.46, w: cardW - 0.32, h: cardH - 0.60,
      fontSize: 10.5, color: C.WHITE, fontFace: F.BODY, align: "left", valign: "top", margin: 0,
    });
  });
  addFooter(s, pageNum);
  return s;
}

function codeSlide(pres, title, subtitle, codeLines, pageNum) {
  const s = pres.addSlide();
  s.background = { color: C.MIDNIGHT };
  s.addText(title, {
    x: 0.42, y: 0.26, w: 9.2, h: 0.52,
    fontSize: 30, color: C.WHITE, fontFace: F.HEAD, margin: 0,
  });
  s.addText(subtitle, {
    x: 0.42, y: 0.78, w: 9.2, h: 0.28,
    fontSize: 13, color: C.DUSK30, fontFace: F.BODY, margin: 0,
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.55, y: 1.18, w: 8.9, h: 3.75,
    fill: { color: "0D1B22" }, line: { color: C.LIME, width: 1 },
  });
  const rich = codeLines.map((line, i) => ({
    text: line.text,
    options: {
      color: line.color || C.WHITE,
      breakLine: true,
      fontFace: F.CODE, fontSize: 11.5,
    },
  }));
  s.addText(rich, {
    x: 0.75, y: 1.32, w: 8.5, h: 3.50,
    fontFace: F.CODE, fontSize: 11.5, align: "left", valign: "top", margin: 0,
  });
  addFooter(s, pageNum);
  return s;
}

function tableSlide(pres, title, subtitle, headerRow, rows, pageNum, colWidths) {
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  s.addText(title, {
    x: 0.42, y: 0.26, w: 9.2, h: 0.52,
    fontSize: 28, color: C.MIDNIGHT, fontFace: F.HEAD, margin: 0,
  });
  s.addText(subtitle, {
    x: 0.42, y: 0.76, w: 9.2, h: 0.28,
    fontSize: 12, color: C.MIDGRAY, fontFace: F.BODY, margin: 0,
  });
  const tblRows = [
    headerRow.map((h) => ({
      text: h,
      options: { fill: { color: C.RED }, color: C.WHITE, bold: true, fontSize: 10, fontFace: F.HEAD },
    })),
    ...rows.map((r) =>
      r.map((cellText) => ({
        text: cellText,
        options: { fontSize: 9.5, color: C.MIDNIGHT, fontFace: F.BODY, fill: { color: C.OFFWHITE } },
      }))
    ),
  ];
  s.addTable(tblRows, {
    x: 0.42, y: 1.18, w: 9.2, colW: colWidths,
    border: { type: "solid", color: C.DUSK30, pt: 0.5 },
    autoPage: false,
    rowH: 0.30,
    valign: "middle",
  });
  addFooter(s, pageNum);
  return s;
}

function diagramSlide(pres, title, subtitle, pageNum) {
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  s.addText(title, {
    x: 0.42, y: 0.26, w: 9.2, h: 0.52,
    fontSize: 28, color: C.MIDNIGHT, fontFace: F.HEAD, margin: 0,
  });
  s.addText(subtitle, {
    x: 0.42, y: 0.76, w: 9.2, h: 0.28,
    fontSize: 12, color: C.MIDGRAY, fontFace: F.BODY, margin: 0,
  });

  // Entity boxes with relationship arrows: Customer -> PaymentMethod -> Transaction -> PaymentFailureEvent
  //                                                                      Transaction -> SupportTicket
  //                                         Customer -----------------> SupportTicket
  const boxW = 1.95, boxH = 0.85;
  const entities = [
    { name: "Customer", x: 0.35, y: 1.35, fields: "id, email, tier, city" },
    { name: "PaymentMethod", x: 2.65, y: 1.35, fields: "id, customer_id, type, status" },
    { name: "Transaction", x: 4.95, y: 1.35, fields: "id, customer_id,\npayment_method_id, status" },
    { name: "PaymentFailureEvent", x: 7.25, y: 1.35, fields: "id, transaction_id,\nfailure_code, gateway" },
    { name: "SupportTicket", x: 4.95, y: 3.55, fields: "id, customer_id,\ntransaction_id, status" },
  ];
  entities.forEach((e) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: e.x, y: e.y, w: boxW, h: boxH,
      fill: { color: C.MIDNIGHT }, line: { color: C.RED, width: 1.25 },
    });
    s.addText(e.name, {
      x: e.x + 0.08, y: e.y + 0.06, w: boxW - 0.16, h: 0.26,
      fontSize: 11, bold: true, color: C.LIME, fontFace: F.HEAD, margin: 0,
    });
    s.addText(e.fields, {
      x: e.x + 0.08, y: e.y + 0.32, w: boxW - 0.16, h: boxH - 0.36,
      fontSize: 8.5, color: C.WHITE, fontFace: F.CODE, margin: 0,
    });
  });

  const arrow = (x1, y1, x2, y2) =>
    s.addShape(pres.shapes.LINE, {
      x: Math.min(x1, x2), y: Math.min(y1, y2),
      w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
      line: { color: C.RED, width: 1.5, endArrowType: "arrow" },
      flipV: y2 < y1,
    });

  arrow(2.30, 1.77, 2.65, 1.77); // Customer -> PaymentMethod
  arrow(4.60, 1.77, 4.95, 1.77); // PaymentMethod -> Transaction
  arrow(6.90, 1.77, 7.25, 1.77); // Transaction -> PaymentFailureEvent
  arrow(5.92, 2.20, 5.92, 3.55); // Transaction -> SupportTicket
  arrow(1.32, 2.20, 1.32, 3.97); // Customer down
  arrow(1.32, 3.97, 4.95, 3.97); // Customer -> SupportTicket (elbow, approx via second line)

  s.addText(
    [
      { text: "Customer 1:N PaymentMethod   •   Customer 1:N Transaction   •   Customer 1:N SupportTicket", options: { breakLine: true } },
      { text: "PaymentMethod 1:N Transaction   •   Transaction 1:1 PaymentFailureEvent   •   Transaction 1:N SupportTicket", options: {} },
    ],
    { x: 0.42, y: 4.55, w: 9.2, h: 0.5, fontSize: 10, color: C.MIDGRAY, fontFace: F.BODY, margin: 0 }
  );

  addFooter(s, pageNum);
  return s;
}

// ---------- Build ----------

// Native version of the architecture diagram (replaces the ASCII-art screenshot
// that was pasted into the deck by hand -- that image is kept at
// docs/slide5-user-image.png if the original is ever wanted back).
function archSlide(pres, pageNum) {
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  s.addText("How the pieces fit together", {
    x: 0.42, y: 0.26, w: 9.2, h: 0.52,
    fontSize: 28, color: C.MIDNIGHT, fontFace: F.HEAD, margin: 0,
  });
  s.addText("Two planes, two key types. The agent never touches Redis directly.", {
    x: 0.42, y: 0.76, w: 9.2, h: 0.28,
    fontSize: 12, color: C.MIDGRAY, fontFace: F.BODY, margin: 0,
  });

  const box = (x, y, w, h, title, lines, accent) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w, h,
      fill: { color: C.MIDNIGHT }, line: { color: accent, width: 1.5 },
    });
    s.addText(title, {
      x: x + 0.14, y: y + 0.1, w: w - 0.28, h: 0.28,
      fontSize: 12, bold: true, color: accent, fontFace: F.HEAD, margin: 0,
    });
    s.addText(lines, {
      x: x + 0.14, y: y + 0.4, w: w - 0.28, h: h - 0.5,
      fontSize: 9.5, color: C.WHITE, fontFace: F.BODY, margin: 0, valign: "top",
    });
  };

  // control plane (top), MCP endpoint (middle), agent (bottom), Redis (right)
  box(2.6, 1.2, 4.3, 1.25, "Context Retriever service — control plane",
    "Stores the schema (entities, fields, relationships)\nAuto-generates the MCP tools from it", C.LIME);
  box(2.6, 2.75, 4.3, 1.2, "MCP endpoint — HTTPS, JSON-RPC",
    "get_*_by_id · filter_* · search_*_by_text\ncount_* · summarize_* · expand_results", C.SKY);
  box(2.6, 4.25, 4.3, 0.85, "Agent / program",
    "Claude, a custom loop, or this demo's script —\nno difference to the API", C.WHITE);
  box(7.4, 2.75, 2.2, 1.2, "Redis", "RedisJSON docs at your key\ntemplates, plus the memory store", C.RED);

  const arrow = (x1, y1, x2, y2, label) => {
    s.addShape(pres.shapes.LINE, {
      x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
      line: { color: C.RED, width: 1.25, endArrowType: "arrow" },
    });
    if (label) {
      s.addText(label, {
        x: (x1 + x2) / 2 - 1.1, y: (y1 + y2) / 2 - 0.16, w: 2.2, h: 0.3,
        fontSize: 8.5, color: C.MIDGRAY, fontFace: F.CODE, align: "center", margin: 0,
      });
    }
  };

  arrow(4.75, 2.45, 4.75, 2.75, null);          // control plane -> MCP
  arrow(4.75, 3.95, 4.75, 4.25, null);          // MCP -> agent
  arrow(7.4, 3.2, 6.9, 3.2, null);              // Redis <- queries

  s.addText("exposes", { x: 4.9, y: 2.46, w: 1.4, h: 0.26, fontSize: 8.5, color: C.MIDGRAY, fontFace: F.CODE, margin: 0 });
  s.addText("returns records", { x: 4.9, y: 3.96, w: 1.8, h: 0.26, fontSize: 8.5, color: C.MIDGRAY, fontFace: F.CODE, margin: 0 });
  s.addText("queries", { x: 6.88, y: 2.9, w: 0.62, h: 0.26, fontSize: 7.5, color: C.MIDGRAY, fontFace: F.CODE, align: "center", margin: 0 });

  // key annotations on the left
  s.addText([
    { text: "admin key\n", options: { bold: true, color: C.LIME, fontSize: 10 } },
    { text: "pushes the schema, once\n(SDK, ctxctl, or console)\n\n", options: { fontSize: 9, color: C.MIDGRAY } },
    { text: "agent key\n", options: { bold: true, color: C.SKY, fontSize: 10 } },
    { text: "tools/list + tools/call,\nconstantly — cannot change\nthe model", options: { fontSize: 9, color: C.MIDGRAY } },
  ], { x: 0.42, y: 1.6, w: 2.0, h: 2.4, fontFace: F.BODY, margin: 0, valign: "top" });

  addFooter(s, pageNum);
  return s;
}

async function build() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";

  let page = 1;

  // 1. Title
  titleSlide(pres);

  // 2. The problem
  contentSlideSingle(
    pres,
    "The problem: the context layer breaks",
    "Why agents fail in production even when the LLM reasoning is sound",
    [
      {
        body:
          "Production agents fail not because the model is wrong, but because the context layer breaks. Enterprise data is fragmented across systems, and teams patch this with text-to-SQL, OpenAPI-to-MCP wrappers, or hand-built tools per agent.",
      },
      {
        header: "That patchwork creates three recurring problems",
        bullets: [
          "“Tool zoo” sprawl — a new hand-built tool for every agent, every data source",
          "SQL injection / risk surface — agents that generate or execute SQL directly against production data",
          "Agents that can't reliably choose the right path — too many similar tools, no governed structure",
        ],
      },
      {
        header: "The contrast",
        body:
          "Context Retriever gives agents a governed, schema-first surface they traverse safely — instead of guessing at SQL or calling a database directly.",
      },
    ],
    ++page
  );

  // 3. What Context Retriever is
  cardSlideDark(
    pres,
    "What Context Retriever actually is",
    "Model once, generate everywhere — the mechanics",
    [
      {
        label: "1. Model",
        body:
          "Define entities, fields, and relationships once — via Python ContextModel classes, the ctxctl CLI, or the Cloud console UI. This is the only hand-authored artifact in the system.",
      },
      {
        label: "2. Generate",
        body:
          "Context Retriever auto-generates a full MCP tool surface from that model: per-entity lookup/filter/search/count/summarize tools, plus relationship-traversal tools. Zero hand-written tool code.",
      },
      {
        label: "3. Invoke",
        body:
          "Agents call the generated tools at runtime instead of writing SQL or touching Redis directly. Two key roles: admin keys provision (create/update the model); agent keys only invoke tools that already exist.",
      },
    ],
    ++page
  );

  // 3b. Architecture
  archSlide(pres, ++page);

  // 4. Entity model diagram
  diagramSlide(
    pres,
    "Our demo domain: payment failure resolution",
    "5 entities, 7 declared relationships — modeled once for this walkthrough",
    ++page
  );

  // 4b. Field/index table
  tableSlide(
    pres,
    "Field & index detail",
    "Every field's Redis index type, since that's what determines which generated tools exist",
    ["Entity", "Key fields", "Index types used"],
    [
      ["Customer", "id, email, tier, city", "key, text, tag, tag"],
      ["PaymentMethod", "id, customer_id (FK), type, last4, status", "key, tag(FK), tag, text, tag"],
      ["Transaction", "id, customer_id (FK), payment_method_id (FK), amount, currency, status, created_at", "key, tag(FK), tag(FK), numeric, tag, tag, numeric"],
      ["PaymentFailureEvent", "id, transaction_id (FK), customer_id (FK), failure_code, failure_reason, gateway, retry_count, occurred_at", "key, tag(FK), tag(FK), tag, text, tag, numeric, numeric"],
      ["SupportTicket", "id, customer_id (FK), transaction_id (FK), status, priority, opened_at", "key, tag(FK), tag(FK), tag, tag, numeric"],
    ],
    ++page,
    [1.9, 5.3, 2.0]
  );

  // 5. Code slide - ContextRelationship
  codeSlide(
    pres,
    "How it's declared in code",
    "ContextModel / ContextField / ContextRelationship — the only hand-authored artifact",
    [
      { text: "class Transaction(ContextModel):", color: C.SKY },
      { text: '    __redis_key_template__ = "transaction:{id}"', color: C.WHITE },
      { text: "" },
      { text: '    id: str = ContextField(description="Transaction ID", is_key_component=True)', color: C.WHITE },
      { text: '    customer_id: str = ContextField(description="Customer ID", index="tag")', color: C.WHITE },
      { text: '    status: str = ContextField(index="tag", allowed_values=["succeeded","failed","pending"])', color: C.WHITE },
      { text: '    amount: float = ContextField(index="numeric")', color: C.WHITE },
      { text: "" },
      { text: "    customer: Any = ContextRelationship(", color: C.LIME },
      { text: '        description="Customer who made this transaction",', color: C.LIME },
      { text: '        target="Customer", source_field="customer_id",', color: C.LIME },
      { text: "    )", color: C.LIME },
    ],
    ++page
  );

  contentSlideSingle(
    pres,
    "Callout: relationships are not free",
    "We tested this live before trusting it",
    [
      {
        body:
          "Relationships are NOT auto-inferred from field naming. A tag field named customer_id does not automatically create a relationship to Customer just because the name matches — we verified this by exporting the data model with only field-naming conventions in place and getting zero relationships back.",
      },
      {
        header: "What actually works",
        bullets: [
          "Each relationship must be explicitly declared with ContextRelationship(target=..., source_field=...)",
          "Confirmed against the bundled context_surfaces/examples/reddish_models.py reference file",
          "Our models.py was fixed accordingly and re-verified via export_data_model before touching the live surface",
        ],
      },
    ],
    ++page
  );

  // 6. What actually got generated - before/after
  tableSlide(
    pres,
    "What actually got generated — before vs. after",
    "Real tool counts from the live surface, captured before and after applying the model",
    ["", "Before (bare Customer)", "After (5-entity model)"],
    [
      ["Entities modeled", "1 (Customer, id only)", "5 (Customer, PaymentMethod, Transaction, PaymentFailureEvent, SupportTicket)"],
      ["Tools exposed", "5 generic tools", "28 tools"],
      ["Tool types", "get_customer_by_id + set-algebra only", "get_*_by_id, filter_*, search_*_by_text, count_*, summarize_*, list_* for all 5 entities"],
      ["Relationships", "“this data model declares none”", "7 real hops surfaced through expand_results"],
      ["Hand-written tool code", "n/a", "Zero"],
    ],
    ++page,
    [2.0, 3.6, 3.6]
  );

  codeSlide(
    pres,
    "The relationship hops, verbatim from the live API",
    "expand_results tool schema, after the model update — not paraphrased",
    [
      { text: "\"description\": \"Relationship to follow. Declared hops:", color: C.WHITE },
      { text: " on a PaymentMethod set, 'customer' gives Customer;", color: C.SKY },
      { text: " on a Transaction set, 'customer' gives Customer;", color: C.SKY },
      { text: " on a Transaction set, 'payment_method' gives PaymentMethod;", color: C.SKY },
      { text: " on a PaymentFailureEvent set, 'transaction' gives Transaction;", color: C.SKY },
      { text: " on a PaymentFailureEvent set, 'customer' gives Customer;", color: C.SKY },
      { text: " on a SupportTicket set, 'customer' gives Customer;", color: C.SKY },
      { text: " on a SupportTicket set, 'transaction' gives Transaction.\"", color: C.SKY },
    ],
    ++page
  );

  // 7. Data lives in Redis
  contentSlideSingle(
    pres,
    "The data lives in Redis — as RedisJSON",
    "Seeded through the documented ingestion path, then verified directly with redis-cli",
    [
      {
        bullets: [
          "22 records imported via UnifiedClient.import_data: 5 Customer, 5 PaymentMethod, 6 Transaction, 4 PaymentFailureEvent, 2 SupportTicket",
          "import_data is the documented path — the package README explicitly warns against writing records directly to Redis unless you intend to manage the full storage/index contract yourself",
          "Each entity is stored as a RedisJSON document at its declared key template",
        ],
      },
      {
        header: "Verified directly, not assumed",
        body:
          'redis-cli TYPE payment_failure:pf_3 → ReJSON-RL.  redis-cli JSON.GET payment_failure:pf_3 returns the exact fields declared on PaymentFailureEvent.',
      },
    ],
    ++page
  );

  // 8. Agent flow walkthrough - divider
  dividerSlide(pres, "The centerpiece", "Resolving a real payment failure, live", true);

  contentSlideSingle(
    pres,
    "The prompt",
    "What an agent given only these generated MCP tools — no SQL, no direct Redis access — was asked to resolve",
    [
      {
        body:
          '“Customer 1042’s payment just failed — what happened and what should we do?”',
      },
      {
        body:
          "Every step below is a generated MCP tool call — the whole tool surface came from the entity model, and nobody hand-wrote a tool or a query. The order of the calls in this build is scripted, not model-chosen; the slide after the walkthrough is precise about which is which.",
      },
    ],
    ++page
  );

  codeSlide(
    pres,
    "Steps 1–3: identify the customer and the failure",
    "Real tool calls and real responses from the live run",
    [
      { text: "→ get_customer_by_id(id=\"1042\")", color: C.LIME },
      { text: "  Sofia Moreno · Madrid · tier: enterprise", color: C.WHITE },
      { text: "" },
      { text: "→ filter_transaction(customer_id=\"1042\")", color: C.LIME },
      { text: "  2 transactions, both status=failed, both €249,", color: C.WHITE },
      { text: "  both on payment_method_id=pm_5", color: C.WHITE },
      { text: "" },
      { text: "→ filter_paymentfailureevent(customer_id=\"1042\")", color: C.LIME },
      { text: "  both failures: failure_code=card_expired,", color: C.WHITE },
      { text: "  gateway=stripe, card pm_5 status=expired", color: C.WHITE },
    ],
    ++page
  );

  codeSlide(
    pres,
    "Steps 4–5: pattern check, duplicate check",
    "Ruling out a systemic incident and a duplicate ticket before acting",
    [
      { text: "→ filter_paymentfailureevent(failure_code=\"card_expired\")", color: C.LIME },
      { text: "  Same 2 records only — not a wider gateway incident,", color: C.WHITE },
      { text: "  isolated to this customer's expired card", color: C.WHITE },
      { text: "" },
      { text: "→ filter_supportticket(customer_id=\"1042\")", color: C.LIME },
      { text: "  0 open tickets — no duplicate risk", color: C.WHITE },
      { text: "" },
      { text: "=== Answer ===", color: C.RED },
      { text: "Expired card. Recurring, not one-off.", color: C.WHITE },
      { text: "Isolated, not systemic. No duplicate ticket.", color: C.WHITE },
      { text: "Correct action: prompt for a new card,", color: C.WHITE },
      { text: "not a blind retry.", color: C.WHITE },
    ],
    ++page
  );

  // 8c. What actually drove those steps -- the honest version.
  contentSlideSingle(
    pres,
    "What drove those five steps",
    "Be precise about this one — an engineer in the room will ask",
    [
      {
        header: "What is generated",
        body:
          "All 28 tools. Nobody hand-wrote a tool, a query, or a schema mapping — the entity model produced the entire surface, including the relationship traversals.",
      },
      {
        header: "What is scripted",
        body:
          "The order of the five calls. In this build they are a fixed list in the demo code; no model decided them. The narration and the closing answer are written text, not generated.",
      },
      {
        header: "Say this, not that",
        bullets: [
          "Accurate: \"every tool it called was generated from the model — none were hand-built\"",
          "Overstated: \"the agent chose and chained these calls itself\" — not in this build",
          "With a real LLM driving, the tool surface is identical; only the chooser changes",
        ],
      },
    ],
    ++page
  );

  // ---------------- Agent Memory ----------------
  dividerSlide(pres, "Adding memory", "The context the data model cannot hold", true);

  cardSlideDark(
    pres,
    "Why memory, on top of Context Retriever",
    "Two products, two different jobs — neither does the other's",
    [
      {
        label: "Context Retriever",
        body:
          "Answers \"what is true right now, in your structured business data.\" It has no concept of a conversation, and no memory of the last one.",
      },
      {
        label: "Session memory (short-term)",
        body:
          "The turns of one conversation, in order. Cheap to write, no model on the write path, expires in about a day. Lets a human agent — or the bot — resume mid-thread.",
      },
      {
        label: "Long-term memory",
        body:
          "Durable facts about the customer, vector-searchable across sessions. This is what makes the second call different from the first.",
      },
    ],
    ++page
  );

  tableSlide(
    pres,
    "Telling the two tiers apart in Redis",
    "Read live from the keyspace — both tiers sit in the same database as your entities",
    ["", "Short-term (session memory)", "Long-term memory"],
    [
      ["Key", "memory:<storeId>:session_memory:<sessionId>", "memory:<storeId>:ltm:<memoryId>"],
      ["Redis data type", "ReJSON-RL — one JSON doc of ordered turns", "hash — fields plus a text_vector embedding"],
      ["TTL observed", "~82,000 s  (~23 hours), refreshed per event", "~31,532,000 s  (~365 days)"],
      ["Searchable by vector", "No embedding at all", "Yes — the text_vector field is what makes recall work"],
    ],
    ++page,
    [1.9, 3.65, 3.65]
  );

  tableSlide(
    pres,
    "Memory types: a per-store registry",
    "Not a fixed enum — the SDK types memory_type as a plain string and the server validates per store",
    ["Type", "Registered here", "Records present", "What it is"],
    [
      ["semantic", "yes", "14", "A durable standing fact"],
      ["episodic", "yes", "39", "Something that happened at a point in time"],
      ["session_summary_view", "yes", "10", "An LLM-written narrative of a whole session"],
      ["message", "yes", "0", "A raw turn kept verbatim — unused in this demo"],
      ["procedural", "no — 400", "n/a", "\"not registered on this store\""],
    ],
    ++page,
    [2.5, 1.7, 1.7, 3.3]
  );

  tableSlide(
    pres,
    "End-to-end: one question, every call",
    "\"Customer 1042's payment just failed — what happened and what should we do?\"",
    ["Step", "Context Retriever tool", "Agent Memory write"],
    [
      ["1", "get_customer_by_id(id=1042)", "add_session_event ×2 (question + finding)"],
      ["2", "filter_transaction(customer_id=1042)", "add_session_event ×1"],
      ["3", "filter_paymentfailureevent(customer_id=1042)", "add_session_event ×1"],
      ["4", "filter_paymentfailureevent(failure_code=card_expired)", "add_session_event ×1"],
      ["5", "filter_supportticket(customer_id=1042)", "add_session_event ×1"],
      ["Finish", "— none —", "add_session_event ×1 + bulk_create_long_term_memories ×2"],
      ["Totals", "5 tool calls", "7 session events, 2 long-term records"],
    ],
    ++page,
    [1.0, 4.6, 3.6]
  );

  contentSlideSingle(
    pres,
    "Is there an LLM in this demo?",
    "Yes — but not where most people assume",
    [
      {
        header: "Not in the orchestration",
        body:
          "Our code makes zero model calls. The five steps are a fixed list; the narration is written text.",
      },
      {
        header: "But two models run inside Agent Memory, server-side",
        bullets: [
          "Extraction and summarisation — we wrote 2 long-term records; the other 61 appeared on their own, in phrasing we never authored. That is an LLM, running on promotion.",
          "Embeddings — every long-term record carries a text_vector; recall is vector similarity.",
          "Both are Redis Cloud-managed. The data plane will not tell you which models; store_health reports feature health only.",
        ],
      },
      {
        header: "What changes if an LLM drives the agent",
        bullets: [
          "Tool choice becomes dynamic — it reads the 28 schemas and picks; three steps or nine, and possibly tools this script never calls",
          "Recall moves to the front: search memory first, then decide whether Context Retriever is even needed",
          "Cost and latency shift from 5 tool calls to roughly 6–10 inference round-trips plus tools, and runs stop being identical",
          "Unchanged: the tool surface, the Redis data, the memory tiers, the key model",
        ],
      },
    ],
    ++page
  );

  // 9. Governance model as designed
  contentSlideSingle(
    pres,
    "Governance, as designed",
    "Two key types, and a tag-based scoping mechanism on agent keys",
    [
      {
        bullets: [
          "Admin keys provision — they create and update the entity model on a surface",
          "Agent keys only invoke tools that already exist — they cannot change the model",
          "Agent keys can carry access_tags, e.g. {\"team\": [\"fraud-ops\"]}, described in the docs as governing multi-tenant / row-level filtering — what an agent is allowed to see",
        ],
      },
    ],
    ++page
  );

  // 10. Honest finding
  dividerSlide(pres, "Testing live vs. trusting docs", "What we verified — and what we couldn't confirm", true);

  contentSlideSingle(
    pres,
    "Access-tag governance did not filter results",
    "Tested live against the actual service — reported plainly, not softened",
    [
      {
        body:
          'We created a second agent key with access_tags={"tier": ["standard"]} and queried the enterprise-tier customer (1042) with it — both directly via get_customer_by_id and via filter_customer.',
      },
      {
        header: "Result",
        bullets: [
          "Both calls returned the restricted enterprise-tier customer, unfiltered",
          "Access-tag enforcement did not work as documented, in this preview build, in this test",
          "This needs following up with the Context Retriever team before relying on it for real governance",
        ],
      },
      {
        header: "Why this matters",
        body:
          "This is the value of testing live rather than trusting docs alone — a governance claim that isn't verified against the real service is a claim, not a control.",
      },
    ],
    ++page
  );

  contentSlideSingle(
    pres,
    "Three more things testing turned up",
    "All in Agent Memory, all worth disclosing before a customer hits them",
    [
      {
        header: "The documented similarity threshold returned nothing",
        body:
          "Docs suggest starting at 0.7. Against this store's real embeddings, 0.7 returned zero results for a plain-language query; 0.5 returned the expected records. Swept 0.7 → 0.5 → 0.3 → 0.0 to confirm. Tune per workload; never demo on the documented default untested.",
      },
      {
        header: "Promotion is aggressive",
        body:
          "One five-turn conversation produced 42 auto-extracted memories, later 51, plus 10 whole-session summaries — against the 2 we wrote deliberately. Plan namespace and topic discipline before production volume, not after.",
      },
      {
        header: "Default search silently omits session summaries",
        body:
          "A search filtered only by owner_id returned 53 records; adding an explicit memory_type list returned 63. The 10 missing were the session_summary_view records — arguably the most useful ones, since each is a coherent narrative rather than a fragment. An agent relying on default recall would never see them.",
      },
    ],
    ++page
  );

  contentSlideSingle(
    pres,
    "How this is delivered",
    "A web UI so the demo is a product surface, not a terminal",
    [
      {
        bullets: [
          "Six sections: live overview, entity model with a Redis-document inspector, the resolution walkthrough, a capability tour, the memory panels, and governance",
          "Every figure and response is a live service call — no fixtures, and errors surface in the UI rather than failing silently",
          "Credentials stay server-side; the browser only ever receives data",
          "Two findings are interactive rather than described: drag the similarity threshold to 0.7 and watch recall go empty, and browse the store to see promotion volume for yourself",
        ],
      },
      {
        header: "Run it",
        body: ".venv/bin/python3 -m uvicorn webapp.server:app --port 8800  →  http://127.0.0.1:8800",
      },
    ],
    ++page
  );

  // 11. Recap
  cardSlideDark(
    pres,
    "Why this matters",
    "What one entity model bought us — and what still needs verifying",
    [
      {
        label: "Fewer hand-built tools",
        body: "One model definition produced 28 tools across 5 entities and 7 relationships. Nobody hand-wrote a tool, a query, or a schema mapping.",
      },
      {
        label: "Governed surface, live data",
        body: "Agents get a governed MCP surface instead of raw DB or SQL access, backed by live Redis — not a stale embedding snapshot. Memory makes the second conversation different from the first.",
      },
      {
        label: "Verify, don't assume",
        body: "Three documented behaviours did not hold on this build — access tags, the default threshold, and default search coverage. Test each claim in your own deployment.",
      },
    ],
    ++page
  );

  // 12. Closing / next steps
  contentSlideSingle(
    pres,
    "Next steps",
    "Code, spec and runbook: github.com/amitmknit/context-retriever-payment-failure-demo",
    [
      {
        header: "Open items from this build",
        bullets: [
          "Access-tag enforcement — follow up with the Context Retriever team before relying on it as a boundary",
          "Whether memory types can be registered per store beyond the four built-ins — the error message implies yes, but there is no documented path",
        ],
      },
      {
        header: "Natural extensions",
        bullets: [
          "Put a real LLM in the driver's seat — same tool surface, dynamic tool choice; keep the scripted flow alongside it for reliable live demos",
          "Move recall to the front of the flow, so memory is consulted before Context Retriever is queried at all",
          "Try the OAuth Identity Provider path (access_tag_claims) as an alternative governance mechanism",
          "Expand the model with a Merchant or Order entity, or repoint it at the customer's own schema",
        ],
      },
    ],
    ++page
  );

  const outPath = "/Users/amitmalik/Claude-Code/demo/context-retriever-payment-failure/Context-Retriever-Payment-Failure-Demo.pptx";
  await pres.writeFile({ fileName: outPath });
  console.log("Wrote:", outPath);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
