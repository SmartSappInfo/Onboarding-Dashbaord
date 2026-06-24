import { describe, it, expect } from 'vitest';
import {
  UNASSIGNED_ZONE,
  zoneOrUnassigned,
  isUnassignedZone,
  zoneDisplayName,
  withUnassignedZone,
  type ZoneRef,
} from '../zone-constants';

describe('UNASSIGNED_ZONE', () => {
  it('has the expected stable id and name', () => {
    expect(UNASSIGNED_ZONE.id).toBe('sys-unassigned');
    expect(UNASSIGNED_ZONE.name).toBe('Unassigned');
  });
});

describe('zoneOrUnassigned', () => {
  it('returns the zone when valid', () => {
    const zone: ZoneRef = { id: 'zone-1', name: 'North Zone' };
    expect(zoneOrUnassigned(zone)).toBe(zone);
  });

  it('returns UNASSIGNED_ZONE when null', () => {
    expect(zoneOrUnassigned(null)).toEqual(UNASSIGNED_ZONE);
  });

  it('returns UNASSIGNED_ZONE when undefined', () => {
    expect(zoneOrUnassigned(undefined)).toEqual(UNASSIGNED_ZONE);
  });

  it('returns UNASSIGNED_ZONE when id is empty string', () => {
    expect(zoneOrUnassigned({ id: '', name: '' })).toEqual(UNASSIGNED_ZONE);
  });

  it('returns UNASSIGNED_ZONE when id is whitespace only', () => {
    expect(zoneOrUnassigned({ id: '   ', name: 'X' })).toEqual(UNASSIGNED_ZONE);
  });

  it('returns UNASSIGNED_ZONE when zone id is sys-unassigned', () => {
    expect(zoneOrUnassigned({ id: 'sys-unassigned', name: 'Unassigned' })).toEqual(UNASSIGNED_ZONE);
  });
});

describe('isUnassignedZone', () => {
  it('returns true for null', () => {
    expect(isUnassignedZone(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isUnassignedZone(undefined)).toBe(true);
  });

  it('returns true for empty id', () => {
    expect(isUnassignedZone({ id: '', name: '' })).toBe(true);
  });

  it('returns true for whitespace id', () => {
    expect(isUnassignedZone({ id: '  ', name: 'X' })).toBe(true);
  });

  it('returns true for sys-unassigned id', () => {
    expect(isUnassignedZone({ id: 'sys-unassigned', name: 'Unassigned' })).toBe(true);
  });

  it('returns false for a real zone', () => {
    expect(isUnassignedZone({ id: 'zone-north', name: 'North' })).toBe(false);
  });
});

describe('zoneDisplayName', () => {
  it('returns empty string for null (safe for message templates)', () => {
    expect(zoneDisplayName(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(zoneDisplayName(undefined)).toBe('');
  });

  it('returns empty string for UNASSIGNED_ZONE (must not render word in messages)', () => {
    expect(zoneDisplayName(UNASSIGNED_ZONE)).toBe('');
  });

  it('returns empty string for empty id', () => {
    expect(zoneDisplayName({ id: '', name: 'Something' })).toBe('');
  });

  it('returns zone name for a real zone', () => {
    expect(zoneDisplayName({ id: 'zone-south', name: 'South Zone' })).toBe('South Zone');
  });
});

describe('withUnassignedZone', () => {
  it('prepends Unassigned to a list of real zones', () => {
    const zones = [{ id: 'zone-1', name: 'North' }, { id: 'zone-2', name: 'South' }];
    const result = withUnassignedZone(zones);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(UNASSIGNED_ZONE);
    expect(result[1]).toEqual(zones[0]);
    expect(result[2]).toEqual(zones[1]);
  });

  it('returns just Unassigned for an empty list', () => {
    expect(withUnassignedZone([])).toEqual([UNASSIGNED_ZONE]);
  });

  it('returns just Unassigned for null', () => {
    expect(withUnassignedZone(null)).toEqual([UNASSIGNED_ZONE]);
  });

  it('returns just Unassigned for undefined', () => {
    expect(withUnassignedZone(undefined)).toEqual([UNASSIGNED_ZONE]);
  });

  it('is idempotent — does not double-add Unassigned if already present', () => {
    const zones = [UNASSIGNED_ZONE, { id: 'zone-1', name: 'North' }];
    const result = withUnassignedZone(zones);
    expect(result).toHaveLength(2);
    expect(result.filter((z) => z.id === UNASSIGNED_ZONE.id)).toHaveLength(1);
  });

  it('does not mutate the input array', () => {
    const zones = [{ id: 'zone-1', name: 'North' }];
    withUnassignedZone(zones);
    expect(zones).toHaveLength(1);
  });

  it('preserves extra fields on the caller zone type', () => {
    const zones = [{ id: 'zone-1', name: 'North', organizationId: 'org-x', isDefault: false }];
    const result = withUnassignedZone(zones);
    expect(result[1]).toMatchObject({ id: 'zone-1', organizationId: 'org-x' });
  });
});
