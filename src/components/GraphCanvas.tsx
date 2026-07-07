'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
// Cytoscape's bundled types diverge across minor versions; alias to a permissive
// type so this file compiles against the installed version without chasing every
// exported-name change.
type CytoscapeStylesheet = any;
type CytoscapeCore = any;
import {
  Network,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Loader2,
  Ghost,
  SlidersHorizontal,
} from 'lucide-react';
import { usePhantomStore } from '@/store/phantom-store';
import {
  ENTITY_COLORS,
  ENTITY_SHAPES,
  RELATIONSHIP_COLORS,
  type EntityType,
  type RelationshipType,
  type GraphData,
  type Entity,
  type Relationship,
} from '@/types';
import { graphApi, entitiesApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import GraphFilters from '@/components/GraphFilters';

// ---------------------------------------------------------------------------
// Cytoscape stylesheet builder
// ---------------------------------------------------------------------------

function buildCytoscapeStylesheet(): CytoscapeStylesheet {
  const entityTypes: EntityType[] = [
    'person',
    'username',
    'location',
    'device',
    'organization',
    'email',
    'phone',
    'url',
    'image',
    'cryptocurrency',
    'media',
  ];

  const relationshipTypes: RelationshipType[] = [
    'owns',
    'communicated',
    'located_at',
    'associated',
    'member_of',
    'operates',
    'linked',
    'reported',
    'finances',
    'familial',
    'operational',
    'geographic',
  ];

  // Base node style
  const styles: CytoscapeStylesheet = [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-wrap': 'wrap',
        'text-max-width': '80px',
        'font-size': '11px',
        'text-valign': 'center',
        'text-halign': 'center',
        color: '#e6f0ff',
        'text-outline-color': '#050810',
        'text-outline-width': '3px',
        width: 40,
        height: 40,
        'border-width': 2,
        'border-color': '#00e5ff',
        'border-opacity': 0.6,
        cursor: 'pointer',
      } as Record<string, unknown>,
    },
    // Per-entity-type styles
    ...entityTypes.map(
      (type) =>
        ({
          selector: `node[type="${type}"]`,
          style: {
            'background-color': ENTITY_COLORS[type],
            shape: ENTITY_SHAPES[type],
          },
        }) as CytoscapeStylesheet,
    ),
    // Selected node highlight
    {
      selector: 'node:selected',
      style: {
        'border-width': 4,
        'border-color': '#00ff9d',
        'border-opacity': 1,
      } as Record<string, unknown>,
    },
    // Base edge style
    {
      selector: 'edge',
      style: {
        width: 2,
        'line-color': 'rgba(0, 229, 255, 0.35)',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': 'rgba(0, 229, 255, 0.35)',
        'curve-style': 'bezier',
        label: 'data(label)',
        'font-size': '9px',
        'text-rotation': 'autorotate',
        'text-outline-color': '#050810',
        'text-outline-width': '2px',
        color: '#6b7ba8',
        cursor: 'pointer',
      } as Record<string, unknown>,
    },
    // Per-relationship-type edge styles
    ...relationshipTypes.map(
      (type) =>
        ({
          selector: `edge[type="${type}"]`,
          style: {
            'line-color': RELATIONSHIP_COLORS[type],
            'target-arrow-color': RELATIONSHIP_COLORS[type],
            ...(type === 'communicated' ? { 'line-style': 'dashed' } : {}),
            ...(type === 'located_at' ? { width: 3 } : {}),
            ...(type === 'associated' ? { 'line-style': 'dotted' } : {}),
          },
        }) as CytoscapeStylesheet,
    ),
    // Selected edge highlight
    {
      selector: 'edge:selected',
      style: {
        width: 4,
        'line-color': '#00ff9d',
        'target-arrow-color': '#00ff9d',
      } as Record<string, unknown>,
    },
  ];

  return styles;
}

// ---------------------------------------------------------------------------
// Layout options mapping
// ---------------------------------------------------------------------------

const LAYOUT_OPTIONS: Record<
  string,
  cytoscape.LayoutOptions & { name: string }
> = {
  cose: {
    name: 'cose',
    animate: true,
    animationDuration: 500,
    nodeRepulsion: () => 80000,
    idealEdgeLength: () => 100,
    gravity: 0.3,
    padding: 30,
    randomize: true,
  } as cytoscape.CoseLayoutOptions,
  breadthfirst: {
    name: 'breadthfirst',
    animate: true,
    animationDuration: 500,
    padding: 30,
    spacingFactor: 1.5,
  } as cytoscape.BreadthFirstLayoutOptions,
  circle: {
    name: 'circle',
    animate: true,
    animationDuration: 500,
    padding: 30,
    spacingFactor: 1.2,
  } as cytoscape.CircleLayoutOptions,
  concentric: {
    name: 'concentric',
    animate: true,
    animationDuration: 500,
    padding: 30,
    spacingFactor: 1.2,
    concentric: (node: cytoscape.NodeSingular) => node.degree(),
  } as cytoscape.ConcentricLayoutOptions,
  grid: {
    name: 'grid',
    animate: true,
    animationDuration: 500,
    padding: 30,
    spacingFactor: 1.2,
  } as cytoscape.GridLayoutOptions,
};

// ---------------------------------------------------------------------------
// Debounce helper
// ---------------------------------------------------------------------------

function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number
): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = ((...args: never[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
  return debounced;
}

// ---------------------------------------------------------------------------
// Filter logic
// ---------------------------------------------------------------------------

interface GraphNodeData {
  data: {
    id: string;
    label: string;
    type: EntityType;
    value: string;
    confidence?: number;
    threatLevel?: string;
    createdAt?: string;
    [key: string]: unknown;
  };
  position?: { x: number; y: number };
}

interface GraphEdgeData {
  data: {
    id: string;
    source: string;
    target: string;
    type: RelationshipType;
    label: string;
    weight: number;
    createdAt?: string;
    [key: string]: unknown;
  };
}

function applyFilters(
  nodes: GraphNodeData[],
  edges: GraphEdgeData[],
  filters: {
    entityTypes: string[];
    relationshipTypes: string[];
    minConfidence: number;
    threatLevels: string[];
    timeRange: { start: string | null; end: string | null };
  }
): { filteredNodes: GraphNodeData[]; filteredEdges: GraphEdgeData[] } {
  // Filter nodes
  const filteredNodeIds = new Set<string>();
  const filteredNodes = nodes.filter((node) => {
    const d = node.data;

    // Entity type filter (empty = show all, includes __none__ = hide all)
    if (filters.entityTypes.length > 0) {
      if (filters.entityTypes.includes('__none__')) return false;
      if (!filters.entityTypes.includes(d.type)) return false;
    }

    // Confidence filter
    if (filters.minConfidence > 0) {
      const conf = d.confidence ?? 0;
      if (conf < filters.minConfidence) return false;
    }

    // Threat level filter
    if (filters.threatLevels.length > 0) {
      if (filters.threatLevels.includes('__none__')) return false;
      const tl = d.threatLevel ?? 'unknown';
      if (!filters.threatLevels.includes(tl)) return false;
    }

    filteredNodeIds.add(d.id);
    return true;
  });

  // Filter edges: only show if relationship type matches AND both endpoints are visible
  const filteredEdges = edges.filter((edge) => {
    const d = edge.data;

    // Both source and target must be visible
    if (!filteredNodeIds.has(d.source) || !filteredNodeIds.has(d.target)) {
      return false;
    }

    // Relationship type filter
    if (filters.relationshipTypes.length > 0) {
      if (filters.relationshipTypes.includes('__none__')) return false;
      if (!filters.relationshipTypes.includes(d.type)) return false;
    }

    // Time range filter (on edges via createdAt)
    if (filters.timeRange.start || filters.timeRange.end) {
      const created = d.createdAt;
      if (!created) return false;
      if (filters.timeRange.start && created < filters.timeRange.start) return false;
      if (filters.timeRange.end && created > filters.timeRange.end + 'T23:59:59') return false;
    }

    return true;
  });

  return { filteredNodes, filteredEdges };
}

// ---------------------------------------------------------------------------
// GraphCanvas Component
// ---------------------------------------------------------------------------

export default function GraphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<CytoscapeCore | null>(null);
  const dataFetchControllerRef = useRef<AbortController | null>(null);
  const rawDataRef = useRef<{ nodes: GraphNodeData[]; edges: GraphEdgeData[] }>({
    nodes: [],
    edges: [],
  });

  // Store selectors
  const currentCase = usePhantomStore((s) => s.currentCase);
  const selectedEntity = usePhantomStore((s) => s.selectedEntity);
  const setSelectedEntity = usePhantomStore((s) => s.setSelectedEntity);
  const selectedRelationship = usePhantomStore((s) => s.selectedRelationship);
  const setSelectedRelationship = usePhantomStore(
    (s) => s.setSelectedRelationship
  );
  const graphLayout = usePhantomStore((s) => s.graphLayout);
  const setGraphLayout = usePhantomStore((s) => s.setGraphLayout);
  const graphFitRequested = usePhantomStore((s) => s.graphFitRequested);
  const requestGraphFit = usePhantomStore((s) => s.requestGraphFit);
  const setQuickAddPosition = usePhantomStore((s) => s.setQuickAddPosition);
  const graphFilters = usePhantomStore((s) => s.graphFilters);

  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // ---- Active filter count for badge ----
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (graphFilters.entityTypes.length > 0) count++;
    if (graphFilters.relationshipTypes.length > 0) count++;
    if (graphFilters.minConfidence > 0) count++;
    if (graphFilters.threatLevels.length > 0) count++;
    if (graphFilters.timeRange.start || graphFilters.timeRange.end) count++;
    return count;
  }, [graphFilters]);

  // ---------------------------------------------------------------------------
  // Debounced position save
  // ---------------------------------------------------------------------------

  const debouncedPositionSaveRef = useRef(
    debounce((id: string, x: number, y: number) => {
      entitiesApi.update(id, { x, y }).catch((err) => {
        console.error('Failed to save entity position:', err);
      });
    }, 300)
  );

  // ---------------------------------------------------------------------------
  // Apply filters and update the graph
  // ---------------------------------------------------------------------------

  const applyFiltersToGraph = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const raw = rawDataRef.current;
    const { filteredNodes, filteredEdges } = applyFilters(
      raw.nodes,
      raw.edges,
      graphFilters
    );

    // Remove existing elements
    cy.elements().remove();

    // Add filtered elements
    if (filteredNodes.length > 0) {
      cy.add(filteredNodes as cytoscape.ElementDefinition[]);
    }
    if (filteredEdges.length > 0) {
      cy.add(filteredEdges as cytoscape.ElementDefinition[]);
    }

    // Fit to view
    if (filteredNodes.length > 0) {
      cy.fit(undefined, 30);
    }

    setNodeCount(filteredNodes.length);
    setEdgeCount(filteredEdges.length);
  }, [graphFilters]);

  // ---------------------------------------------------------------------------
  // Fetch graph data
  // ---------------------------------------------------------------------------

  const fetchGraphData = useCallback(
    async (caseId: string) => {
      if (!cyRef.current) return;

      setIsLoading(true);
      setError(null);

      // Cancel any in-flight request
      if (dataFetchControllerRef.current) {
        dataFetchControllerRef.current.abort();
      }
      const controller = new AbortController();
      dataFetchControllerRef.current = controller;

      try {
        const data: GraphData = await graphApi.getData(caseId);

        if (controller.signal.aborted) return;

        // Store raw data for filtering
        rawDataRef.current = {
          nodes: data.nodes as GraphNodeData[],
          edges: data.edges as GraphEdgeData[],
        };

        // Apply current filters
        const cy = cyRef.current;
        const { filteredNodes, filteredEdges } = applyFilters(
          rawDataRef.current.nodes,
          rawDataRef.current.edges,
          graphFilters
        );

        // Remove existing elements
        cy.elements().remove();

        // Add filtered elements
        if (filteredNodes.length > 0) {
          cy.add(filteredNodes as cytoscape.ElementDefinition[]);
        }
        if (filteredEdges.length > 0) {
          cy.add(filteredEdges as cytoscape.ElementDefinition[]);
        }

        // Run layout
        const layoutOpts = LAYOUT_OPTIONS[graphLayout] || LAYOUT_OPTIONS.cose;
        const onlyNodesHavePositions = filteredNodes.every(
          (n) => n.position && (n.position.x !== 0 || n.position.y !== 0)
        );

        // If all nodes have saved positions, skip layout and just fit
        if (onlyNodesHavePositions && filteredNodes.length > 0) {
          cy.fit(undefined, 30);
        } else {
          cy.layout(layoutOpts as cytoscape.LayoutOptions).run();
        }

        setNodeCount(filteredNodes.length);
        setEdgeCount(filteredEdges.length);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : 'Failed to load graph data';
        console.error('Graph data fetch error:', err);
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [graphLayout, graphFilters]
  );

  // ---------------------------------------------------------------------------
  // Initialize Cytoscape
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: buildCytoscapeStylesheet(),
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.3,
      boxSelectionEnabled: false,
    });

    cyRef.current = cy;

    // ---- Event handlers ----

    // Node tap: select entity
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeData = node.data();

      const entity: Entity = {
        id: nodeData.id,
        caseId: currentCase?.id ?? '',
        name: nodeData.label,
        type: nodeData.type,
        value: nodeData.value ?? '',
        metadata: nodeData.metadata ?? {},
        avatar: nodeData.avatar ?? '',
        color: nodeData.color ?? ENTITY_COLORS[nodeData.type as EntityType],
        x: node.position().x,
        y: node.position().y,
        notes: nodeData.notes ?? '',
        createdAt: nodeData.createdAt ?? '',
        updatedAt: '',
      };

      setSelectedEntity(entity);
      setSelectedRelationship(null);
    });

    // Edge tap: select relationship
    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      const edgeData = edge.data();

      const relationship: Relationship = {
        id: edgeData.id,
        caseId: currentCase?.id ?? '',
        sourceId: edgeData.source,
        targetId: edgeData.target,
        type: edgeData.type,
        label: edgeData.label ?? '',
        metadata: edgeData.metadata ?? {},
        weight: edgeData.weight ?? 1,
        createdAt: edgeData.createdAt ?? '',
        updatedAt: '',
      };

      setSelectedRelationship(relationship);
      setSelectedEntity(null);
    });

    // Background tap: deselect
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedEntity(null);
        setSelectedRelationship(null);
      }
    });

    // Background right-click: open quick-add entity panel
    cy.on('cxttap', (evt) => {
      if (evt.target === cy) {
        const pos = evt.position;
        if (pos) {
          setQuickAddPosition({ x: pos.x, y: pos.y });
        }
      }
    });

    // Node drag stop: save position
    cy.on('dragfree', 'node', (evt) => {
      const node = evt.target;
      const id = node.id();
      const pos = node.position();
      debouncedPositionSaveRef.current(id, pos.x, pos.y);
    });

    // Double-click background: fit graph
    cy.on('dblclick', (evt) => {
      if (evt.target === cy) {
        cy.fit(undefined, 30);
      }
    });

    // Cleanup
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch data when currentCase changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (currentCase?.id) {
      fetchGraphData(currentCase.id);
    } else {
      // Clear the graph when no case is selected
      if (cyRef.current) {
        cyRef.current.elements().remove();
      }
      rawDataRef.current = { nodes: [], edges: [] };
      setNodeCount(0);
      setEdgeCount(0);
      setError(null);
    }
  }, [currentCase?.id, fetchGraphData]);

  // ---------------------------------------------------------------------------
  // Re-apply filters when graphFilters change (without re-fetching)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!currentCase?.id) return;
    // Only re-apply if we have data already
    if (rawDataRef.current.nodes.length === 0 && rawDataRef.current.edges.length === 0) return;
    applyFiltersToGraph();
  }, [graphFilters, applyFiltersToGraph, currentCase?.id]);

  // ---------------------------------------------------------------------------
  // Re-run layout when graphLayout changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.elements().length === 0) return;

    const layoutOpts = LAYOUT_OPTIONS[graphLayout] || LAYOUT_OPTIONS.cose;
    cy.layout(layoutOpts as cytoscape.LayoutOptions).run();
  }, [graphLayout]);

  // ---------------------------------------------------------------------------
  // Fit graph when graphFitRequested changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.elements().length === 0) return;
    cy.fit(undefined, 30);
  }, [graphFitRequested]);

  // ---------------------------------------------------------------------------
  // Sync selected entity highlight in cytoscape
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // Deselect all first
    cy.elements().unselect();

    if (selectedEntity) {
      const node = cy.getElementById(selectedEntity.id);
      if (node.length > 0) {
        node.select();
      }
    }
    if (selectedRelationship) {
      const edge = cy.getElementById(selectedRelationship.id);
      if (edge.length > 0) {
        edge.select();
      }
    }
  }, [selectedEntity, selectedRelationship]);

  // ---------------------------------------------------------------------------
  // Toolbar actions
  // ---------------------------------------------------------------------------

  const handleZoomIn = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.3);
    cyRef.current?.center();
  }, []);

  const handleZoomOut = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() / 1.3);
    cyRef.current?.center();
  }, []);

  const handleFit = useCallback(() => {
    requestGraphFit();
  }, [requestGraphFit]);

  const handleLayoutChange = useCallback(
    (value: string) => {
      setGraphLayout(value as 'cose' | 'breadthfirst' | 'circle' | 'concentric' | 'grid');
    },
    [setGraphLayout]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // No case selected - empty state
  if (!currentCase) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background text-muted-foreground cyber-grid">
        <Ghost className="size-16 mb-4 opacity-30 neon-cyan" />
        <h2 className="text-xl font-semibold neon-cyan mb-2 tracking-wide">
          No Case Selected
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs text-center">
          Select or create a case to start building your investigation graph.
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-background cyber-grid">
      {/* Cytoscape container */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: 'transparent' }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-cyan-400" />
            <span className="text-sm text-cyan-400/70 tracking-wide">Loading graph…</span>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && !isLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-destructive/20 text-destructive px-4 py-2 rounded-md text-sm max-w-md text-center border border-destructive/40 font-mono">
          {error}
        </div>
      )}

      {/* Graph Filters overlay panel */}
      {showFilters && (
        <div className="absolute top-2 left-2 z-20">
          <GraphFilters onClose={() => setShowFilters(false)} />
        </div>
      )}

      {/* Floating toolbar */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        {/* Filter button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 bg-card/80 border border-cyan-500/20 text-cyan-400/70 hover:bg-cyan-500/10 hover:text-cyan-400 backdrop-blur-sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="size-3.5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-cyan-400 text-black text-[8px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Filters
          </TooltipContent>
        </Tooltip>

        {/* Layout selector */}
        <Select value={graphLayout} onValueChange={handleLayoutChange}>
          <SelectTrigger
            className="h-8 w-[140px] bg-card/80 border-cyan-500/20 text-cyan-400/70 text-xs hover:bg-cyan-500/10 backdrop-blur-sm"
            size="sm"
          >
            <Network className="size-3.5 mr-1 opacity-60" />
            <SelectValue placeholder="Layout" />
          </SelectTrigger>
          <SelectContent className="bg-card border-cyan-500/20">
            <SelectItem value="cose" className="text-cyan-50/80 text-xs focus:bg-cyan-500/10 focus:text-cyan-400">
              Force-directed
            </SelectItem>
            <SelectItem value="breadthfirst" className="text-cyan-50/80 text-xs focus:bg-cyan-500/10 focus:text-cyan-400">
              Breadth-first
            </SelectItem>
            <SelectItem value="circle" className="text-cyan-50/80 text-xs focus:bg-cyan-500/10 focus:text-cyan-400">
              Circle
            </SelectItem>
            <SelectItem value="concentric" className="text-cyan-50/80 text-xs focus:bg-cyan-500/10 focus:text-cyan-400">
              Concentric
            </SelectItem>
            <SelectItem value="grid" className="text-cyan-50/80 text-xs focus:bg-cyan-500/10 focus:text-cyan-400">
              Grid
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Fit button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-card/80 border border-cyan-500/20 text-cyan-400/70 hover:bg-cyan-500/10 hover:text-cyan-400 backdrop-blur-sm"
              onClick={handleFit}
            >
              <Maximize2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Fit graph
          </TooltipContent>
        </Tooltip>

        {/* Zoom in */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-card/80 border border-cyan-500/20 text-cyan-400/70 hover:bg-cyan-500/10 hover:text-cyan-400 backdrop-blur-sm"
              onClick={handleZoomIn}
            >
              <ZoomIn className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Zoom in
          </TooltipContent>
        </Tooltip>

        {/* Zoom out */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-card/80 border border-cyan-500/20 text-cyan-400/70 hover:bg-cyan-500/10 hover:text-cyan-400 backdrop-blur-sm"
              onClick={handleZoomOut}
            >
              <ZoomOut className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Zoom out
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Stats bar (bottom-left) */}
      {!isLoading && nodeCount > 0 && (
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3 text-xs text-muted-foreground bg-card/70 px-3 py-1.5 rounded-md backdrop-blur-sm border border-cyan-500/15 font-mono">
          <span className="neon-cyan">{nodeCount} node{nodeCount !== 1 ? 's' : ''}</span>
          <span className="text-cyan-500/20">|</span>
          <span className="neon-purple">{edgeCount} edge{edgeCount !== 1 ? 's' : ''}</span>
          {activeFilterCount > 0 && (
            <>
              <span className="text-cyan-500/20">|</span>
              <span className="text-cyan-400">{activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active</span>
            </>
          )}
        </div>
      )}

      {/* Empty graph hint */}
      {!isLoading && !error && nodeCount === 0 && currentCase && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <div className="relative mb-3">
            <Network className="size-12 text-cyan-400/30" />
            <div className="absolute inset-0 blur-xl bg-cyan-500/10 rounded-full" />
          </div>
          <p className="text-sm neon-cyan mb-1">Empty graph</p>
          <p className="text-xs text-muted-foreground max-w-xs text-center">
            Right-click on the canvas to add entities, or use the side panel to
            create new nodes and relationships.
          </p>
        </div>
      )}

      {/* Context hint (bottom-right) */}
      {!isLoading && nodeCount > 0 && (
        <div className="absolute bottom-3 right-3 z-20 text-[10px] text-muted-foreground/60 bg-card/50 px-2 py-1 rounded backdrop-blur-sm border border-cyan-500/10 font-mono">
          Right-click to add · Double-click to fit
        </div>
      )}
    </div>
  );
}
