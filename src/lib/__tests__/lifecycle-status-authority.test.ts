import { describe, it, expect } from 'vitest';
import { SaaSInstitutionDataSchema, validateIndustryData } from '../industry-schemas';
import { applyIndustryDataDefaults } from '../entity-utils';
import { createMinimalIndustryData } from '../industry-defaults';

describe('lifecycleStatus is authoritative — accountStatus is optional', () => {
  it('SaaSInstitutionDataSchema parses successfully without accountStatus', () => {
    const result = SaaSInstitutionDataSchema.safeParse({
      industry: 'SaaS',
      capacity: 10,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accountStatus).toBeUndefined();
    }
  });

  it('SaaSInstitutionDataSchema parses successfully with accountStatus', () => {
    const result = SaaSInstitutionDataSchema.safeParse({
      industry: 'SaaS',
      capacity: 10,
      accountStatus: 'active',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accountStatus).toBe('active');
    }
  });

  it('applyIndustryDataDefaults does not inject accountStatus', () => {
    const result = applyIndustryDataDefaults({}, 'SaaS', 'institution');
    expect(result).not.toHaveProperty('accountStatus');
    expect(result.capacity).toBe(0);
  });

  it('validateIndustryData passes for a SaaS entity without accountStatus', () => {
    const data = {
      industry: 'SaaS',
      capacity: 5,
    };
    const validated = validateIndustryData(data, 'SaaS');
    expect(validated.industry).toBe('SaaS');
    expect((validated as any).accountStatus).toBeUndefined();
  });

  it('createMinimalIndustryData creates minimal SaaS data without accountStatus', () => {
    const instResult = createMinimalIndustryData('SaaS', 'institution');
    expect(instResult.industry).toBe('SaaS');
    expect(instResult.capacity).toBe(0);
    expect(instResult).not.toHaveProperty('accountStatus');

    const personResult = createMinimalIndustryData('SaaS', 'person');
    expect(personResult.industry).toBe('SaaS');
    expect(personResult.role).toBe('user');
    expect(personResult.activationStatus).toBe('pending');
    expect(personResult).not.toHaveProperty('accountStatus');
  });
});
