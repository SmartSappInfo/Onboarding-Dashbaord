'use client';

import * as React from 'react';
import { useFeatures } from '@/hooks/use-features';
import { usePermissions } from '@/hooks/use-permissions';
import { AppFeatureId } from '@/lib/types';
import { featureToCoordinates } from '@/lib/permissions-engine';
import { ShieldAlert, Lock } from 'lucide-react';
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
  const { isFeatureEnabled, isLoading: isFeaturesLoading } = useFeatures();
  const { can, isSystemAdmin, isLoading: isPermissionsLoading } = usePermissions();

  const isLoading = isFeaturesLoading || isPermissionsLoading;

  // If loading, render nothing momentarily to avoid flicker.
  if (isLoading) return null;

  // 1. Check Global Feature Switch (Org/Workspace Level)
  const featureActive = isFeatureEnabled(featureId);
  
  // 2. Check User-Specific Permission (RBAC Level)
  const coords = featureToCoordinates[featureId];
  const permissionGranted = coords ? can(coords.section, coords.feature, 'view') : true;

  // Rule: Feature must be active AND user must have permission (unless System Admin)
  const isAllowed = featureActive && (permissionGranted || isSystemAdmin);

  if (isAllowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Determine why it's blocked for the message
  const isPermissionIssue = featureActive && !permissionGranted;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in zoom-in duration-500">
      <div className={cn(
        "w-20 h-20 rounded-full flex items-center justify-center mb-6 ring-8",
        isPermissionIssue ? "bg-amber-500/10 ring-amber-500/5" : "bg-destructive/10 ring-destructive/5"
      )}>
        {isPermissionIssue ? (
          <Lock className="w-10 h-10 text-amber-600" />
        ) : (
          <ShieldAlert className="w-10 h-10 text-destructive" />
        )}
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">
        {isPermissionIssue ? "Access Restricted" : "Feature Disabled"}
      </h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed font-medium">
        {isPermissionIssue 
          ? "You do not have the required permissions to view this module. Please contact your administrator to request access."
          : "This module is currently inactive for your workspace. Please contact your administrator to enable it."
        }
      </p>
      <Button asChild variant="outline" className="rounded-xl font-extrabold px-8 border-2">
        <Link href="/admin">Return to Dashboard</Link>
      </Button>
    </div>
  );
}

// Helper to handle conditional classes since utils might not be imported yet or might be different
function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
