/**
 * @fileOverview Thin server-only client for the Meta WhatsApp Cloud API
 * (Graph API). The HTTP core retries 429/5xx with exponential backoff (spec
 * R10, F7) and NEVER puts the access token in the URL or logs — it travels in
 * the `Authorization: Bearer` header only (spec R5).
 *
 * `fetch` and `sleep` are injectable so the retry logic is unit-testable
 * without network access or real timers.
 */

import type { MetaTemplateRaw } from './whatsapp-domain';

export const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = 'https://graph.facebook.com';

export interface MetaCredentials {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
}

export interface MetaClientOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  baseDelayMs?: number;
  capDelayMs?: number;
  graphVersion?: string;
}

export interface PhoneHealth {
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: 'GREEN' | 'YELLOW' | 'RED';
  messagingLimit?: string;
}

interface MetaTemplatePage {
  data?: MetaTemplateRaw[];
  paging?: { cursors?: { after?: string }; next?: string };
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function buildGraphUrl(path: string, version = GRAPH_VERSION): string {
  return `${GRAPH_BASE}/${version}/${path.replace(/^\//, '')}`;
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/** Deterministic exponential backoff with a ceiling (ms). */
export function backoffDelayMs(attempt: number, baseMs = 500, capMs = 8000): number {
  return Math.min(capMs, baseMs * 2 ** attempt);
}

export function parsePhoneHealth(data: Record<string, unknown>): PhoneHealth {
  return {
    displayPhoneNumber: data.display_phone_number as string | undefined,
    verifiedName: data.verified_name as string | undefined,
    qualityRating: data.quality_rating as PhoneHealth['qualityRating'],
    messagingLimit: data.messaging_limit_tier as string | undefined,
  };
}

export function parseGraphError(data: unknown): string {
  const err = (data as { error?: { message?: string } } | undefined)?.error;
  return err?.message || 'Unknown Meta Graph API error';
}

/**
 * Embedded Signup (OAuth): exchange the authorization code returned by the
 * hosted flow for a long-lived business-integration access token, using the
 * PLATFORM Meta app's id + secret. The secret travels only in the request to
 * Meta and is never logged.
 */
export async function exchangeEmbeddedSignupCode(
  code: string,
  opts: { appId: string; appSecret: string; fetchImpl?: typeof fetch; graphVersion?: string },
): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const url =
    buildGraphUrl('oauth/access_token', opts.graphVersion ?? GRAPH_VERSION) +
    `?${new URLSearchParams({ client_id: opts.appId, client_secret: opts.appSecret, code }).toString()}`;
  const res = await fetchImpl(url, { method: 'GET' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`[meta-cloud] ${parseGraphError(data)}`);
  const token = (data as { access_token?: string }).access_token;
  if (!token) throw new Error('[meta-cloud] Embedded Signup did not return an access token.');
  return token;
}

// ── Client ───────────────────────────────────────────────────────────────────

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class MetaCloudApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly capDelayMs: number;
  private readonly version: string;

  constructor(private readonly creds: MetaCredentials, opts: MetaClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.sleep = opts.sleep ?? defaultSleep;
    this.maxAttempts = opts.maxAttempts ?? 3;
    this.baseDelayMs = opts.baseDelayMs ?? 500;
    this.capDelayMs = opts.capDelayMs ?? 8000;
    this.version = opts.graphVersion ?? GRAPH_VERSION;
  }

  /**
   * Issue a Graph request with retry. Returns parsed JSON on 2xx; throws the
   * Graph error message otherwise (after exhausting retries for transient
   * failures). The token is never placed in the URL.
   */
  async request<T = unknown>(
    method: string,
    path: string,
    init: { query?: Record<string, string>; body?: unknown } = {},
  ): Promise<T> {
    let url = buildGraphUrl(path, this.version);
    if (init.query && Object.keys(init.query).length > 0) {
      url += `?${new URLSearchParams(init.query).toString()}`;
    }

    let lastError = 'request failed';
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const res = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) return data as T;

      lastError = parseGraphError(data);
      const canRetry = isRetryableStatus(res.status) && attempt < this.maxAttempts - 1;
      if (!canRetry) break;
      await this.sleep(backoffDelayMs(attempt, this.baseDelayMs, this.capDelayMs));
    }
    throw new Error(`[meta-cloud] ${lastError}`);
  }

  /**
   * List all message templates for the WABA, following cursor pagination until
   * exhausted. Returns raw Meta template objects (normalize via whatsapp-domain).
   */
  async listMessageTemplates(): Promise<MetaTemplateRaw[]> {
    const all: MetaTemplateRaw[] = [];
    let after: string | undefined;
    do {
      const query: Record<string, string> = {
        limit: '100',
        fields: 'id,name,language,category,status,components,rejected_reason',
      };
      if (after) query.after = after;
      const page = await this.request<MetaTemplatePage>('GET', `${this.creds.wabaId}/message_templates`, {
        query,
      });
      all.push(...(page.data ?? []));
      after = page.paging?.next ? page.paging?.cursors?.after : undefined;
    } while (after);
    return all;
  }

  /**
   * Upload header sample media via Meta's Resumable Upload API and return the
   * `header_handle` used in a template's `example`. Two steps: create an upload
   * session, then POST the bytes (Meta uses the `OAuth` auth scheme + a
   * `file_offset` header for the data step). Not retried — uploads aren't
   * idempotent and the file is large.
   */
  async uploadResumable(input: {
    appId: string;
    fileName: string;
    fileType: string;
    data: Uint8Array;
  }): Promise<string> {
    const { appId, fileName, fileType, data } = input;

    const sessionUrl =
      buildGraphUrl(`${appId}/uploads`, this.version) +
      `?${new URLSearchParams({
        file_name: fileName,
        file_length: String(data.byteLength),
        file_type: fileType,
      }).toString()}`;
    const sessionRes = await this.fetchImpl(sessionUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.creds.accessToken}` },
    });
    const session = await sessionRes.json().catch(() => ({}));
    if (!sessionRes.ok) throw new Error(`[meta-cloud] ${parseGraphError(session)}`);
    const sessionId = (session as { id?: string }).id;
    if (!sessionId) throw new Error('[meta-cloud] Upload session was not created.');

    const uploadRes = await this.fetchImpl(buildGraphUrl(sessionId, this.version), {
      method: 'POST',
      headers: { Authorization: `OAuth ${this.creds.accessToken}`, file_offset: '0' },
      // Uint8Array is a valid fetch body at runtime; TS 5.7's generic
      // Uint8Array<ArrayBufferLike> doesn't match BodyInit, so cast.
      body: data as unknown as BodyInit,
    });
    const uploaded = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok) throw new Error(`[meta-cloud] ${parseGraphError(uploaded)}`);
    const handle = (uploaded as { h?: string }).h;
    if (!handle) throw new Error('[meta-cloud] Upload did not return a file handle.');
    return handle;
  }

  /**
   * Submit a new message template for Meta approval via
   * `POST /{wabaId}/message_templates`. Returns Meta's id + initial status
   * (typically PENDING). Approval happens asynchronously on Meta's side — poll
   * via `listMessageTemplates` / the sync action.
   */
  async createMessageTemplate(payload: {
    name: string;
    language: string;
    category: string;
    components: unknown[];
  }): Promise<{ id: string; status?: string; category?: string }> {
    return this.request<{ id: string; status?: string; category?: string }>(
      'POST',
      `${this.creds.wabaId}/message_templates`,
      { body: payload },
    );
  }

  /**
   * Send a pre-built message payload (template or text) via
   * `POST /{phoneNumberId}/messages`. Returns the Meta message id (wamid) for
   * status reconciliation.
   */
  async sendMessage(payload: unknown): Promise<{ metaMessageId: string | null; raw: unknown }> {
    const data = await this.request<{ messages?: Array<{ id?: string }> }>(
      'POST',
      `${this.creds.phoneNumberId}/messages`,
      { body: payload },
    );
    return { metaMessageId: data.messages?.[0]?.id ?? null, raw: data };
  }

  /**
   * Subscribe the app to a WABA's webhooks (Embedded Signup auto-wiring) — the
   * org never has to paste a callback URL. Idempotent on Meta's side.
   */
  async subscribeAppToWaba(wabaId: string): Promise<boolean> {
    const data = await this.request<{ success?: boolean }>('POST', `${wabaId}/subscribed_apps`);
    return data?.success !== false;
  }

  /** Fetch quality rating / messaging tier for the configured phone number. */
  async getPhoneNumberHealth(): Promise<PhoneHealth> {
    const data = await this.request<Record<string, unknown>>('GET', this.creds.phoneNumberId, {
      query: { fields: 'display_phone_number,verified_name,quality_rating,messaging_limit_tier' },
    });
    return parsePhoneHealth(data);
  }
}
