# Order-to-Cash Graph Intelligence System

A context graph system with an LLM-powered conversational query interface built for the SAP Order-to-Cash (O2C) dataset.

---

## [Live Demo](https://fde-graph-llm-chat-frontend.onrender.com/)

> Run locally using the setup instructions below. No cloud deployment configured.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│  ┌─────────────────────┐  ┌────────────────────────┐ │
│  │   Graph Canvas       │  │     Chat Panel         │ │
│  │   (React Flow)       │  │   (Conversational UI)  │ │
│  │  - Node popup cards  │  │  - Message history     │ │
│  │  - Edge details      │  │  - Typing indicator    │ │
│  │  - Focus/expand view │  │  - Status indicator    │ │
│  └─────────────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                        │ HTTP/REST
┌─────────────────────────────────────────────────────┐
│                   Backend (Express)                  │
│  GET /api/graph          → full graph data           │
│  GET /api/graph/node/:id → node + neighbors          │
│  POST /api/chat          → LLM chat with guardrails  │
└─────────────────────────────────────────────────────┘
                        │ better-sqlite3
┌─────────────────────────────────────────────────────┐
│                  SQLite Database                     │
│  business_partners, sales_order_headers/items,       │
│  outbound_delivery_headers/items, billing_document_  │
│  headers/items, journal_entry_items, payments,       │
│  products, product_descriptions, plants              │
└─────────────────────────────────────────────────────┘
                        │ Groq API
┌─────────────────────────────────────────────────────┐
│           LLM (llama-3.1-8b-instant via Groq)        │
│  - Topic classifier (guardrail)                      │
│  - SQL generator (text-to-SQL)                       │
│  - Answer synthesizer (grounded on DB results)       │
└─────────────────────────────────────────────────────┘
```

---

## Graph Modeling Decisions

### Node Types

| Type | ID Prefix | Source Table | Description |
|------|-----------|-------------|-------------|
| Customer | `C:` | business_partners | Sold-to parties |
| Sales Order | `SO:` | sales_order_headers | Purchase orders placed by customers |
| Delivery | `D:` | outbound_delivery_headers | Outbound shipments |
| Billing Document | `B:` | billing_document_headers | Invoices generated from deliveries |
| Journal Entry | `J:` | journal_entry_items (grouped) | Accounting documents from billing |
| Payment | `P:` | payments (grouped) | Clearing payments against journal entries |
| Product | `PR:` | products (filtered) | Materials referenced in billing items |
| Plant | `PL:` | plants (filtered) | Shipping locations referenced in deliveries |

Products and Plants are only included if they are **actually referenced** in the dataset (billed or delivered), keeping the graph focused and relevant.

### Edge Types (Relations)

| Relation | Source → Target | Meaning |
|----------|----------------|---------|
| `places` | Customer → Sales Order | Customer places an order |
| `fulfilled_by` | Sales Order → Delivery | Order is shipped via delivery |
| `generates` | Delivery → Billing Doc | Delivery triggers invoice |
| `creates_journal` | Billing Doc → Journal Entry | Invoice creates accounting entry |
| `settled_by` | Journal Entry → Payment | Accounting entry is cleared by payment |
| `billed_for` | Billing Doc → Product | Invoice line item references product |
| `ships_from` | Delivery → Plant | Delivery originates from a plant |

### Design Tradeoffs

- **Item-level entities (sales order items, billing items) are edges, not nodes** — modeled as attributes of parent documents to avoid graph explosion while retaining traceability.
- **Journal entries are grouped** by `accounting_document + fiscal_year + company_code` — one node per accounting document, not per line item.
- **Products/Plants are filtered** to only those present in active transactions, avoiding orphan nodes that add no analytical value.

---

## Database and Storage Choice

### Architecture: Hybrid Relational + Derived In-Memory Graph

This system uses a **two-layer storage design**, which is the central architectural decision of the backend:

| Layer | Technology | Role |
|-------|-----------|------|
| **Persisted store** | SQLite (`better-sqlite3`) | Canonical source of truth for all O2C entities ingested from JSONL |
| **Graph projection** | In-memory JS objects | Typed nodes and edges derived at request time from SQL joins |

The source dataset is inherently **relational and transactional** — sales orders referencing customers, delivery items referencing sales orders, billing items referencing deliveries. Storing it in a relational database is the natural fit: FK constraints can be enforced, cross-entity aggregations can run as standard SQL, and the data remains queryable both structurally (graph traversal) and analytically (aggregations, filters).

The graph is **not stored separately**. Every call to `GET /api/graph` triggers `graph.service.js` to execute ~14 SQL queries, construct typed node and edge objects, deduplicate by ID, and return a JSON graph. This means the graph is always a live, consistent view of the database — no sync lag, no separate graph store to maintain.

### Why SQLite specifically

- **`better-sqlite3` uses a synchronous API** — no async DB layer, no connection pool, no promise chains. The entire graph build is a straightforward sequence of `.prepare().all()` calls.
- **WAL (Write-Ahead Log) mode** is enabled on connection (`PRAGMA journal_mode = WAL`), allowing safe concurrent reads without blocking the server during the occasional seed/migrate write.
- **Foreign key constraints** (`PRAGMA foreign_keys = ON`) are enforced at the DB level, catching referential integrity issues at seed time rather than at query time.
- **Schema-first design** — `schema.sql` defines all 14 tables with composite PKs and FKs before any data is loaded. The migrate → seed order ensures parent rows always exist before child rows.
- **Zero-ops deployment** — the database is a single `.db` file (`data/graph.db`), tracked in `.gitignore`, reproducible at any time via `npm run migrate && npm run seed`.

### Tradeoffs

| Concern | Decision |
|---------|---------|
| **Graph rebuilt per request** | Acceptable for a single-user local tool; the full graph build takes milliseconds on this dataset size. A production system would cache the graph or maintain a materialized view. |
| **No graph-native query language** | Cypher/Gremlin traversals would be more expressive for multi-hop path queries. Here, those are emulated via JOIN chains in SQL + in-memory neighbor lookup in JS. |
| **No write concurrency** | SQLite handles one writer at a time. Not a constraint for this read-heavy, single-user workload. |
| **Alternatives considered** | Neo4j or Amazon Neptune would provide native graph traversal and indexing at scale, but add significant operational overhead (separate server, auth, Bolt protocol) that is unnecessary for this scope. PostgreSQL with `ltree` or `recursive CTEs` was also considered but offers no meaningful advantage over SQLite here. |

---

## LLM Integration and Prompting Strategy

### Design Philosophy

The LLM is used **as an orchestration layer**, not as a knowledge source. Every answer it gives must be grounded in data retrieved from SQLite or the graph — the model is explicitly forbidden from inventing values. The prompting architecture enforces this through structured context injection and strict output formatting rules.

### Three-Stage Pipeline

Each chat message flows through three sequential LLM calls:

```
User message
     │
     ▼
┌─────────────────────────────────────────┐
│  Stage 1: Topic Guardrail               │
│  Model  : llama-3.1-8b-instant          │
│  Temp   : 0  │  Max tokens: 5           │
│  Output : RELEVANT or IRRELEVANT        │
│  Behavior: fail-closed on any error     │
└────────────────────┬────────────────────┘
                     │ RELEVANT only
                     ▼
┌─────────────────────────────────────────┐
│  Stage 2: Text-to-SQL Generation        │
│  Model  : llama-3.1-8b-instant          │
│  Temp   : 0  │  Max tokens: 500         │
│  Output : Raw SELECT statement          │
│           or the literal word NO_SQL    │
│  Rules  : SELECT only, LIMIT 20,        │
│           standard SQLite syntax        │
│  → SQL is executed against SQLite       │
│  → Results injected as context          │
└────────────────────┬────────────────────┘
                     │ SQL results + graph context
                     ▼
┌─────────────────────────────────────────┐
│  Stage 3: Answer Synthesis              │
│  Model  : llama-3.1-8b-instant          │
│  Temp   : 0.3  │  Max tokens: 1024      │
│  Context: system intro                  │
│           + graph summary               │
│           + node/neighbor context       │
│           + LIVE DATABASE QUERY RESULTS │
│           + conversation history        │
└─────────────────────────────────────────┘
```

### Context Injection Strategy

Every Stage 3 call receives a composed system prompt built from four sources:

1. **System intro + role definition** — establishes the model as a domain-restricted O2C analyst and lists strict behavioral rules (no hallucination, no off-topic responses, always cite data).

2. **Graph summary** — dynamically generated from the live database: total node/edge counts broken down by type, and the full relation map. This gives the model structural awareness of the dataset without passing all node data.

3. **Node context (ID-triggered)** — if the user message contains any 5+ digit number, the backend pattern-matches it against node IDs and field values, then injects the matching node's full metadata plus all its connected neighbors and edge relations. This enables precise document trace queries (e.g. "trace billing document 9012345678").

4. **Live SQL results** — the output of Stage 2 is executed against SQLite and injected verbatim as `LIVE DATABASE QUERY RESULTS`. The Stage 3 prompt explicitly instructs the model to treat these as the primary source of truth. Results are capped at 4000 characters to avoid context window overflow.

### Prompt Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Temperature 0 for guardrail and SQL** | Deterministic outputs — the classifier must always output exactly `RELEVANT`/`IRRELEVANT`; the SQL generator must produce syntactically valid SQL, not creative variations. |
| **Temperature 0.3 for answer synthesis** | Slightly relaxed to allow natural, readable prose while still staying grounded in provided data. |
| **Explicit `NO_SQL` escape hatch in SQL stage** | Conceptual questions (e.g. "what does an O2C flow look like?") cannot be answered by a SQL query. The model is instructed to return `NO_SQL` in those cases; the pipeline skips SQL execution and proceeds with graph context only. |
| **Full schema injected into SQL prompt** | The model receives all 14 table definitions with column names, types, and FK relationships. This dramatically reduces hallucinated column names and invalid JOIN paths. |
| **IRRELEVANT check catches the RELEVANT substring** | `verdict.includes("IRRELEVANT")` is checked before the RELEVANT branch — necessary because `"IRRELEVANT"` contains the substring `"RELEVANT"`. A naive string-equality check would misclassify off-topic responses. |
| **Conversation history threaded through** | The validated history array is appended before the current user message in Stage 3, enabling multi-turn follow-up queries within a session. |

### LLM Provider

`llama-3.1-8b-instant` via [Groq](https://console.groq.com) is used for all three stages. Groq's inference API provides sub-second latency on this model, which keeps the three-stage pipeline responsive. The codebase also retains commented-out `@google/generative-ai` code for Gemini (`gemini-2.0-flash-lite`) as an alternative provider that can be swapped in by uncommenting the relevant block in `chat.service.js`.

---

## Guardrails

### 1. Off-Topic Domain Restriction

Every message passes through a dedicated one-shot classifier (Stage 1) before any expensive LLM call or database query is made. The classifier receives a tightly scoped system prompt listing exactly what is `RELEVANT` (O2C entities, SAP process, graph analysis) and what is `IRRELEVANT` (general knowledge, coding help, creative writing, current events).

**Fail-closed behavior:** if the Groq API call itself throws an error (network timeout, rate limit, service outage), the `catch` block returns `false` — the message is treated as irrelevant and rejected. This prevents off-topic queries from slipping through during partial outages.

**Fixed rejection response:**
> "This system is designed to answer questions related to the provided dataset only. I can help you explore the Order to Cash (O2C) process — customers, sales orders, deliveries, billing documents, journal entries, and payments."

### 2. Input Validation (Server-Side)

Validated in `chat.controller.js` before the service layer is ever called:

- `message`: required field, must be a non-empty string (returns HTTP 400 otherwise)
- `history`: must be an array; each entry must have `role` of `"user"` or `"assistant"` and a string `content` — any entry failing this shape is silently filtered out before being passed to the LLM

### 3. SQL Safety

Generated SQL is sandboxed at two levels:

- **Statement-level check:** any SQL that does not begin with `SELECT` (case-insensitive) is discarded before execution — `INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, and all DDL/DML variants are blocked.
- **Prepared statements:** `better-sqlite3`'s `.prepare()` API is used throughout `seed.js` and the chat service. Parameters are bound positionally (`?`), never via string interpolation, preventing SQL injection through user-controlled input.

### 4. Answer Grounding

The Stage 3 system prompt contains an explicit instruction: *"When LIVE DATABASE QUERY RESULTS are provided below, base your answer primarily on those results — they are real data from the database"* and *"do NOT invent or guess values."* If no SQL results are available and no node context is matched, the model is instructed to say so clearly rather than hallucinate an answer.

---

## Example Queries Supported

**a. Product analytics**
> "Which products are associated with the highest number of billing documents?"

SQL path: `billing_document_items GROUP BY material ORDER BY COUNT DESC`

**b. Full flow trace**
> "Trace the full flow of billing document 9012345678"

Node context path: injects the billing node + all connected neighbors (delivery, journal entry, payment, products)

**c. Broken/incomplete flows**
> "Find sales orders that were delivered but never billed"

SQL path: LEFT JOIN `outbound_delivery_items` → `billing_document_items` WHERE billing side IS NULL

---

## Setup and Run

### Prerequisites
- Node.js 18+
- A free [Groq API key](https://console.groq.com)

### Backend

```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env and set GROQ_API_KEY=your_key_here

# Initialize database
npm run migrate
npm run seed

# Start server (port 5000)
npm run dev
```

### Frontend

```bash
cd frontend
npm install

# Start dev server (port 5173)
npm run dev
```

Open `http://localhost:5173` in your browser.

### Environment variables (backend/.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | Yes | — | Groq API key for LLM calls |
| `PORT` | No | 5000 | Backend server port |
| `DB_PATH` | No | `./data/graph.db` | Path to SQLite database file |

---

## Project Structure

```
fde-graph-assignment/
├── backend/
│   ├── data/
│   │   ├── graph.db               # SQLite database (generated)
│   │   └── raw/sap-o2c-data/      # Source JSONL files
│   └── src/
│       ├── config/
│       │   ├── db.js              # SQLite connection (respects DB_PATH env)
│       │   └── env.js             # Environment config
│       ├── controllers/           # Express route handlers
│       ├── middleware/            # Error handling
│       ├── routes/                # API route definitions
│       ├── services/
│       │   ├── graph.service.js   # Graph construction from SQLite
│       │   └── chat.service.js    # LLM pipeline (guardrail + SQL + answer)
│       └── db/
│           ├── migrate.js         # Schema creation
│           ├── seed.js            # Data ingestion from JSONL
│           └── schema.sql         # Table definitions
└── frontend/
    └── src/
        ├── api/graphApi.js        # API client
        ├── components/
        │   ├── GraphCanvas.jsx    # React Flow wrapper
        │   ├── GraphNode.jsx      # Custom node renderer
        │   ├── NodePopup.jsx      # Floating node detail card
        │   ├── NodeDetail.jsx     # Edge detail panel
        │   └── ChatPanel.jsx      # Chat UI
        ├── hooks/useGraphData.js  # Graph data fetching
        └── utils/transformGraph.js # Backend → React Flow transformation
```

---
## [Demo Video](https://drive.google.com/file/d/1FNc1cv0qTPVK83TTTtr9xbfYbCSd8XD_/view?usp=sharing)
