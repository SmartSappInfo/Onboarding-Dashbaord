'use client';

import * as React from 'react';
import {
  Building2,
  Layers,
  Users,
  Database,
  AlertTriangle,
  Clock,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, getCountFromServer, where } from 'firebase/firestore';

// ─────────────────────────────────────────────────
// Platform Dashboard
// Shows aggregate health metrics across all orgs/workspaces.
// ─────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color: 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'slate';
  isLoading?: boolean;
}

const colorMap = {
  emerald: {
    bg: 'bg-emerald-500/10',
    icon: 'text-emerald-400',
    glow: 'shadow-emerald-500/5',
  },
  blue: {
    bg: 'bg-blue-500/10',
    icon: 'text-blue-400',
    glow: 'shadow-blue-500/5',
  },
  amber: {
    bg: 'bg-amber-500/10',
    icon: 'text-amber-400',
    glow: 'shadow-amber-500/5',
  },
  red: {
    bg: 'bg-red-500/10',
    icon: 'text-red-400',
    glow: 'shadow-red-500/5',
  },
  purple: {
    bg: 'bg-purple-500/10',
    icon: 'text-purple-400',
    glow: 'shadow-purple-500/5',
  },
  slate: {
    bg: 'bg-slate-500/10',
    icon: 'text-muted-foreground',
    glow: 'shadow-slate-500/5',
  },
};

function StatCard({ label, value, icon: Icon, trend, color, isLoading }: StatCardProps) {
  const colors = colorMap[color];

  return (
    <div
      className={`relative rounded-2xl border border-border bg-muted/50 p-5 
        hover:border-border transition-all duration-200 shadow-xl ${colors.glow}
        group cursor-default`}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            {label}
          </span>
          {isLoading ? (
            <div className="h-8 w-20 bg-accent rounded-lg animate-pulse mt-1" />
          ) : (
            <span className="text-2xl font-bold text-foreground tracking-tight">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
          )}
          {trend ? (
            <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </span>
          ) : null}
        </div>
        <div className={`h-10 w-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${colors.icon}`} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardClient() {
  const firestore = useFirestore();
  const [stats, setStats] = React.useState({
    orgs: 0,
    workspaces: 0,
    users: 0,
    entities: 0,
    failedJobs: 0,
    pendingJobs: 0,
    recentAudit: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore) return;

    async function loadStats() {
      try {
        // Parallel fetch all counts (async-parallel)
        const [orgsSnap, workspacesSnap, usersSnap, entitiesSnap] = await Promise.all([
          getCountFromServer(query(collection(firestore!, 'organizations'))),
          getCountFromServer(query(collection(firestore!, 'workspaces'))),
          getCountFromServer(query(collection(firestore!, 'users'))),
          getCountFromServer(query(collection(firestore!, 'entities'))),
        ]);

        setStats({
          orgs: orgsSnap.data().count,
          workspaces: workspacesSnap.data().count,
          users: usersSnap.data().count,
          entities: entitiesSnap.data().count,
          failedJobs: 0,  // Will connect to platform_jobs in Phase 6
          pendingJobs: 0,
          recentAudit: 0,
        });
      } catch (error) {
        console.error('[BACKOFFICE_DASHBOARD] Failed to load stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadStats();
  }, [firestore]);

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Platform Overview
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time health metrics across all organizations and workspaces.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Organizations"
          value={stats.orgs}
          icon={Building2}
          color="emerald"
          isLoading={isLoading}
        />
        <StatCard
          label="Workspaces"
          value={stats.workspaces}
          icon={Layers}
          color="blue"
          isLoading={isLoading}
        />
        <StatCard
          label="Total Users"
          value={stats.users}
          icon={Users}
          color="purple"
          isLoading={isLoading}
        />
        <StatCard
          label="Total Entities"
          value={stats.entities}
          icon={Database}
          color="slate"
          isLoading={isLoading}
        />
      </div>

      {/* Operations Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Failed Jobs"
          value={stats.failedJobs}
          icon={AlertTriangle}
          color="red"
          isLoading={isLoading}
        />
        <StatCard
          label="Pending Jobs"
          value={stats.pendingJobs}
          icon={Clock}
          color="amber"
          isLoading={isLoading}
        />
        <StatCard
          label="Audit Actions (24h)"
          value={stats.recentAudit}
          icon={Activity}
          color="emerald"
          isLoading={isLoading}
        />
      </div>

      {/* Placeholder sections for future widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-muted/50 p-6 min-h-[200px]">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            Feature Rollout Progress
          </h3>
          <p className="text-xs text-slate-600">
            Feature flag rollout visualization will appear here in Phase 2.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/50 p-6 min-h-[200px]">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            Recent Platform Activity
          </h3>
          <p className="text-xs text-slate-600">
            Audit log stream will appear here in Phase 7.
          </p>
        </div>
      </div>
    </div>
  );
}
