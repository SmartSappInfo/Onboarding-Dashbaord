
'use server';

/**
 * @fileOverview Server-side service for interacting with the Resend Email API.
 * Follows functional patterns and avoids classes per airules.md.
 */

const BASE_URL = 'https://api.resend.com';
const API_KEY = process.env.RESEND_API_KEY;
const DOMAIN = process.env.RESEND_DOMAIN || 'enroll.smartsapp.com';

export interface EmailAttachment {
  content: string; // Base64 string
  filename: string;
  type?: string; // Mime type
}

/**
 * Core request handler for Resend API using native fetch.
 */
async function resendRequest(endpoint: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: any) {
  if (!API_KEY) throw new Error("RESEND_API_KEY is not configured.");

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Resend API Error: ${response.statusText}`);
  }

  return data;
}

/**
 * Sends an email or schedules one for later.
 * @param params Object containing recipient, subject, html, attachments, and optional scheduledAt.
 */
export async function sendEmail(params: {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  scheduledAt?: string; // ISO 8601 format
}) {
  const payload = {
    from: params.from || `SmartSapp <notifications@${DOMAIN}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments,
    scheduled_at: params.scheduledAt,
  };

  return resendRequest('/emails', 'POST', payload);
}

/**
 * Sends multiple emails in a single batch request for high performance.
 * @param emails Array of individual email objects.
 */
export async function sendBatchEmails(emails: { 
    from?: string; 
    to: string | string[]; 
    subject: string; 
    html: string; 
    attachments?: EmailAttachment[];
    scheduledAt?: string 
}[]) {
  const payload = emails.map(email => ({
    from: email.from || `SmartSapp <notifications@${DOMAIN}>`,
    to: email.to,
    subject: email.subject,
    html: email.html,
    attachments: email.attachments,
    scheduled_at: email.scheduledAt,
  }));

  return resendRequest('/emails/batch', 'POST', payload);
}

/**
 * Retrieves the status and details of a single email.
 */
export async function getEmail(id: string) {
  return resendRequest(`/emails/${id}`, 'GET');
}

/**
 * Updates a scheduled email.
 */
export async function updateScheduledEmail(id: string, params: { subject?: string; html?: string; scheduledAt?: string }) {
  const payload = {
    subject: params.subject,
    html: params.html,
    scheduled_at: params.scheduledAt,
  };
  return resendRequest(`/emails/${id}`, 'PATCH', payload);
}

/**
 * Cancels a scheduled email dispatch.
 */
export async function cancelEmail(id: string) {
  return resendRequest(`/emails/${id}/cancel`, 'POST');
}

/**
 * Lists verified domains to ensure from addresses are valid.
 */
export async function getVerifiedDomains() {
  return resendRequest('/domains', 'GET');
}
