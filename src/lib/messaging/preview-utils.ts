/**
 * @fileOverview Centralized utility to resolve message preview snippets for conversation
 * lists, inbox widgets, and activity feeds without ever leaking raw HTML tags or styles.
 * 
 * Single Source of Truth for message snippet presentation:
 * - Email: Message title or subject is preferred. Strips any HTML tags or doc headers cleanly.
 * - SMS / WhatsApp: Plain text body is preferred, stripped of any HTML tags or markup.
 * 
 * Conforms to SmartSapp Engineering Protocols:
 * - Strict Typing: Zero `any` or `any[]`.
 * - No Raw HTML/CSS Leakage: Never display raw HTML tags, unescaped markup, or raw CSS blocks in the UI.
 * 
 * @testability src/lib/messaging/__tests__/preview-utils.test.ts
 */

import { toDisplayText } from '@/lib/utils/display-text';

export interface ResolveMessagePreviewOptions {
  channel?: string | null;
  title?: string | null;
  subject?: string | null;
  previewText?: string | null;
  body?: string | null;
  maxLength?: number;
}

/**
 * Resolves a clean, user-friendly plain-text preview snippet for a message.
 * Ensures the title/subject is prioritized for emails, text for SMS/WhatsApp,
 * and guarantees that no HTML tags (e.g. `<!DOCTYPE>`, `<head>`, `<style>`) leak into the UI.
 */
export function resolveMessagePreviewSnippet({
  channel,
  title,
  subject,
  previewText,
  body,
  maxLength = 120,
}: ResolveMessagePreviewOptions): string {
  const normalizedChannel = (channel ?? 'sms').toLowerCase();
  let snippet = '';

  if (normalizedChannel === 'email') {
    // For Email: the subject or title of the message suffices. Never leak HTML/DOCTYPE markup into text sinks.
    const candidate = subject?.trim() || title?.trim() || previewText?.trim();
    if (candidate) {
      snippet = toDisplayText(candidate);
    } else if (body) {
      // Fallback if no title or subject was provided: strip entire HTML body to plain text
      snippet = toDisplayText(body);
    }
    if (!snippet) {
      snippet = 'Email message';
    }
  } else {
    // For SMS & WhatsApp: the plain text of the message is preferred.
    if (body) {
      snippet = toDisplayText(body);
    }
    if (!snippet && (subject || title)) {
      snippet = toDisplayText(subject || title);
    }
    if (!snippet) {
      snippet = 'No message content';
    }
  }

  // Defense-in-depth: run through toDisplayText to guarantee no residual tags survive
  snippet = toDisplayText(snippet);

  if (maxLength > 0 && snippet.length > maxLength) {
    return snippet.slice(0, maxLength).trim();
  }

  return snippet;
}
