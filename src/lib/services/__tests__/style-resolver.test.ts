import { describe, it, expect } from 'vitest';
import { getDefaultStyle } from '../style-resolver';
import type { MessageStyle } from '@/lib/types';

describe('getDefaultStyle (7-Tier Resolution Order)', () => {
  const globalStyle: MessageStyle = {
    id: 'global-def',
    name: 'Global Default',
    scope: 'global',
    isDefault: true,
    workspaceIds: [],
    createdAt: '',
    updatedAt: '',
  };

  const orgStyle: MessageStyle = {
    id: 'org-minex-style',
    name: 'Minex360 Custom',
    scope: 'organization',
    organizationId: 'minex360',
    isDefault: false,
    workspaceIds: [],
    createdAt: '',
    updatedAt: '',
  };

  const orgDefaultStyle: MessageStyle = {
    id: 'org-minex-default',
    name: 'Minex360 Default',
    scope: 'organization',
    organizationId: 'minex360',
    isDefault: true,
    workspaceIds: [],
    createdAt: '',
    updatedAt: '',
  };

  const wsDefaultStyle: MessageStyle = {
    id: 'ws-default',
    name: 'Workspace Default',
    workspaceIds: ['ws-1'],
    isDefault: true,
    createdAt: '',
    updatedAt: '',
  };

  const wsStyle: MessageStyle = {
    id: 'ws-custom',
    name: 'Workspace Custom',
    workspaceIds: ['ws-1'],
    isDefault: false,
    createdAt: '',
    updatedAt: '',
  };

  it('returns undefined when styles array is empty or undefined', () => {
    expect(getDefaultStyle(undefined, 'minex360')).toBeUndefined();
    expect(getDefaultStyle([], 'minex360')).toBeUndefined();
  });

  it('Tier 1: prioritizes org-specific default style over global & workspace styles', () => {
    const candidates = [globalStyle, wsDefaultStyle, orgStyle, orgDefaultStyle];
    const resolved = getDefaultStyle(candidates, 'minex360', 'ws-1');
    expect(resolved?.id).toBe('org-minex-default');
  });

  it('Tier 2: falls back to workspace-specific default style when org default is absent', () => {
    const candidates = [globalStyle, wsDefaultStyle, orgStyle];
    const resolved = getDefaultStyle(candidates, 'minex360', 'ws-1');
    expect(resolved?.id).toBe('ws-default');
  });

  it('Tier 3: falls back to any org-specific style when no default flag is true', () => {
    const candidates = [globalStyle, orgStyle];
    const resolved = getDefaultStyle(candidates, 'minex360', 'ws-other');
    expect(resolved?.id).toBe('org-minex-style');
  });

  it('Tier 4: falls back to any workspace-specific style when no org style matches', () => {
    const candidates = [globalStyle, wsStyle];
    const resolved = getDefaultStyle(candidates, 'other-org', 'ws-1');
    expect(resolved?.id).toBe('ws-custom');
  });

  it('Tier 5: falls back to global default style when org/ws styles do not match', () => {
    const candidates = [globalStyle, { ...wsStyle, workspaceIds: ['ws-99'] }];
    const resolved = getDefaultStyle(candidates, 'other-org', 'ws-1');
    expect(resolved?.id).toBe('global-def');
  });
});
