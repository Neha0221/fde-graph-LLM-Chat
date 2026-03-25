import { useMemo } from 'react';
import { NODE_COLORS, NODE_TYPE_LABELS } from '../utils/transformGraph';

const SKIP_KEYS = new Set(['label', 'nodeType', 'color', 'id']);

const RELATION_LABELS = {
  places: 'Places',
  fulfilled_by: 'Fulfilled By',
  generates: 'Generates',
  creates_journal: 'Creates Journal',
  settled_by: 'Settled By',
  billed_for: 'Billed For',
  ships_from: 'Ships From',
};

const NodeDetail = ({
  node,
  edge,
  allNodes = [],
  allEdges = [],
  onClose,
  onExpandNode,
  onSelectNode,
  focusMode,
}) => {
  const connections = useMemo(() => {
    if (!node?.id) return [];
    return allEdges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => {
        const neighborId = e.source === node.id ? e.target : e.source;
        const neighborNode = allNodes.find((n) => n.id === neighborId);
        return {
          edgeId: e.id,
          relation: e.data?.relation || '',
          direction: e.source === node.id ? 'outgoing' : 'incoming',
          neighborId,
          neighborLabel: neighborNode?.data?.label || neighborId,
          neighborType: neighborNode?.data?.nodeType || '',
          neighborColor: neighborNode?.data?.color || '#94A3B8',
          neighborData: neighborNode ? { id: neighborNode.id, ...neighborNode.data } : null,
        };
      });
  }, [node, allNodes, allEdges]);

  if (!node && !edge) {
    return (
      <div className="node-detail-empty">
        <div className="empty-icon">◎</div>
        <p>Click any node to inspect its details</p>
        <p className="empty-hint">Double-click a node to expand its connections</p>
      </div>
    );
  }

  // ── Edge selected view ────────────────────────────────
  if (edge && !node) {
    const sourceNode = allNodes.find((n) => n.id === edge.source);
    const targetNode = allNodes.find((n) => n.id === edge.target);
    const relation = edge.data?.relation || edge.label || '';

    return (
      <div className="node-detail">
        <div className="node-detail-header">
          <div className="edge-badge">
            <span className="edge-badge-icon">↗</span>
            <span>Relationship</span>
          </div>
          <button className="close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        <h3 className="node-title">
          {RELATION_LABELS[relation] || relation || 'Connection'}
        </h3>

        <div className="edge-endpoints">
          <div className="edge-endpoint">
            <div
              className="node-dot"
              style={{ background: sourceNode?.data?.color || '#94A3B8' }}
            />
            <div>
              <p className="endpoint-type">
                {NODE_TYPE_LABELS[sourceNode?.data?.nodeType] || 'Source'}
              </p>
              <p className="endpoint-label">{sourceNode?.data?.label || edge.source}</p>
            </div>
          </div>
          <div className="edge-arrow">→</div>
          <div className="edge-endpoint">
            <div
              className="node-dot"
              style={{ background: targetNode?.data?.color || '#94A3B8' }}
            />
            <div>
              <p className="endpoint-type">
                {NODE_TYPE_LABELS[targetNode?.data?.nodeType] || 'Target'}
              </p>
              <p className="endpoint-label">{targetNode?.data?.label || edge.target}</p>
            </div>
          </div>
        </div>

        <div className="edge-actions">
          {sourceNode && (
            <button
              className="btn-inspect-node"
              onClick={() => onSelectNode?.({ id: sourceNode.id, ...sourceNode.data })}
            >
              Inspect Source
            </button>
          )}
          {targetNode && (
            <button
              className="btn-inspect-node"
              onClick={() => onSelectNode?.({ id: targetNode.id, ...targetNode.data })}
            >
              Inspect Target
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Node selected view ────────────────────────────────
  const color = NODE_COLORS[node.nodeType] || '#94A3B8';
  const typeLabel = NODE_TYPE_LABELS[node.nodeType] || node.nodeType;

  return (
    <div className="node-detail">
      {/* Type badge + close */}
      <div className="node-detail-header">
        <div className="node-type-badge" style={{ borderColor: color }}>
          <div className="node-dot" style={{ background: color }} />
          <span style={{ color }}>{typeLabel}</span>
        </div>
        <button className="close-btn" onClick={onClose} title="Close">✕</button>
      </div>

      {/* Node label */}
      <h3 className="node-title">{node.label}</h3>

      {/* Expand button */}
      <button
        className="btn-expand"
        style={{ '--expand-color': color }}
        onClick={() => onExpandNode?.(node.id)}
        title={focusMode ? "Add this node's neighbors to the focus view" : 'Enter focus view for this node'}
      >
        <span className="expand-icon">⊕</span>
        {focusMode ? 'Expand in Focus' : 'Expand Node'}
      </button>

      {/* Key-value metadata */}
      <div className="node-fields">
        {Object.entries(node).map(([key, value]) => {
          if (SKIP_KEYS.has(key)) return null;
          if (value === null || value === undefined || value === '') return null;
          return (
            <div key={key} className="node-field">
              <span className="field-key">{key.replace(/_/g, ' ')}</span>
              <span className="field-value">
                {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Connections section */}
      {connections.length > 0 && (
        <div className="connections-section">
          <div className="connections-header">
            <span>Connections</span>
            <span className="connections-count">{connections.length}</span>
          </div>
          <div className="connections-list">
            {connections.map((conn) => (
              <button
                key={conn.edgeId}
                className="connection-item"
                onClick={() => conn.neighborData && onSelectNode?.(conn.neighborData)}
                title={`Click to inspect ${conn.neighborLabel}`}
              >
                <div className="conn-left">
                  <div className="node-dot" style={{ background: conn.neighborColor }} />
                  <div className="conn-info">
                    <span className="conn-label">{conn.neighborLabel}</span>
                    <span className="conn-type">
                      {NODE_TYPE_LABELS[conn.neighborType] || conn.neighborType}
                    </span>
                  </div>
                </div>
                <span className={`conn-relation ${conn.direction}`}>
                  {conn.direction === 'outgoing' ? '→' : '←'}&nbsp;
                  {RELATION_LABELS[conn.relation] || conn.relation}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeDetail;
