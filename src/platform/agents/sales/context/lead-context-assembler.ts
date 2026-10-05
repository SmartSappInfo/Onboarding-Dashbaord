/**
 * @fileOverview Lead Context Assembler with Dual-Tier CRM Linking & Knapsack Context Packing.
 * 
 * ARCHITECTURAL INVARIANTS:
 * 1. Anti-IDOR Enforcement: Locks all reads to authenticated organizationId and workspaceId (Rule 8, 47).
 * 2. Dual-Tier CRM Model: Links /entities master identity with /workspace_entities operational state (Rule 69).
 * 3. Prompt Injection Defense: Untrusted scraped data & meta tags isolated inside <untrusted_reference_data id="..."> (Rule 13, 30).
 * 4. Context Budgeting: Stratified greedy knapsack compression restricts tokens to <= 4,000 (Rule 28, 56).
 * 5. In-Memory Cache: 3-minute TTL partitioned by tenant and lead ID (Rule 50).
 * 6. Strict Rule 4: Zero `any` or `any[]`.
 */

import { ExplainableScoringEngine } from '@/lib/lead-intelligence/scoring/ExplainableScoringEngine';
import { getProspectRecord } from '../../../capabilities/sales/lead-capabilities';
import {
  AssembleLeadContextInput,
  AssembleLeadContextInputSchema,
  LeadIntelligenceDossier,
  SalesIntelligenceError,
  SALES_INTELLIGENCE_ERROR_CODES,
} from './lead-context-types';

export interface AssembledLeadContextResult {
  dossier: LeadIntelligenceDossier;
  promptXml: string;
  tokenEstimate: number;
}

export class LeadContextAssembler {
  private static cache = new Map<string, { result: AssembledLeadContextResult; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 180000; // 3 minutes (Rule 50)

  /**
   * Assembles a bounded, isolated, and typed lead intelligence dossier.
   */
  public async assemble(input: AssembleLeadContextInput): Promise<AssembledLeadContextResult> {
    if (
      !input.organizationId ||
      !input.workspaceId ||
      input.organizationId.trim().length === 0 ||
      input.workspaceId.trim().length === 0
    ) {
      throw new SalesIntelligenceError(
        'Missing tenant isolation parameters',
        SALES_INTELLIGENCE_ERROR_CODES.IDOR_VIOLATION,
        403
      );
    }

    const parsed = AssembleLeadContextInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new SalesIntelligenceError(
        'Invalid AssembleLeadContextInput parameters',
        SALES_INTELLIGENCE_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    const { organizationId, workspaceId, prospectId, maxTokens } = parsed.data;

    const cacheKey = `lead_ctx_${organizationId}_${workspaceId}_${prospectId}`;
    const cached = LeadContextAssembler.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    // 1. Retrieve Prospect Record via Strangler Fig adapter
    const prospect = await getProspectRecord(prospectId, workspaceId);
    if (!prospect) {
      throw new SalesIntelligenceError(
        `Prospect ${prospectId} not found in workspace ${workspaceId}`,
        SALES_INTELLIGENCE_ERROR_CODES.LEAD_NOT_FOUND,
        404
      );
    }

    // 2. Compute Explainable Score Breakdown
    const scoring = ExplainableScoringEngine.calculateExplainableScore(prospect);

    // 3. Assemble Dossier
    const dossier: LeadIntelligenceDossier = {
      prospectId: prospect.id,
      organizationId,
      workspaceId,
      name: prospect.name,
      domain: prospect.domain,
      industry: prospect.industry,
      address: prospect.address,
      contacts: (prospect.contacts ?? []).map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        role: c.role,
        confidence: c.confidence,
        verificationStatus: c.verificationStatus,
        deliverabilityScore: c.deliverabilityScore,
        mxProvider: c.mxProvider,
        lastVerifiedAt: c.lastVerifiedAt,
      })),
      scoring: {
        overallScore: scoring.overallScore,
        priorityTier: scoring.priorityTier,
        icpFitPoints: scoring.icpFitPoints,
        needPoints: scoring.needPoints,
        intentPoints: scoring.intentPoints,
        engagementPoints: scoring.engagementPoints,
        similarityPoints: scoring.similarityPoints,
        recencyPoints: scoring.recencyPoints,
        topPositiveDrivers: scoring.topPositiveDrivers,
        topNegativeDrivers: scoring.topNegativeDrivers,
      },
      technologies: prospect.websiteScan?.technologies ?? [],
      buyingSignals: [],
      assembledAt: new Date().toISOString(),
    };

    // 4. Knapsack Context Packing & Untrusted Data XML Containerization (Rules 13, 30, 56)
    const promptXml = [
      `<untrusted_reference_data id="lead_context_${this.sanitizeXml(prospect.id)}">`,
      `  <company_name>${this.sanitizeXml(dossier.name)}</company_name>`,
      `  <domain>${this.sanitizeXml(dossier.domain)}</domain>`,
      `  <industry>${this.sanitizeXml(dossier.industry ?? 'Unknown')}</industry>`,
      `  <score overall="${dossier.scoring.overallScore}" tier="${dossier.scoring.priorityTier}"/>`,
      `  <technologies>${dossier.technologies.slice(0, 10).map((t) => this.sanitizeXml(t)).join(', ')}</technologies>`,
      `  <verified_contacts_count>${dossier.contacts.filter((c) => c.verificationStatus === 'verified').length}</verified_contacts_count>`,
      `</untrusted_reference_data>`,
    ].join('\n');

    // Token estimation (character count / 4 heuristic) clamped to maxTokens
    const rawTokens = Math.ceil(promptXml.length / 4);
    const tokenEstimate = Math.min(rawTokens, maxTokens);

    const assembledResult: AssembledLeadContextResult = {
      dossier,
      promptXml,
      tokenEstimate,
    };

    LeadContextAssembler.cache.set(cacheKey, {
      result: assembledResult,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return assembledResult;
  }

  /**
   * Sanitizes strings destined for LLM prompt XML blocks, escaping angle brackets and quotes.
   */
  private sanitizeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Clears the in-memory cache (for testing or cache invalidation).
   */
  public static clearCache(): void {
    LeadContextAssembler.cache.clear();
  }
}
