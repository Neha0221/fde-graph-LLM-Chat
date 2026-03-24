import { Handle, Position } from 'reactflow';

// Defined at module level so the reference is always stable (no ReactFlow warning)
const GraphNode = ({ data, selected }) => (
  <div
    title={data.label}
    style={{
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: data.color,
      border: selected
        ? '2px solid #1e293b'
        : '1.5px solid rgba(255,255,255,0.8)',
      cursor: 'pointer',
      boxShadow: selected ? `0 0 0 3px ${data.color}55` : 'none',
      transition: 'box-shadow 0.15s ease',
    }}
  >
    <Handle
      type="target"
      position={Position.Left}
      style={{ opacity: 0, width: 0, height: 0 }}
    />
    <Handle
      type="source"
      position={Position.Right}
      style={{ opacity: 0, width: 0, height: 0 }}
    />
  </div>
);

// Exported as a stable module-level object — prevents ReactFlow nodeTypes warning
export const nodeTypes = { graphNode: GraphNode };

export default GraphNode;
