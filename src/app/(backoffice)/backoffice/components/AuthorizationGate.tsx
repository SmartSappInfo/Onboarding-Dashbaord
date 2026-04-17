'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import { Shield, Loader2, XCircle } from 'lucide-react';
import { useBackoffice } from '../context/BackofficeProvider';

// ─────────────────────────────────────────────────
// Authorization Gate
// Blocks rendering until backoffice access is confirmed.
// Redirects unauthorized users to /admin.
// ─────────────────────────────────────────────────

export default function AuthorizationGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const { hasAccess, isLoading } = useBackoffice();
  const [status, setStatus] = React.useState<'checking' | 'granted' | 'denied'>('checking');

  React.useEffect(() => {
    if (isUserLoading || isLoading) return;

    if (!user) {
      setStatus('denied');
      const timer = setTimeout(() => router.push('/login'), 1500);
      return () => clearTimeout(timer);
    }

    if (!hasAccess) {
      setStatus('denied');
      const timer = setTimeout(() => router.push('/admin'), 2000);
      return () => clearTimeout(timer);
    }

    setStatus('granted');
  }, [isUserLoading, isLoading, user, hasAccess, router]);

  // Loading state
  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-xl shadow-emerald-500/20">
            <Shield className="h-8 w-8 text-foreground" />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
            <span className="text-sm font-semibold text-muted-foreground tracking-wide">
              Verifying access...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Denied state
  if (status === 'denied') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
          <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground mb-1">Access Denied</p>
            <p className="text-xs text-muted-foreground">
              You don&apos;t have permission to access the Control Plane.
            </p>
            <p className="text-xs text-slate-600 mt-2">Redirecting...</p>
          </div>
        </div>
      </div>
    );
  }

  // Granted — render children
  return <>{children}</>;
}
