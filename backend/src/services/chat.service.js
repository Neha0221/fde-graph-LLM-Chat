// ── Provider imports ────────────────────────────────────────

// [GROQ - ACTIVE]
const Groq = require("groq-sdk");
const { GROQ_API_KEY } = require("../config/env");

// [GEMINI - commented out, kept for future reference]
// const { GoogleGenerativeAI } = require("@google/generative-ai");
// const { GEMINI_API_KEY } = require("../config/env");
// const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
// const geminiHistory = [
//   { role: "user", parts: [{ text: systemContext }] },
//   { role: "model", parts: [{ text: "Understood. I am Dodge AI..." }] },
//   ...history.map((h) => ({
//     role: h.role === "assistant" ? "model" : "user",
//     parts: [{ text: h.content }],
//   })),
// ];
// const chatSession = model.startChat({ history: geminiHistory });
// const result = await chatSession.sendMessage(message);
// return result.response.text();

const db = require("../config/db");
const { getFullGraph } = require("./graph.service");

// ── Guardrail: topic relevance classifier ───────────────────

const GUARD_SYSTEM_PROMPT = `You are a strict topic classifier for a SAP Order-to-Cash (O2C) graph analysis system.

Your ONLY job is to decide if the user's message is relevant to this system.

RELEVANT topics include:
- SAP Order to Cash (O2C) business process
- Customers, Sales Orders, Deliveries, Billing Documents, Journal Entries, Payments
- Graph data analysis, document tracing, business process flows
- Questions about specific document IDs, relationships between entities
- Analytics or reporting on the O2C dataset

IRRELEVANT topics include everything else, such as:
- General knowledge questions (science, history, geography, etc.)
- Coding help, math problems, language translation
- Creative writing, jokes, stories, poems
- Current events, sports, entertainment
- Any topic not directly related to the O2C dataset

Respond with ONLY one word — either RELEVANT or IRRELEVANT. No explanation, no punctuation.`;

const OFF_TOPIC_REPLY =
  "This system is designed to answer questions related to the provided dataset only. I can help you explore the Order to Cash (O2C) process — customers, sales orders, deliveries, billing documents, journal entries, and payments.";

const isTopicRelevant = async (groq, message) => {
  try {
    const result = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: GUARD_SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      temperature: 0,
      max_tokens: 5,
    });
    const verdict = result.choices[0].message.content.trim().toUpperCase();
    // IRRELEVANT contains the substring RELEVANT, so check for IRRELEVANT first
    return !verdict.includes("IRRELEVANT");
  } catch {
    // Fail-open: if classification errors, allow the message through
    return true;
  }
};

// ── Text-to-SQL pipeline ─────────────────────────────────────

const DB_SCHEMA = `
Tables in this SQLite O2C database:

business_partners: business_partner(PK), full_name, partner_category, is_blocked(0/1)
business_partner_addresses: business_partner(FK), city_name, country, postal_code, region
products: product(PK), product_type, gross_weight, net_weight, base_unit, product_group
product_descriptions: product(FK), language, product_description
plants: plant(PK), plant_name
sales_order_headers: sales_order(PK), sold_to_party(FK→business_partners), creation_date, total_net_amount, transaction_currency, overall_delivery_status, overall_billing_status, header_billing_block, delivery_block_reason
sales_order_items: sales_order(FK), sales_order_item, material(FK→products), requested_quantity, net_amount, transaction_currency, production_plant(FK→plants)
outbound_delivery_headers: delivery_document(PK), creation_date, actual_goods_movement_date, overall_goods_movement_status, overall_picking_status, shipping_point
outbound_delivery_items: delivery_document(FK), delivery_document_item, reference_sd_document(FK→sales_order_headers.sales_order), plant(FK→plants)
billing_document_headers: billing_document(PK), billing_document_type, billing_document_date, total_net_amount, transaction_currency, is_cancelled(0/1), sold_to_party(FK→business_partners), company_code
billing_document_items: billing_document(FK), billing_document_item, material(FK→products), billing_quantity, net_amount, reference_sd_document(FK→outbound_delivery_headers.delivery_document)
journal_entry_items: accounting_document, company_code, fiscal_year, reference_document(FK→billing_document_headers.billing_document), customer(FK→business_partners), amount_in_transaction_currency, transaction_currency, posting_date, clearing_date, clearing_accounting_document
payments: accounting_document, company_code, fiscal_year, clearing_accounting_document(FK→journal_entry_items.accounting_document), customer(FK→business_partners), amount_in_transaction_currency, transaction_currency, clearing_date
`;

const SQL_GENERATION_PROMPT = `You are an expert SQLite query generator for an SAP Order-to-Cash (O2C) database.

Your task: generate a single valid SQLite SELECT query to answer the user's question about the O2C data.

STRICT RULES:
- Output ONLY the raw SQL statement. No markdown, no backticks, no explanation, no comments.
- Use ONLY SELECT statements. Never write INSERT, UPDATE, DELETE, DROP, CREATE, or any DDL/DML.
- Use only standard SQLite syntax (no window functions like RANK unless truly necessary).
- Always add LIMIT 20 at the end unless the user explicitly asks for all rows.
- Use aliases to make column names descriptive.
- If the question is conceptual or cannot be answered by a SQL query, respond with exactly the word: NO_SQL

DATABASE SCHEMA:
${DB_SCHEMA}`;

const executeSQL = (sqlQuery) => {
  const normalized = sqlQuery.trim().toUpperCase();
  if (!normalized.startsWith("SELECT")) return null;
  try {
    const rows = db.prepare(sqlQuery).all();
    return rows.slice(0, 20);
  } catch (err) {
    console.error("[SQL Error]", err.message);
    return null;
  }
};

const tryGenerateAndRunSQL = async (groq, message) => {
  try {
    const result = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SQL_GENERATION_PROMPT },
        { role: "user", content: message },
      ],
      temperature: 0,
      max_tokens: 500,
    });

    const sqlRaw = result.choices[0].message.content.trim();

    if (!sqlRaw || sqlRaw.toUpperCase() === "NO_SQL" || !sqlRaw.toUpperCase().startsWith("SELECT")) {
      return null;
    }

    const rows = executeSQL(sqlRaw);
    if (!rows || rows.length === 0) return null;

    // Truncate serialized results to avoid bloating the context window
    const serialized = JSON.stringify(rows, null, 2);
    const truncated = serialized.length > 4000
      ? serialized.slice(0, 4000) + "\n  ... (results truncated)"
      : serialized;

    return { sql: sqlRaw, results: truncated, rowCount: rows.length };
  } catch {
    return null;
  }
};

// ── Graph context builders ──────────────────────────────────

const buildGraphSummary = () => {
  const { nodes, edges } = getFullGraph();

  const typeCounts = {};
  nodes.forEach((n) => {
    typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  });

  const relations = [...new Set(edges.map((e) => e.relation))];

  return `
=== ORDER TO CASH GRAPH SUMMARY ===
Total Nodes : ${nodes.length}
${Object.entries(typeCounts)
  .map(([type, count]) => `  • ${type.replace(/_/g, " ")}: ${count}`)
  .join("\n")}

Total Edges : ${edges.length}
Relation types: ${relations.join(", ")}

Process flow:
  Customer --[places]--> Sales Order --[fulfilled_by]--> Delivery
  Delivery --[generates]--> Billing Document
  Billing Document --[creates_journal]--> Journal Entry
  Journal Entry --[settled_by]--> Payment
====================================`;
};

// Detect numeric IDs in the user message and fetch their node data + neighbors
const buildNodeContext = (message) => {
  const { nodes, edges } = getFullGraph();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Look for 5+ digit numbers that might be document IDs
  const potentialIds = message.match(/\b\d{5,}\b/g) || [];

  const matched = [];

  for (const rawId of potentialIds) {
    const found = nodes.filter((n) => {
      if (n.id.endsWith(rawId)) return true;
      return Object.values(n.data || {}).some((v) => String(v) === rawId);
    });

    for (const node of found) {
      const connEdges = edges.filter(
        (e) => e.source === node.id || e.target === node.id
      );
      const connections = connEdges.map((e) => {
        const neighborId = e.source === node.id ? e.target : e.source;
        const neighbor = nodeMap.get(neighborId);
        return `    ${e.relation} → ${neighbor?.label || neighborId} (${neighbor?.type || ""})`;
      });

      matched.push(
        `\nNode found: ${node.label} [${node.type}]\n` +
          `Data: ${JSON.stringify(node.data, null, 2)}\n` +
          `Connections (${connections.length}):\n${connections.join("\n") || "    none"}`
      );
    }
  }

  return matched.length > 0
    ? `\n=== RELEVANT NODES ===\n${matched.join("\n---\n")}\n=====================`
    : "";
};

const SYSTEM_INTRO = `You are Dodge AI, an intelligent graph agent specializing in SAP Order to Cash (O2C) process analysis.

You help users explore and understand the O2C business graph which contains:
- Customers, Sales Orders, Deliveries, Billing Documents, Journal Entries, and Payments
- Their relationships through the full O2C cycle

STRICT RULES — follow these without exception:
- ONLY answer questions about the O2C graph data, SAP business process, and entities in this dataset
- If a question is unrelated to the O2C domain or the graph data, respond ONLY with: "This system is designed to answer questions related to the provided dataset only."
- When "LIVE DATABASE QUERY RESULTS" are provided below, base your answer primarily on those results — they are real data from the database
- When specific IDs are mentioned, use the node data provided in context
- Be concise, factual, and precise — every claim must be backed by data in the context
- If data is not available in context, say so clearly — do NOT invent or guess values
- Format document numbers and IDs clearly in your responses`;

// ── Main chat function (Groq) ───────────────────────────────

const chat = async (message, history = []) => {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not set. Please add your key to backend/.env"
    );
  }

  const groq = new Groq({ apiKey: GROQ_API_KEY });

  // ── Guardrail: reject off-topic queries before calling main LLM ──
  const relevant = await isTopicRelevant(groq, message);
  if (!relevant) {
    return OFF_TOPIC_REPLY;
  }

  // ── Dynamic SQL: translate query → SQL → execute → inject results ──
  // Graph summary and node context are synchronous; SQL generation is async
  const graphSummary = buildGraphSummary();
  const nodeContext = buildNodeContext(message);
  const sqlResult = await tryGenerateAndRunSQL(groq, message);

  const sqlContext = sqlResult
    ? `\n\n=== LIVE DATABASE QUERY RESULTS ===\nSQL: ${sqlResult.sql}\nRows: ${sqlResult.rowCount}\n${sqlResult.results}\n====================================`
    : "";

  const systemContext = `${SYSTEM_INTRO}\n\n${graphSummary}${nodeContext}${sqlContext}`;

  // Build messages array: system prompt + history + current message
  const messages = [
    { role: "system", content: systemContext },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages,
    temperature: 0.3,
    max_tokens: 1024,
  });

  return completion.choices[0].message.content;
};

module.exports = { chat };
