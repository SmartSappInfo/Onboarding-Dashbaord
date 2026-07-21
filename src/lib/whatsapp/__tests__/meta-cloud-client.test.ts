import { describe, it, expect, vi } from 'vitest';
import {
  MetaCloudApiClient,
  buildGraphUrl,
  isRetryableStatus,
  backoffDelayMs,
  parsePhoneHealth,
  parseGraphError,
  type MetaCredentials,
} from '../meta-cloud-client';

/**
 * Phase 1 — Meta Graph API client. Pure helpers are tested directly; the
 * request core is tested with an injected `fetch` + zero-delay `sleep` so retry
 * / backoff behavior (spec R10, F7) is exercised without network or real timers.
 */

const creds: MetaCredentials = {
  accessToken: 'EAAG-secret-token',
  phoneNumberId: 'pn_1',
  wabaId: 'waba_1',
};

/** A fetch stub returning a sequence of canned responses. */
function fetchSequence(responses: Array<{ status: number; body: unknown }>) {
  const fn = vi.fn(async () => {
    const next = responses.shift()!;
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body,
      text: async () => JSON.stringify(next.body),
    } as Response;
  });
  return fn;
}

function makeClient(fetchImpl: typeof fetch, maxAttempts = 3) {
  return new MetaCloudApiClient(creds, {
    fetchImpl,
    sleep: async () => {},
    baseDelayMs: 0,
    maxAttempts,
  });
}

describe('pure helpers', () => {
  it('buildGraphUrl joins version and path', () => {
    expect(buildGraphUrl('pn_1/messages', 'v21.0')).toBe(
      'https://graph.facebook.com/v21.0/pn_1/messages',
    );
    expect(buildGraphUrl('/pn_1', 'v21.0')).toBe('https://graph.facebook.com/v21.0/pn_1');
  });

  it('isRetryableStatus only for 429 and 5xx', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });

  it('backoffDelayMs grows exponentially and caps', () => {
    expect(backoffDelayMs(0, 500, 8000)).toBe(500);
    expect(backoffDelayMs(1, 500, 8000)).toBe(1000);
    expect(backoffDelayMs(2, 500, 8000)).toBe(2000);
    expect(backoffDelayMs(10, 500, 8000)).toBe(8000); // capped
  });

  it('parsePhoneHealth maps Meta fields', () => {
    const health = parsePhoneHealth({
      display_phone_number: '+233200000000',
      verified_name: 'Acme',
      quality_rating: 'GREEN',
      messaging_limit_tier: 'TIER_1K',
    });
    expect(health.displayPhoneNumber).toBe('+233200000000');
    expect(health.qualityRating).toBe('GREEN');
    expect(health.messagingLimit).toBe('TIER_1K');
    expect(health.verifiedName).toBe('Acme');
  });

  it('parseGraphError extracts the message', () => {
    expect(parseGraphError({ error: { message: 'Invalid OAuth token', code: 190 } })).toMatch(
      /Invalid OAuth token/,
    );
    expect(parseGraphError({})).toMatch(/unknown/i);
  });

  // Meta puts a generic "Invalid parameter" in `message` and the ACTUAL reason in
  // error_user_title/error_user_msg/error_data.details. Surfacing only `message`
  // is why template pushes failed with an undiagnosable error.
  it('parseGraphError surfaces the user-facing title and message over the generic one', () => {
    const out = parseGraphError({
      error: {
        message: 'Invalid parameter',
        type: 'OAuthException',
        code: 100,
        error_subcode: 2388023,
        error_user_title: 'Template Body Invalid',
        error_user_msg: 'The body text cannot end with a parameter.',
        fbtrace_id: 'Axyz',
      },
    });
    expect(out).toMatch(/Template Body Invalid/);
    expect(out).toMatch(/cannot end with a parameter/);
    expect(out).toMatch(/100/); // code retained for support/debugging
    expect(out).toMatch(/2388023/); // subcode retained
  });

  it('parseGraphError includes error_data.details when present', () => {
    const out = parseGraphError({
      error: {
        message: 'Invalid parameter',
        code: 100,
        error_data: { details: 'body_text example count does not match placeholders' },
      },
    });
    expect(out).toMatch(/example count does not match/);
  });

  it('parseGraphError never throws on malformed payloads', () => {
    expect(parseGraphError(null)).toMatch(/unknown/i);
    expect(parseGraphError('boom')).toMatch(/unknown/i);
    expect(parseGraphError({ error: {} })).toMatch(/unknown/i);
  });
});

describe('MetaCloudApiClient.getPhoneNumberHealth', () => {
  it('returns parsed health on success', async () => {
    const fetchImpl = fetchSequence([
      { status: 200, body: { display_phone_number: '+233200000000', quality_rating: 'GREEN', messaging_limit_tier: 'TIER_1K' } },
    ]);
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    const health = await client.getPhoneNumberHealth();
    expect(health.qualityRating).toBe('GREEN');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sends the token as a Bearer header, never in the URL', async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(String(url)).not.toContain('EAAG-secret-token');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer EAAG-secret-token');
      return { ok: true, status: 200, json: async () => ({ quality_rating: 'GREEN' }), text: async () => '{}' } as Response;
    });
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await client.getPhoneNumberHealth();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 then succeeds', async () => {
    const fetchImpl = fetchSequence([
      { status: 429, body: { error: { message: 'rate limited' } } },
      { status: 200, body: { quality_rating: 'YELLOW' } },
    ]);
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    const health = await client.getPhoneNumberHealth();
    expect(health.qualityRating).toBe('YELLOW');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 401 and throws the Graph error', async () => {
    const fetchImpl = fetchSequence([
      { status: 401, body: { error: { message: 'Invalid OAuth token', code: 190 } } },
    ]);
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.getPhoneNumberHealth()).rejects.toThrow(/Invalid OAuth token/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxAttempts on persistent 5xx', async () => {
    const fetchImpl = fetchSequence([
      { status: 500, body: { error: { message: 'server error' } } },
      { status: 500, body: { error: { message: 'server error' } } },
      { status: 500, body: { error: { message: 'server error' } } },
    ]);
    const client = makeClient(fetchImpl as unknown as typeof fetch, 3);
    await expect(client.getPhoneNumberHealth()).rejects.toThrow(/server error/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('exchangeEmbeddedSignupCode (OAuth)', () => {
  it('exchanges the auth code for an access token (token never in any log)', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const u = String(url);
      expect(u).toContain('/oauth/access_token');
      expect(u).toContain('client_id=APP_ID');
      expect(u).toContain('client_secret=APP_SECRET');
      expect(u).toContain('code=THE_CODE');
      return { ok: true, status: 200, json: async () => ({ access_token: 'EAAG-provisioned', token_type: 'bearer' }), text: async () => '{}' } as Response;
    });
    const { exchangeEmbeddedSignupCode } = await import('../meta-cloud-client');
    const token = await exchangeEmbeddedSignupCode('THE_CODE', {
      appId: 'APP_ID',
      appSecret: 'APP_SECRET',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(token).toBe('EAAG-provisioned');
  });

  it('throws the Graph error on failure', async () => {
    const fetchImpl = fetchSequence([
      { status: 400, body: { error: { message: 'Invalid verification code format' } } },
    ]);
    const { exchangeEmbeddedSignupCode } = await import('../meta-cloud-client');
    await expect(
      exchangeEmbeddedSignupCode('bad', { appId: 'A', appSecret: 'B', fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/Invalid verification code/);
  });
});

describe('MetaCloudApiClient.subscribeAppToWaba', () => {
  it('POSTs to {wabaId}/subscribed_apps to auto-wire webhooks', async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(String(url)).toContain('/waba_1/subscribed_apps');
      expect(init.method).toBe('POST');
      return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => '{}' } as Response;
    });
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(client.subscribeAppToWaba('waba_1')).resolves.toBe(true);
  });
});

describe('MetaCloudApiClient.sendMessage', () => {
  it('POSTs to {phoneNumberId}/messages and returns the wamid', async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(String(url)).toContain('/pn_1/messages');
      expect(init.method).toBe('POST');
      return {
        ok: true,
        status: 200,
        json: async () => ({ messages: [{ id: 'wamid.ABC' }] }),
        text: async () => '{}',
      } as Response;
    });
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    const res = await client.sendMessage({ messaging_product: 'whatsapp', to: '2332', type: 'text', text: { body: 'hi' } });
    expect(res.metaMessageId).toBe('wamid.ABC');
  });
});

describe('MetaCloudApiClient.uploadResumable', () => {
  it('creates a session, posts the bytes (OAuth scheme), and returns the handle', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      const body =
        calls.length === 1 ? { id: 'upload:SESSION' } : { h: 'HANDLE_xyz' };
      return { ok: true, status: 200, json: async () => body, text: async () => '{}' } as Response;
    });
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    const handle = await client.uploadResumable({
      appId: 'APP_ID',
      fileName: 'logo.png',
      fileType: 'image/png',
      data: new Uint8Array([1, 2, 3]),
    });
    expect(handle).toBe('HANDLE_xyz');
    expect(calls[0].url).toContain('/APP_ID/uploads');
    expect(calls[0].url).toContain('file_length=3');
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe('OAuth EAAG-secret-token');
    expect(calls[1].url).toContain('/upload:SESSION');
  });

  it('throws when no file handle is returned', async () => {
    const fetchImpl = fetchSequence([
      { status: 200, body: { id: 'upload:SESSION' } },
      { status: 200, body: {} },
    ]);
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(
      client.uploadResumable({ appId: 'A', fileName: 'f', fileType: 'image/png', data: new Uint8Array([1]) }),
    ).rejects.toThrow(/file handle/);
  });

  it('throws the Graph error when the session fails to create', async () => {
    const fetchImpl = fetchSequence([{ status: 400, body: { error: { message: 'bad app' } } }]);
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    await expect(
      client.uploadResumable({ appId: 'A', fileName: 'f', fileType: 'image/png', data: new Uint8Array([1]) }),
    ).rejects.toThrow(/bad app/);
  });
});

describe('MetaCloudApiClient.listMessageTemplates', () => {
  it('follows cursor pagination until exhausted', async () => {
    const fetchImpl = fetchSequence([
      {
        status: 200,
        body: {
          data: [{ id: 't1', name: 'a', language: 'en', category: 'UTILITY', status: 'APPROVED' }],
          paging: { cursors: { after: 'CUR2' }, next: 'https://graph/next' },
        },
      },
      {
        status: 200,
        body: {
          data: [{ id: 't2', name: 'b', language: 'en', category: 'MARKETING', status: 'PENDING' }],
          paging: { cursors: { after: 'CUR3' } }, // no `next` → stop
        },
      },
    ]);
    const client = makeClient(fetchImpl as unknown as typeof fetch);
    const templates = await client.listMessageTemplates();
    expect(templates.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
