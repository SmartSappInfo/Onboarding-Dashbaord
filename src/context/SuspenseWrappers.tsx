'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { GlobalFilterProvider } from './GlobalFilterProvider';
import { TenantProvider } from './TenantContext';
import { PerspectiveProvider } from './PerspectiveContext';

// Loading fallback for context providers
function ContextLoadingFallback() {
  return (
    <div className="min-h-screen w-full bg-background" suppressHydrationWarning />
  );
}

// Suspense wrapper for GlobalFilterProvider
export function SuspenseGlobalFilterProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ContextLoadingFallback />}>
      <GlobalFilterProvider>{children}</GlobalFilterProvider>
    </Suspense>
  );
}

// Suspense wrapper for TenantProvider
export function SuspenseTenantProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ContextLoadingFallback />}>
      <TenantProvider>{children}</TenantProvider>
    </Suspense>
  );
}

// Suspense wrapper for PerspectiveProvider
export function SuspensePerspectiveProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ContextLoadingFallback />}>
      <PerspectiveProvider>{children}</PerspectiveProvider>
    </Suspense>
  );
}