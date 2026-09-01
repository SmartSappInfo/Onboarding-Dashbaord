/**
 * @fileOverview Unit Tests for AI Administration & Command Center Services
 */

import { describe, it, expect } from 'vitest';
import { AiApprovalRoutingService } from '../ai-approval-routing-service';

describe('AiApprovalRoutingService Human-in-the-loop Gate', () => {
  it('throws an error when approving a non-existent proposal', async () => {
    await expect(
      AiApprovalRoutingService.approveProposal('org-test', 'non-existent-prop-id', 'admin-1')
    ).rejects.toThrow(/not found/i);
  });
});
