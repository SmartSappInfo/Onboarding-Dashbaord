/**
 * @fileOverview Graph Reasoning, Influence Mapping & Advanced Relationship Analytics Engine (Phase 13 Milestone 2)
 *
 * Implements:
 * - Rule 4 (Strict Zero-`any` / `any[]` typing policy)
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Scoping)
 * - Rule 10 (Zod v4 schema validation)
 * - Rule 11 (Pure Mathematical Centrality & Decay Determinism)
 * - Rule 12 (Canonical Risk Vocabulary: L0_READ)
 * - Rule 13 & 30 (Untrusted Context XML Isolation: `<untrusted_reference_data id="...">`)
 * - Rule 40 (Domain Event Publishing via defaultEventBus)
 * - Rule 41 (Structured Explainability Grid: WHAT / WHY / IMPACT / RISK)
 * - Rule 42 (Shadow Mode Simulation Support: `dryRun: true`)
 * - Rule 48 (Structured Error Codes & HTTP Mapping)
 * - Rule 50 (Tenant-Partitioned In-Memory Caching with 3-minute TTL & Reactive EventBus Invalidation)
 * - Rule 55 (Graph Canvas Ceilings: max 80 nodes, max 150 edges, depth <= 2 or 3)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 69 (Strangler Fig Pattern Preservation)
 * - Rules 1940-1953 (The 7 Mandatory Domain Agent Deliverables)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';
import {
  MAX_GRAPH_NODES,
  MAX_GRAPH_EDGES,
  MAX_GRAPH_NEIGHBOR_DEPTH,
  MAX_GRAPH_PATH_DEPTH,
  MAX_CONTAGION_HOPS,
  GRAPH_CACHE_TTL_MS,
  KEY_DECISION_MAKER_SCORE_THRESHOLD,
  GraphNodeRecord,
  GraphEdgeRecord,
  GraphInfluenceScore,
  AnalyzeInfluenceInput,
  AnalyzeInfluenceInputRaw,
  AnalyzeInfluenceInputSchema,
  AnalyzeInfluenceResult,
  AnalyzeInfluenceResultSchema,
  DetectContagionInput,
  DetectContagionInputRaw,
  DetectContagionInputSchema,
  AccountContagionCluster,
  AccountContagionClusterSchema,
  AffectedNodeSummary,
  RiskTransmissionVector,
  FindCausalPathInput,
  FindCausalPathInputRaw,
  FindCausalPathInputSchema,
  MultiHopPathReasoning,
  MultiHopPathReasoningSchema,
  PathHop,
  StakeholderRoleCategory,
  ContagionRiskTier,
  GraphReasoningError,
} from './graph-reasoning-types';

// Non-backtracking linear regex patterns for prompt injection directives (Rule 30)
const ADVERSARIAL_DIRECTIVE_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
  /system\s+override/gi,
  /you\s+are\s+now\s+an\s+unrestricted/gi,
  /disregard\s+(all\s+)?prior\s+prompts/gi,
  /bypass\s+all\s+safety/gi,
  /reveal\s+all\s+system\s+prompts/gi,
  /exfiltrate/gi,
  /assistant\s+mode\s+deactivated/gi,
  /<system>/gi,
  /<\/system>/gi,
];

/**
 * Sanitizes untrusted strings and neutralizes prompt injection attempts (Rules 13 & 30).
 */
export function sanitizeGraphString(text: string): { sanitized: string; hadInjection: boolean } {
  let hadInjection = false;
  let result = text;

  for (const pattern of ADVERSARIAL_DIRECTIVE_PATTERNS) {
    if (pattern.test(result)) {
      hadInjection = true;
      result = result.replace(pattern, '[REDACTED_INJECTION_DIRECTIVE]');
    }
  }

  return { sanitized: result, hadInjection };
}

/**
 * Wraps untrusted narrative data in canonical XML reference containers (Rules 13 & 30).
 */
export function wrapInUntrustedXml(id: string, content: string): string {
  const { sanitized } = sanitizeGraphString(content);
  return `<untrusted_reference_data id="graph_narrative_${id}">${sanitized}</untrusted_reference_data>`;
}

export interface GraphReasoningCacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

/**
 * Pluggable Storage Adapter Contract for Graph Nodes and Edges
 */
export interface GraphStorageAdapter {
  getNode(workspaceId: string, nodeId: string): Promise<GraphNodeRecord | null>;
  getIncidentEdges(workspaceId: string, nodeId: string): Promise<GraphEdgeRecord[]>;
  getAllNodes(workspaceId: string): Promise<GraphNodeRecord[]>;
  getAllEdges(workspaceId: string): Promise<GraphEdgeRecord[]>;
  upsertNode(node: GraphNodeRecord): Promise<void>;
  upsertEdge(edge: GraphEdgeRecord): Promise<void>;
}

/**
 * In-Memory Graph Storage Implementation for Hermetic Testing & High-Speed Cache
 */
export class MemoryGraphStorageAdapter implements GraphStorageAdapter {
  private nodes = new Map<string, GraphNodeRecord>();
  private edges = new Map<string, GraphEdgeRecord>();

  async getNode(workspaceId: string, nodeId: string): Promise<GraphNodeRecord | null> {
    const node = this.nodes.get(nodeId);
    if (!node || node.workspaceId !== workspaceId) return null;
    return node;
  }

  async getIncidentEdges(workspaceId: string, nodeId: string): Promise<GraphEdgeRecord[]> {
    const results: GraphEdgeRecord[] = [];
    for (const edge of this.edges.values()) {
      if (edge.workspaceId !== workspaceId) continue;
      if (edge.source === nodeId || edge.target === nodeId) {
        results.push(edge);
      }
    }
    return results;
  }

  async getAllNodes(workspaceId: string): Promise<GraphNodeRecord[]> {
    const results: GraphNodeRecord[] = [];
    for (const node of this.nodes.values()) {
      if (node.workspaceId === workspaceId) results.push(node);
    }
    return results;
  }

  async getAllEdges(workspaceId: string): Promise<GraphEdgeRecord[]> {
    const results: GraphEdgeRecord[] = [];
    for (const edge of this.edges.values()) {
      if (edge.workspaceId === workspaceId) results.push(edge);
    }
    return results;
  }

  async upsertNode(node: GraphNodeRecord): Promise<void> {
    this.nodes.set(node.id, node);
  }

  async upsertEdge(edge: GraphEdgeRecord): Promise<void> {
    this.edges.set(edge.id, edge);
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }
}

/**
 * Hybrid Firestore + Memory Storage Adapter
 */
export class FirestoreGraphStorageAdapter implements GraphStorageAdapter {
  private memoryFallback = new MemoryGraphStorageAdapter();

  async getNode(workspaceId: string, nodeId: string): Promise<GraphNodeRecord | null> {
    if (adminDb) {
      try {
        const snap = await adminDb.collection('graph_nodes').doc(nodeId).get();
        if (snap.exists) {
          const data = snap.data() as GraphNodeRecord;
          if (data.workspaceId === workspaceId) return data;
        }
      } catch {
        // Fallback to memory
      }
    }
    return this.memoryFallback.getNode(workspaceId, nodeId);
  }

  async getIncidentEdges(workspaceId: string, nodeId: string): Promise<GraphEdgeRecord[]> {
    if (adminDb) {
      try {
        const results: GraphEdgeRecord[] = [];
        const sourceQuery = await adminDb
          .collection('graph_edges')
          .where('workspaceId', '==', workspaceId)
          .where('source', '==', nodeId)
          .limit(MAX_GRAPH_EDGES)
          .get();

        for (const doc of sourceQuery.docs) {
          results.push(doc.data() as GraphEdgeRecord);
        }

        const targetQuery = await adminDb
          .collection('graph_edges')
          .where('workspaceId', '==', workspaceId)
          .where('target', '==', nodeId)
          .limit(MAX_GRAPH_EDGES)
          .get();

        for (const doc of targetQuery.docs) {
          if (!results.some((e) => e.id === doc.id)) {
            results.push(doc.data() as GraphEdgeRecord);
          }
        }

        if (results.length > 0) return results;
      } catch {
        // Fallback
      }
    }
    return this.memoryFallback.getIncidentEdges(workspaceId, nodeId);
  }

  async getAllNodes(workspaceId: string): Promise<GraphNodeRecord[]> {
    if (adminDb) {
      try {
        const snap = await adminDb
          .collection('graph_nodes')
          .where('workspaceId', '==', workspaceId)
          .limit(MAX_GRAPH_NODES)
          .get();
        if (!snap.empty) {
          return snap.docs.map((d) => d.data() as GraphNodeRecord);
        }
      } catch {
        // Fallback
      }
    }
    return this.memoryFallback.getAllNodes(workspaceId);
  }

  async getAllEdges(workspaceId: string): Promise<GraphEdgeRecord[]> {
    if (adminDb) {
      try {
        const snap = await adminDb
          .collection('graph_edges')
          .where('workspaceId', '==', workspaceId)
          .limit(MAX_GRAPH_EDGES)
          .get();
        if (!snap.empty) {
          return snap.docs.map((d) => d.data() as GraphEdgeRecord);
        }
      } catch {
        // Fallback
      }
    }
    return this.memoryFallback.getAllEdges(workspaceId);
  }

  async upsertNode(node: GraphNodeRecord): Promise<void> {
    await this.memoryFallback.upsertNode(node);
    if (adminDb) {
      try {
        await adminDb.collection('graph_nodes').doc(node.id).set(node, { merge: true });
      } catch {
        // Hermetic fallback
      }
    }
  }

  async upsertEdge(edge: GraphEdgeRecord): Promise<void> {
    await this.memoryFallback.upsertEdge(edge);
    if (adminDb) {
      try {
        await adminDb.collection('graph_edges').doc(edge.id).set(edge, { merge: true });
      } catch {
        // Hermetic fallback
      }
    }
  }

  getMemoryFallback(): MemoryGraphStorageAdapter {
    return this.memoryFallback;
  }
}

/**
 * Pure Mathematical Stakeholder Influence Scoring Algorithm (Rule 11)
 */
export function calculateStakeholderInfluence(
  node: GraphNodeRecord,
  incidentEdges: readonly GraphEdgeRecord[],
  totalGraphNodes: number
): GraphInfluenceScore {
  const sanitizedLabel = sanitizeGraphString(node.label).sanitized;

  // 1. Degree Centrality
  const directDegree = incidentEdges.length;
  const normalizer = Math.max(1, totalGraphNodes - 1);
  const degreeCentrality = Math.min(100, Math.round((directDegree / normalizer) * 100));

  // 2. Role Category & Weight (Executive = 100, Financial = 85, Operational = 70, Technical = 65, Influencer = 50)
  const metaRole = (node.metadata?.role as string | undefined)?.toUpperCase();
  let roleCategory: StakeholderRoleCategory = 'INFLUENCER';
  let roleWeight = 50;

  if (metaRole === 'EXECUTIVE' || sanitizedLabel.toLowerCase().includes('principal') || sanitizedLabel.toLowerCase().includes('chair') || sanitizedLabel.toLowerCase().includes('director') || sanitizedLabel.toLowerCase().includes('ceo') || sanitizedLabel.toLowerCase().includes('managing')) {
    roleCategory = 'EXECUTIVE';
    roleWeight = 100;
  } else if (metaRole === 'FINANCIAL' || sanitizedLabel.toLowerCase().includes('bursar') || sanitizedLabel.toLowerCase().includes('finance') || sanitizedLabel.toLowerCase().includes('cfo')) {
    roleCategory = 'FINANCIAL';
    roleWeight = 85;
  } else if (metaRole === 'OPERATIONAL' || sanitizedLabel.toLowerCase().includes('vp') || sanitizedLabel.toLowerCase().includes('operations') || sanitizedLabel.toLowerCase().includes('manager')) {
    roleCategory = 'OPERATIONAL';
    roleWeight = 70;
  } else if (metaRole === 'TECHNICAL' || sanitizedLabel.toLowerCase().includes('it') || sanitizedLabel.toLowerCase().includes('engineer')) {
    roleCategory = 'TECHNICAL';
    roleWeight = 65;
  }

  // 3. Deal & Meeting Velocity Factors
  const dealInvolvement = typeof node.metadata?.dealInvolvement === 'number' ? node.metadata.dealInvolvement : 0;
  const dealFactor = Math.min(100, dealInvolvement * 15);

  const meetingCount = typeof node.metadata?.meetingCount === 'number' ? node.metadata.meetingCount : 0;
  const meetingFactor = Math.min(100, meetingCount * 10);

  // 4. Edge Weight Contribution
  const totalEdgeWeight = incidentEdges.reduce((acc, e) => acc + (e.weight ?? 1.0), 0);
  const averageEdgeWeight = directDegree > 0 ? totalEdgeWeight / directDegree : 0.5;

  // 5. Betweenness Approximation (heuristic based on cross-node bridges)
  const betweennessCentrality = Math.min(100, Math.round(directDegree * 15 * averageEdgeWeight));

  // 6. Composite Weighted Influence Formula (Rule 11)
  // Score = Degree (35%) + Role (30%) + Deals (20%) + Meetings (15%)
  const rawScore =
    degreeCentrality * 0.35 +
    roleWeight * 0.30 +
    dealFactor * 0.20 +
    meetingFactor * 0.15;

  const compositeInfluenceScore = Math.min(100, Math.max(0, Math.round(rawScore)));
  const authorityWeight = Math.round((roleWeight / 100) * 100) / 100;

  // 7. Key Decision Maker Flag
  const isKeyDecisionMaker =
    compositeInfluenceScore >= KEY_DECISION_MAKER_SCORE_THRESHOLD ||
    roleCategory === 'EXECUTIVE';

  // 8. Influence Drivers Breakdown
  const influenceDrivers: string[] = [];
  if (roleWeight >= 85) influenceDrivers.push(`High organizational authority (${roleCategory} role)`);
  if (directDegree >= 2) influenceDrivers.push(`High network connectivity (${directDegree} direct relationships)`);
  if (dealFactor >= 50) influenceDrivers.push(`Active revenue deal involvement (${dealInvolvement} commercial touches)`);
  if (meetingFactor >= 50) influenceDrivers.push(`High engagement meeting velocity (${meetingCount} touchpoints)`);
  if (influenceDrivers.length === 0) influenceDrivers.push('Standard organizational association');

  return {
    nodeId: node.id,
    nodeLabel: sanitizedLabel,
    nodeType: node.type,
    degreeCentrality,
    betweennessCentrality,
    compositeInfluenceScore,
    authorityWeight,
    directConnectionCount: directDegree,
    indirectConnectionCount: Math.max(0, directDegree * 2), // 2-hop approximation
    isKeyDecisionMaker,
    roleCategory,
    influenceDrivers,
  };
}

/**
 * Graph Reasoning Service Implementation
 */
export class GraphReasoningService {
  private cache = new Map<string, GraphReasoningCacheEntry<unknown>>();
  private storage: GraphStorageAdapter;

  constructor(storageAdapter?: GraphStorageAdapter) {
    this.storage = storageAdapter ?? new FirestoreGraphStorageAdapter();

    // Reactive cache invalidation via EventBus (Rule 50)
    try {
      defaultEventBus.subscribe('graph.edge.*', async () => {
        this.cache.clear();
      });
      defaultEventBus.subscribe('deal.*', async () => {
        this.cache.clear();
      });
      defaultEventBus.subscribe('crm.entity.*', async () => {
        this.cache.clear();
      });
    } catch {
      // EventBus registration fallback
    }
  }

  /**
   * Evaluates the Emergency Dead-Man Switch (Rule 60)
   */
  private async assertDeadManSwitch(organizationId: string): Promise<void> {
    try {
      await checkGovernanceDeadManSwitch(organizationId);
    } catch (err) {
      if (err instanceof AgentGovernanceEmergencyPausedError) {
        throw new GraphReasoningError(
          'GRAPH_DEAD_MAN_PAUSED',
          `Graph Reasoning operations are suspended by platform administrator for tenant '${organizationId}' (Rule 60).`,
          503
        );
      }
      throw err;
    }
  }

  /**
   * Retrieves a cached entry or computes fresh result with 3-minute TTL (Rule 50)
   */
  private async getOrSetCache<T>(
    cacheKey: string,
    computeFn: () => Promise<T>
  ): Promise<T> {
    const existing = this.cache.get(cacheKey);
    const now = Date.now();
    if (existing && existing.expiresAt > now) {
      return existing.data as T;
    }

    const fresh = await computeFn();
    this.cache.set(cacheKey, {
      data: fresh,
      cachedAt: now,
      expiresAt: now + GRAPH_CACHE_TTL_MS,
    });
    return fresh;
  }

  /**
   * 1. Analyze Decision-Maker Influence & Authority Mapping
   */
  async analyzeDecisionMakerInfluence(
    input: AnalyzeInfluenceInputRaw
  ): Promise<AnalyzeInfluenceResult> {
    const validated = AnalyzeInfluenceInputSchema.parse(input);
    await this.assertDeadManSwitch(validated.organizationId);

    const cacheKey = `${validated.organizationId}:${validated.workspaceId}:influence:${validated.entityId}`;

    return this.getOrSetCache(cacheKey, async () => {
      const rootNode = await this.storage.getNode(validated.workspaceId, validated.entityId);
      if (!rootNode) {
        throw new GraphReasoningError(
          'GRAPH_NODE_NOT_FOUND',
          `Target entity '${validated.entityId}' was not found in knowledge graph for workspace '${validated.workspaceId}'.`,
          404
        );
      }

      const allNodes = await this.storage.getAllNodes(validated.workspaceId);
      const allEdges = await this.storage.getAllEdges(validated.workspaceId);

      // BFS to find stakeholder neighborhood within Rule 55 bounds
      const maxNodes = Math.min(MAX_GRAPH_NODES, validated.maxNodes);
      const visitedNodeIds = new Set<string>([validated.entityId]);
      const neighborNodes: GraphNodeRecord[] = [];
      let clamped = false;
      const queue: Array<[string, number]> = [[validated.entityId, 0]];
      while (queue.length > 0 && neighborNodes.length < maxNodes) {
        const [currentId, depth] = queue.shift()!;
        if (depth >= MAX_GRAPH_NEIGHBOR_DEPTH) continue;

        for (const edge of allEdges) {
          if (edge.source === currentId || edge.target === currentId) {
            const neighborId = edge.source === currentId ? edge.target : edge.source;
            if (!visitedNodeIds.has(neighborId)) {
              if (neighborNodes.length >= maxNodes) {
                clamped = true;
                break;
              }
              visitedNodeIds.add(neighborId);
              const nodeRecord = allNodes.find((n) => n.id === neighborId);
              if (nodeRecord) {
                neighborNodes.push(nodeRecord);
                queue.push([neighborId, depth + 1]);
              }
            }
          }
        }
      }

      // Compute influence for every neighbor stakeholder
      const stakeholderScores: GraphInfluenceScore[] = [];
      for (const node of neighborNodes) {
        const incidentEdges = allEdges.filter(
          (e) => e.source === node.id || e.target === node.id
        );
        const score = calculateStakeholderInfluence(node, incidentEdges, allNodes.length);
        stakeholderScores.push(score);
      }

      // Sort descending by composite influence
      stakeholderScores.sort((a, b) => b.compositeInfluenceScore - a.compositeInfluenceScore);

      const keyDecisionMakerIds = stakeholderScores
        .filter((s) => s.isKeyDecisionMaker)
        .map((s) => s.nodeId);

      const result: AnalyzeInfluenceResult = {
        entityId: validated.entityId,
        entityLabel: rootNode.label,
        totalStakeholders: stakeholderScores.length,
        keyDecisionMakerCount: keyDecisionMakerIds.length,
        stakeholders: stakeholderScores,
        keyDecisionMakerIds,
        clamped: clamped || neighborNodes.length >= maxNodes,
        analyzedAt: new Date().toISOString(),
      };

      // Emit domain event (Rule 40)
      if (!validated.dryRun) {
        try {
          await defaultEventBus.publish(
            createDomainEvent({
              type: 'graph.reasoning.influence_calculated',
              source: 'graph.reasoning',
              organizationId: validated.organizationId,
              workspaceId: validated.workspaceId,
              correlationId: `corr_inf_${Date.now()}`,
              idempotencyKey: `idemp_inf_${validated.entityId}_${Date.now()}`,
              actor: { type: 'agent', id: 'supervisor' },
              entity: { type: 'entity', id: validated.entityId },
              payload: {
                entityId: validated.entityId,
                totalStakeholders: result.totalStakeholders,
                keyDecisionMakerCount: result.keyDecisionMakerCount,
              },
            })
          );
        } catch {
          // Event publish failure non-fatal
        }
      }

      return AnalyzeInfluenceResultSchema.parse(result);
    });
  }

  /**
   * 2. Detect Account Risk Contagion Clustering
   */
  async detectAccountRiskContagion(
    input: DetectContagionInputRaw
  ): Promise<AccountContagionCluster> {
    const validated = DetectContagionInputSchema.parse(input);
    await this.assertDeadManSwitch(validated.organizationId);

    const cacheKey = `${validated.organizationId}:${validated.workspaceId}:contagion:${validated.sourceEntityId}`;

    return this.getOrSetCache(cacheKey, async () => {
      const rootNode = await this.storage.getNode(validated.workspaceId, validated.sourceEntityId);
      if (!rootNode) {
        throw new GraphReasoningError(
          'GRAPH_NODE_NOT_FOUND',
          `Source entity '${validated.sourceEntityId}' was not found in knowledge graph for workspace '${validated.workspaceId}'.`,
          404
        );
      }

      const allNodes = await this.storage.getAllNodes(validated.workspaceId);
      const allEdges = await this.storage.getAllEdges(validated.workspaceId);

      const initialRisk = validated.initialRiskScore;
      const maxHops = Math.min(MAX_CONTAGION_HOPS, validated.maxHops);
      const decayFactor = 0.65;

      const visited = new Set<string>([validated.sourceEntityId]);
      const queue: [string, number, number][] = [[validated.sourceEntityId, initialRisk, 0]];

      const affectedNodes: AffectedNodeSummary[] = [];
      const transmissionVectors: RiskTransmissionVector[] = [];
      let totalExposure = 0;
      let dealCount = 0;
      let contactCount = 0;
      let entityCount = 0;

      while (queue.length > 0 && affectedNodes.length < MAX_GRAPH_NODES) {
        const [currentId, parentRisk, hop] = queue.shift()!;
        if (hop >= maxHops) continue;

        for (const edge of allEdges) {
          if (edge.source === currentId || edge.target === currentId) {
            const neighborId = edge.source === currentId ? edge.target : edge.source;
            if (!visited.has(neighborId)) {
              if (affectedNodes.length >= MAX_GRAPH_NODES) break;
              visited.add(neighborId);
              const neighborNode = allNodes.find((n) => n.id === neighborId);
              if (!neighborNode) continue;

              const edgeWeight = edge.weight ?? 0.8;
              const transmittedRisk = Math.min(
                100,
                Math.round(parentRisk * edgeWeight * Math.pow(decayFactor, hop + 1))
              );

              const associatedDealAmount =
                typeof neighborNode.metadata?.dealAmount === 'number'
                  ? neighborNode.metadata.dealAmount
                  : 0;

              totalExposure += associatedDealAmount;
              if (associatedDealAmount > 0) dealCount++;
              if (neighborNode.type === 'CONTACT') contactCount++;
              if (neighborNode.type === 'ENTITY' || neighborNode.type === 'CAMPUS') entityCount++;

              affectedNodes.push({
                nodeId: neighborNode.id,
                label: sanitizeGraphString(neighborNode.label).sanitized,
                relationship: edge.relationship,
                hopDistance: hop + 1,
                transmittedRiskScore: transmittedRisk,
                vulnerabilityFactor: Math.round(edgeWeight * 100) / 100,
                associatedDealAmount,
              });

              // Map transmission vector
              let vectorType: RiskTransmissionVector['vectorType'] = 'GEOGRAPHIC_CLUSTER';
              if (edge.relationship === 'SHARED_VENDOR') vectorType = 'SHARED_VENDOR';
              else if (edge.relationship === 'SISTER_CAMPUS') vectorType = 'SISTER_CAMPUS';
              else if (edge.relationship === 'MANAGES' || edge.relationship === 'EMPLOYED_AT') vectorType = 'COMMON_DECISION_MAKER';

              if (!transmissionVectors.some((v) => v.vectorType === vectorType)) {
                transmissionVectors.push({
                  vectorType,
                  weight: edgeWeight,
                  evidence: `Transmission via ${edge.relationship} connection to ${neighborNode.label}`,
                });
              }

              queue.push([neighborId, transmittedRisk, hop + 1]);
            }
          }
        }
      }

      // Compute composite contagion score
      const averageTransmitted =
        affectedNodes.length > 0
          ? affectedNodes.reduce((acc, n) => acc + n.transmittedRiskScore, 0) / affectedNodes.length
          : 0;
      const compositeContagionScore = Math.min(
        100,
        Math.round(initialRisk * 0.4 + averageTransmitted * 0.6)
      );

      // Risk tier
      let contagionRiskTier: ContagionRiskTier = 'LOW';
      if (compositeContagionScore >= 75 || totalExposure >= 50000) contagionRiskTier = 'CRITICAL';
      else if (compositeContagionScore >= 55) contagionRiskTier = 'ELEVATED';
      else if (compositeContagionScore >= 35) contagionRiskTier = 'MODERATE';

      // Mitigation playbook formulation
      const mitigationPlaybook: string[] = [];
      if (contagionRiskTier === 'CRITICAL' || contagionRiskTier === 'ELEVATED') {
        mitigationPlaybook.push('Stage emergency risk containment review in Approval Center');
        mitigationPlaybook.push(`Notify account executives managing ${entityCount} connected sister/client entities`);
        mitigationPlaybook.push(`Audit ${dealCount} active commercial deals totalling $${totalExposure.toLocaleString()} at exposure`);
      } else {
        mitigationPlaybook.push('Monitor connection topology weekly for risk escalation');
        mitigationPlaybook.push('Re-verify partner/vendor agreements during upcoming business reviews');
      }

      const cluster: AccountContagionCluster = {
        rootEntityId: validated.sourceEntityId,
        rootEntityLabel: rootNode.label,
        initialRiskScore: initialRisk,
        compositeContagionScore,
        contagionRiskTier,
        affectedNodes,
        riskTransmissionVectors: transmissionVectors,
        totalRevenueExposure: totalExposure,
        blastRadius: {
          entityCount,
          dealCount,
          contactCount,
        },
        mitigationPlaybook,
        clamped: affectedNodes.length >= MAX_GRAPH_NODES,
        analyzedAt: new Date().toISOString(),
      };

      // Emit domain event (Rule 40)
      if (!validated.dryRun) {
        try {
          await defaultEventBus.publish(
            createDomainEvent({
              type: 'graph.reasoning.contagion_detected',
              source: 'graph.reasoning',
              organizationId: validated.organizationId,
              workspaceId: validated.workspaceId,
              correlationId: `corr_cont_${Date.now()}`,
              idempotencyKey: `idemp_cont_${validated.sourceEntityId}_${Date.now()}`,
              actor: { type: 'agent', id: 'supervisor' },
              entity: { type: 'entity', id: validated.sourceEntityId },
              payload: {
                rootEntityId: validated.sourceEntityId,
                riskTier: cluster.contagionRiskTier,
                totalExposure: cluster.totalRevenueExposure,
                affectedCount: cluster.affectedNodes.length,
              },
            })
          );
        } catch {
          // Event publish failure non-fatal
        }
      }

      return AccountContagionClusterSchema.parse(cluster);
    });
  }

  /**
   * 3. Find Causal Relationship Path
   */
  async findCausalRelationshipPath(
    input: FindCausalPathInputRaw
  ): Promise<MultiHopPathReasoning> {
    const validated = FindCausalPathInputSchema.parse(input);
    await this.assertDeadManSwitch(validated.organizationId);

    const cacheKey = `${validated.organizationId}:${validated.workspaceId}:path:${validated.sourceNodeId}:${validated.targetNodeId}`;

    return this.getOrSetCache(cacheKey, async () => {
      const sourceNode = await this.storage.getNode(validated.workspaceId, validated.sourceNodeId);
      const targetNode = await this.storage.getNode(validated.workspaceId, validated.targetNodeId);

      const sourceLabel = sourceNode ? sanitizeGraphString(sourceNode.label).sanitized : validated.sourceNodeId;
      const targetLabel = targetNode ? sanitizeGraphString(targetNode.label).sanitized : validated.targetNodeId;

      if (!sourceNode || !targetNode) {
        const missing = !sourceNode ? validated.sourceNodeId : validated.targetNodeId;
        throw new GraphReasoningError(
          'GRAPH_NODE_NOT_FOUND',
          `Pathfinding endpoint node '${missing}' was not found in knowledge graph for workspace '${validated.workspaceId}'.`,
          404
        );
      }

      if (validated.sourceNodeId === validated.targetNodeId) {
        return MultiHopPathReasoningSchema.parse({
          sourceNodeId: validated.sourceNodeId,
          sourceLabel,
          targetNodeId: validated.targetNodeId,
          targetLabel,
          pathFound: true,
          hops: [],
          causalInferenceNarrative: wrapInUntrustedXml(
            `${validated.sourceNodeId}_identity`,
            `Source and target represent the identical entity (${sourceLabel}). No traversal needed.`
          ),
          connectionStrength: 100,
          traversalDepth: 0,
          explainabilityGrid: {
            what: `Identical entity comparison for ${sourceLabel}`,
            why: 'Source node and target node match exactly',
            impact: 'Zero hops required; immediate identity link confirmed',
            risk: 'No relational risk detected',
          },
          analyzedAt: new Date().toISOString(),
        });
      }

      const allNodes = await this.storage.getAllNodes(validated.workspaceId);
      const allEdges = await this.storage.getAllEdges(validated.workspaceId);

      const maxDepth = Math.min(MAX_GRAPH_PATH_DEPTH, validated.maxDepth);

      // BFS shortest-path with cycle avoidance: [currentId, PathHop[]]
      const queue: [string, PathHop[]][] = [[validated.sourceNodeId, []]];
      const visited = new Set<string>([validated.sourceNodeId]);
      let foundHops: PathHop[] | null = null;

      while (queue.length > 0) {
        const [currentId, currentHops] = queue.shift()!;
        if (currentHops.length >= maxDepth) continue;

        for (const edge of allEdges) {
          if (edge.source === currentId || edge.target === currentId) {
            const nextId = edge.source === currentId ? edge.target : edge.source;

            if (nextId === validated.targetNodeId) {
              const fromRecord = allNodes.find((n) => n.id === currentId);
              const toRecord = allNodes.find((n) => n.id === nextId);

              foundHops = [
                ...currentHops,
                {
                  hopIndex: currentHops.length,
                  fromNodeId: currentId,
                  fromLabel: fromRecord ? sanitizeGraphString(fromRecord.label).sanitized : currentId,
                  toNodeId: nextId,
                  toLabel: toRecord ? sanitizeGraphString(toRecord.label).sanitized : nextId,
                  relationship: edge.relationship,
                  weight: edge.weight ?? 0.8,
                },
              ];
              break;
            }

            if (!visited.has(nextId)) {
              visited.add(nextId);
              const fromRecord = allNodes.find((n) => n.id === currentId);
              const toRecord = allNodes.find((n) => n.id === nextId);

              queue.push([
                nextId,
                [
                  ...currentHops,
                  {
                    hopIndex: currentHops.length,
                    fromNodeId: currentId,
                    fromLabel: fromRecord ? sanitizeGraphString(fromRecord.label).sanitized : currentId,
                    toNodeId: nextId,
                    toLabel: toRecord ? sanitizeGraphString(toRecord.label).sanitized : nextId,
                    relationship: edge.relationship,
                    weight: edge.weight ?? 0.8,
                  },
                ],
              ]);
            }
          }
        }
        if (foundHops) break;
      }

      if (!foundHops || foundHops.length === 0) {
        return MultiHopPathReasoningSchema.parse({
          sourceNodeId: validated.sourceNodeId,
          sourceLabel,
          targetNodeId: validated.targetNodeId,
          targetLabel,
          pathFound: false,
          hops: [],
          causalInferenceNarrative: wrapInUntrustedXml(
            `${validated.sourceNodeId}_${validated.targetNodeId}_unconnected`,
            `No relationship path exists between '${sourceLabel}' and '${targetLabel}' within ${maxDepth} relational hops.`
          ),
          connectionStrength: 0,
          traversalDepth: 0,
          explainabilityGrid: {
            what: `Unconnected entity pair (${sourceLabel} -> ${targetLabel})`,
            why: `Exhausted ${visited.size} explored graph nodes up to depth ${maxDepth} without discovering incident path`,
            impact: 'Cold introduction required; zero trusted warm pathways discovered',
            risk: 'Higher outreach friction due to absence of mutual stakeholders',
          },
          analyzedAt: new Date().toISOString(),
        });
      }

      // Calculate path connection strength
      const compoundWeight = foundHops.reduce((acc, h) => acc * h.weight, 1.0);
      const connectionStrength = Math.min(100, Math.round(compoundWeight * 100));

      // Synthesize causal inference narrative
      const stepDescriptions = foundHops.map(
        (h) => `'${h.fromLabel}' ${h.relationship.toLowerCase().replace(/_/g, ' ')} '${h.toLabel}'`
      );
      const narrativeRaw = `Warm introduction path discovered across ${foundHops.length} hops: ${stepDescriptions.join(' -> ')}. Overall relationship affinity is scored at ${connectionStrength}/100.`;

      const result: MultiHopPathReasoning = {
        sourceNodeId: validated.sourceNodeId,
        sourceLabel,
        targetNodeId: validated.targetNodeId,
        targetLabel,
        pathFound: true,
        hops: foundHops,
        causalInferenceNarrative: wrapInUntrustedXml(`${validated.sourceNodeId}_${validated.targetNodeId}`, narrativeRaw),
        connectionStrength,
        traversalDepth: foundHops.length,
        explainabilityGrid: {
          what: `Warm referral route connecting ${sourceLabel} to ${targetLabel}`,
          why: `Direct intermediate bridge verified via ${foundHops[0].toLabel}`,
          impact: `Affinity score of ${connectionStrength}% provides actionable executive warm introduction opportunity`,
          risk: 'Low relational friction; communication should reference mutual context',
        },
        analyzedAt: new Date().toISOString(),
      };

      // Emit domain event (Rule 40)
      if (!validated.dryRun) {
        try {
          await defaultEventBus.publish(
            createDomainEvent({
              type: 'graph.reasoning.path_analyzed',
              source: 'graph.reasoning',
              organizationId: validated.organizationId,
              workspaceId: validated.workspaceId,
              correlationId: `corr_path_${Date.now()}`,
              idempotencyKey: `idemp_path_${validated.sourceNodeId}_${validated.targetNodeId}_${Date.now()}`,
              actor: { type: 'agent', id: 'supervisor' },
              entity: { type: 'node', id: validated.sourceNodeId },
              payload: {
                sourceNodeId: validated.sourceNodeId,
                targetNodeId: validated.targetNodeId,
                hopsCount: foundHops.length,
                connectionStrength,
              },
            })
          );
        } catch {
          // Event publish failure non-fatal
        }
      }

      return MultiHopPathReasoningSchema.parse(result);
    });
  }

  /**
   * Invalidates tenant-partitioned in-memory cache (Rule 50)
   */
  invalidateCache(organizationId?: string, workspaceId?: string, entityId?: string): void {
    if (!organizationId) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${organizationId}:`)) {
        if (!workspaceId || key.includes(`:${workspaceId}:`)) {
          if (!entityId || key.endsWith(`:${entityId}`)) {
            this.cache.delete(key);
          }
        }
      }
    }
  }

  /**
   * Direct Storage Accessor (for hermetic test population & admin seeding)
   */
  getStorage(): GraphStorageAdapter {
    return this.storage;
  }
}

// Global HMR-Safe Singleton Preservation
declare global {
  var __smartsappGraphReasoningService: GraphReasoningService | undefined;
}

export function getGraphReasoningService(adapter?: GraphStorageAdapter): GraphReasoningService {
  if (adapter) {
    globalThis.__smartsappGraphReasoningService = new GraphReasoningService(adapter);
  } else if (!globalThis.__smartsappGraphReasoningService) {
    globalThis.__smartsappGraphReasoningService = new GraphReasoningService();
  }
  return globalThis.__smartsappGraphReasoningService;
}
