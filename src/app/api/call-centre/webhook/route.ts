import { NextResponse } from 'next/server';
import { validateExternalUrl } from '@/lib/security/ssrf-guard';

/**
 * @fileOverview Call Centre Outbound Webhook Proxy
 *
 * Dispatches automated webhook payloads to external endpoints configured by workspace operators.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Security: Protected by SSRF validation via `validateExternalUrl` to prevent targeting
 *   internal infrastructure, cloud metadata (169.254.169.254), loopback addresses, or private subnets.
 * - Caution: Do not bypass the SSRF guard. If users report that a public webhook fails, verify
 *   that the target URL uses standard public HTTP/HTTPS ports.
 * - Zero `any` or `any[]` typing.
 */

interface WebhookProxyRequestBody {
  url?: string;
  headers?: string;
  payload?: unknown;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as WebhookProxyRequestBody;
    const { url, headers, payload } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid webhook URL' }, { status: 400 });
    }

    // SSRF & Ingress Protection Guard
    const ssrfCheck = validateExternalUrl(url);
    if (!ssrfCheck.isValid || !ssrfCheck.sanitizedUrl) {
      console.warn(`[WEBHOOK_PROXY_SSRF_BLOCKED] URL rejected: ${url}. Reason: ${ssrfCheck.error}`);
      return NextResponse.json(
        { error: ssrfCheck.error || 'Destination URL is not permitted for security reasons.' },
        { status: 403 }
      );
    }

    const targetUrl = ssrfCheck.sanitizedUrl;
    let parsedHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

    if (headers && typeof headers === 'string') {
      try {
        const jsonHeaders = JSON.parse(headers) as Record<string, unknown>;
        if (typeof jsonHeaders === 'object' && jsonHeaders !== null) {
          for (const [key, value] of Object.entries(jsonHeaders)) {
            if (typeof value === 'string') {
              parsedHeaders[key] = value;
            }
          }
        }
      } catch {
        // If it's not valid JSON, parse as key-value pairs (Header: Value) separated by newlines
        const lines = headers.split('\n');
        for (const line of lines) {
          const colonIdx = line.indexOf(':');
          if (colonIdx > -1) {
            const key = line.slice(0, colonIdx).trim();
            const val = line.slice(colonIdx + 1).trim();
            if (key) {
              parsedHeaders[key] = val;
            }
          }
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: parsedHeaders,
        body: JSON.stringify(payload ?? {}),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      let responseBody = '';
      try {
        responseBody = await res.text();
      } catch {
        // Ignore parsing error if response is empty or binary
      }

      return NextResponse.json({
        status: res.status,
        ok: res.ok,
        body: responseBody,
      });
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        return NextResponse.json({ error: 'Webhook request timed out (10s limit)' }, { status: 504 });
      }
      throw fetchErr;
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[WEBHOOK_PROXY_ERROR]', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
