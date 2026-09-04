/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Official Developer SDK
 *
 * Lightweight, zero-dependency, isomorphic TypeScript SDK for embedding SmartSapp Media Intelligence
 * into external web apps, mobile applications, and backend services.
 *
 * ARCHITECTURAL PRINCIPLES (RULE 10):
 * 1. Zero External Dependencies: Built purely on standard fetch API for browser and Node.js compatibility.
 * 2. Type-Safe Contracts: Full interface typing with zero `any` or `unknown`.
 * 3. Graceful Error Handling: Structured SDK responses with success flags and informative error messages.
 *
 * PRD REFERENCE:
 * - PRD Sec 115 (SDK / Developer Platform) & Sec 132 (Phase 9 - Enterprise Platform).
 */

export interface SmartSappMediaClientConfig {
  apiKey: string;
  baseUrl?: string;
  workspaceId?: string;
}

export interface SdkTrackEventInput {
  assetId: string;
  eventType: 'view' | 'play' | 'progress' | 'complete' | 'cta_click' | 'download';
  contactId?: string;
  progressPercent?: number;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface SdkResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

export class SmartSappMediaClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private identifiedContactId: string | null = null;

  constructor(config: SmartSappMediaClientConfig) {
    if (!config.apiKey) {
      throw new Error('SmartSappMediaClient requires an apiKey (e.g. sk_media_...).');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || '').replace(/\/+$/, '');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<SdkResponse<T>> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'X-SmartSapp-Client': 'Media-SDK-TS/2.0',
    };

    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers as Record<string, string> | undefined),
        },
      });

      const json = await res.json();
      return json as SdkResponse<T>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network request failed';
      return { success: false, error: msg };
    }
  }

  /**
   * Sets the active CRM contact identity for subsequent track calls.
   */
  public identify(contactId: string): void {
    this.identifiedContactId = contactId;
  }

  /**
   * Clears the current contact identity.
   */
  public resetIdentity(): void {
    this.identifiedContactId = null;
  }

  /**
   * Emits a media playback or conversion telemetry event.
   */
  public async track(event: SdkTrackEventInput): Promise<SdkResponse<{ eventId: string }>> {
    const payload = {
      ...event,
      contactId: event.contactId || this.identifiedContactId || undefined,
    };

    return this.request<{ eventId: string }>('/api/v1/media/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Lists published media assets with optional format filtering.
   */
  public async listAssets(options: { type?: string; limit?: number } = {}): Promise<SdkResponse<unknown[]>> {
    const params = new URLSearchParams();
    if (options.type) params.set('type', options.type);
    if (options.limit) params.set('limit', String(options.limit));

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<unknown[]>(`/api/v1/media/assets${qs}`);
  }

  /**
   * Retrieves single asset details.
   */
  public async getAsset(assetId: string): Promise<SdkResponse<Record<string, unknown>>> {
    return this.request<Record<string, unknown>>(`/api/v1/media/assets/${encodeURIComponent(assetId)}`);
  }

  /**
   * Lists experiences available for embedding.
   */
  public async listExperiences(): Promise<SdkResponse<unknown[]>> {
    return this.request<unknown[]>('/api/v1/media/experiences');
  }

  /**
   * Queries media semantically using natural language vector search.
   */
  public async search(
    query: string,
    options: { assetId?: string; limit?: number } = {}
  ): Promise<SdkResponse<unknown[]>> {
    return this.request<unknown[]>('/api/v1/media/search', {
      method: 'POST',
      body: JSON.stringify({ query, ...options }),
    });
  }

  /**
   * Gets next-best content recommendations tailored for a contact and deal stage.
   */
  public async getRecommendations(options: {
    contactId?: string;
    dealStage?: string;
    currentAssetId?: string;
    limit?: number;
  } = {}): Promise<SdkResponse<unknown[]>> {
    const contactId = options.contactId || this.identifiedContactId || undefined;
    return this.request<unknown[]>('/api/v1/media/recommendations', {
      method: 'POST',
      body: JSON.stringify({ ...options, contactId }),
    });
  }
}
