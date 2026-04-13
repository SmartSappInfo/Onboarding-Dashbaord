'use client';

import * as React from 'react';
import { useFeatures } from '@/hooks/use-features';
import { AppFeatureId } from '@/lib/types';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface FeatureGuardProps {
  featureId: AppFeatureId;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * FeatureGuard protects routes and components based on active feature toggles.
 * If the specified feature is disabled (either at the Org or Workspace level),
 * it renders a fallback UI instead of the children.
 */
export function FeatureGuard({ featureId, children, fallback }: FeatureGuardProps) {
  const { isFeatureEnabled, isLoading } = useFeatures();

  // If features are still loading, you could show a spinner, 
  // but we'll just render nothing momentarily to avoid flicker.
  if (isLoading) return null;

  if (isFeatureEnabled(featureId)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in zoom-in duration-500">
      <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-destructive/5">
        <ShieldAlert className="w-10 h-10 text-destructive" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">Feature Disabled</h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
        This module is currently inactive for your workspace. Please contact your administrator if you believe this is an error or need access to this functionality.
      </p>
      <Button asChild variant="outline" className="rounded-xl font-bold">
        <Link href="/admin">Return to Dashboard</Link>
      </Button>
    </div>
  );
}
