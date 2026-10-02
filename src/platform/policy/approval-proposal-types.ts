/**
 * @fileOverview Canonical Action Proposal Contracts & Schemas (Phase 3 Milestone 3 & 4)
 *
 * Implements Rule 4 (Zero any & Anti-IDOR), Rule 8 (Fail-Closed Architecture),
 * Rule 21 & 41 (Action Proposal Structure: WHAT, WHY, WHO, BLAST RADIUS, EVIDENCE),
 * Rule 22 (Cryptographic Payload Binding), and Rule 40 (Audit Log Immutability).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import { AGENT_PERSONA_IDS } from '../identity/agent-persona-types';

export const ACTION_PROPOSAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'bound',
  'expired',
  'revoked',
] as const;

export type ActionProposalStatus = (typeof ACTION_PROPOSAL_STATUSES)[number];

export const APPROVAL_ERROR_CODES = [
  'PROPOSAL_NOT_FOUND',
  'PROPOSAL_EXPIRED',
  'PROPOSAL_ALREADY_DECIDED',
  'PROPOSAL_ALREADY_BOUND',
  'UNAUTHORIZED_APPROVER',
  'SELF_APPROVAL_FORBIDDEN',
  'PAYLOAD_TAMPERED',
  'EMERGENCY_PAUSED',
  'TENANT_MISMATCH',
] as const;

export type ApprovalErrorCode = (typeof APPROVAL_ERROR_CODES)[number];

export const BlastRadiusSchema = z.object({
  entityCount: z.number().int().min(0),
  entityType: z.string().min(1),
  estimatedCostUsd: z.number().min(0).optional(),
  riskLevel: z.string().min(1),
  affectedTenants: z.array(z.string()).optional(),
  targetSummary: z.string().optional(),
});

export type BlastRadius = z.infer<typeof BlastRadiusSchema>;

export const ActionProposalSchema = z.object({
  proposalId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  capabilityId: z.string().min(1),
  capabilityVersion: z.string().min(1),
  agentPersonaId: z.enum(AGENT_PERSONA_IDS),
  authorizingUserId: z.string().min(1),
  delegationId: z.string().optional(),
  delegationChain: z.array(z.string()).optional(),
  toolInvocationId: z.string().optional(),
  what: z.string().min(1),
  why: z.string().min(1),
  blastRadius: BlastRadiusSchema.optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  payload: z.record(z.string(), z.unknown()),
  payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.enum(ACTION_PROPOSAL_STATUSES).default('pending'),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  decisionNotes: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  rejectedBy: z.string().optional(),
  rejectedAt: z.string().datetime().optional(),
  boundToolInvocationId: z.string().optional(),
  boundAt: z.string().datetime().optional(),
});

export type ActionProposal = z.infer<typeof ActionProposalSchema>;

export const CreateProposalInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  capabilityId: z.string().min(1),
  capabilityVersion: z.string().min(1),
  agentPersonaId: z.enum(AGENT_PERSONA_IDS),
  authorizingUserId: z.string().min(1),
  delegationId: z.string().optional(),
  delegationChain: z.array(z.string()).optional(),
  toolInvocationId: z.string().optional(),
  what: z.string().min(1),
  why: z.string().min(1),
  blastRadius: BlastRadiusSchema.optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  payload: z.record(z.string(), z.unknown()),
  ttlSeconds: z.number().int().min(60).max(604800).optional(),
});

export type CreateProposalInput = z.infer<typeof CreateProposalInputSchema>;

export const ProposalDecisionInputSchema = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().optional(),
});

export type ProposalDecisionInput = z.infer<typeof ProposalDecisionInputSchema>;
