import { useMemo } from 'react';
import { NODE_COLORS, NODE_TYPE_LABELS } from '../utils/transformGraph';

const MAX_FIELDS = 10;
const SKIP_KEYS = new Set(['label', 'nodeType', 'color', 'id']);

const NodePopup = ({ node, allEdges, pos, onClose, onExpand }) => {
  const connectionCount = useMemo(() => {
    if (!node?.id) return 0;
    return allEdges.filter((e) => e.source === node.id || e.target === node.id).length;
  }, [node, allEdges]);

  if (!node) return null;

  const color = NODE_COLORS[node.nodeType] || '#94A3B8';
  const typeLabel = NODE_TYPE_LABELS[node.nodeType] || node.nodeType;

  const entries = Object.entries(node).filter(([key, value]) => {
    if (SKIP_KEYS.has(key)) return false;
    if (value === null || value === undefined || value === '') return false;
    return true;
  });

  const visibleEntries = entries.slice(0, MAX_FIELDS);
  const hasHidden = entries.length > MAX_FIELDS;

  // Smart position: offset from click, clamp so popup stays on screen
  const POPUP_W = 270;
  const left = pos.x + 16 + POPUP_W > window.innerWidth
    ? pos.x - POPUP_W - 8
    : pos.x + 16;
  const top = Math.max(Math.min(pos.y - 24, window.innerHeight - 480), 60);

  return (
    <div
      className="node-popup"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="node-popup-header">
        <span className="node-popup-type" style={{ color }}>{typeLabel}</span>
        <button className="node-popup-close" onClick={onClose} title="Close">✕</button>
      </div>

      {/* Fields */}
      <div className="node-popup-fields">
        {/* Entity row always first */}
        <div className="node-popup-row">
          <span className="npop-key">Entity</span>
          <span className="npop-val">{typeLabel}</span>
        </div>

        {visibleEntries.map(([key, value]) => (
          <div key={key} className="node-popup-row">
            <span className="npop-key">
              {key
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase())
                .trim() || key}
            </span>
            <span className="npop-val">
              {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
            </span>
          </div>
        ))}
      </div>

      {/* Hidden fields notice */}
      {hasHidden && (
        <p className="node-popup-hidden">Additional fields hidden for readability</p>
      )}

      {/* Footer */}
      <div className="node-popup-footer">
        <span className="node-popup-conn">Connections: {connectionCount}</span>
        <button
          className="node-popup-expand"
          style={{ color }}
          onClick={() => onExpand?.(node.id)}
        >
          Expand →
        </button>
      </div>
    </div>
  );
};

export default NodePopup;
