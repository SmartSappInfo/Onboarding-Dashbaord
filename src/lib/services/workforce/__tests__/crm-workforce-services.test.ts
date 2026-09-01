/**
 * @fileOverview Unit Tests for CRM Workforce & Ownership Services
 */

import { describe, it, expect } from 'vitest';
import { OwnershipTransferService } from '../ownership-transfer-service';

describe('OwnershipTransferService Validation', () => {
  it('rejects transfer when source and target members are identical', async () => {
    await expect(
      OwnershipTransferService.transferOwnership('org-test', {
        sourcePersonId: 'user-1',
        targetPersonId: 'user-1',
        entityTypes: ['deal', 'contact'],
        executedBy: 'admin-1',
      })
    ).rejects.toThrow('Source and destination members must be different');
  });
});
