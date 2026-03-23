'use client';

import AutomationsClient from './AutomationsClient';

// Force dynamic rendering - required because parent layout uses useSearchParams
export const dynamic = 'force-dynamic';

/**
 * @fileOverview Automation Hub Entry Point.
 * Displays the registry of active blueprints and the execution ledger.
 */
export default function AutomationsPage() {
  return <AutomationsClient />;
}
