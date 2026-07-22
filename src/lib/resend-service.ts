import fs from 'fs';
import path from 'path';

/**
 * @fileOverview Server-side service for interacting with the Resend Email API.
 * Follows functional patterns and avoids classes per airules.md.
 */

const BASE_URL = 'https://api.resend.com';

export function loadEnvFallback(key: string): string | undefined {
  try {
    if (process.env[key]) return process.env[key];

    const files = ['.env.local', '.env'];
    for (const file of files) {
      const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`));
          if (match) {
            let val = match[1].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            return val;
          }
        }
      }
    }
  } catch (e) {
    console.warn(`[ENV-FALLBACK] Failed to read environment files for ${key}:`, (e as Error).message);
  }
  return undefined;
}

const getApiKey = () => loadEnvFallback('RESEND_API_KEY');
const getDomain = () => loadEnvFallback('RESEND_DOMAIN') || 'smartsapp.com';

export interface EmailAttachment {
  content: string; // Base64 string
  filename: string;
  type?: string; // Mime type
}

export interface ResendResponse {
  id?: string;
  message?: string;
  data?: unknown;
  last_event?: string;
  status?: string | number;
}

export interface BatchEmailItem {
  id: string;
}

export interface BatchEmailsResponse {
  data?: BatchEmailItem[];
  error?: string;
}

let lastResendCallTimestamp = 0;
const RESEND_MIN_INTERVAL_MS = 135; // ~7.4 requests per second max per process to stay strictly under Resend's 10 req/s limit

async function throttleResendCall(): Promise<void> {
  const now = Date.now();
  const timeSinceLast = now - lastResendCallTimestamp;
  if (timeSinceLast < RESEND_MIN_INTERVAL_MS) {
    const waitMs = RESEND_MIN_INTERVAL_MS - timeSinceLast;
    lastResendCallTimestamp = now + waitMs;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  } else {
    lastResendCallTimestamp = now;
  }
}

/**
 * Core request handler for Resend API using native fetch.
 */
async function resendRequest(
  endpoint: string, 
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE', 
  body?: unknown,
  apiKeyOverride?: string,
  maxRetries = 8,
  initialDelayMs = 1000
): Promise<ResendResponse> {
  const apiKey = apiKeyOverride || getApiKey();
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  let attempt = 0;
  while (true) {
    await throttleResendCall();

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    
    let data: ResendResponse = {};
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = (await response.json()) as ResendResponse;
      } catch (e) {
        console.warn('[RESEND] Failed to parse JSON response:', (e as Error).message);
      }
    } else {
      try {
        const text = await response.text();
        if (text) {
          data = { message: text };
        }
      } catch (e) {
        // Ignore text read error
      }
    }

    if (!response.ok) {
      const status = response.status;
      // Handle 429 Too Many Requests and 5xx Server Errors with exponential backoff & full jitter
      if ((status === 429 || status >= 500) && attempt < maxRetries) {
        attempt++;
        let delayMs = 0;

        // Check if provider supplied Retry-After or RateLimit-Reset header
        const retryAfterHeader = response.headers.get('retry-after') || response.headers.get('ratelimit-reset');
        if (retryAfterHeader) {
          const parsedHeader = parseFloat(retryAfterHeader);
          if (!isNaN(parsedHeader) && parsedHeader > 0) {
            delayMs = parsedHeader > 1000000000 ? Math.max(200, parsedHeader - Date.now()) : parsedHeader * 1000;
          }
        }

        if (!delayMs || delayMs <= 0) {
          // Exponential backoff with full randomized jitter: 1s, 2s, 4s, 8s, 16s
          const baseBackoff = Math.min(16000, initialDelayMs * Math.pow(2, attempt));
          delayMs = Math.round(baseBackoff * (0.75 + Math.random() * 0.5));
        }

        console.warn(`[RESEND] Rate limit or server error (${status}), attempt ${attempt}/${maxRetries}. Backing off for ${Math.round(delayMs)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue; // Retry
      }

      const errorMsg = data?.message || `Resend API Error: ${response.statusText} (${status})`;
      const error = new Error(errorMsg) as Error & { status?: number; name?: string };
      error.status = status;
      error.name = (data as Record<string, unknown>)?.name as string || 'ResendError';
      throw error;
    }

    return data;
  }
}

export interface ResendTag {
  name: string;
  value: string;
}

/**
 * Sends an email or schedules one for later.
 */
export async function sendEmail(params: {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  scheduledAt?: string;
  tags?: ResendTag[];
  apiKey?: string;
  domain?: string;
  headers?: Record<string, string>;
}) {
  const domain = params.domain || getDomain();
  const payload: Record<string, unknown> = {
    from: params.from || `SmartSapp <notifications@${domain}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments,
    scheduled_at: params.scheduledAt,
    tags: params.tags,
  };

  if (params.headers) {
    payload.headers = params.headers;
  }

  return resendRequest('/emails', 'POST', payload, params.apiKey);
}

export async function sendBatchEmails(
  emails: { 
    from?: string; 
    to: string | string[]; 
    subject: string; 
    html: string; 
    attachments?: EmailAttachment[];
    scheduledAt?: string;
    tags?: ResendTag[];
    headers?: Record<string, string>;
  }[],
  apiKey?: string,
  domain?: string
): Promise<BatchEmailsResponse> {
  const defaultDomain = domain || getDomain();
  const payload = emails.map(email => ({
    from: email.from || `SmartSapp <notifications@${defaultDomain}>`,
    to: email.to,
    subject: email.subject,
    html: email.html,
    attachments: email.attachments,
    scheduled_at: email.scheduledAt,
    tags: email.tags,
    headers: email.headers,
  }));

  // Chunk payload into groups of 150 (Resend API limit)
  const results: ResendResponse[] = [];
  try {
    for (let i = 0; i < payload.length; i += 150) {
      const chunk = payload.slice(i, i + 150);
      const result = await resendRequest('/emails/batch', 'POST', chunk, apiKey);
      results.push(result);
    }
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  }

  // Combine results into a single BatchEmailsResponse
  const combinedData: BatchEmailItem[] = [];
  
  for (const res of results) {
    if (res && res.data && Array.isArray(res.data)) {
      for (const item of res.data) {
        if (item && typeof item === 'object' && 'id' in item) {
          combinedData.push({ id: String(item.id) });
        }
      }
    } else if (res && Array.isArray(res)) {
      for (const item of res) {
        if (item && typeof item === 'object' && 'id' in item) {
          combinedData.push({ id: String(item.id) });
        }
      }
    }
  }

  return {
    data: combinedData
  };
}

/**
 * Retrieves the status and details of a single email.
 */
export async function getEmail(id: string, apiKey?: string) {
  return resendRequest(`/emails/${id}`, 'GET', undefined, apiKey);
}

/**
 * Updates a scheduled email.
 */
export async function updateScheduledEmail(
  id: string, 
  params: { subject?: string; html?: string; scheduledAt?: string },
  apiKey?: string
) {
  const payload = {
    subject: params.subject,
    html: params.html,
    scheduled_at: params.scheduledAt,
  };
  return resendRequest(`/emails/${id}`, 'PATCH', payload, apiKey);
}

/**
 * Cancels a scheduled email dispatch.
 */
export async function cancelEmail(id: string, apiKey?: string) {
  return resendRequest(`/emails/${id}/cancel`, 'POST', undefined, apiKey);
}

/**
 * Lists verified domains to ensure from addresses are valid.
 */
export async function getVerifiedDomains(apiKey?: string) {
  return resendRequest('/domains', 'GET', undefined, apiKey);
}
