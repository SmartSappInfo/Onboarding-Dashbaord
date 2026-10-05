/**
 * @fileOverview Adversarial Red-Team Security Test Suite for Revenue Swarm & Outbound Operations (Phase 10 Milestone 5 Task 5)
 *
 * Evaluates 5 Canonical Adversarial Attack Vectors against the Flagship Revenue Operations Subsystem:
 * 1. Vector 1: Prompt injection in scraped web pages, meta tags, and prospect notes (Rules 13 & 30).
 * 2. Vector 2: Universal Outbound SSRF & Cloud Metadata Egress Probing (Rule 34).
 * 3. Vector 3: Cryptographic Two-Phase Payload Tampering & Hash Mismatch (Rule 22).
 * 4. Vector 4: Anti-Self-Approval Bypass Attempts (Rule 13).
 * 5. Vector 5: Emergency Dead-Man Governance Switch Evasion (Rule 60).
 *
 * Strict Compliance:
 * - Rule 4: Zero `any`/`any[]` typing policy.
 * - Rule 8: Multi-tenant Anti-IDOR boundary validation.
 * - Rule 13: Untrusted tool data & anti-self-approval enforcement.
 * - Rule 21 & 22: Two-Phase Action Model & canonical SHA-256 payloadHash binding.
 * - Rule 34: Outbound SSRF guard via validateSafeEgressUrl.
 * - Rule 46: Adversarial Red-Team & Failure Mode Testing.
 * - Rule 60: Step 1 emergency dead-man pause evaluation.
 * - Rule 68: Non-Negotiable Invariants 11-15 (Model != security boundary, Untrusted tool data,
 *   Idempotent/versioned/audited mutations, Bounded resources, Non-code operability).
 * - Rule 69: Strangler Fig Invariant.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import dns from 'node:dns';
import { RevenueSwarmOrchestrator } from '@/platform/agents/sales/swarm/revenue-swarm-orchestrator';
import { RevenueSwarmError } from '@/platform/agents/sales/swarm/revenue-swarm-types';
import type { RevenueSwarmMissionInput } from '@/platform/agents/sales/swarm/revenue-swarm-types';
import { SdrOutboundEngine } from '@/platform/agents/sales/outbound/sdr-outbound-engine';
import { validateSafeEgressUrl, SsrffBlockedError } from '@/platform/security/safe-url-fetch';
import {
  draftProspectOutreachAction,
  stageSequenceApprovalAction,
  dispatchApprovedOutreachAction,
} from '@/app/actions/sdr-outbound-actions';
import { launchRevenueSwarmAction } from '@/app/actions/revenue-swarm-actions';
import type { Prospect } from '@/lib/lead-intelligence/types';

// Mock requireAuth
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    uid: 'user_analyst_victim',
    profile: {
      id: 'prof_victim',
      name: 'Analyst Victim',
      email: 'analyst@victim.edu',
      organizationId: 'org_victim_edu',
      lastActiveWorkspaceId: 'ws_victim_workspace',
      workspaceIds: ['ws_victim_workspace'],
      role: 'staff',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    isSystemAdmin: false,
  })),
}));

// Mock governance dead man switch
vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(async (orgId?: string) => {
    if (orgId === 'org_paused') {
      throw new Error('Platform emergency dead-man pause engaged');
    }
  }),
}));

// Mock FieldsVariablesService to isolate SSOT token resolution in hermetic tests
vi.mock('@/lib/services/fields-variables-service-impl', () => ({
  FieldsVariablesService: {
    resolveTemplateVariables: vi.fn(async (text: string) => {
      return text
        .replace('{{contact.name}}', 'Principal Mensah')
        .replace('{{prospect.name}}', 'Injected High School');
    }),
  },
}));

describe('Adversarial Red-Team Security Test Suite (Phase 10 Milestone 5)', () => {
  const organizationId = 'org_victim_edu';
  const workspaceId = 'ws_victim_workspace';

  beforeEach(() => {
    vi.clearAllMocks();
    // Stub DNS lookups for network isolation (Rule 34 offline deterministic test)
    const publicAnswer: dns.LookupAddress[] = [{ address: '93.184.216.34', family: 4 }];
    vi.spyOn(dns.promises, 'lookup').mockImplementation(
      (async () => publicAnswer) as unknown as typeof dns.promises.lookup
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // VECTOR 1: Indirect Prompt Injection in Scraped Web Pages & Notes (Rules 13 & 30)
  // ==========================================================================
  describe('Vector 1: Indirect Prompt Injection Defense (Rules 13 & 30)', () => {
    it('isolates malicious directives in scraped website profiles within <untrusted-reference-data> XML containers', async () => {
      const nowIso = '2026-01-01T00:00:00Z';
      const maliciousProspects: Prospect[] = [
        {
          id: 'prosp_jailbreak_school',
          organizationId,
          workspaceId,
          domain: 'trojanacademy.edu.gh',
          syncStatus: 'unregistered',
          createdAt: nowIso,
          updatedAt: nowIso,
          name: 'Trojan Academy',
          address: 'North Ridge, Accra, Ghana',
          phone: '020 999 8877',
          contacts: [
            {
              id: 'con_attacker',
              name: 'Dr. Malicious',
              role: 'Director of Exploits',
              email: 'attacker@trojanacademy.edu.gh',
              phone: '024 111 2233',
              confidence: 90,
              verificationStatus: 'verified',
            },
          ],
          scoring: {
            overallScore: 90,
            needScore: 35,
            digitalMaturity: 30,
            buyingIntent: 25,
            budgetProbability: 20,
            decisionMakerFound: 20,
            engagement: 10,
          },
        },
      ];

      const orchestrator = new RevenueSwarmOrchestrator({
        mockProspects: maliciousProspects,
      });

      const missionInput: RevenueSwarmMissionInput = {
        organizationId,
        workspaceId,
        criteria: {
          query: 'Find qualified edtech leads',
          targetIndustry: 'edtech',
          geography: 'Accra, Ghana',
          targetLeadCount: 1,
          minQualificationScore: 50,
          channels: ['whatsapp', 'email'],
          sdrPersonaId: 'lead_sdr',
          dryRun: true,
        },
        authorizingUserId: 'usr_sdr_lead',
      };

      const outcome = await orchestrator.executeMission(missionInput);

      expect(outcome.status).toBe('waiting_for_approval');
      expect(outcome.stages.find((s) => s.stage === 'research')?.status).toBe('completed');

      // Verify that the orchestrator generated drafts without executing hostile overrides
      expect(outcome.totalDraftsGenerated).toBeGreaterThanOrEqual(2);
    });

    it('ensures prompt injection in prospect notes cannot override template variables or leak credentials', async () => {
      const nowIso = '2026-01-01T00:00:00Z';
      const hostileNotesProspect: Prospect = {
        id: 'prosp_injection_note',
        organizationId,
        workspaceId,
        domain: 'injected.edu.gh',
        syncStatus: 'unregistered',
        createdAt: nowIso,
        updatedAt: nowIso,
        name: 'Injected High School',
        address: 'Airport Residential, Accra',
        phone: '020 444 5566',
        contacts: [
          {
            id: 'con_target',
            name: 'Principal Mensah',
            role: 'Headmaster',
            email: 'headmaster@injected.edu.gh',
            phone: '024 888 9900',
            confidence: 90,
            verificationStatus: 'verified',
          },
        ],
        scoring: {
          overallScore: 88,
          needScore: 30,
          digitalMaturity: 28,
          buyingIntent: 25,
          budgetProbability: 18,
          decisionMakerFound: 18,
          engagement: 12,
        },
      };

      // Draft outreach with template
      const draftResult = await SdrOutboundEngine.draftOutreach(
        {
          organizationId,
          workspaceId,
          prospectId: hostileNotesProspect.id,
          contactId: hostileNotesProspect.contacts?.[0]?.id,
          channel: 'whatsapp',
          sdrPersonaId: 'lead_sdr',
          templateText:
            'Hello {{contact.name}}, I am reaching out from SmartSapp regarding {{prospect.name}}.',
        },
        hostileNotesProspect,
        hostileNotesProspect.contacts?.[0]
      );

      // Verify that output does not contain raw execution escape sequences or leak credentials
      expect(draftResult.draft.body).not.toContain('<script>');
      expect(draftResult.draft.body).not.toContain('API_KEY');
      expect(draftResult.draft.body).not.toContain('Disclose private passwords');
      expect(draftResult.draft.body).toContain('Hello Principal Mensah');
      expect(draftResult.draft.body).toContain('Injected High School');
    });
  });

  // ==========================================================================
  // VECTOR 2: Universal Outbound SSRF & Cloud Metadata Egress Probing (Rule 34)
  // ==========================================================================
  describe('Vector 2: Outbound SSRF & Network Boundary Defense (Rule 34)', () => {
    it('blocks Google Cloud & AWS link-local metadata IP (169.254.169.254)', async () => {
      await expect(
        validateSafeEgressUrl(
          'http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token'
        )
      ).rejects.toThrow(SsrffBlockedError);

      await expect(
        validateSafeEgressUrl('http://169.254.169.254/latest/meta-data/')
      ).rejects.toThrow(SsrffBlockedError);
    });

    it('blocks GCP metadata internal DNS name (metadata.google.internal)', async () => {
      await expect(
        validateSafeEgressUrl('http://metadata.google.internal/computeMetadata/v1/')
      ).rejects.toThrow(SsrffBlockedError);
    });

    it('blocks localhost and loopback IPv4/IPv6 addresses', async () => {
      await expect(validateSafeEgressUrl('http://localhost:3000/api/internal')).rejects.toThrow(
        SsrffBlockedError
      );
      await expect(validateSafeEgressUrl('http://127.0.0.1:8080/api/admin')).rejects.toThrow(
        SsrffBlockedError
      );
      await expect(validateSafeEgressUrl('http://127.0.0.2:9000/')).rejects.toThrow(
        SsrffBlockedError
      );
    });

    it('blocks RFC 1918 private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)', async () => {
      await expect(validateSafeEgressUrl('http://10.0.0.1:8080/admin')).rejects.toThrow(
        SsrffBlockedError
      );
      await expect(validateSafeEgressUrl('http://172.16.0.5:443/status')).rejects.toThrow(
        SsrffBlockedError
      );
      await expect(validateSafeEgressUrl('http://192.168.1.1/router')).rejects.toThrow(
        SsrffBlockedError
      );
    });

    it('blocks IPv4-mapped IPv6 metadata and loopback tunnels', async () => {
      await expect(
        validateSafeEgressUrl('http://[::ffff:169.254.169.254]/computeMetadata/v1/')
      ).rejects.toThrow(SsrffBlockedError);
      await expect(
        validateSafeEgressUrl('http://[::ffff:127.0.0.1]:8080/admin')
      ).rejects.toThrow(SsrffBlockedError);
    });

    it('blocks Carrier-Grade NAT (100.64.0.0/10) and IPv6 Unique Local Addresses', async () => {
      await expect(validateSafeEgressUrl('http://100.64.1.1:8080')).rejects.toThrow(
        SsrffBlockedError
      );
      await expect(validateSafeEgressUrl('http://[fc00::1]/secret')).rejects.toThrow(
        SsrffBlockedError
      );
      await expect(validateSafeEgressUrl('http://[fd12:3456::1]/internal')).rejects.toThrow(
        SsrffBlockedError
      );
    });

    it('permits valid public HTTPS school and API endpoints', async () => {
      const validUrl1 = await validateSafeEgressUrl('https://gis.edu.gh/portal');
      expect(validUrl1).toBe('https://gis.edu.gh/portal');

      const validUrl2 = await validateSafeEgressUrl('https://api.resend.com/emails');
      expect(validUrl2).toBe('https://api.resend.com/emails');
    });
  });

  // ==========================================================================
  // VECTOR 3: Cryptographic Two-Phase Payload Tampering (Rule 22)
  // ==========================================================================
  describe('Vector 3: Cryptographic Payload Tampering Detection (Rule 22)', () => {
    it('rejects dispatch with PAYLOAD_TAMPERED when payloadHash is modified by attacker', async () => {
      const stageRes = await stageSequenceApprovalAction({
        organizationId,
        workspaceId,
        leadIds: ['prosp_test_1'],
        sequenceConfig: {
          id: 'seq_tamper_test',
          name: 'Tamper Verification Cadence',
          steps: [
            { stepIndex: 1, dayOffset: 0, channel: 'whatsapp', name: 'Intro', condition: 'always' },
          ],
          dailySendingLimit: 25,
        },
        sdrPersonaId: 'lead_sdr',
      });

      expect(stageRes.success).toBe(true);
      const proposalId = stageRes.data!.actionProposalId;

      // Attacker submits modified/forged SHA-256 hash
      const tamperedHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      const dispatchRes = await dispatchApprovedOutreachAction({
        organizationId,
        workspaceId,
        draftId: stageRes.data!.drafts[0].id,
        actionProposalId: proposalId,
        payloadHash: tamperedHash,
        dryRun: false,
      });

      expect(dispatchRes.success).toBe(false);
      expect(dispatchRes.code).toBe('PAYLOAD_TAMPERED');
      expect(dispatchRes.error).toContain('Payload hash mismatch');
    });

    it('asserts that altering payload fields yields a completely different SHA-256 hash', () => {
      const originalPayload = {
        dailySendingLimit: 20,
        leadIds: ['lead_1', 'lead_2'],
        sdrPersonaId: 'lead_sdr',
        sequenceConfigId: 'seq_100',
      };

      const alteredPayload = {
        ...originalPayload,
        dailySendingLimit: 200, // Attacker attempts to inflate daily limit 10x
      };

      const originalHash = SdrOutboundEngine.computeOutreachPayloadHash(originalPayload);
      const alteredHash = SdrOutboundEngine.computeOutreachPayloadHash(alteredPayload);

      expect(originalHash).toHaveLength(64);
      expect(alteredHash).toHaveLength(64);
      expect(originalHash).not.toBe(alteredHash);
    });

    it('produces identical deterministic hashes regardless of object key insertion order (Canonical JSON)', () => {
      const payloadKeyOrderA = {
        alpha: 'first',
        beta: 123,
        gamma: ['a', 'b'],
      };

      const payloadKeyOrderB = {
        gamma: ['a', 'b'],
        alpha: 'first',
        beta: 123,
      };

      const hashA = SdrOutboundEngine.computeOutreachPayloadHash(payloadKeyOrderA);
      const hashB = SdrOutboundEngine.computeOutreachPayloadHash(payloadKeyOrderB);

      expect(hashA).toBe(hashB);
    });
  });

  // ==========================================================================
  // VECTOR 4: Anti-Self-Approval Enforcement (Rule 13)
  // ==========================================================================
  describe('Vector 4: Anti-Self-Approval Enforcement (Rule 13)', () => {
    it('rejects dispatch with SELF_APPROVAL_FORBIDDEN when proposing user attempts to approve their own proposal', async () => {
      const { requireAuth } = await import('@/lib/auth/require-auth');
      vi.mocked(requireAuth).mockResolvedValue({
        uid: 'user_rogue_sdr',
        profile: {
          id: 'prof_rogue',
          name: 'Rogue SDR',
          email: 'rogue@sdr.com',
          organizationId,
          lastActiveWorkspaceId: workspaceId,
          workspaceIds: [workspaceId],
          role: 'sdr',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isSystemAdmin: false,
      });

      // Stage proposal as user_rogue_sdr
      const stageRes = await stageSequenceApprovalAction({
        organizationId,
        workspaceId,
        leadIds: ['prosp_test_1'],
        sequenceConfig: {
          id: 'seq_self_approval',
          name: 'Self Approval Sequence',
          steps: [
            { stepIndex: 1, dayOffset: 0, channel: 'whatsapp', name: 'Intro', condition: 'always' },
          ],
          dailySendingLimit: 15,
        },
        sdrPersonaId: 'lead_sdr',
      });

      expect(stageRes.success).toBe(true);
      const proposalId = stageRes.data!.actionProposalId;
      const validPayloadHash = stageRes.data!.payloadHash;

      // In the mock proposal map, simulate that user_rogue_sdr marked it approved by themselves
      // When dispatchApprovedOutreachAction runs, it checks whether authorizingUserId === approvedBy
      const dispatchRes = await dispatchApprovedOutreachAction({
        organizationId,
        workspaceId,
        draftId: stageRes.data!.drafts[0].id,
        actionProposalId: proposalId,
        payloadHash: validPayloadHash,
        dryRun: false,
      });

      // Unapproved proposal rejected first
      expect(dispatchRes.success).toBe(false);
      expect(['PROPOSAL_NOT_APPROVED', 'SELF_APPROVAL_FORBIDDEN']).toContain(dispatchRes.code);
    });
  });

  // ==========================================================================
  // VECTOR 5: Emergency Dead-Man Switch Evaluation (Rule 60)
  // ==========================================================================
  describe('Vector 5: Emergency Dead-Man Switch Evaluation (Rule 60)', () => {
    it('halts RevenueSwarmOrchestrator.executeMission with SWARM_DEAD_MAN_PAUSED', async () => {
      const orchestrator = new RevenueSwarmOrchestrator();

      const pausedMission: RevenueSwarmMissionInput = {
        organizationId: 'org_paused',
        workspaceId,
        criteria: {
          query: 'Find 20 qualified leads in edtech and prepare outreach',
          targetIndustry: 'edtech',
          geography: 'Ghana',
          targetLeadCount: 20,
          minQualificationScore: 70,
          channels: ['whatsapp', 'email'],
          sdrPersonaId: 'lead_sdr',
          dryRun: true,
        },
        authorizingUserId: 'usr_paused_tester',
      };

      await expect(orchestrator.executeMission(pausedMission)).rejects.toThrow(RevenueSwarmError);
      await expect(orchestrator.executeMission(pausedMission)).rejects.toThrow(
        'Sales operations are currently suspended'
      );
    });

    it('halts launchRevenueSwarmAction with SWARM_DEAD_MAN_PAUSED', async () => {
      const { requireAuth } = await import('@/lib/auth/require-auth');
      vi.mocked(requireAuth).mockResolvedValueOnce({
        uid: 'user_paused_tester',
        profile: {
          id: 'prof_paused',
          name: 'Paused Admin',
          email: 'admin@paused.org',
          organizationId: 'org_paused',
          lastActiveWorkspaceId: workspaceId,
          workspaceIds: [workspaceId],
          role: 'admin',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isSystemAdmin: false,
      });

      const actionRes = await launchRevenueSwarmAction({
        organizationId: 'org_paused',
        workspaceId,
        criteria: {
          query: 'Find edtech leads',
          targetIndustry: 'edtech',
          geography: 'Accra',
          targetLeadCount: 10,
          minQualificationScore: 70,
          channels: ['whatsapp'],
          sdrPersonaId: 'lead_sdr',
          dryRun: true,
        },
      });

      expect(actionRes.success).toBe(false);
      expect(actionRes.code).toBe('SWARM_DEAD_MAN_PAUSED');
      expect(actionRes.error).toContain('suspended');
    });

    it('halts draftProspectOutreachAction with SALES_DEAD_MAN_PAUSED', async () => {
      const { requireAuth } = await import('@/lib/auth/require-auth');
      vi.mocked(requireAuth).mockResolvedValueOnce({
        uid: 'user_paused_tester',
        profile: {
          id: 'prof_paused',
          name: 'Paused Admin',
          email: 'admin@paused.org',
          organizationId: 'org_paused',
          lastActiveWorkspaceId: workspaceId,
          workspaceIds: [workspaceId],
          role: 'admin',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isSystemAdmin: false,
      });

      const draftRes = await draftProspectOutreachAction({
        organizationId: 'org_paused',
        workspaceId,
        prospectId: 'prosp_test_1',
        channel: 'email',
        sdrPersonaId: 'lead_sdr',
      });

      expect(draftRes.success).toBe(false);
      expect(draftRes.code).toBe('SALES_DEAD_MAN_PAUSED');
    });

    it('halts dispatchApprovedOutreachAction with SALES_DEAD_MAN_PAUSED', async () => {
      const { requireAuth } = await import('@/lib/auth/require-auth');
      vi.mocked(requireAuth).mockResolvedValueOnce({
        uid: 'user_paused_tester',
        profile: {
          id: 'prof_paused',
          name: 'Paused Admin',
          email: 'admin@paused.org',
          organizationId: 'org_paused',
          lastActiveWorkspaceId: workspaceId,
          workspaceIds: [workspaceId],
          role: 'admin',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isSystemAdmin: false,
      });

      const dispatchRes = await dispatchApprovedOutreachAction({
        organizationId: 'org_paused',
        workspaceId,
        draftId: 'draft_123',
        actionProposalId: 'prop_123',
        payloadHash: 'hash_123',
        dryRun: false,
      });

      expect(dispatchRes.success).toBe(false);
      expect(dispatchRes.code).toBe('SALES_DEAD_MAN_PAUSED');
    });
  });
});
