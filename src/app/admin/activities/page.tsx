import GlobalActivityClient from '../activity/GlobalActivityClient';
import type { Metadata } from 'next';

/**
 * @fileOverview Legacy Activities Route Alias (Rule 1, Rule 69)
 *
 * Seamlessly wrappers the unified GlobalActivityClient to preserve 100% backward
 * compatibility for existing bookmarks, internal route links, and sidebar entries.
 */

export const metadata: Metadata = {
  title: 'Platform Audit Trail',
  description: 'Comprehensive chronological log of all user actions, system events, and interactions.',
};

// Force dynamic rendering since this page uses authentication and search params
export const dynamic = 'force-dynamic';

export default function ActivitiesPage() {
  return <GlobalActivityClient />;
}
