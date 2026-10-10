import { describe, it, expect } from 'vitest';
import { getSpecificLocationLabel, type LocationValue } from '../LocationFilterPopover';

describe('LocationFilterPopover Label Resolution', () => {
  it('returns "All Locations" when value is empty or null', () => {
    expect(getSpecificLocationLabel(null)).toBe('All Locations');
    expect(getSpecificLocationLabel({})).toBe('All Locations');
    expect(getSpecificLocationLabel({ country: null, region: null, district: null })).toBe('All Locations');
  });

  it('returns country name when only country is selected', () => {
    const val: LocationValue = {
      country: { id: 'c1', name: 'Ghana', code: 'GH', flag: '🇬🇭' },
      region: null,
      district: null,
    };
    expect(getSpecificLocationLabel(val)).toBe('Ghana');
  });

  it('returns specific region and country code when region is selected', () => {
    const val: LocationValue = {
      country: { id: 'c1', name: 'Ghana', code: 'GH', flag: '🇬🇭' },
      region: { id: 'r1', name: 'Greater Accra' },
      district: null,
    };
    expect(getSpecificLocationLabel(val)).toBe('Greater Accra, GH');
  });

  it('returns specific district and country code when district is selected', () => {
    const val: LocationValue = {
      country: { id: 'c1', name: 'Ghana', code: 'GH', flag: '🇬🇭' },
      region: { id: 'r1', name: 'Greater Accra' },
      district: { id: 'd1', name: 'Accra Metro' },
    };
    expect(getSpecificLocationLabel(val)).toBe('Accra Metro, GH');
  });

  it('handles country with code fallback gracefully', () => {
    const val: LocationValue = {
      country: { id: 'c1', name: 'Nigeria', code: '', flag: '🇳🇬' },
      region: { id: 'r1', name: 'Lagos' },
      district: null,
    };
    expect(getSpecificLocationLabel(val)).toBe('Lagos, Nigeria');
  });
});
