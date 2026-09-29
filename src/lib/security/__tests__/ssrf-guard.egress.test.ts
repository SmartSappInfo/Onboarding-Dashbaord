// @vitest-environment node
/**
 * @fileOverview SSRF egress tests (round-2 blocker R4). Fully offline.
 *
 * - IP literals in every IPv6 spelling are classified by the embedded IPv4 they reach.
 * - The connection-level lookup blocks hostnames whose DNS answer is private (DNS rebinding).
 * - `safeUrlFetch` re-validates redirect hops, drops credentials cross-origin and applies 303 semantics.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import dns from 'node:dns';
import { MockAgent } from 'undici';
import {
  guardedLookup,
  isForbiddenIp,
  isSsrfBlockedError,
  safeUrlFetch,
  validateExternalUrl,
} from '../ssrf-guard';

describe('IP literal classification', () => {
  it.each([
    'http://[::ffff:169.254.169.254]/',
    'http://[::ffff:a9fe:a9fe]/',
    'http://[0:0:0:0:0:ffff:a9fe:a9fe]/',
    'http://[64:ff9b::a9fe:a9fe]/',
    'http://[64:ff9b::169.254.169.254]/',
    'http://[2002:a9fe:a9fe::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::127.0.0.1]/',
    'http://[::1]/',
    'http://[fe80::1]/',
    'http://[fd12:3456::1]/',
    'http://[ff02::1]/',
    'http://[2001:db8::1]/',
    'http://localhost./',
    'http://0x7f000001/',
    'http://100.64.0.1/',
  ])('blocks %s synchronously', (url) => {
    expect(validateExternalUrl(url).isValid).toBe(false);
  });

  it.each(['http://[2606:4700:4700::1111]/', 'https://93.184.216.34/', 'https://example.com/'])('allows public %s', (url) => {
    expect(validateExternalUrl(url).isValid).toBe(true);
  });

  it('classifies public mapped / NAT64 addresses as allowed', () => {
    expect(isForbiddenIp('::ffff:93.184.216.34')).toBe(false);
    expect(isForbiddenIp('64:ff9b::5db8:d822')).toBe(false);
    expect(isForbiddenIp('not-an-ip')).toBe(false);
  });
});

describe('guardedLookup (connection-level DNS check)', () => {
  afterEach(() => vi.restoreAllMocks());

  const run = (answer: Array<{ address: string; family: number }>, all: boolean) =>
    new Promise<{ err: Error | null; result: unknown }>((resolve) => {
      vi.spyOn(dns, 'lookup').mockImplementation(((
        _host: string,
        _opts: dns.LookupAllOptions,
        cb: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void
      ) => cb(null, answer)) as unknown as typeof dns.lookup);
      guardedLookup('rebind.attacker.test', { all }, (err, address, family) =>
        resolve({ err, result: all ? address : { address, family } })
      );
    });

  it('refuses a hostname that resolves to the metadata server', async () => {
    const { err } = await run([{ address: '169.254.169.254', family: 4 }], false);
    expect(isSsrfBlockedError(err)).toBe(true);
  });

  it('refuses when ANY answer is private (mixed public/private records)', async () => {
    const { err } = await run(
      [
        { address: '93.184.216.34', family: 4 },
        { address: '::ffff:10.0.0.5', family: 6 },
      ],
      true
    );
    expect(isSsrfBlockedError(err)).toBe(true);
  });

  it('passes public answers through in both single and `all` modes', async () => {
    expect(await run([{ address: '93.184.216.34', family: 4 }], false)).toEqual({
      err: null,
      result: { address: '93.184.216.34', family: 4 },
    });
    expect((await run([{ address: '93.184.216.34', family: 4 }], true)).result).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });
});

describe('safeUrlFetch redirects', () => {
  function mock() {
    const agent = new MockAgent();
    agent.disableNetConnect();
    return agent;
  }

  it('refuses a redirect to the metadata server', async () => {
    const agent = mock();
    agent.get('https://public.example').intercept({ path: '/start' }).reply(302, '', { headers: { location: 'http://169.254.169.254/computeMetadata/v1/' } });
    await expect(safeUrlFetch('https://public.example/start', {}, 3, { dispatcher: agent })).rejects.toSatisfy(isSsrfBlockedError);
  });

  it('drops credential headers on a cross-origin redirect but keeps them same-origin', async () => {
    const agent = mock();
    const seen: Array<Record<string, string>> = [];
    agent
      .get('https://a.example')
      .intercept({ path: '/1' })
      .reply((opts) => {
        seen.push(opts.headers as Record<string, string>);
        return { statusCode: 307, data: '', responseOptions: { headers: { location: '/2' } } };
      });
    agent
      .get('https://a.example')
      .intercept({ path: '/2' })
      .reply((opts) => {
        seen.push(opts.headers as Record<string, string>);
        return { statusCode: 307, data: '', responseOptions: { headers: { location: 'https://b.example/3' } } };
      });
    agent
      .get('https://b.example')
      .intercept({ path: '/3' })
      .reply((opts) => {
        seen.push(opts.headers as Record<string, string>);
        return { statusCode: 200, data: 'ok' };
      });

    const res = await safeUrlFetch('https://a.example/1', { headers: { Authorization: 'Bearer s3cret', 'X-Trace': 't' } }, 3, { dispatcher: agent });
    expect(await res.text()).toBe('ok');
    const auth = (h: Record<string, string>) => Object.entries(h).find(([k]) => k.toLowerCase() === 'authorization')?.[1];
    expect(auth(seen[1])).toBe('Bearer s3cret'); // same origin
    expect(auth(seen[2])).toBeUndefined(); // cross origin
  });

  it('turns a POST into a bodyless GET after 303', async () => {
    const agent = mock();
    agent.get('https://a.example').intercept({ path: '/submit', method: 'POST' }).reply(303, '', { headers: { location: '/done' } });
    agent.get('https://a.example').intercept({ path: '/done', method: 'GET' }).reply(200, 'done');
    const res = await safeUrlFetch('https://a.example/submit', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }, 3, {
      dispatcher: agent,
    });
    expect(await res.text()).toBe('done');
  });

  it('stops after the redirect limit', async () => {
    const agent = mock();
    agent.get('https://loop.example').intercept({ path: '/' }).reply(302, '', { headers: { location: '/' } }).persist();
    await expect(safeUrlFetch('https://loop.example/', {}, 2, { dispatcher: agent })).rejects.toSatisfy(isSsrfBlockedError);
  });
});
