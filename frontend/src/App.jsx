import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import GraphCanvas from './components/GraphCanvas';
import NodeDetail from './components/NodeDetail';
import ChatPanel from './components/ChatPanel';
import { useGraphData } from './hooks/useGraphData';
import { transformToReactFlow, NODE_COLORS, NODE_TYPE_LABELS } from './utils/transformGraph';
import { fetchNodeNeighbors } from './api/graphApi';
import './App.css';

function App() {
  const { graphData, loading, error } = useGraphData();
  const [rfNodes, setRfNodes] = useState([]);
  const [rfEdges, setRfEdges] = useState([]);

  // Selected node for detail panel
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);

  // Resizable sidebar
  const [chatWidth, setChatWidth] = useState(380);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeStart = useCallback((e) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = chatWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [chatWidth]);

  useEffect(() => {
    let rafId = null;

    const onMouseMove = (e) => {
      if (!isResizing.current) return;
      if (rafId) return; // skip if a frame is already scheduled
      rafId = requestAnimationFrame(() => {
        const delta = startX.current - e.clientX;
        const newWidth = Math.min(Math.max(startWidth.current + delta, 320), 580);
        setChatWidth(newWidth);
        rafId = null;
      });
    };
    const onMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Focus / expand state
  const [focusMode, setFocusMode] = useState(false);
  const [focusNodeIds, setFocusNodeIds] = useState(new Set());
  const [focusEdgeIds, setFocusEdgeIds] = useState(new Set());
  const [expandLoading, setExpandLoading] = useState(false);

  useEffect(() => {
    if (graphData.nodes.length > 0) {
      const { nodes, edges } = transformToReactFlow(graphData.nodes, graphData.edges);
      setRfNodes(nodes);
      setRfEdges(edges);
    }
  }, [graphData]);

  const handleExpandNode = useCallback(async (nodeId) => {
    setExpandLoading(true);
    try {
      const data = await fetchNodeNeighbors(nodeId);
      const newNodeIds = new Set([data.node.id, ...data.neighbors.map((n) => n.id)]);
      const newEdgeIds = new Set(data.edges.map((e) => e.id));

      setFocusNodeIds((prev) => {
        const next = new Set(prev);
        newNodeIds.forEach((id) => next.add(id));
        return next;
      });
      setFocusEdgeIds((prev) => {
        const next = new Set(prev);
        newEdgeIds.forEach((id) => next.add(id));
        return next;
      });
      setFocusMode(true);
      setSelectedNode(null);
      setSelectedEdge(null);
    } catch (err) {
      console.error('Failed to expand node:', err);
    } finally {
      setExpandLoading(false);
    }
  }, []);

  const handleResetFocus = useCallback(() => {
    setFocusMode(false);
    setFocusNodeIds(new Set());
    setFocusEdgeIds(new Set());
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const displayNodes = useMemo(() => {
    if (!focusMode) return rfNodes;
    return rfNodes.filter((n) => focusNodeIds.has(n.id));
  }, [focusMode, focusNodeIds, rfNodes]);

  const displayEdges = useMemo(() => {
    if (!focusMode) return rfEdges;
    return rfEdges
      .filter((e) => focusEdgeIds.has(e.id))
      .map((e) => ({
        ...e,
        label: e.data?.relation,
        labelStyle: { fontSize: 10, fill: '#64748b', fontWeight: 600 },
        labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9 },
        labelBgPadding: [4, 3],
        style: { stroke: '#93C5FD', strokeWidth: 1.5, opacity: 0.85 },
      }));
  }, [focusMode, focusEdgeIds, rfEdges]);

  const handleNodeClick = useCallback((nodeData) => {
    setSelectedNode(nodeData);
    setSelectedEdge(null);
  }, []);

  const handleEdgeClick = useCallback((edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const canvasKey = focusMode ? `focus-${focusNodeIds.size}` : 'full';

  return (
    <div className="app-layout">

      {/* ── Top Header ── */}
      <header className="app-header">
        <div className="header-left">
          <span className="breadcrumb">Mapping</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb active">Order to Cash</span>
          {focusMode && (
            <>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb active focus-label">Focus View</span>
            </>
          )}
        </div>
        <div className="header-right">
          {focusMode && (
            <button className="btn-back" onClick={handleResetFocus}>
              ← Full Graph
            </button>
          )}
          {!loading && !error && (
            <div className="header-stats">
              <span className="stat-pill">{displayNodes.length} Nodes</span>
              <span className="stat-pill">{displayEdges.length} Edges</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Body: Graph + Chat Sidebar ── */}
      <div className="app-body">

        {/* Graph Panel */}
        <main className="graph-panel">
          {loading && (
            <div className="state-overlay">
              <div className="spinner" />
              <p>Loading graph data…</p>
            </div>
          )}

          {error && (
            <div className="state-overlay error">
              <span className="error-icon">⚠</span>
              <p>Failed to load graph</p>
              <p className="error-sub">{error}</p>
              <p className="error-sub">Make sure backend is running on port 5000</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Legend — only in full graph mode */}
              {!focusMode && (
                <div className="legend">
                  {Object.entries(NODE_TYPE_LABELS).map(([type, label]) => (
                    <div key={type} className="legend-item">
                      <div className="legend-dot" style={{ background: NODE_COLORS[type] }} />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Focus mode hint */}
              {focusMode && (
                <div className="focus-hint">
                  Double-click any node to expand its neighbors
                </div>
              )}

              {(selectedNode || selectedEdge) && (
                <div className="node-detail-panel">
                  <NodeDetail
                    node={selectedNode}
                    edge={selectedEdge}
                    allNodes={rfNodes}
                    allEdges={rfEdges}
                    onClose={handleCloseDetail}
                    onExpandNode={handleExpandNode}
                    onSelectNode={(nodeData) => {
                      setSelectedNode(nodeData);
                      setSelectedEdge(null);
                    }}
                    focusMode={focusMode}
                  />
                </div>
              )}

              <GraphCanvas
                key={canvasKey}
                nodes={displayNodes}
                edges={displayEdges}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleExpandNode}
                onEdgeClick={handleEdgeClick}
                onPaneClick={handleCloseDetail}
              />
            </>
          )}

          {expandLoading && (
            <div className="expand-loading-overlay">
              <div className="spinner-sm" />
              <span>Expanding…</span>
            </div>
          )}
        </main>

        {/* Drag handle */}
        <div className="resize-handle" onMouseDown={handleResizeStart}>
          <div className="resize-grip">
            <span /><span /><span /><span /><span /><span />
          </div>
        </div>

        {/* Right Sidebar — Chat */}
        <aside className="sidebar" style={{ width: chatWidth }}>
          <ChatPanel />
        </aside>

      </div>

    </div>
  );
}

export default App;
