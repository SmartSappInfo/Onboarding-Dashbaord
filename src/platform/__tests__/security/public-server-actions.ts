/**
 * @fileOverview Server actions that are PUBLIC BY DESIGN (no signed-in identity required).
 *
 * Every entry needs a reason a reviewer can check. Adding an entry is a security decision: the action
 * must expose only what an anonymous visitor may see (published, minimal projection) and must never
 * write on behalf of an unverified identity. Keys are `repo/relative/file.ts#exportName`.
 */
export const PUBLIC_SERVER_ACTIONS: Readonly<Record<string, string>> = {
  'src/app/actions/commerce-actions.ts#joinPortalWaitlistAction':
    'Pre-launch waitlist sign-up for anonymous visitors; organization taken from the portal, not the caller.',
  'src/app/actions/commerce-actions.ts#validateCouponAction':
    'Checks a coupon code against an offer of the same portal; returns only validity and discount.',
  'src/app/actions/community-actions.ts#getMemberPublicProfileAction':
    'Public member profile card (display fields only).',
  'src/app/actions/credential-actions.ts#exportOpenBadgeAction':
    'Open Badges 3.0 export used by the public certificate verification page.',
  'src/app/actions/credential-actions.ts#verifyCertificateAction':
    'Public certificate verification by code. Follow-up: minimise recipientEmail (Round 4).',
  'src/app/actions/learning-actions.ts#getSanitizedAssessmentAction':
    'Assessment questions with correct answers stripped server-side.',
  'src/app/actions/membership-actions.ts#verifyInvitationTokenAction':
    'Checks an invitation token before sign-up; consumes nothing (acceptance is token + ID-token guarded).',
  'src/app/actions/portal-actions.ts#getPublicPortalBySlugAction':
    'Public portal shell by slug (published portals; public projection).',
  'src/app/actions/portal-actions.ts#validatePortalPasswordAction':
    'Password gate for password-protected portals; returns only pass/fail.',
};
