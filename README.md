# Order-to-Cash Graph Intelligence System

A context graph system with an LLM-powered conversational query interface built for the SAP Order-to-Cash (O2C) dataset.

---

## Live Demo

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

## Database Choice

**SQLite via `better-sqlite3`**

- Synchronous API reduces complexity; no async DB layer needed
- WAL mode enabled for safe concurrent reads
- All raw data is seeded from JSONL source files via `npm run seed`
- Schema enforces FK constraints (`PRAGMA foreign_keys = ON`)

**Tradeoff:** SQLite is not suitable for multi-user production workloads, but is ideal for this local single-user analytical system.

---

## LLM Integration and Prompting Strategy

### Three-stage pipeline per chat message

**Stage 1 — Topic Guardrail (fast classifier)**
```
Model: llama-3.1-8b-instant
Temperature: 0
Max tokens: 5
Output: RELEVANT | IRRELEVANT
Behavior: Fail-closed (errors → reject)
```

**Stage 2 — Text-to-SQL (parallel with graph context)**
```
Model: llama-3.1-8b-instant
Temperature: 0
Max tokens: 500
Output: Raw SELECT statement or NO_SQL
Rules: SELECT only, LIMIT 20, standard SQLite syntax
```
Results are executed against SQLite and injected into the main system context as `LIVE DATABASE QUERY RESULTS`.

**Stage 3 — Answer synthesis**
```
Model: llama-3.1-8b-instant
Temperature: 0.3
Max tokens: 1024
Context: system intro + graph summary + node context + SQL results + conversation history
```

### Context injection

Each query receives:
1. **Graph summary** — node/edge counts by type, full relation map
2. **Node context** — if the message contains 5+ digit IDs, matching nodes and their neighbors are fetched and injected
3. **SQL results** — live query results formatted as JSON (truncated at 4000 chars if needed)

---

## Guardrails

### Off-topic rejection

Every message passes through a strict one-shot classifier before the main LLM is called. The classifier is instructed to output only `RELEVANT` or `IRRELEVANT`.

**Fail-closed:** If the classifier call errors (network, rate-limit), the message is rejected, not allowed through.

**Rejection response:**
> "This system is designed to answer questions related to the provided dataset only. I can help you explore the Order to Cash (O2C) process — customers, sales orders, deliveries, billing documents, journal entries, and payments."

### Input validation

- `message` field: required, must be non-empty string
- `history` field: must be array; each item must have `role` (`user`|`assistant`) and string `content`; invalid items are silently filtered

### SQL injection prevention

- Only `SELECT` statements are executed
- Any generated SQL not starting with `SELECT` is discarded before execution
- `better-sqlite3` uses parameterized prepared statements throughout the seed/migrate layer

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

## Known Limitations

- Graph layout uses deterministic random scatter — not force-directed, so some nodes may overlap at high density
- Chat history is not persisted across page refreshes
- SQL generation quality depends on the LLM; complex multi-join queries may occasionally be imprecise
- Classifier fail-closed means a Groq outage blocks all chat queries
