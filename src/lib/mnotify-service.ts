
'use server';

/**
 * @fileOverview Server-side service for interacting with mNotify BMS API v2.0.
 * Follows functional patterns and handles data normalization for the Ghana SMS gateway.
 */

const BASE_URL = 'https://api.mnotify.com/api';
const API_KEY = process.env.MNOTIFY_API_KEY;

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

/**
 * Core request handler for mNotify API.
 */
async function mNotifyRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: any) {
  if (!API_KEY) throw new Error("MNOTIFY_API_KEY is not configured.");

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.append('key', API_KEY);

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), options);
  const data = await response.json();

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

  return mNotifyRequest('/sms/quick', 'POST', payload);
}

/**
 * Registers a new Alphanumeric Sender ID.
 */
export async function registerSenderId(sender_name: string, purpose: string) {
  return mNotifyRequest('/senderid/register', 'POST', {
    sender_name: sender_name.substring(0, 11),
    purpose
  });
}

/**
 * Checks the approval status of a Sender ID.
 */
export async function getSenderIdStatus(sender_name: string) {
  return mNotifyRequest('/senderid/status', 'POST', {
    sender_name: sender_name.substring(0, 11)
  });
}

/**
 * Retrieves the current SMS credit balance.
 */
export async function getSmsBalance() {
  const data = await mNotifyRequest('/balance/sms', 'GET');
  return data.balance;
}

/**
 * Retrieves all currently scheduled SMS jobs.
 */
export async function getScheduledMessages() {
  return mNotifyRequest('/scheduled', 'GET');
}

/**
 * Updates a specific scheduled SMS message.
 */
export async function updateScheduledSms(id: string, message: string, scheduleDate: Date, sender: string) {
  return mNotifyRequest(`/scheduled/${id}`, 'POST', {
    sender: sender.substring(0, 11),
    message,
    schedule_date: formatNotifyDate(scheduleDate)
  });
}

/**
 * Deletes a scheduled SMS message.
 */
export async function deleteScheduledSms(id: string) {
    return mNotifyRequest(`/scheduled/${id}`, 'DELETE');
}

/**
 * Retrieves SMS account metrics for a given date range.
 */
export async function getSmsMetrics(from: string, to: string) {
  return mNotifyRequest(`/report?from=${from}&to=${to}`, 'GET');
}

/**
 * Retrieves the delivery status of a single SMS.
 */
export async function getSmsStatus(providerId: string) {
  return mNotifyRequest(`/status/${providerId}`, 'GET');
}
