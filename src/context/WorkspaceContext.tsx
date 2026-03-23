'use client';

import { useTenant } from './TenantContext';

/**
 * @fileOverview Backward compatibility proxy for Workspace Context.
 * All logic has been migrated to TenantContext.tsx. This hook now
 * redirects to useTenant() to prevent runtime errors in existing components.
 */

export function useWorkspace() {
  return useTenant();
}

/**
 * WorkspaceProvider is now a legacy stub. 
 * Use TenantProvider in src/app/admin/layout.tsx instead.
 */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
