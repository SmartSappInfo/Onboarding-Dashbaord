/**
 * @fileOverview Single source of truth for per-channel behavior.
 *
 * Channel logic was previously an `if/else` ladder of `=== 'email' ? : 'sms'`
 * ternaries duplicated across ~90 files (spec §3C). Adding a channel meant
 * hunting every site — the root cause of the silent-misroute bugs F1/F2 and the
 * exhaustiveness drift F4. Consumers now read this registry instead of branching
 * inline, and {@link assertNever} forces the compiler to flag any future channel
 * that a `switch` forgets to handle.
 *
 * This module is pure (no I/O) and safe to import from client or server.
 */

import type { MessageChannel } from '@/lib/types';

export interface ChannelMeta {
  key: MessageChannel;
  /** Human-facing label. */
  label: string;
  /** Which contact field carries the recipient address for this channel. */
  recipientField: 'email' | 'phone' | 'userId';
  /**
   * Key used by the suppression service. `null` for channels that are not
   * subject to opt-out suppression (in-app, push).
   */
  suppressionKey: 'email' | 'sms' | 'whatsapp' | null;
  /** Whether free-form (non-template) content is allowed. */
  supportsFreeform: boolean;
  /** True for channels delivering to an external contact address (email/sms/whatsapp). */
  isContactChannel: boolean;
}

export const CHANNEL_REGISTRY: Record<MessageChannel, ChannelMeta> = {
  email: {
    key: 'email',
    label: 'Email',
    recipientField: 'email',
    suppressionKey: 'email',
    supportsFreeform: true,
    isContactChannel: true,
  },
  sms: {
    key: 'sms',
    label: 'SMS',
    recipientField: 'phone',
    suppressionKey: 'sms',
    supportsFreeform: true,
    isContactChannel: true,
  },
  whatsapp: {
    key: 'whatsapp',
    label: 'WhatsApp',
    recipientField: 'phone',
    suppressionKey: 'whatsapp',
    // Free-form is only allowed inside an open 24h session; the engine enforces
    // that at send time. Outside a session, an approved template is required.
    supportsFreeform: true,
    isContactChannel: true,
  },
  in_app: {
    key: 'in_app',
    label: 'In-App',
    recipientField: 'userId',
    suppressionKey: null,
    supportsFreeform: true,
    isContactChannel: false,
  },
  push: {
    key: 'push',
    label: 'Push',
    recipientField: 'userId',
    suppressionKey: null,
    supportsFreeform: true,
    isContactChannel: false,
  },
};

/** All known channels, derived from the registry. */
export const ALL_CHANNELS = Object.keys(CHANNEL_REGISTRY) as MessageChannel[];

/** Look up channel metadata, throwing on an unknown channel. */
export function getChannelMeta(channel: MessageChannel): ChannelMeta {
  const meta = CHANNEL_REGISTRY[channel];
  if (!meta) {
    throw new Error(`[channel-registry] Unknown channel '${channel}'.`);
  }
  return meta;
}

/**
 * Map any channel to the `'email' | 'sms'` value that contact-resolution helpers
 * (e.g. `resolveRecipientContacts`) expect: 'email' picks the email field,
 * anything else picks the phone field. Preserves the legacy
 * `channel === 'email' ? 'email' : 'sms'` behavior while making WhatsApp (phone)
 * correct by construction.
 */
export function contactResolutionChannel(channel: MessageChannel): 'email' | 'sms' {
  return getChannelMeta(channel).recipientField === 'email' ? 'email' : 'sms';
}

/**
 * Exhaustiveness guard. Place in the `default`/`else` of a channel `switch` so
 * the compiler errors when a new `MessageChannel` member is added but unhandled.
 */
export function assertNever(value: never, context = 'value'): never {
  throw new Error(`[channel-registry] Unhandled ${context}: ${JSON.stringify(value)}`);
}
