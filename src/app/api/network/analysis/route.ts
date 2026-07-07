import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, analysisType } = body;

    if (!caseId) {
      return NextResponse.json(
        { error: 'caseId is required' },
        { status: 400 }
      );
    }

    const type = analysisType || 'centrality';
    const validTypes = ['centrality', 'community', 'disruption'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid analysisType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch all entities and relationships for the case
    const [entities, relationships] = await Promise.all([
      db.entity.findMany({
        where: { caseId },
        select: { id: true, name: true, type: true, confidence: true, threatLevel: true },
      }),
      db.relationship.findMany({
        where: { caseId },
        select: { id: true, sourceId: true, targetId: true, type: true, weight: true },
      }),
    ]);

    if (entities.length === 0) {
      return NextResponse.json({
        caseId,
        analysisType: type,
        results: { message: 'No entities found for analysis' },
      });
    }

    // Build adjacency structures
    const nodeIds = entities.map((e) => e.id);
    const nodeIndexMap = new Map<string, number>();
    nodeIds.forEach((id, index) => nodeIndexMap.set(id, index));

    const n = nodeIds.length;
    // Adjacency matrix (weighted, undirected for centrality)
    const adjacency: number[][] = Array.from({ length: n }, () =>
      Array(n).fill(0)
    );

    for (const rel of relationships) {
      const srcIdx = nodeIndexMap.get(rel.sourceId);
      const tgtIdx = nodeIndexMap.get(rel.targetId);
      if (srcIdx !== undefined && tgtIdx !== undefined) {
        adjacency[srcIdx][tgtIdx] += rel.weight;
        adjacency[tgtIdx][srcIdx] += rel.weight; // Undirected
      }
    }

    let results: Record<string, unknown>;

    if (type === 'centrality') {
      results = computeCentrality(entities, adjacency, nodeIds, n);
    } else if (type === 'community') {
      results = computeCommunities(entities, adjacency, nodeIds, n);
    } else {
      results = computeDisruption(entities, relationships, adjacency, nodeIds, n);
    }

    await createAuditLog('analysis', 'NetworkAnalysis', {
      caseId,
      analysisType: type,
      entityCount: entities.length,
      relationshipCount: relationships.length,
    });

    return NextResponse.json({
      caseId,
      analysisType: type,
      entityCount: entities.length,
      relationshipCount: relationships.length,
      results,
    });
  } catch (error) {
    console.error('Network analysis failed:', error);
    return NextResponse.json(
      { error: 'Network analysis failed' },
      { status: 500 }
    );
  }
}

interface EntityInfo {
  id: string;
  name: string;
  type: string;
  confidence: number;
  threatLevel: string;
}

function computeCentrality(
  entities: EntityInfo[],
  adjacency: number[][],
  nodeIds: string[],
  n: number
): Record<string, unknown> {
  // Degree centrality
  const degreeCentrality = entities.map((entity, i) => {
    const degree = adjacency[i].reduce((sum, w) => sum + w, 0);
    const maxDegree = Math.max(n - 1, 1);
    return {
      entityId: entity.id,
      name: entity.name,
      type: entity.type,
      degree: degree,
      degreeCentrality: degree / maxDegree,
    };
  });

  // Betweenness centrality (Brandes algorithm simplified)
  const betweenness = Array(n).fill(0);
  for (let s = 0; s < n; s++) {
    const stack: number[] = [];
    const predecessors: number[][] = Array.from({ length: n }, () => []);
    const sigma = Array(n).fill(0);
    sigma[s] = 1;
    const dist = Array(n).fill(-1);
    dist[s] = 0;
    const queue: number[] = [s];

    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      for (let w = 0; w < n; w++) {
        if (adjacency[v][w] > 0) {
          if (dist[w] < 0) {
            queue.push(w);
            dist[w] = dist[v] + 1;
          }
          if (dist[w] === dist[v] + 1) {
            sigma[w] += sigma[v];
            predecessors[w].push(v);
          }
        }
      }
    }

    const delta = Array(n).fill(0);
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of predecessors[w]) {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      if (w !== s) {
        betweenness[w] += delta[w];
      }
    }
  }

  // Normalize betweenness
  const maxBetweenness =
    n > 2 ? ((n - 1) * (n - 2)) / 2 : 1;
  const betweennessCentrality = entities.map((entity, i) => ({
    entityId: entity.id,
    name: entity.name,
    type: entity.type,
    betweenness: betweenness[i],
    betweennessCentrality: betweenness[i] / maxBetweenness,
  }));

  // Eigenvector centrality (power iteration)
  const eigenVector = computeEigenvectorCentrality(adjacency, n, 100);

  const eigenvectorCentrality = entities.map((entity, i) => ({
    entityId: entity.id,
    name: entity.name,
    type: entity.type,
    eigenvector: eigenVector[i],
  }));

  // PageRank
  const pageRankScores = pageRank(adjacency, n, 0.85, 100);

  const pageRankResults = entities.map((entity, i) => ({
    entityId: entity.id,
    name: entity.name,
    type: entity.type,
    pageRank: pageRankScores[i],
  }));

  // Top influential nodes (composite score)
  const composite = entities.map((entity, i) => {
    const dc = degreeCentrality[i].degreeCentrality;
    const bc = betweennessCentrality[i].betweennessCentrality;
    const ec = eigenVector[i];
    const pr = pageRankScores[i];
    return {
      entityId: entity.id,
      name: entity.name,
      type: entity.type,
      confidence: entity.confidence,
      threatLevel: entity.threatLevel,
      scores: {
        degreeCentrality: Math.round(dc * 1000) / 1000,
        betweennessCentrality: Math.round(bc * 1000) / 1000,
        eigenvectorCentrality: Math.round(ec * 1000) / 1000,
        pageRank: Math.round(pr * 1000) / 1000,
      },
      compositeScore:
        Math.round(
          (dc * 0.3 + bc * 0.3 + ec * 0.2 + pr * 0.2) * 1000
        ) / 1000,
    };
  });

  composite.sort((a, b) => b.compositeScore - a.compositeScore);

  return {
    topInfluential: composite.slice(0, 20),
    degreeCentrality: degreeCentrality.sort(
      (a, b) => b.degreeCentrality - a.degreeCentrality
    ),
    betweennessCentrality: betweennessCentrality.sort(
      (a, b) => b.betweennessCentrality - a.betweennessCentrality
    ),
    eigenvectorCentrality: eigenvectorCentrality.sort(
      (a, b) => b.eigenvector - a.eigenvector
    ),
    pageRank: pageRankResults.sort((a, b) => b.pageRank - a.pageRank),
  };
}

function computeEigenvectorCentrality(
  adjacency: number[][],
  n: number,
  iterations: number
): number[] {
  let vector = Array(n).fill(1 / n);

  for (let iter = 0; iter < iterations; iter++) {
    const newVector = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        newVector[i] += adjacency[i][j] * vector[j];
      }
    }

    // Normalize
    const norm = Math.sqrt(
      newVector.reduce((sum, v) => sum + v * v, 0)
    );
    if (norm > 0) {
      vector = newVector.map((v) => v / norm);
    }
  }

  return vector;
}

function pageRank(
  adjacency: number[][],
  n: number,
  damping: number,
  iterations: number
): number[] {
  // Build out-degree
  const outDegree = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (adjacency[i][j] > 0) outDegree[i]++;
    }
  }

  let ranks = Array(n).fill(1 / n);

  for (let iter = 0; iter < iterations; iter++) {
    const newRanks = Array(n).fill((1 - damping) / n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (adjacency[j][i] > 0 && outDegree[j] > 0) {
          newRanks[i] += damping * (ranks[j] / outDegree[j]);
        }
      }
    }
    ranks = newRanks;
  }

  return ranks;
}

function computeCommunities(
  entities: EntityInfo[],
  adjacency: number[][],
  nodeIds: string[],
  n: number
): Record<string, unknown> {
  // Label propagation algorithm for community detection
  const labels = entities.map((_, i) => i);

  let changed = true;
  let maxIterations = 100;
  while (changed && maxIterations > 0) {
    changed = false;
    maxIterations--;

    for (let i = 0; i < n; i++) {
      const neighborLabels: Record<number, number> = {};
      for (let j = 0; j < n; j++) {
        if (adjacency[i][j] > 0) {
          const label = labels[j];
          neighborLabels[label] = (neighborLabels[label] || 0) + adjacency[i][j];
        }
      }

      if (Object.keys(neighborLabels).length > 0) {
        const maxLabel = Object.entries(neighborLabels).sort(
          ([, a], [, b]) => b - a
        )[0][0];
        const newLabel = parseInt(maxLabel, 10);
        if (labels[i] !== newLabel) {
          labels[i] = newLabel;
          changed = true;
        }
      }
    }
  }

  // Group entities by community
  const communities: Record<number, Array<{
    entityId: string;
    name: string;
    type: string;
  }>> = {};
  for (let i = 0; i < n; i++) {
    const label = labels[i];
    if (!communities[label]) communities[label] = [];
    communities[label].push({
      entityId: entities[i].id,
      name: entities[i].name,
      type: entities[i].type,
    });
  }

  // Compute community metrics
  const communityList = Object.entries(communities).map(
    ([label, members]) => {
      const memberIds = new Set(members.map((m) => m.entityId));
      let internalEdges = 0;
      let externalEdges = 0;

      for (let i = 0; i < n; i++) {
        if (!memberIds.has(nodeIds[i])) continue;
        for (let j = i + 1; j < n; j++) {
          if (adjacency[i][j] > 0) {
            if (memberIds.has(nodeIds[j])) {
              internalEdges++;
            } else {
              externalEdges++;
            }
          }
        }
      }

      return {
        communityId: parseInt(label, 10),
        size: members.length,
        members,
        internalEdges,
        externalEdges,
        density:
          members.length > 1
            ? (2 * internalEdges) / (members.length * (members.length - 1))
            : 0,
        conductance:
          internalEdges + externalEdges > 0
            ? externalEdges / (internalEdges + externalEdges)
            : 1,
      };
    }
  );

  communityList.sort((a, b) => b.size - a.size);

  return {
    communityCount: communityList.length,
    communities: communityList,
    modularity: computeModularity(adjacency, labels, n),
  };
}

function computeModularity(
  adjacency: number[][],
  labels: number[],
  n: number
): number {
  const totalWeight = adjacency.reduce(
    (sum, row) => sum + row.reduce((s, v) => s + v, 0),
    0
  ) / 2;

  if (totalWeight === 0) return 0;

  const degree = adjacency.map((row) =>
    row.reduce((s, v) => s + v, 0)
  );

  let q = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (labels[i] === labels[j]) {
        q +=
          adjacency[i][j] - (degree[i] * degree[j]) / (2 * totalWeight);
      }
    }
  }

  return Math.round((q / (2 * totalWeight)) * 1000) / 1000;
}

function computeDisruption(
  entities: EntityInfo[],
  relationships: { id: string; sourceId: string; targetId: string; type: string; weight: number }[],
  adjacency: number[][],
  nodeIds: string[],
  n: number
): Record<string, unknown> {
  // Calculate the impact of removing each node
  const baseConnectivity = countConnectedPairs(adjacency, n);

  const disruptionScores = entities.map((entity, i) => {
    // Remove node i and recalculate connectivity
    const modifiedAdj = adjacency.map((row) => [...row]);
    for (let j = 0; j < n; j++) {
      modifiedAdj[i][j] = 0;
      modifiedAdj[j][i] = 0;
    }

    const newConnectivity = countConnectedPairs(modifiedAdj, n);
    const disruption =
      baseConnectivity > 0
        ? (baseConnectivity - newConnectivity) / baseConnectivity
        : 0;

    // Calculate the degree of this node
    const degree = adjacency[i].reduce((sum, w) => sum + w, 0);

    // Calculate clustering coefficient
    const neighbors: number[] = [];
    for (let j = 0; j < n; j++) {
      if (adjacency[i][j] > 0) neighbors.push(j);
    }

    let triangles = 0;
    for (let a = 0; a < neighbors.length; a++) {
      for (let b = a + 1; b < neighbors.length; b++) {
        if (adjacency[neighbors[a]][neighbors[b]] > 0) triangles++;
      }
    }
    const maxTriangles =
      neighbors.length > 1
        ? (neighbors.length * (neighbors.length - 1)) / 2
        : 1;
    const clusteringCoeff = triangles / maxTriangles;

    return {
      entityId: entity.id,
      name: entity.name,
      type: entity.type,
      confidence: entity.confidence,
      threatLevel: entity.threatLevel,
      degree,
      clusteringCoefficient: Math.round(clusteringCoeff * 1000) / 1000,
      disruptionScore: Math.round(disruption * 1000) / 1000,
      recommendedAction: disruption > 0.3
        ? 'CRITICAL - High impact removal point'
        : disruption > 0.1
          ? 'MODERATE - Significant impact'
          : 'LOW - Limited network impact',
    };
  });

  disruptionScores.sort(
    (a, b) => b.disruptionScore - a.disruptionScore
  );

  // Find bridge edges (edges whose removal disconnects components)
  const bridges: Array<{
    sourceId: string;
    sourceName: string;
    targetId: string;
    targetName: string;
    type: string;
    bridgeScore: number;
  }> = [];

  for (const rel of relationships) {
    const srcIdx = nodeIds.indexOf(rel.sourceId);
    const tgtIdx = nodeIds.indexOf(rel.targetId);
    if (srcIdx >= 0 && tgtIdx >= 0) {
      // Temporarily remove edge
      const origWeight = adjacency[srcIdx][tgtIdx];
      adjacency[srcIdx][tgtIdx] = 0;
      adjacency[tgtIdx][srcIdx] = 0;

      const newConnectivity = countConnectedPairs(adjacency, n);
      const bridgeScore =
        baseConnectivity > 0
          ? (baseConnectivity - newConnectivity) / baseConnectivity
          : 0;

      // Restore edge
      adjacency[srcIdx][tgtIdx] = origWeight;
      adjacency[tgtIdx][srcIdx] = origWeight;

      if (bridgeScore > 0) {
        const srcEntity = entities.find((e) => e.id === rel.sourceId);
        const tgtEntity = entities.find((e) => e.id === rel.targetId);
        bridges.push({
          sourceId: rel.sourceId,
          sourceName: srcEntity?.name || '',
          targetId: rel.targetId,
          targetName: tgtEntity?.name || '',
          type: rel.type,
          bridgeScore: Math.round(bridgeScore * 1000) / 1000,
        });
      }
    }
  }

  bridges.sort((a, b) => b.bridgeScore - a.bridgeScore);

  return {
    optimalRemovalPoints: disruptionScores.slice(0, 15),
    bridgeEdges: bridges.slice(0, 15),
    baseConnectivity,
    totalNodes: n,
    totalRelationships: relationships.length,
  };
}

function countConnectedPairs(adjacency: number[][], n: number): number {
  // Count pairs of nodes that are connected (directly or indirectly)
  const visited = Array(n).fill(false);
  let pairs = 0;

  for (let start = 0; start < n; start++) {
    if (visited[start]) continue;

    // BFS to find connected component
    const component: number[] = [];
    const queue = [start];
    visited[start] = true;

    while (queue.length > 0) {
      const node = queue.shift()!;
      component.push(node);

      for (let j = 0; j < n; j++) {
        if (adjacency[node][j] > 0 && !visited[j]) {
          visited[j] = true;
          queue.push(j);
        }
      }
    }

    pairs += (component.length * (component.length - 1)) / 2;
  }

  return pairs;
}
