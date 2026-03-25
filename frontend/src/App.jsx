import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import GraphCanvas from './components/GraphCanvas';
import NodeDetail from './components/NodeDetail';
import NodePopup from './components/NodePopup';
import ChatPanel from './components/ChatPanel';
import { useGraphData } from './hooks/useGraphData';
import { transformToReactFlow, NODE_COLORS, NODE_TYPE_LABELS } from './utils/transformGraph';
import { fetchNodeNeighbors } from './api/graphApi';
import './App.css';

function App() {
  const { graphData, loading, error } = useGraphData();
  const [rfNodes, setRfNodes] = useState([]);
  const [rfEdges, setRfEdges] = useState([]);

  // Selected node/edge popup positions
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [popupPos, setPopupPos] = useState(null);
  const [edgePopupPos, setEdgePopupPos] = useState(null);

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
    const baseEdges = !focusMode
      ? rfEdges
      : rfEdges
          .filter((e) => focusEdgeIds.has(e.id))
          .map((e) => ({
            ...e,
            label: e.data?.relation,
            labelStyle: { fontSize: 10, fill: '#64748b', fontWeight: 600 },
            labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9 },
            labelBgPadding: [4, 3],
            style: { stroke: '#93C5FD', strokeWidth: 1.5, opacity: 0.85 },
          }));

    if (!selectedNode) return baseEdges;

    return baseEdges.map((e) => {
      const isConnected = e.source === selectedNode.id || e.target === selectedNode.id;
      return {
        ...e,
        style: isConnected
          ? { stroke: '#3b82f6', strokeWidth: 2.5, opacity: 1 }
          : { stroke: '#93C5FD', strokeWidth: 0.8, opacity: 0.12 },
        zIndex: isConnected ? 10 : 0,
      };
    });
  }, [focusMode, focusEdgeIds, rfEdges, selectedNode]);

  const handleNodeClick = useCallback((nodeData, pos) => {
    setSelectedNode(nodeData);
    setPopupPos(pos);
    setSelectedEdge(null);
  }, []);

  const handleEdgeClick = useCallback((edge, pos) => {
    setSelectedEdge(edge);
    setEdgePopupPos(pos);
    setSelectedNode(null);
    setPopupPos(null);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setPopupPos(null);
    setEdgePopupPos(null);
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

              {/* Floating popup — appears at the clicked node's position */}
              {selectedNode && popupPos && (
                <NodePopup
                  node={selectedNode}
                  allEdges={rfEdges}
                  pos={popupPos}
                  onClose={handleCloseDetail}
                  onExpand={handleExpandNode}
                />
              )}

              {/* Edge detail floating panel — positioned at click location */}
              {selectedEdge && edgePopupPos && (() => {
                const PANEL_W = 260;
                const left = edgePopupPos.x + 16 + PANEL_W > window.innerWidth
                  ? edgePopupPos.x - PANEL_W - 8
                  : edgePopupPos.x + 16;
                const top = Math.max(Math.min(edgePopupPos.y - 24, window.innerHeight - 400), 60);
                return (
                  <div
                    className="node-detail-panel"
                    style={{ position: 'fixed', top, left, bottom: 'auto' }}
                  >
                    <NodeDetail
                      edge={selectedEdge}
                      allNodes={rfNodes}
                      allEdges={rfEdges}
                      onClose={handleCloseDetail}
                      onExpandNode={handleExpandNode}
                      onSelectNode={(nodeData) => {
                        setSelectedNode(nodeData);
                        setSelectedEdge(null);
                        setEdgePopupPos(null);
                        setPopupPos({ x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 200 });
                      }}
                      focusMode={focusMode}
                    />
                  </div>
                );
              })()}

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
