const db = require("../config/db");

// ---- Node builders ----

const buildCustomerNodes = () => {
  const rows = db.prepare(`
    SELECT bp.business_partner, bp.full_name, bp.partner_category, bp.is_blocked,
           a.city_name, a.country
    FROM business_partners bp
    LEFT JOIN business_partner_addresses a ON a.business_partner = bp.business_partner
  `).all();

  return rows.map((r) => ({
    id: `C:${r.business_partner}`,
    type: "customer",
    label: r.full_name || r.business_partner,
    data: {
      business_partner: r.business_partner,
      city: r.city_name,
      country: r.country,
      is_blocked: r.is_blocked === 1,
    },
  }));
};

const buildSalesOrderNodes = () => {
  const rows = db.prepare(`
    SELECT sales_order, sold_to_party, creation_date, total_net_amount,
           transaction_currency, overall_delivery_status, overall_billing_status
    FROM sales_order_headers
  `).all();

  return rows.map((r) => ({
    id: `SO:${r.sales_order}`,
    type: "sales_order",
    label: `SO ${r.sales_order}`,
    data: {
      sales_order: r.sales_order,
      customer: r.sold_to_party,
      creation_date: r.creation_date,
      total_amount: r.total_net_amount,
      currency: r.transaction_currency,
      delivery_status: r.overall_delivery_status,
      billing_status: r.overall_billing_status,
    },
  }));
};

const buildDeliveryNodes = () => {
  const rows = db.prepare(`
    SELECT delivery_document, creation_date, actual_goods_movement_date,
           overall_goods_movement_status, overall_picking_status, shipping_point
    FROM outbound_delivery_headers
  `).all();

  return rows.map((r) => ({
    id: `D:${r.delivery_document}`,
    type: "delivery",
    label: `DEL ${r.delivery_document}`,
    data: {
      delivery_document: r.delivery_document,
      creation_date: r.creation_date,
      goods_movement_date: r.actual_goods_movement_date,
      goods_movement_status: r.overall_goods_movement_status,
      picking_status: r.overall_picking_status,
      shipping_point: r.shipping_point,
    },
  }));
};

const buildBillingNodes = () => {
  const rows = db.prepare(`
    SELECT billing_document, billing_document_type, billing_document_date,
           total_net_amount, transaction_currency, is_cancelled, sold_to_party
    FROM billing_document_headers
  `).all();

  return rows.map((r) => ({
    id: `B:${r.billing_document}`,
    type: "billing_document",
    label: `BILL ${r.billing_document}`,
    data: {
      billing_document: r.billing_document,
      type: r.billing_document_type,
      date: r.billing_document_date,
      total_amount: r.total_net_amount,
      currency: r.transaction_currency,
      is_cancelled: r.is_cancelled === 1,
      customer: r.sold_to_party,
    },
  }));
};

const buildJournalNodes = () => {
  const rows = db.prepare(`
    SELECT DISTINCT accounting_document, fiscal_year, company_code,
                    reference_document, posting_date, customer,
                    SUM(amount_in_transaction_currency) as total_amount,
                    transaction_currency
    FROM journal_entry_items
    GROUP BY accounting_document, fiscal_year, company_code
  `).all();

  return rows.map((r) => ({
    id: `J:${r.accounting_document}`,
    type: "journal_entry",
    label: `JE ${r.accounting_document}`,
    data: {
      accounting_document: r.accounting_document,
      fiscal_year: r.fiscal_year,
      company_code: r.company_code,
      reference_billing: r.reference_document,
      posting_date: r.posting_date,
      customer: r.customer,
      total_amount: r.total_amount,
      currency: r.transaction_currency,
    },
  }));
};

const buildPaymentNodes = () => {
  const rows = db.prepare(`
    SELECT DISTINCT accounting_document, fiscal_year, company_code,
                    clearing_date, customer,
                    SUM(amount_in_transaction_currency) as total_amount,
                    transaction_currency
    FROM payments
    GROUP BY accounting_document, fiscal_year, company_code
  `).all();

  return rows.map((r) => ({
    id: `P:${r.accounting_document}`,
    type: "payment",
    label: `PAY ${r.accounting_document}`,
    data: {
      accounting_document: r.accounting_document,
      fiscal_year: r.fiscal_year,
      clearing_date: r.clearing_date,
      customer: r.customer,
      total_amount: r.total_amount,
      currency: r.transaction_currency,
    },
  }));
};

// ---- Edge builders ----

const buildCustomerToOrderEdges = () => {
  const rows = db.prepare(`
    SELECT sales_order, sold_to_party FROM sales_order_headers
  `).all();

  return rows.map((r) => ({
    id: `E:C:${r.sold_to_party}->SO:${r.sales_order}`,
    source: `C:${r.sold_to_party}`,
    target: `SO:${r.sales_order}`,
    relation: "places",
  }));
};

const buildOrderToDeliveryEdges = () => {
  const rows = db.prepare(`
    SELECT DISTINCT odi.reference_sd_document AS sales_order,
                    odi.delivery_document
    FROM outbound_delivery_items odi
    WHERE odi.reference_sd_document IS NOT NULL
  `).all();

  return rows.map((r) => ({
    id: `E:SO:${r.sales_order}->D:${r.delivery_document}`,
    source: `SO:${r.sales_order}`,
    target: `D:${r.delivery_document}`,
    relation: "fulfilled_by",
  }));
};

const buildDeliveryToBillingEdges = () => {
  const rows = db.prepare(`
    SELECT DISTINCT bdi.reference_sd_document AS delivery_document,
                    bdi.billing_document
    FROM billing_document_items bdi
    WHERE bdi.reference_sd_document IS NOT NULL
  `).all();

  return rows.map((r) => ({
    id: `E:D:${r.delivery_document}->B:${r.billing_document}`,
    source: `D:${r.delivery_document}`,
    target: `B:${r.billing_document}`,
    relation: "generates",
  }));
};

const buildBillingToJournalEdges = () => {
  const rows = db.prepare(`
    SELECT DISTINCT reference_document AS billing_document,
                    accounting_document
    FROM journal_entry_items
    WHERE reference_document IS NOT NULL
  `).all();

  return rows.map((r) => ({
    id: `E:B:${r.billing_document}->J:${r.accounting_document}`,
    source: `B:${r.billing_document}`,
    target: `J:${r.accounting_document}`,
    relation: "creates_journal",
  }));
};

const buildJournalToPaymentEdges = () => {
  const rows = db.prepare(`
    SELECT DISTINCT j.accounting_document AS journal_doc,
                    p.accounting_document AS payment_doc
    FROM journal_entry_items j
    JOIN payments p ON p.clearing_accounting_document = j.accounting_document
                    AND p.customer = j.customer
  `).all();

  return rows.map((r) => ({
    id: `E:J:${r.journal_doc}->P:${r.payment_doc}`,
    source: `J:${r.journal_doc}`,
    target: `P:${r.payment_doc}`,
    relation: "settled_by",
  }));
};

// ---- Main graph builder ----

const getFullGraph = () => {
  const nodes = [
    ...buildCustomerNodes(),
    ...buildSalesOrderNodes(),
    ...buildDeliveryNodes(),
    ...buildBillingNodes(),
    ...buildJournalNodes(),
    ...buildPaymentNodes(),
  ];

  // deduplicate nodes by id
  const nodeMap = new Map();
  for (const n of nodes) nodeMap.set(n.id, n);

  const edges = [
    ...buildCustomerToOrderEdges(),
    ...buildOrderToDeliveryEdges(),
    ...buildDeliveryToBillingEdges(),
    ...buildBillingToJournalEdges(),
    ...buildJournalToPaymentEdges(),
  ];

  // deduplicate edges by id
  const edgeMap = new Map();
  for (const e of edges) edgeMap.set(e.id, e);

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
};

// ---- Single node with neighbors ----

const getNodeWithNeighbors = (nodeId) => {
  const { nodes, edges } = getFullGraph();

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const targetNode = nodeMap.get(nodeId);

  if (!targetNode) return null;

  const neighborEdges = edges.filter(
    (e) => e.source === nodeId || e.target === nodeId
  );

  const neighborIds = new Set();
  for (const e of neighborEdges) {
    neighborIds.add(e.source);
    neighborIds.add(e.target);
  }

  const neighborNodes = Array.from(neighborIds)
    .map((id) => nodeMap.get(id))
    .filter(Boolean);

  return {
    node: targetNode,
    neighbors: neighborNodes,
    edges: neighborEdges,
  };
};

module.exports = { getFullGraph, getNodeWithNeighbors };
