'use client';

import type { ReactNode } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { BackofficeProvider } from './context/BackofficeProvider';
import BackofficeSidebar from './components/BackofficeSidebar';
import BackofficeHeader from './components/BackofficeHeader';
import AuthorizationGate from './components/AuthorizationGate';

// ─────────────────────────────────────────────────
// Backoffice Layout Client
// Assembles the full control plane shell:
//   BackofficeProvider → AuthorizationGate → Sidebar + Header + Content
// ─────────────────────────────────────────────────

function BackofficeShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <BackofficeSidebar />
      <SidebarInset className="min-h-0 flex-1 flex flex-col overflow-hidden bg-card relative">
        {/* Subtle radial gradient accent */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(34,197,94,0.04),transparent_50%)] pointer-events-none" />
        <BackofficeHeader />
        <main className="flex-1 flex flex-col overflow-auto relative p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function BackofficeLayoutClient({ children }: { children: ReactNode }) {
  return (
    <BackofficeProvider>
      <AuthorizationGate>
        <BackofficeShell>{children}</BackofficeShell>
      </AuthorizationGate>
    </BackofficeProvider>
  );
}
