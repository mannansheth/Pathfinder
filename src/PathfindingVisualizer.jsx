import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Plus, Trash2, Info, ChevronRight, X } from 'lucide-react';
import { toast } from 'react-toastify';

export const PathfindingVisualizer = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [sourceNode, setSourceNode] = useState(null);
  const [destNode, setDestNode] = useState(null);
  const [algorithm, setAlgorithm] = useState('dijkstra');
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState([]);
  const [mode, setMode] = useState('add');
  const canvasRef = useRef(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeEdges, setActiveEdges] = useState([]);
  
  // Modal states
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [direction, setDirection] = useState("uni");
  const [weightInput, setWeightInput] = useState('1');
  const [pendingEdge, setPendingEdge] = useState(null);


  const colors = {
    bg: '#0f172a',
    cardBg: '#1e293b',
    node: '#475569',
    nodeHighlight: '#06b6d4',
    nodeSource: '#10b981',
    nodeDest: '#ef4444',
    edge: '#334155',
    edgeActive: '#06b6d4',
    text: '#e2e8f0',
    textMuted: '#94a3b8',
    border: '#334155',
    accent: '#06b6d4',
    nodeTentative: '#f59e0b'
  };

  // Min-Heap (Priority Queue) implementation
  class MinHeap {
    constructor() {
      this.heap = [];
    }

    push(node, priority) {
      this.heap.push({ node, priority });
      this.bubbleUp(this.heap.length - 1);
    }

    pop() {
      if (this.heap.length === 0) return null;
      if (this.heap.length === 1) return this.heap.pop();
      
      const min = this.heap[0];
      this.heap[0] = this.heap.pop();
      this.bubbleDown(0);
      return min;
    }

    bubbleUp(index) {
      while (index > 0) {
        const parentIndex = Math.floor((index - 1) / 2);
        if (this.heap[parentIndex].priority <= this.heap[index].priority) break;
        
        [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
        index = parentIndex;
      }
    }

    bubbleDown(index) {
      while (true) {
        let smallest = index;
        const leftChild = 2 * index + 1;
        const rightChild = 2 * index + 2;

        if (leftChild < this.heap.length && 
            this.heap[leftChild].priority < this.heap[smallest].priority) {
          smallest = leftChild;
        }

        if (rightChild < this.heap.length && 
            this.heap[rightChild].priority < this.heap[smallest].priority) {
          smallest = rightChild;
        }

        if (smallest === index) break;

        [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
        index = smallest;
      }
    }

    isEmpty() {
      return this.heap.length === 0;
    }

    getAll() {
      return this.heap.map(item => ({ node: item.node, distance: item.priority }));
    }

    size() {
      return this.heap.length;
    }
  }


  const dijkstra = (nodes, edges, source, dest) => {
    const steps = [];
    const distances = {};
    const previous = {};
    const permanent = new Set();
    const minHeap = new MinHeap();
    
    nodes.forEach(node => {
      distances[node.id] = Infinity;
      previous[node.id] = null;
    });
    
    distances[source] = 0;
    minHeap.push(source, 0);
    
    steps.push({
      type: 'init',
      distances: {...distances},
      previous: {...previous},
      current: null,
      permanent: [],
      tentative: [{ node: source, distance: 0 }],
      activeEdges: [],
      message: 'Initialize: Set source distance to 0, add to tentative set'
    });

    while (!minHeap.isEmpty()) {
      // Extract minimum from tentative set
      const { node: current, priority: currentDist } = minHeap.pop();
      
      // Skip if already in permanent set (can have duplicates)
      if (permanent.has(current)) continue;
      
      permanent.add(current);
      
      const permanentArray = Array.from(permanent).map(nodeId => ({
        node: nodeId,
        distance: distances[nodeId]
      }));
      const tentativeArray = minHeap.getAll();
      
      // Get neighbors of current node
      const neighbors = edges
        .filter(e => e.from === current)
        .map(e => ({ to: e.to, weight: e.weight }));
      
      const exploringEdges = edges
        .filter(e => e.from === current && !permanent.has(e.to))
        .map(e => `${e.from}-${e.to}`);
      
      steps.push({
        type: 'extract',
        distances: {...distances},
        previous: {...previous},
        current,
        permanent: [...permanentArray],
        tentative: [...tentativeArray],
        neighbors: neighbors.map(n => n.to),
        activeEdges: exploringEdges,
        message: `Move ${current} from tentative to permanent (distance: ${distances[current]})`
      });
      
      // Early termination if we reached destination
      if (current === dest) {
        break;
      }
      
      // Relax all neighbors
      neighbors.forEach(({ to, weight }) => {
        if (!permanent.has(to)) {
          const alt = distances[current] + weight;
          
          if (alt < distances[to]) {
            distances[to] = alt;
            previous[to] = current;
            minHeap.push(to, alt);
            
            const tentativeArrayAfterUpdate = minHeap.getAll();
            
            steps.push({
              type: 'update',
              distances: {...distances},
              previous: {...previous},
              current,
              permanent: [...permanentArray],
              tentative: [...tentativeArrayAfterUpdate],
              updated: to,
              activeEdges: [`${current}-${to}`],
              message: `Relax edge ${current}→${to}: Update distance to ${alt}, add to tentative set`
            });
          } else {
            steps.push({
              type: 'no-update',
              distances: {...distances},
              previous: {...previous},
              current,
              permanent: [...permanentArray],
              tentative: [...tentativeArray],
              activeEdges: [`${current}-${to}`],
              message: `Edge ${current}→${to}: No improvement (${alt} ≥ ${distances[to]})`
            });
          }
        }
      });
    }
    
    // Reconstruct path
    const path = [];
    let curr = dest;
    while (curr !== null) {
      path.unshift(curr);
      curr = previous[curr];
    }
    
    const pathEdges = [];
    for (let i = 0; i < path.length - 1; i++) {
      pathEdges.push(`${path[i]}-${path[i + 1]}`);
    }

    const finalPermanent = Array.from(permanent).map(nodeId => ({
      node: nodeId,
      distance: distances[nodeId]
    }));
    
    steps.push({
      type: 'complete',
      distances: {...distances},
      previous: {...previous},
      path: distances[dest] !== Infinity ? path : [],
      permanent: finalPermanent,
      tentative: [],
      activeEdges: pathEdges,
      message: distances[dest] !== Infinity 
        ? `Path found! Distance: ${distances[dest]}, Path: ${path.join(' → ')}`
        : 'No path exists'
    });
    
    return steps;
  };


  const bellmanFord = (nodes, edges, source, dest) => {
    const steps = [];
    const distances = {};
    const previous = {};
    
    nodes.forEach(node => {
      distances[node.id] = Infinity;
      previous[node.id] = null;
    });
    
    distances[source] = 0;
    
    steps.push({
      type: 'show-edges',
      distances: {...distances},
      previous: {...previous},
      iteration: 0,
      edges: edges.map(e => `${e.from}→${e.to} (weight: ${e.weight})`),
      activeEdges: [],
      message: `Graph has ${edges.length} edges: ${edges.map(e => `${e.from}→${e.to}(${e.weight})`).join(', ')}`
    });
    
    steps.push({
      type: 'init',
      distances: {...distances},
      previous: {...previous},
      iteration: 0,
      activeEdges: [],
      message: `Initialize: Set distance[${source}] = 0, all others = ∞`
    });

    for (let i = 0; i < nodes.length - 1; i++) {
      let updated = false;
      
      steps.push({
        type: 'iteration-start',
        distances: {...distances},
        previous: {...previous},
        iteration: i + 1,
        activeEdges: [],
        message: `Iteration ${i + 1}: Relaxing all ${edges.length} edges`
      });
      
      edges.forEach((edge, edgeIndex) => {
        const activeEdge = [`${edge.from}-${edge.to}`];
        
        if (distances[edge.from] !== Infinity) {
          const alt = distances[edge.from] + edge.weight;
          
          if (alt < distances[edge.to]) {
            const oldDist = distances[edge.to];
            distances[edge.to] = alt;
            previous[edge.to] = edge.from;
            updated = true;
            
            steps.push({
              type: 'update',
              distances: {...distances},
              previous: {...previous},
              iteration: i + 1,
              edge,
              edgeNumber: edgeIndex + 1,
              activeEdges: activeEdge,
              message: `Edge ${edgeIndex + 1} (${edge.from}→${edge.to}): Relax! ${edge.to} distance updated from ${oldDist === Infinity ? '∞' : oldDist} to ${alt}`
            });
          } else {
            steps.push({
              type: 'no-update',
              distances: {...distances},
              previous: {...previous},
              iteration: i + 1,
              edge,
              edgeNumber: edgeIndex + 1,
              activeEdges: activeEdge,
              message: `Edge ${edgeIndex + 1} (${edge.from}→${edge.to}): No update (${alt} ≥ ${distances[edge.to] === Infinity ? '∞' : distances[edge.to]})`
            });
          }
        } else {
          steps.push({
            type: 'skip',
            distances: {...distances},
            previous: {...previous},
            iteration: i + 1,
            edge,
            edgeNumber: edgeIndex + 1,
            activeEdges: activeEdge,
            message: `Edge ${edgeIndex + 1} (${edge.from}→${edge.to}): Skip (source ${edge.from} unreachable)`
          });
        }
      });
      
      // After iteration summary
      steps.push({
        type: 'iteration-end',
        distances: {...distances},
        previous: {...previous},
        iteration: i + 1,
        activeEdges: [],
        updated: updated,
        message: updated 
          ? `Iteration ${i + 1} complete: Distances updated` 
          : `Iteration ${i + 1} complete: No changes, can terminate early`
      });
      
      if (!updated) {
        break;
      }
    }
    
    // Check for negative cycles
    let hasNegativeCycle = false;
    let negativeCycleEdge = null;
    
    edges.forEach(edge => {
      if (distances[edge.from] !== Infinity) {
        const alt = distances[edge.from] + edge.weight;
        if (alt < distances[edge.to]) {
          hasNegativeCycle = true;
          negativeCycleEdge = edge;
        }
      }
    });

    if (hasNegativeCycle) {
      steps.push({
        type: 'negative-cycle',
        distances: {...distances},
        previous: {...previous},
        activeEdges: negativeCycleEdge ? [`${negativeCycleEdge.from}-${negativeCycleEdge.to}`] : [],
        message: `Negative cycle detected! Edge ${negativeCycleEdge.from}→${negativeCycleEdge.to} can still be relaxed. Shortest paths undefined.`
      });
      return steps;
    }
    
    // Reconstruct path
    const path = [];
    let curr = dest;
    while (curr !== null) {
      path.unshift(curr);
      curr = previous[curr];
    }
    
    const pathEdges = [];
    for (let i = 0; i < path.length - 1; i++) {
      pathEdges.push(`${path[i]}-${path[i + 1]}`);
    }
    
    steps.push({
      type: 'complete',
      distances: {...distances},
      previous: {...previous},
      path: distances[dest] !== Infinity ? path : [],
      activeEdges: pathEdges,
      message: distances[dest] !== Infinity 
        ? `Algorithm complete! Shortest path from ${source} to ${dest}: ${path.join(' → ')} (Distance: ${distances[dest]})`
        : `Algorithm complete! No path exists from ${source} to ${dest}`
    });
    
    return steps;
  };


  // Modal handlers
  const openWeightModal = (fromNode, toNode) => {
    setPendingEdge({ from: fromNode, to: toNode });
    setWeightInput('1');
    setShowWeightModal(true);
  };

  const closeWeightModal = () => {
    setShowWeightModal(false);
    setPendingEdge(null);
    setWeightInput('1');
    setConnectingFrom(null);
  };

  const handleWeightSubmit = (e) => {
    e.preventDefault();
    const weight = parseInt(weightInput);
    if (algorithm === "dijkstra" && weight < 0) {
      toast.error("Dijkstra's algorithm must have positive weight edges only.");
      return;
    }
    if (weight && pendingEdge) {
      direction === "uni" ? 
      setEdges([...edges, {
        from: pendingEdge.from,
        to: pendingEdge.to,
        weight: weight
      }])
      :
      setEdges([...edges, ...[{
        from: pendingEdge.from,
        to: pendingEdge.to,
        weight: weight
      }, {
        from: pendingEdge.to,
        to: pendingEdge.from,
        weight: weight
      }]])
      ;
    }
    setDirection("uni")
    closeWeightModal();
  };


  const handleCanvasMouseDown = (e) => {
    if (isAnimating) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const clickedNode = nodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 25;
    });
    
    if (clickedNode && mode === 'add') {
      setDraggingNode(clickedNode.id);
      setDragOffset({ x: clickedNode.x - x, y: clickedNode.y - y });
    } else if (mode === 'add' && !clickedNode) {
      const newNode = {
        id: `N${nodes.length}`,
        x,
        y
      };
      setNodes([...nodes, newNode]);
    } else if (mode === 'connect' && clickedNode) {
      if (!connectingFrom) {
        setConnectingFrom(clickedNode.id);
      } else if (connectingFrom !== clickedNode.id) {
        openWeightModal(connectingFrom, clickedNode.id);
      }
    } else if (mode === 'delete' && clickedNode) {
      setNodes(nodes.filter(n => n.id !== clickedNode.id));
      setEdges(edges.filter(e => e.from !== clickedNode.id && e.to !== clickedNode.id));
      if (sourceNode === clickedNode.id) setSourceNode(null);
      if (destNode === clickedNode.id) setDestNode(null);
    } else if (mode === 'selectSource' && clickedNode) {
      setSourceNode(clickedNode.id);
      setMode('add');
    } else if (mode === 'selectDest' && clickedNode) {
      setDestNode(clickedNode.id);
      setMode('add');
    }
  };


  const handleCanvasMouseMove = (e) => {
    if (!draggingNode) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setNodes(nodes.map(node => 
      node.id === draggingNode 
        ? { ...node, x: x + dragOffset.x, y: y + dragOffset.y }
        : node
    ));
  };


  const handleCanvasMouseUp = () => {
    setDraggingNode(null);
  };


  const runAlgorithm = () => {
    if (!sourceNode || !destNode || edges.length === 0) {
      toast.error("Please select source node, destination node and make sure graph contains edges.")
      return;
    }
    
    const algorithmSteps = algorithm === 'dijkstra' 
      ? dijkstra(nodes, edges, sourceNode, destNode)
      : bellmanFord(nodes, edges, sourceNode, destNode);
    
    setSteps(algorithmSteps);
    setCurrentStep(0);
    setIsAnimating(true);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsAnimating(false);
    }
  };


  const resetVisualization = () => {
    setIsAnimating(false);
    setCurrentStep(0);
    setSteps([]);
    setActiveEdges([]);
  };


  const clearGraph = () => {
    setNodes([]);
    setEdges([]);
    setSourceNode(null);
    setDestNode(null);
    resetVisualization();
  };


  useEffect(() => {
    if (steps[currentStep]) {
      setActiveEdges(steps[currentStep].activeEdges || []);
    }
  }, [currentStep, steps]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const currentStepData = steps[currentStep];
    
    // Draw edges
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) return;
      
      const edgeKey = `${edge.from}-${edge.to}`;
      const isActive = activeEdges.includes(edgeKey);
      
      let edgeColor = colors.edge;
      let lineWidth = 2;
      
      if (isActive) {
        edgeColor = colors.edgeActive;
        lineWidth = 4;
      }
      
      if (isActive && isAnimating) {
        const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
        ctx.globalAlpha = pulse;
      }
      
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);
      ctx.lineTo(toNode.x, toNode.y);
      ctx.stroke();
      
      ctx.globalAlpha = 1;
      
      const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
      const arrowSize = 10;
      const endX = toNode.x - Math.cos(angle) * 25;
      const endY = toNode.y - Math.sin(angle) * 25;
      
      ctx.fillStyle = edgeColor;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowSize * Math.cos(angle - Math.PI / 6),
        endY - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - arrowSize * Math.cos(angle + Math.PI / 6),
        endY - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
      
      const midX = (fromNode.x + toNode.x) / 2;
      const midY = (fromNode.y + toNode.y) / 2;
      ctx.fillStyle = colors.cardBg;
      ctx.fillRect(midX - 15, midY - 12, 30, 24);
      ctx.fillStyle = isActive ? colors.edgeActive : colors.text;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(edge.weight, midX, midY);
    });
    
    if (connectingFrom) {
      const fromNode = nodes.find(n => n.id === connectingFrom);
      if (fromNode) {
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(fromNode.x, fromNode.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    
    // Draw nodes
    nodes.forEach(node => {
      let nodeColor = colors.node;
      let showPulse = false;
      
      // Check if node is in tentative or permanent set
      const inTentative = currentStepData?.tentative?.some(t => t.node === node.id);
      const inPermanent = currentStepData?.permanent?.some(p => p.node === node.id);
      
      if (node.id === sourceNode) {
        nodeColor = colors.nodeSource;
      } else if (node.id === destNode) {
        nodeColor = colors.nodeDest;
      } else if (currentStepData) {
        if (currentStepData.current === node.id || currentStepData.updated === node.id) {
          nodeColor = colors.nodeHighlight;
          showPulse = true;
        } else if (inTentative) {
          nodeColor = colors.nodeTentative; // Orange for tentative
        } else if (inPermanent) {
          nodeColor = '#64748b'; // Gray for permanent
        }
      }
      
      if (showPulse && isAnimating) {
        const pulse = Math.sin(Date.now() / 300) * 5 + 30;
        const alpha = Math.sin(Date.now() / 300) * 0.3 + 0.5;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = colors.nodeHighlight;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulse, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      
      ctx.fillStyle = nodeColor;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 25, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.id, node.x, node.y);
      
      if (currentStepData && currentStepData.distances) {
        const dist = currentStepData.distances[node.id];
        const distText = dist === Infinity ? '∞' : dist;
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 13px Arial';
        ctx.fillText(distText, node.x, node.y - 40);
      }
    });
    
    if (isAnimating) {
      requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          handleCanvasMouseMove({ clientX: 0, clientY: 0 });
        }
      });
    }
  }, [nodes, edges, sourceNode, destNode, currentStep, steps, connectingFrom, activeEdges, isAnimating]);


  return (
    <div className="pathfinding-container">
      <header className="pathfinding-header">
        <h1 className="pathfinding-title">Pathfinding Algorithm Visualizer</h1>
        <p className="pathfinding-subtitle">Interactive visualization of Dijkstra's and Bellman-Ford algorithms</p>
      </header>
      
      <div className="pathfinding-controls">
        <div className="control-group">
          <label className="control-label">Algorithm:</label>
          <select 
            value={algorithm} 
            onChange={(e) => {
              if (e.target.value === "dijkstra" && edges.filter(e => e.weight < 0).length > 0)  {
                toast.error("Dijkstra's algorithm can only contain positive edge weight. Please clear before selecting");
                return; 
              }
              setAlgorithm(e.target.value)
            }}
            className="control-select"
            disabled={isAnimating}
          >
            <option value="dijkstra">Dijkstra's Algorithm</option>
            <option value="bellman-ford">Bellman-Ford Algorithm</option>
          </select>
        </div>
        
        <div className="control-group">
          <label className="control-label">Mode:</label>
          <div className="button-group">
            <button 
              onClick={() => { setMode('add'); setConnectingFrom(null); }}
              className={`mode-button ${mode === 'add' ? 'mode-button-active' : ''}`}
              disabled={isAnimating}
            >
              <Plus size={16} /> Add
            </button>
            <button 
              onClick={() => { setMode('connect'); setConnectingFrom(null); }}
              className={`mode-button ${mode === 'connect' ? 'mode-button-active' : ''}`}
              disabled={isAnimating}
            >
              Connect
            </button>
            <button 
              onClick={() => { setMode('delete'); setConnectingFrom(null); }}
              className={`mode-button ${mode === 'delete' ? 'mode-button-active' : ''}`}
              disabled={isAnimating}
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        </div>
        
        <div className="control-group">
          <button 
            onClick={() => setMode('selectSource')}
            className="action-button"
            disabled={isAnimating}
          >
            Source: {sourceNode || 'None'}
          </button>
          <button 
            onClick={() => setMode('selectDest')}
            className="action-button"
            disabled={isAnimating}
          >
            Dest: {destNode || 'None'}
          </button>
        </div>
        
        <div className="control-group">
          <button onClick={runAlgorithm} className="primary-button" disabled={isAnimating}>
            <Play size={16} /> Run Algorithm
          </button>
          {isAnimating && currentStep < steps.length - 1 && (
            <button onClick={nextStep} className="next-step-button">
              <ChevronRight size={16} /> Next Step
            </button>
          )}
          <button onClick={resetVisualization} className="action-button" disabled={!steps.length}>
            <RotateCcw size={16} /> Reset
          </button>
          <button onClick={clearGraph} className="action-button" disabled={isAnimating}>
            <Trash2 size={16} /> Clear
          </button>
        </div>
      </div>
      
      <div className="main-content">
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            className="visualization-canvas"
          />
          {mode === 'selectSource' && (
            <div className="canvas-instruction">Click on a node to set as SOURCE</div>
          )}
          {mode === 'selectDest' && (
            <div className="canvas-instruction">Click on a node to set as DESTINATION</div>
          )}
          {connectingFrom && (
            <div className="canvas-instruction">Click on another node to create edge from {connectingFrom}</div>
          )}
        </div>
        
        {steps.length > 0 && (
          <div className="info-panel">
            <div className="step-info">
              <h3 className="step-title">
                Step {currentStep + 1} of {steps.length}
              </h3>
              <p className="step-message">{steps[currentStep].message}</p>
            </div>
            
            <div className="legend-container">
              <h4 className="legend-title">Legend:</h4>
              <div className="legend-items">
                <div className="legend-item">
                  <div className="legend-dot" style={{backgroundColor: colors.nodeSource}}></div>
                  <span>Source</span>
                </div>
                <div className="legend-item">
                  <div className="legend-dot" style={{backgroundColor: colors.nodeDest}}></div>
                  <span>Destination</span>
                </div>
                <div className="legend-item">
                  <div className="legend-dot" style={{backgroundColor: colors.nodeHighlight}}></div>
                  <span>Current Node</span>
                </div>
                {algorithm === 'dijkstra' && (
                  <>
                    <div className="legend-item">
                      <div className="legend-dot" style={{backgroundColor: colors.nodeTentative}}></div>
                      <span>Tentative</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-dot" style={{backgroundColor: '#64748b'}}></div>
                      <span>Permanent</span>
                    </div>
                  </>
                )}
                <div className="legend-item">
                  <div className="legend-dot" style={{backgroundColor: colors.node}}></div>
                  <span>Unvisited</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Keep the table sections with className updates */}
      {steps.length > 0 && (
        <div className="table-container">
          {steps.length > 0 && (
          <div className="table-container">
            {algorithm === 'dijkstra' ? (
              <>
                <h3 className="table-title">Permanent & Tentative Sets - Step {currentStep + 1}</h3>

                <div className="sets-container">
                  <div className="set-box">
                    <h4 className="set-title">Permanent Set</h4>
                    <table className="set-table">
                      <thead>
                        <tr>
                          <th className="table-header">Node</th>
                          <th className="table-header">Distance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {steps[currentStep].permanent && steps[currentStep].permanent.length > 0 ? (
                          steps[currentStep].permanent.map(item => (
                            <tr key={item.node}>
                              <td 
                                className={`table-cell ${item.node === steps[currentStep].current ? 'bg-accent text-white font-bold' : ''}`}
                              >
                                {item.node}
                              </td>
                              <td 
                                className={`table-cell ${item.node === steps[currentStep].current ? 'bg-accent text-white font-bold' : ''}`}
                              >
                                {item.distance === Infinity ? '∞' : item.distance}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="2" className="table-cell table-cell-center">
                              Empty
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="set-box">
                    <h4 className="set-title">Tentative Set</h4>
                    <table className="set-table">
                      <thead>
                        <tr>
                          <th className="table-header">Node</th>
                          <th className="table-header">Distance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {steps[currentStep].tentative && steps[currentStep].tentative.length > 0 ? (
                          steps[currentStep].tentative
                            .sort((a, b) => a.distance - b.distance)
                            .map(item => (
                              <tr key={item.node}>
                                <td 
                                  className="table-cell"
                                  style={{
                                    backgroundColor: item.node === steps[currentStep].updated ? '#fef3c7' : 'transparent',
                                    fontWeight: item.node === steps[currentStep].updated ? 'bold' : 'normal'
                                  }}
                                >
                                  {item.node}
                                </td>
                                <td 
                                  className="table-cell"
                                  style={{
                                    backgroundColor: item.node === steps[currentStep].updated ? '#fef3c7' : 'transparent',
                                    fontWeight: item.node === steps[currentStep].updated ? 'bold' : 'normal'
                                  }}
                                >
                                  {item.distance === Infinity ? '∞' : item.distance}
                                </td>
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td colSpan="2" className="table-cell table-cell-center">
                              Empty
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                </div>
                <>
                <table className="data-table">
                    <thead>
                      <tr>
                        <th className="table-header">Node</th>
                        {nodes.map(node => (
                          <th key={node.id} className="table-header">{node.id}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="table-cell table-cell-black">Distance</td>
                        {nodes.map(node => {
                          const dist = steps[currentStep].distances[node.id];
                          const isUpdated = steps[currentStep].edge?.to === node.id && steps[currentStep].type === 'update';
                          return (
                            <td 
                              key={node.id} 
                              className={`table-cell ${isUpdated ? 'bg-success text-white font-bold' : ''}`}
                            >
                              {dist === Infinity ? '∞' : dist}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="table-cell table-cell-black">Previous</td>
                        {nodes.map(node => {
                          const prev = steps[currentStep].previous[node.id];
                          const isUpdated = steps[currentStep].edge?.to === node.id && steps[currentStep].type === 'update';
                          return (
                            <td 
                              key={node.id} 
                              className={`table-cell ${isUpdated ? 'bg-success text-white font-bold' : ''}`}
                            >
                              {prev || '-'}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                  </>
              </>
              ) : (
              <>
                {steps[currentStep].edgeNumber && (
                  <div className="edge-info">
                    <strong>Processing Edge {steps[currentStep].edgeNumber}/{edges.length}:</strong>{' '}
                    {steps[currentStep].edge.from} → {steps[currentStep].edge.to} (weight: {steps[currentStep].edge.weight})
                  </div>
                )}
                <h3 className="table-title">
                  {steps[currentStep].iteration !== undefined 
                    ? `Iteration ${steps[currentStep].iteration} - Distance Table`
                    : 'Distance Table'}
                </h3>

                
                {steps[currentStep].type === 'show-edges' && (
                  <div className="edges-list">
                    <h4 className="edges-title">All Edges in Graph:</h4>
                    <div className="edges-grid">
                      {edges.map((edge, idx) => (
                        <div key={idx} className="edge-item">
                          {idx + 1}. {edge.from} → {edge.to} (weight: {edge.weight})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="table-header">Node</th>
                      {nodes.map(node => (
                        <th key={node.id} className="table-header">{node.id}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="table-cell table-cell-black">Distance</td>
                      {nodes.map(node => {
                        const dist = steps[currentStep].distances[node.id];
                        const isUpdated = steps[currentStep].edge?.to === node.id && steps[currentStep].type === 'update';
                        return (
                          <td 
                            key={node.id} 
                            className={`table-cell ${isUpdated ? 'bg-success text-white font-bold' : ''}`}
                          >
                            {dist === Infinity ? '∞' : dist}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="table-cell table-cell-black">Previous</td>
                      {nodes.map(node => {
                        const prev = steps[currentStep].previous[node.id];
                        const isUpdated = steps[currentStep].edge?.to === node.id && steps[currentStep].type === 'update';
                        return (
                          <td 
                            key={node.id} 
                            className={`table-cell ${isUpdated ? 'bg-success text-white font-bold' : ''}`}
                          >
                            {prev || '-'}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
                
                
              </>
            )}
          </div>
          )}

        </div>
      )}
      
      <div className="algorithm-info">
        <div className="info-card">
          <h3 className="info-card-title">
            <Info size={20} /> Dijkstra's Algorithm
          </h3>
          <p className="info-card-text">
            <strong>Time Complexity:</strong> O(E log V) with priority queue<br/>
            <strong>Space Complexity:</strong> O(V)<br/>
            <strong>Best for:</strong> Graphs with non-negative weights<br/>
            <strong>Approach:</strong> Greedy algorithm that maintains permanent and tentative sets
          </p>
        </div>
        
        <div className="info-card">
          <h3 className="info-card-title">
            <Info size={20} /> Bellman-Ford Algorithm
          </h3>
          <p className="info-card-text">
            <strong>Time Complexity:</strong> O(V × E)<br/>
            <strong>Space Complexity:</strong> O(V)<br/>
            <strong>Best for:</strong> Graphs with negative weights, detects negative cycles<br/>
            <strong>Approach:</strong> Dynamic programming that relaxes all edges V-1 times
          </p>
        </div>
      </div>

      {/* Modal with classNames */}
      {showWeightModal && (
        <>
          <div className="modal-overlay" onClick={closeWeightModal} />
          <div className="modal-container">
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">Enter Edge Weight</h3>
                <button className="modal-close-button" onClick={closeWeightModal}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleWeightSubmit}>
                <div className="modal-body">
                  {direction === "uni" ? 
                    <p className="modal-text">
                      Creating edge from <strong>{pendingEdge?.from}</strong> to <strong>{pendingEdge?.to}</strong>
                    </p>
                  :
                    <p className="modal-text">
                      Creating edge from <strong>{pendingEdge?.from}</strong> to <strong>{pendingEdge?.to}</strong> and 
                      <strong>{pendingEdge?.to}</strong> to <strong>{pendingEdge?.from}</strong>
                    </p>

                    }
                  <label className="modal-label">
                    Weight:
                    <input
                      type="number"
                      value={weightInput}
                      onChange={(e) => setWeightInput(e.target.value)}
                      className="modal-input"
                      autoFocus
                      required
                    />
                  </label>
                  <select 
                    value={direction} 
                    onChange={(e) => {
                      setDirection(e.target.value);
                    }}
                    className="control-select"
                    disabled={isAnimating}
                  >
                    <option value="uni">Unidirectional</option>
                    <option value="bi">Bidirectional</option>
                  </select>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    onClick={closeWeightModal} 
                    className="modal-cancel-button"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="modal-submit-button"
                  >
                    Create Edge
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

