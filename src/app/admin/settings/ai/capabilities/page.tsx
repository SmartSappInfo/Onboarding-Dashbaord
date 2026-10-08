import * as React from 'react';
import type { Metadata } from 'next';
import { CapabilityRegistryClient } from './CapabilityRegistryClient';
import { canonicalCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';
import { getProgressiveDiscoveryService } from '@/platform/registry/discovery/progressive-discovery-service';
import type { CapabilityCatalogItem } from '@/platform/registry/contracts/registry-types';
import '@/platform/capabilities/registry/registry-capabilities';

/**
 * @fileOverview Capabilities Registry Server Page (/admin/settings/ai/capabilities) (Phase 15 Milestone 4 Task 6)
 *
 * Implements:
 * - Rule 4: Strict Typing Protocol (Zero any or any[]).
 * - Rule 7: Mobile-first responsive views, touch targets >= 44px.
 * - Rule 51: Next.js 15 Server Component with async data prefetching.
 * - Rule 69: Strangler Fig Invariant (Replaces legacy redirect with full backoffice registry console).
 */

export const metadata: Metadata = {
  title: 'Capabilities Registry | SmartSapp Backoffice',
  description:
    'Strategic backoffice asset catalog for platform tool capabilities, parameter schemas, and cryptographic drift verification.',
};

export const dynamic = 'force-dynamic';

export default async function CapabilitiesPage(): Promise<React.JSX.Element> {
  const service = getProgressiveDiscoveryService();
  const allCaps = canonicalCapabilityRegistryStore.list();

  const capabilities: CapabilityCatalogItem[] = [];
  for (const cap of allCaps) {
    const details = await service.getCapabilityDetails(cap.id);
    if (details) {
      capabilities.push(details);
    }
  }

  // Ensure pure plain JSON serializability across the Server -> Client Component boundary (RSC Invariant)
  const plainCapabilities = JSON.parse(JSON.stringify(capabilities)) as CapabilityCatalogItem[];

  return (
    <React.Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center p-8 text-muted-foreground text-sm font-mono">
          Loading Capabilities Registry...
        </div>
      }
    >
      <CapabilityRegistryClient initialCapabilities={plainCapabilities} />
    </React.Suspense>
  );
}
