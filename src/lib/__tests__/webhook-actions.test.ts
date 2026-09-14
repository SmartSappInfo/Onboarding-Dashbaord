import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatchSignupWebhook } from '../webhook-actions';
import { SIGNUP_WEBHOOK_TARGETS } from '../webhook-constants';

describe('dispatchSignupWebhook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('includes both Pabbly and SmartSapp Automations in the configured targets', () => {
    const urls = SIGNUP_WEBHOOK_TARGETS.map((t) => t.url);
    expect(urls).toContain(
      'https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTZiMDYzNTA0MzE1MjZkNTUzMzUxMzYi_pc'
    );
    expect(urls).toContain(
      'https://go.smartsapp.com/api/automations/webhook/TSRkUBIo6neV20iL526t'
    );
  });

  it('dispatches payload to all webhook targets with correct headers and body', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ status: 'accepted' }),
      };
    });
    global.fetch = mockFetch;

    const samplePayload = {
      organization: 'Achimota Basic School',
      contactPerson: 'Kwame Mensah',
      email: 'headmaster@achimota.edu.gh',
      phone: '+233244123456',
      nominalRoll: 450,
      implementationDate: '2026-10-01',
      notifySchool: 'Yes',
      notifySmartSapp: 'Yes',
    };

    const response = await dispatchSignupWebhook(samplePayload);

    expect(response.success).toBe(true);
    expect(response.results).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify both URLs were targeted
    const calledUrls = mockFetch.mock.calls.map((call) => call[0]);
    expect(calledUrls).toContain(
      'https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTZiMDYzNTA0MzE1MjZkNTUzMzUxMzYi_pc'
    );
    expect(calledUrls).toContain(
      'https://go.smartsapp.com/api/automations/webhook/TSRkUBIo6neV20iL526t'
    );

    // Verify request options
    for (const call of mockFetch.mock.calls) {
      const options = call[1] as RequestInit;
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(options.body as string)).toEqual(samplePayload);
    }
  });

  it('handles partial failures gracefully without interrupting delivery to other targets', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('pabbly.com')) {
        return {
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          text: async () => 'Gateway timeout',
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ status: 'accepted', ingressId: 'TSRkUBIo6neV20iL526t' }),
      };
    });
    global.fetch = mockFetch;

    const response = await dispatchSignupWebhook({ organization: 'Test School' });

    expect(response.success).toBe(true); // Partial success is considered success for non-blocking notifications
    const smartsappResult = response.results.find((r) => r.id === 'smartsapp_automations');
    const pabblyResult = response.results.find((r) => r.id === 'pabbly');

    expect(smartsappResult?.success).toBe(true);
    expect(pabblyResult?.success).toBe(false);
    expect(pabblyResult?.statusCode).toBe(502);
  });

  it('reports failure when all webhook targets fail', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));
    global.fetch = mockFetch;

    const response = await dispatchSignupWebhook({ organization: 'Test School' });

    expect(response.success).toBe(false);
    expect(response.results.every((r) => !r.success)).toBe(true);
    expect(response.error).toContain('failed to receive payload');
  });

  it('dispatches exclusively to internal SmartSapp Automations when chosen', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ status: 'accepted' }),
    });
    global.fetch = mockFetch;

    const response = await dispatchSignupWebhook({ organization: 'Smart School' }, 'smartsapp_automations');

    expect(response.success).toBe(true);
    expect(response.results).toHaveLength(1);
    expect(response.results[0].id).toBe('smartsapp_automations');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://go.smartsapp.com/api/automations/webhook/TSRkUBIo6neV20iL526t',
      expect.anything()
    );
  });

  it('dispatches exclusively to external Pabbly when chosen', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ status: 'accepted' }),
    });
    global.fetch = mockFetch;

    const response = await dispatchSignupWebhook({ organization: 'Pabbly School' }, 'pabbly');

    expect(response.success).toBe(true);
    expect(response.results).toHaveLength(1);
    expect(response.results[0].id).toBe('pabbly');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTZiMDYzNTA0MzE1MjZkNTUzMzUxMzYi_pc',
      expect.anything()
    );
  });

  it('skips network fetch completely when targetOption is none', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const response = await dispatchSignupWebhook({ organization: 'No Webhook School' }, 'none');

    expect(response.success).toBe(true);
    expect(response.results).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
