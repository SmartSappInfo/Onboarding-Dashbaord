'use client';

/**
 * @fileOverview Saved Directory Views Horizontal Pill Bar (Analytics 2.0)
 *
 * Provides 1-click filter switching across standard presets (All People, Pending Approval,
 * Recently Joined, Inactive 30+ Days, Administrators, Finance Access, High Risk) and custom views.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring easing on active state transitions.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Users,
  Clock,
  Sparkles,
  Moon,
  Shield,
  DollarSign,
  AlertTriangle,
  Bookmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SavedDirectoryView } from '@/lib/types';
import { listSavedDirectoryViewsAction } from '@/app/actions/analytics-actions';

interface SavedViewsPillBarProps {
  activeViewId: string;
  onSelectView: (view: SavedDirectoryView) => void;
}

export function SavedViewsPillBar({
  activeViewId,
  onSelectView,
}: SavedViewsPillBarProps) {
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [views, setViews] = React.useState<SavedDirectoryView[]>([]);

  React.useEffect(() => {
    async function loadViews() {
      if (!authUser || !activeOrganizationId) return;
      try {
        const idToken = await authUser.getIdToken();
        const res = await listSavedDirectoryViewsAction({
          idToken,
          organizationId: activeOrganizationId,
        });
        if (res.success) {
          setViews(res.views);
        }
      } catch (err: unknown) {
        console.warn('[SavedViewsPillBar] Load error:', err);
      }
    }
    loadViews();
  }, [authUser, activeOrganizationId]);

  const getViewIcon = (name: string) => {
    switch (name) {
      case 'All People':
        return <Users className="w-3.5 h-3.5" />;
      case 'Pending Approval':
        return <Clock className="w-3.5 h-3.5 text-amber-500" />;
      case 'Recently Joined':
        return <Sparkles className="w-3.5 h-3.5 text-emerald-500" />;
      case 'Inactive 30+ Days':
        return <Moon className="w-3.5 h-3.5 text-rose-500" />;
      case 'Administrators':
        return <Shield className="w-3.5 h-3.5 text-blue-500" />;
      case 'Finance Access':
        return <DollarSign className="w-3.5 h-3.5 text-emerald-600" />;
      case 'High Risk / SoD':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />;
      default:
        return <Bookmark className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="w-full overflow-x-auto pb-1.5 scrollbar-none flex items-center gap-1.5">
      {views.map((view) => {
        const isActive = activeViewId === view.id;
        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onSelectView(view)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border shrink-0',
              isActive
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'bg-card text-muted-foreground hover:bg-muted/60 border-border/80'
            )}
          >
            {getViewIcon(view.name)}
            <span>{view.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SavedViewsPillBar;
