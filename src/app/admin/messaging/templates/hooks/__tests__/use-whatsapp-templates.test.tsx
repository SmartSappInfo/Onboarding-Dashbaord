import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { WhatsAppTemplate } from '@/lib/whatsapp/whatsapp-types';

const listMock = vi.fn();
const syncMock = vi.fn();
const getConnMock = vi.fn();

vi.mock('@/lib/whatsapp-template-actions', () => ({
  listWhatsAppTemplates: (...args: unknown[]) => listMock(...args),
  syncWhatsAppTemplates: (...args: unknown[]) => syncMock(...args),
}));

vi.mock('@/lib/whatsapp-actions', () => ({
  getWhatsAppConnection: (...args: unknown[]) => getConnMock(...args),
}));

const userMock: { user: { getIdToken: () => Promise<string> } | null } = {
  user: { getIdToken: async () => 'tok' },
};
vi.mock('@/firebase', () => ({ useUser: () => userMock }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { useWhatsAppTemplates } from '../use-whatsapp-templates';

const sample: WhatsAppTemplate = {
  id: 'org1_a_en',
  organizationId: 'org1',
  metaTemplateId: 'm1',
  name: 'a',
  language: 'en',
  category: 'UTILITY',
  status: 'APPROVED',
  components: [],
  paramCount: 0,
  syncedAt: '2026-06-20T00:00:00.000Z',
};

beforeEach(() => {
  listMock.mockReset();
  syncMock.mockReset();
  getConnMock.mockReset();
  userMock.user = { user: { getIdToken: async () => 'tok' } }.user;
});

describe('useWhatsAppTemplates', () => {
  it('does not call the action when organizationId is empty', async () => {
    const { result } = renderHook(() => useWhatsAppTemplates(''));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listMock).not.toHaveBeenCalled();
    expect(result.current.templates).toEqual([]);
  });

  it('loads templates on mount when org is present', async () => {
    listMock.mockResolvedValue({ success: true, data: [sample] });
    getConnMock.mockResolvedValue({ success: true, data: { wabaId: '123' } });
    const { result } = renderHook(() => useWhatsAppTemplates('org1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listMock).toHaveBeenCalledWith('tok', 'org1');
    expect(result.current.templates).toEqual([sample]);
    expect(result.current.error).toBeNull();
    expect(result.current.connected).toBe(true);
  });

  it('surfaces the action error message', async () => {
    listMock.mockResolvedValue({ success: false, error: 'Forbidden: org admin required.' });
    getConnMock.mockResolvedValue({ success: true, data: null });
    const { result } = renderHook(() => useWhatsAppTemplates('org1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Forbidden: org admin required.');
    expect(result.current.templates).toEqual([]);
  });

  it('sync replaces templates', async () => {
    listMock.mockResolvedValue({ success: true, data: [] });
    getConnMock.mockResolvedValue({ success: true, data: { wabaId: '123' } });
    syncMock.mockResolvedValue({ success: true, data: { count: 1, templates: [sample] } });
    const { result } = renderHook(() => useWhatsAppTemplates('org1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.sync();
    });
    expect(result.current.templates).toEqual([sample]);
  });
});
