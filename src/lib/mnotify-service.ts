/**
 * @fileOverview Server-side service for interacting with mNotify BMS API v2.0.
 * Follows functional patterns and handles data normalization for the Ghana SMS gateway.
 */

import { loadEnvFallback } from './resend-service';

const BASE_URL = 'https://api.mnotify.com/api';
const getApiKey = () => loadEnvFallback('MNOTIFY_API_KEY');

/**
 * Normalizes a phone number to the Ghana 233 format required by mNotify.
 */
function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '233' + digits.substring(1);
  if (digits.length === 9) return '233' + digits;
  return digits;
}

/**
 * Formats a Date to YYYY-MM-DD hh:mm as required by mNotify.
 */
function formatNotifyDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface SmsReportItem {
  sent?: number;
  delivered?: number;
  failed?: number;
  date?: string;
}

export interface MNotifyResponse {
  status?: string | number;
  code?: string;
  message?: string;
  balance?: number;
  scheduled_messages?: unknown[];
  report?: SmsReportItem[];
  summary?: { _id?: string };
}

/**
 * Core request handler for mNotify API.
 */
async function mNotifyRequest(
  endpoint: string, 
  method: 'GET' | 'POST' | 'PUT' | 'DELETE', 
  body?: unknown,
  apiKeyOverride?: string
): Promise<MNotifyResponse> {
  const apiKey = apiKeyOverride || getApiKey();
  if (!apiKey) throw new Error("MNOTIFY_API_KEY is not configured.");

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.append('key', apiKey);

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), options);
  const data = (await response.json()) as MNotifyResponse;

  // mNotify returns status: 'success' or HTTP-like codes in the JSON
  if (data.status !== 'success' && data.status !== 200 && data.code !== 'success') {
    throw new Error(data.message || 'mNotify API Request Failed');
  }

  return data;
}

/**
 * Sends an immediate or scheduled SMS.
 */
export async function sendSms(params: {
  recipient: string | string[];
  message: string;
  sender: string;
  scheduleDate?: Date;
  apiKey?: string;
}) {
  const recipients = Array.isArray(params.recipient) 
    ? params.recipient.map(normalizePhoneNumber) 
    : [normalizePhoneNumber(params.recipient)];

  const payload = {
    recipient: recipients,
    sender: params.sender.substring(0, 11),
    message: params.message,
    is_schedule: !!params.scheduleDate,
    schedule_date: params.scheduleDate ? formatNotifyDate(params.scheduleDate) : "",
  };

  return mNotifyRequest('/sms/quick', 'POST', payload, params.apiKey);
}

/**
 * Registers a new Alphanumeric Sender ID.
 */
export async function registerSenderId(sender_name: string, purpose: string, apiKey?: string) {
  return mNotifyRequest('/senderid/register', 'POST', {
    sender_name: sender_name.substring(0, 11),
    purpose
  }, apiKey);
}

/**
 * Checks the approval status of a Sender ID.
 */
export async function getSenderIdStatus(sender_name: string, apiKey?: string) {
  return mNotifyRequest('/senderid/status', 'POST', {
    sender_name: sender_name.substring(0, 11)
  }, apiKey);
}

/**
 * Retrieves the current SMS credit balance.
 */
export async function getSmsBalance(apiKey?: string) {
  const data = await mNotifyRequest('/balance/sms', 'GET', undefined, apiKey);
  return data.balance;
}

/**
 * Retrieves all currently scheduled SMS jobs.
 */
export async function getScheduledMessages(apiKey?: string) {
  return mNotifyRequest('/scheduled', 'GET', undefined, apiKey);
}

/**
 * Updates a specific scheduled SMS message.
 */
export async function updateScheduledSms(id: string, message: string, scheduleDate: Date, sender: string, apiKey?: string) {
  return mNotifyRequest(`/scheduled/${id}`, 'POST', {
    sender: sender.substring(0, 11),
    message,
    schedule_date: formatNotifyDate(scheduleDate)
  }, apiKey);
}

/**
 * Deletes a scheduled SMS message.
 */
export async function deleteScheduledSms(id: string, apiKey?: string) {
    return mNotifyRequest(`/scheduled/${id}`, 'DELETE', undefined, apiKey);
}

/**
 * Retrieves SMS account metrics for a given date range.
 */
export async function getSmsMetrics(from: string, to: string, apiKey?: string) {
  return mNotifyRequest(`/report?from=${from}&to=${to}`, 'GET', undefined, apiKey);
}

/**
 * Retrieves the delivery status of a single SMS.
 */
export async function getSmsStatus(providerId: string, apiKey?: string) {
  return mNotifyRequest(`/status/${providerId}`, 'GET', undefined, apiKey);
}
