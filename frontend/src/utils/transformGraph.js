// O2C flow order — left to right on canvas (supporting entities below)
const TYPE_ORDER = [
  'customer',
  'sales_order',
  'delivery',
  'billing_document',
  'journal_entry',
  'payment',
  'product',
  'plant',
];

// Each type occupies a rectangular region on the canvas
// Core O2C flow: left→right on top row
// Supporting entities: second row below
const TYPE_REGIONS = {
  customer:         { x1: 50,   y1: 100,  x2: 280,  y2: 900 },
  sales_order:      { x1: 380,  y1: 50,   x2: 950,  y2: 950 },
  delivery:         { x1: 1050, y1: 100,  x2: 1580, y2: 900 },
  billing_document: { x1: 1680, y1: 50,   x2: 2500, y2: 950 },
  journal_entry:    { x1: 2600, y1: 50,   x2: 3050, y2: 480 },
  payment:          { x1: 2600, y1: 530,  x2: 3050, y2: 950 },
  product:          { x1: 1680, y1: 1050, x2: 2500, y2: 1600 },
  plant:            { x1: 1050, y1: 1050, x2: 1580, y2: 1600 },
};

export const NODE_COLORS = {
  customer:         '#4F46E5',
  sales_order:      '#0EA5E9',
  delivery:         '#10B981',
  billing_document: '#F59E0B',
  journal_entry:    '#EF4444',
  payment:          '#8B5CF6',
  product:          '#EC4899',
  plant:            '#14B8A6',
};

export const NODE_TYPE_LABELS = {
  customer:         'Customer',
  sales_order:      'Sales Order',
  delivery:         'Delivery',
  billing_document: 'Billing Doc',
  journal_entry:    'Journal Entry',
  payment:          'Payment',
  product:          'Product',
  plant:            'Plant',
};

/**
 * Deterministic pseudo-random in [0, 1) based on integer seed.
 * Same seed always returns the same value — consistent layout across refreshes.
 */
const seededRand = (seed) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

/**
 * Scatter N nodes randomly (but deterministically) within a rectangular region.
 */
const scatterInRegion = (nodes, region) => {
  const { x1, y1, x2, y2 } = region;
  const w = x2 - x1;
  const h = y2 - y1;
  const positions = {};
  nodes.forEach((node, i) => {
    positions[node.id] = {
      x: x1 + seededRand(i * 2)     * w,
      y: y1 + seededRand(i * 2 + 1) * h,
    };
  });
  return positions;
};

/**
 * Converts backend graph { nodes, edges } → ReactFlow format.
 * Nodes are scattered organically within type regions arranged left→right.
 */
export const transformToReactFlow = (backendNodes, backendEdges) => {
  // Group by type
  const grouped = {};
  TYPE_ORDER.forEach((t) => (grouped[t] = []));
  backendNodes.forEach((node) => {
    if (grouped[node.type]) grouped[node.type].push(node);
  });

  // Build position map using scatter layout per type region
  const positionMap = {};
  TYPE_ORDER.forEach((type) => {
    const region = TYPE_REGIONS[type] || { x1: 0, y1: 0, x2: 400, y2: 400 };
    Object.assign(positionMap, scatterInRegion(grouped[type], region));
  });

  // ReactFlow nodes
  const rfNodes = backendNodes.map((node) => ({
    id: node.id,
    type: 'graphNode',
    position: positionMap[node.id] || { x: 0, y: 0 },
    data: {
      label: node.label,
      nodeType: node.type,
      color: NODE_COLORS[node.type] || '#94A3B8',
      ...node.data,
    },
  }));

  // ReactFlow edges — no labels (too cluttered at full-graph scale)
  const rfEdges = backendEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: { relation: edge.relation },
    style: { stroke: '#93C5FD', strokeWidth: 0.8, opacity: 0.45 },
  }));

  return { nodes: rfNodes, edges: rfEdges };
};
