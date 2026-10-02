import GlobalActivityClient from './GlobalActivityClient';
import type { Metadata } from 'next';

/**
 * @fileOverview Global Activity & Audit Console Page Route (Phase 2 Milestone 3 - Task 6)
 *
 * Implements Rule 10 (Inline Architectural Documentation), Rule 47 (Multi-Tenant Isolation),
 * and Rule 61 (Operator Console).
 */

export const metadata: Metadata = {
  title: 'Global Activity & Audit Console',
  description: 'Unified real-time activity timeline, actor attribution, distributed tracing, and operator recovery tools.',
};

// Force dynamic rendering since this page utilizes active workspace context and live event streaming
export const dynamic = 'force-dynamic';

export default function GlobalActivityPage() {
  return <GlobalActivityClient />;
}
