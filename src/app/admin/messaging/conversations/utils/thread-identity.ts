/**
 * SmartSapp Messaging Hub — Multi-Tier Identity Resolver
 *
 * Scans message thread history to accurately extract contact name, institution name,
 * phone, email, and verified Firestore entity document ID.
 *
 * In accordance with Rule 4: Zero any or any[].
 * In accordance with Rule 21: Graceful degradation for ad-hoc / unlinked contacts.
 */

import type { MessageLog } from '@/lib/types';

export interface ThreadIdentity {
  contactName: string;
  institutionName: string;
  email: string | null;
  phone: string | null;
  realEntityId: string | null;
}

/**
 * Capitalizes names and converts snake_case, dot, or dash-separated strings into human names.
 */
function formatHumanName(raw: string): string {
  const cleaned = raw.replace(/[._\-+]/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function extractThreadIdentity(messages: MessageLog[]): ThreadIdentity {
  let contactName = '';
  let institutionName = '';
  let email: string | null = null;
  let phone: string | null = null;
  let realEntityId: string | null = null;

  for (const msg of messages) {
    // 1. Discover Firestore Entity ID
    if (!realEntityId && msg.entityId && !msg.entityId.includes('@') && !msg.entityId.startsWith('+')) {
      realEntityId = msg.entityId;
    }

    // 2. Discover Recipient Channels
    if (!email && msg.recipient && msg.recipient.includes('@')) {
      email = msg.recipient.toLowerCase().trim();
    }
    if (!phone && msg.recipient && !msg.recipient.includes('@') && /^[+\d\s\-()]+$/.test(msg.recipient)) {
      phone = msg.recipient.trim();
    }

    // 3. Scan Variables
    const vars = (msg.variables || {}) as Record<string, unknown>;

    if (!contactName) {
      if (typeof vars.contact_name === 'string' && vars.contact_name.trim()) {
        contactName = vars.contact_name.trim();
      } else if (typeof vars.name === 'string' && vars.name.trim()) {
        contactName = vars.name.trim();
      } else if (typeof vars.recipient_name === 'string' && vars.recipient_name.trim()) {
        contactName = vars.recipient_name.trim();
      } else if (
        typeof vars.first_name === 'string' &&
        vars.first_name.trim()
      ) {
        const lastName = typeof vars.last_name === 'string' ? vars.last_name.trim() : '';
        contactName = `${vars.first_name.trim()} ${lastName}`.trim();
      } else if (typeof vars.student_name === 'string' && vars.student_name.trim()) {
        contactName = vars.student_name.trim();
      }
    }

    if (!institutionName) {
      if (typeof vars.institution === 'string' && vars.institution.trim()) {
        institutionName = vars.institution.trim();
      } else if (typeof vars.school === 'string' && vars.school.trim()) {
        institutionName = vars.school.trim();
      } else if (typeof vars.school_name === 'string' && vars.school_name.trim()) {
        institutionName = vars.school_name.trim();
      } else if (typeof vars.company === 'string' && vars.company.trim()) {
        institutionName = vars.company.trim();
      } else if (typeof vars.organization === 'string' && vars.organization.trim()) {
        institutionName = vars.organization.trim();
      }
    }

    if (!email && typeof vars.email === 'string' && vars.email.includes('@')) {
      email = vars.email.toLowerCase().trim();
    }

    if (!phone && typeof vars.phone === 'string' && vars.phone.trim()) {
      phone = vars.phone.trim();
    }

    // 4. Scan Log Denormalized Entity Fields
    if (!institutionName && typeof msg.entityName === 'string' && msg.entityName.trim()) {
      institutionName = msg.entityName.trim();
    }

    if (!contactName && typeof msg.displayName === 'string' && msg.displayName.trim()) {
      const candidate = msg.displayName.trim();
      // Only use displayName as contact name if it's not the same as institution or raw email
      if (candidate !== institutionName && !candidate.includes('@')) {
        contactName = candidate;
      } else if (!institutionName && !candidate.includes('@')) {
        institutionName = candidate;
      }
    }
  }

  // Graceful fallbacks
  if (!contactName) {
    if (email) {
      const usernamePart = email.split('@')[0].replace(/\d+$/, ''); // Strip trailing numbers e.g. "ackahrosline5" -> "ackahrosline"
      contactName = formatHumanName(usernamePart) || email;
    } else if (phone) {
      contactName = phone;
    } else {
      contactName = messages[0]?.recipient || 'Unknown Contact';
    }
  }

  return {
    contactName,
    institutionName: institutionName !== contactName ? institutionName : '',
    email,
    phone,
    realEntityId,
  };
}
