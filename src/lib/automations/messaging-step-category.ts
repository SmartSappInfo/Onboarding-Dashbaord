/**
 * @fileoverview Pure Channel Category Resolver Engine for Automation Messaging Steps.
 *
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Protocol):
 * 1. Single Source of Truth: All channel category resolution for step enabling/disabling,
 *    filtering, and statistics must strictly route through `getMessagingCategory`.
 * 2. Backward & Forward Compatibility: Normalizes both modern `SEND_MESSAGE` + `config.channel`
 *    nodes AND legacy direct node types (`DIRECT_SMS`, `SEND_EMAIL`, `SEND_WHATSAPP`).
 * 3. Strict Type Safety: Zero 'any' or 'any[]' typings permitted.
 */

export type MessagingStepCategory =
  | 'SMS'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'NOTIFICATION_IN_APP'
  | 'NOTIFICATION_PUSH'
  | 'ALERT'
  | 'CALL_CAMPAIGN'
  | 'OTHER';

export function getMessagingCategory(
  actionType?: string,
  channel?: string
): MessagingStepCategory {
  const type = (actionType || '').toUpperCase();
  const ch = (channel || '').toLowerCase();

  if (type === 'SEND_MESSAGE') {
    if (ch === 'sms') return 'SMS';
    if (ch === 'whatsapp') return 'WHATSAPP';
    return 'EMAIL'; // Default channel for SEND_MESSAGE when channel is email or unspecified
  }

  if (type === 'DIRECT_SMS' || type === 'SEND_SMS' || type === 'SEND_NOTIFICATION_SMS') {
    return 'SMS';
  }

  if (type === 'DIRECT_EMAIL' || type === 'SEND_EMAIL' || type === 'SEND_NOTIFICATION_EMAIL') {
    return 'EMAIL';
  }

  if (type === 'DIRECT_WHATSAPP' || type === 'SEND_WHATSAPP') {
    return 'WHATSAPP';
  }

  if (type === 'SEND_NOTIFICATION_IN_APP') return 'NOTIFICATION_IN_APP';
  if (type === 'SEND_NOTIFICATION_PUSH') return 'NOTIFICATION_PUSH';
  if (type === 'ALERT') return 'ALERT';
  if (type === 'ADD_TO_CALL_CAMPAIGN') return 'CALL_CAMPAIGN';

  return 'OTHER';
}

export function getMessagingCategoryLabel(category: MessagingStepCategory): string {
  switch (category) {
    case 'SMS':
      return 'SMS';
    case 'EMAIL':
      return 'Email';
    case 'WHATSAPP':
      return 'WhatsApp';
    case 'NOTIFICATION_IN_APP':
      return 'In-App Notification';
    case 'NOTIFICATION_PUSH':
      return 'Push Notification';
    case 'ALERT':
      return 'Alert';
    case 'CALL_CAMPAIGN':
      return 'Call Campaign';
    case 'OTHER':
    default:
      return 'Message';
  }
}
