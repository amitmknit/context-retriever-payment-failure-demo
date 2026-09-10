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
  s.addText("End-to-end: resolving a payment failure", {
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
      s.addText(sec.body, {
        x: 0.42, y, w: 9.2, h: 0.34,
        fontSize: 11.5, color: C.MIDNIGHT, fontFace: F.BODY, margin: 0,
      });
      y += 0.36;
    }
    if (sec.bullets) {
      const h = sec.bullets.length * 0.30 + 0.05;
      bulletText(s, sec.bullets, {
        x: 0.55, y, w: 9.0, h,
        fontSize: 11.5, color: C.MIDNIGHT, fontFace: F.BODY, margin: 0,
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
          "Every step below is a generated MCP tool call the agent chose and chained itself. There is no hand-written orchestration code for this logic — the tool surface came entirely from the entity model.",
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
    "The agent rules out a systemic incident and a duplicate before acting",
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

  // 11. Recap
  cardSlideDark(
    pres,
    "Why this matters",
    "What one entity model bought us — and what still needs verifying",
    [
      {
        label: "Fewer hand-built tools",
        body: "One model definition replaced what would've been 5+ hand-built tools per agent — across 5 entities and 7 relationships.",
      },
      {
        label: "Governed surface, live data",
        body: "Agents get a governed MCP surface instead of raw DB/SQL access, backed by live Redis data — not stale embeddings.",
      },
      {
        label: "Verify, don't assume",
        body: "Access-control claims should be verified per-deployment, not assumed from docs — exactly as this run demonstrated.",
      },
    ],
    ++page
  );

  // 12. Closing / next steps
  contentSlideSingle(
    pres,
    "Next steps",
    "Demo code and spec: /Users/amitmalik/Claude-Code/demo/context-retriever-payment-failure",
    [
      {
        bullets: [
          "Follow up with the Context Retriever team on access-tag enforcement in this preview build",
          "Try the OAuth Identity Provider path (access_tag_claims) as an alternative governance mechanism",
          "Expand the model with a Merchant/Order entity for a fuller payments domain",
          "Wire this MCP endpoint into a real agent — e.g. Claude Code via `claude mcp add`",
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
