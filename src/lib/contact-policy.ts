import type { ContactIdentifierPolicy } from './types';

/**
 * Validates whether the provided contact identifiers satisfy the workspace's
 * contact identifier policy.
 *
 * Used by: bulk import wizard, new entity page, survey entity creation.
 */
export function validateContactIdentifier(
  phone: string | undefined | null,
  email: string | undefined | null,
  policy: ContactIdentifierPolicy = 'phone_or_email'
): { valid: boolean; reason?: string } {
  const hasPhone = !!phone?.trim();
  const hasEmail = !!email?.trim();

  switch (policy) {
    case 'phone_only':
      if (!hasPhone) {
        return { valid: false, reason: 'Phone number is required per workspace policy' };
      }
      return { valid: true };

    case 'email_only':
      if (!hasEmail) {
        return { valid: false, reason: 'Email address is required per workspace policy' };
      }
      return { valid: true };

    case 'phone_or_email':
    default:
      if (!hasPhone && !hasEmail) {
        return { valid: false, reason: 'Either a phone number or email address is required' };
      }
      return { valid: true };
  }
}

/**
 * Returns a human-readable label for the contact policy.
 */
export function getContactPolicyLabel(policy: ContactIdentifierPolicy): string {
  switch (policy) {
    case 'phone_only':
      return 'Phone Required';
    case 'email_only':
      return 'Email Required';
    case 'phone_or_email':
    default:
      return 'Phone or Email';
  }
}

/**
 * Returns the emoji icon for the contact policy.
 */
export function getContactPolicyIcon(policy: ContactIdentifierPolicy): string {
  switch (policy) {
    case 'phone_only':
      return '📱';
    case 'email_only':
      return '📧';
    case 'phone_or_email':
    default:
      return '📱📧';
  }
}
