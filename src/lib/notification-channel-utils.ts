/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Pure notification channel utilities decoupled from Server Actions ('use server').
 * Normalizes multi-channel and legacy channel string configurations into an active channel set.
 */

export function resolveActiveChannels(
  channelOrOptions?: string | { channels?: Array<'email' | 'sms' | 'whatsapp'>; channel?: string },
  explicitChannels?: Array<'email' | 'sms' | 'whatsapp'>
): Array<'email' | 'sms' | 'whatsapp'> {
  const result = new Set<'email' | 'sms' | 'whatsapp'>();

  let ch: string | undefined;
  let channelsList: Array<'email' | 'sms' | 'whatsapp'> | undefined =
    (typeof channelOrOptions === 'object' && channelOrOptions !== null ? channelOrOptions.channels : undefined) || explicitChannels;

  if (typeof channelOrOptions === 'object' && channelOrOptions !== null) {
    ch = channelOrOptions.channel;
  } else if (typeof channelOrOptions === 'string') {
    ch = channelOrOptions;
  }

  if (Array.isArray(channelsList) && channelsList.length > 0) {
    channelsList.forEach((c) => {
      if (c === 'email' || c === 'sms' || c === 'whatsapp') result.add(c);
    });
    if (result.size > 0) return Array.from(result);
  }

  if (!ch) return [];

  if (ch === 'all') {
    result.add('email');
    result.add('sms');
    result.add('whatsapp');
  } else if (ch === 'both') {
    result.add('email');
    result.add('sms');
  } else if (ch === 'email') {
    result.add('email');
  } else if (ch === 'sms') {
    result.add('sms');
  } else if (ch === 'whatsapp') {
    result.add('whatsapp');
  }

  return Array.from(result);
}
