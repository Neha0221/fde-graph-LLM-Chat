import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes as _nodeTypes } from './GraphNode';

// Defined outside component so reference is always stable
const defaultEdgeOptions = {
  style: { stroke: '#93C5FD', strokeWidth: 0.8, opacity: 0.5 },
};

const GraphCanvas = ({
  nodes: initialNodes,
  edges: initialEdges,
  onNodeClick,
  onNodeDoubleClick,
  onEdgeClick,
  onPaneClick,
}) => {
  const nodeTypes = useMemo(() => _nodeTypes, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync internal state when async data arrives from parent
  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);
  useEffect(() => { setEdges(initialEdges); }, [initialEdges, setEdges]);

  const handleNodeClick = useCallback(
    (event, node) => {
      onNodeClick?.({ id: node.id, ...node.data }, { x: event.clientX, y: event.clientY });
    },
    [onNodeClick]
  );

  const handleNodeDoubleClick = useCallback(
    (_, node) => {
      onNodeDoubleClick?.(node.id);
    },
    [onNodeDoubleClick]
  );

  const handleEdgeClick = useCallback(
    (event, edge) => {
      onEdgeClick?.(edge, { x: event.clientX, y: event.clientY });
    },
    [onEdgeClick]
  );

  const handlePaneClick = useCallback(() => {
    onPaneClick?.();
  }, [onPaneClick]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.05}
        maxZoom={5}
      >
        <Background color="#e2e8f0" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => node.data?.color || '#94A3B8'}
          maskColor="rgba(248,250,252,0.7)"
          style={{
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
          }}
        />
      </ReactFlow>
    </div>
  );
};

export default GraphCanvas;
