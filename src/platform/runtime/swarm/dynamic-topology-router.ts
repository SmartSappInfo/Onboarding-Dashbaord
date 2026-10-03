/**
 * @fileOverview Multi-Agent Dynamic Topology Router & DAG Validator (Phase 6 Milestone 5)
 *
 * Implements:
 * - Rule 4: Zero `any`/`any[]` strict typing.
 * - Rule 9 & 23: Graph complexity ceilings (max 10 nodes, max 4 in-degree dependencies).
 * - Rule 18: TOCTOU optimistic concurrency conflict resolution.
 * - Rule 47: Kahn's algorithm for deterministic acyclicity verification and topological sorting.
 * - Dynamic branch evaluation based on intermediate step verification results.
 */

import {
  type SwarmMission,
  SwarmError,
} from './swarm-types';

export interface TopologyStage {
  stageIndex: number;
  specialistIds: string[];
}

export interface TopologyGraph {
  nodes: string[];
  stages: TopologyStage[];
  edges: Array<{ from: string; to: string }>;
}

export interface CustomDagInput {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
}

export interface DynamicBranchRule {
  conditionField: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  threshold: unknown;
  targetSpecialistId: string;
}

export interface EvaluateDynamicBranchParams {
  currentAgentId: string;
  verificationResult: {
    verified: boolean;
    observedState?: Record<string, unknown>;
    assertionDetails?: string;
  };
  branchRules: DynamicBranchRule[];
}

export interface ToctouConflictParams {
  conflictedNodeId: string;
  expectedVersion: string | number;
  observedVersion: string | number;
}

export interface ToctouResolution {
  action: 'replan_with_latest_state';
  targetNodeId: string;
  reason: string;
}

export class DynamicTopologyRouter {
  public static readonly MAX_NODES = 10;
  public static readonly MAX_IN_DEGREE = 4;

  /**
   * Builds and topologically orders the execution stages for a swarm mission.
   */
  public buildTopologyGraph(mission: SwarmMission): TopologyGraph {
    switch (mission.topology) {
      case 'hierarchical': {
        const supervisorId = mission.supervisorPersonaId ?? 'supervisor';
        const nodes = [supervisorId, ...mission.specialistPersonaIds];
        const edges = mission.specialistPersonaIds.map((specId) => ({
          from: supervisorId,
          to: specId,
        }));

        this.validateCustomDag({ nodes, edges });

        return {
          nodes,
          stages: [
            { stageIndex: 0, specialistIds: [supervisorId] },
            { stageIndex: 1, specialistIds: [...mission.specialistPersonaIds] },
          ],
          edges,
        };
      }

      case 'pipeline': {
        const nodes = [...mission.specialistPersonaIds];
        const edges: Array<{ from: string; to: string }> = [];
        const stages: TopologyStage[] = [];

        for (let i = 0; i < nodes.length; i++) {
          stages.push({
            stageIndex: i,
            specialistIds: [nodes[i]],
          });
          if (i > 0) {
            edges.push({ from: nodes[i - 1], to: nodes[i] });
          }
        }

        this.validateCustomDag({ nodes, edges });

        return { nodes, stages, edges };
      }

      case 'mesh_consensus': {
        const nodes = [...mission.specialistPersonaIds];
        this.validateCustomDag({ nodes, edges: [] });

        return {
          nodes,
          stages: [{ stageIndex: 0, specialistIds: nodes }],
          edges: [],
        };
      }

      case 'dynamic_dag': {
        const nodes = [...mission.specialistPersonaIds];
        const edges: Array<{ from: string; to: string }> = [];
        this.validateCustomDag({ nodes, edges });

        return {
          nodes,
          stages: [{ stageIndex: 0, specialistIds: nodes }],
          edges,
        };
      }

      default: {
        const _exhaustive: never = mission.topology;
        throw new SwarmError('INVALID_SWARM_STATE', `Unknown topology: ${_exhaustive}`);
      }
    }
  }

  /**
   * Validates a custom DAG against resource ceilings and asserts acyclicity via Kahn's algorithm (Rule 47).
   */
  public validateCustomDag(input: CustomDagInput): void {
    if (input.nodes.length > DynamicTopologyRouter.MAX_NODES) {
      throw new SwarmError(
        'TOPOLOGY_CYCLE_DETECTED',
        `Maximum agent nodes exceeded (${input.nodes.length} > ${DynamicTopologyRouter.MAX_NODES})`
      );
    }

    // Compute in-degrees and check maximum dependency bounds (Rule 23)
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of input.nodes) {
      inDegree.set(node, 0);
      adjacency.set(node, []);
    }

    for (const edge of input.edges) {
      if (!inDegree.has(edge.to) || !inDegree.has(edge.from)) {
        throw new SwarmError(
          'TOPOLOGY_CYCLE_DETECTED',
          `Edge references undefined node: ${edge.from} -> ${edge.to}`
        );
      }
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
      adjacency.get(edge.from)!.push(edge.to);

      if ((inDegree.get(edge.to) ?? 0) > DynamicTopologyRouter.MAX_IN_DEGREE) {
        throw new SwarmError(
          'TOPOLOGY_CYCLE_DETECTED',
          `Node "${edge.to}" exceeds maximum in-degree dependencies (${DynamicTopologyRouter.MAX_IN_DEGREE})`
        );
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [node, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(node);
      }
    }

    let visitedCount = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      visitedCount++;

      for (const neighbor of adjacency.get(current) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (visitedCount !== input.nodes.length) {
      throw new SwarmError('TOPOLOGY_CYCLE_DETECTED', 'Topology cycle detected in multi-agent DAG');
    }
  }

  /**
   * Evaluates dynamic conditional branching based on intermediate step verification results.
   */
  public evaluateDynamicBranch(params: EvaluateDynamicBranchParams): string | null {
    const observed = params.verificationResult.observedState ?? {};

    for (const rule of params.branchRules) {
      const val = observed[rule.conditionField];
      let matches = false;

      switch (rule.operator) {
        case 'eq':
          matches = val === rule.threshold;
          break;
        case 'neq':
          matches = val !== rule.threshold;
          break;
        case 'gt':
          matches = typeof val === 'number' && typeof rule.threshold === 'number' && val > rule.threshold;
          break;
        case 'gte':
          matches = typeof val === 'number' && typeof rule.threshold === 'number' && val >= rule.threshold;
          break;
        case 'lt':
          matches = typeof val === 'number' && typeof rule.threshold === 'number' && val < rule.threshold;
          break;
        case 'lte':
          matches = typeof val === 'number' && typeof rule.threshold === 'number' && val <= rule.threshold;
          break;
        case 'contains':
          if (Array.isArray(val)) {
            matches = val.includes(rule.threshold);
          } else if (typeof val === 'string' && typeof rule.threshold === 'string') {
            matches = val.includes(rule.threshold);
          }
          break;
      }

      if (matches) {
        return rule.targetSpecialistId;
      }
    }

    return null;
  }

  /**
   * Handles TOCTOU optimistic concurrency conflicts by producing a structured resolution (Rule 18).
   */
  public handleToctouConflict(params: ToctouConflictParams): ToctouResolution {
    return {
      action: 'replan_with_latest_state',
      targetNodeId: params.conflictedNodeId,
      reason: `TOCTOU Conflict: expected version ${params.expectedVersion}, observed ${params.observedVersion}.`,
    };
  }
}
