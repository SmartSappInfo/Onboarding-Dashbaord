'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Deal } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useEntityResolver } from '@/context/EntityCacheContext';
import { useTerminology } from '@/hooks/use-terminology';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn, toTitleCase } from '@/lib/utils';
import { ArrowUp, ArrowDown, ChevronsUpDown, UserCircle2, Workflow } from 'lucide-react';
import type { KanbanFilters } from '../pipeline-types';
import { applyDealFilters } from '../utils/filter-deals';
import { getForecastUrgency } from '../utils/deal-urgency';

interface DealsListViewProps {
  pipelineId: string;
  filters: KanbanFilters;
}

type SortKey = 'name' | 'entity' | 'value' | 'forecast' | 'stage' | 'assignee' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_COLOR: Record<Deal['status'], string> = {
  open: '#3b82f6',
  won: '#10b981',
  lost: '#ef4444',
};

export default function DealsListView({ pipelineId, filters }: DealsListViewProps) {
  const firestore = useFirestore();
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const { assignedUserId } = useGlobalFilter();
  // Resolve only the entities referenced by the visible deals (names + tags),
  // not the whole workspace (Phase 5).
  const { entitiesById, resolveIds } = useEntityResolver();
  const { singular } = useTerminology();

  const [sort, setSort] = React.useState<{ key: SortKey; dir: SortDir }>({ key: 'forecast', dir: 'asc' });

  const dealsQuery = useMemoFirebase(
    () => (firestore && activeWorkspaceId ? query(
      collection(firestore, 'deals'),
      where('pipelineId', '==', pipelineId),
      where('workspaceId', '==', activeWorkspaceId)
    ) : null),
    [firestore, pipelineId, activeWorkspaceId]
  );
  const { data: deals, isLoading } = useCollection<Deal>(dealsQuery);

  // Resolve the entities referenced by the current deals (deduped + batched).
  React.useEffect(() => {
    const ids = (deals || []).map((d) => d.entityId).filter((x): x is string => !!x);
    if (ids.length > 0) resolveIds(ids);
  }, [deals, resolveIds]);

  const entityName = React.useCallback(
    (entityId: string) => entitiesById.get(entityId)?.displayName || 'Unknown',
    [entitiesById]
  );

  const getEntityTags = React.useCallback(
    (entityId: string) => entitiesById.get(entityId)?.workspaceTags ?? [],
    [entitiesById]
  );

  const filteredDeals = React.useMemo(
    () => applyDealFilters(deals || [], filters, assignedUserId, getEntityTags),
    [deals, filters, assignedUserId, getEntityTags]
  );

  const sortedDeals = React.useMemo(() => {
    const list = [...filteredDeals];
    const dir = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sort.key) {
        case 'name':
          return dir * (a.name || '').localeCompare(b.name || '');
        case 'entity':
          return dir * entityName(a.entityId).localeCompare(entityName(b.entityId));
        case 'value':
          return dir * ((a.value ?? 0) - (b.value ?? 0));
        case 'forecast':
          return dir * (getForecastUrgency(a.expectedCloseDate).sortWeight - getForecastUrgency(b.expectedCloseDate).sortWeight);
        case 'stage':
          return dir * (a.stageName || '').localeCompare(b.stageName || '');
        case 'assignee':
          return dir * (a.assignedTo?.name || '').localeCompare(b.assignedTo?.name || '');
        case 'status':
          return dir * (a.status || '').localeCompare(b.status || '');
        default:
          return 0;
      }
    });
    return list;
  }, [filteredDeals, sort, entityName]);

  const toggleSort = (key: SortKey) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' });
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (sortedDeals.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 opacity-10">
        <Workflow size={80} />
        <p className="font-semibold tracking-[0.3em] text-lg">No Deals</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto px-6 pb-10">
      <table className="w-full border-separate border-spacing-y-1.5 text-left">
        <thead className="sticky top-0 z-10 bg-background">
          <tr>
            <SortHeader label="Deal" sortKey="name" sort={sort} onSort={toggleSort} />
            <SortHeader label={singular} sortKey="entity" sort={sort} onSort={toggleSort} />
            <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Focal Contacts</th>
            <SortHeader label="Value" sortKey="value" sort={sort} onSort={toggleSort} align="right" />
            <SortHeader label="Forecast" sortKey="forecast" sort={sort} onSort={toggleSort} />
            <SortHeader label="Stage" sortKey="stage" sort={sort} onSort={toggleSort} />
            <SortHeader label="Assigned" sortKey="assignee" sort={sort} onSort={toggleSort} />
            <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
          </tr>
        </thead>
        <tbody>
          {sortedDeals.map(deal => {
            const urgency = getForecastUrgency(deal.expectedCloseDate);
            const focal = deal.focalContacts ?? [];
            const statusColor = STATUS_COLOR[deal.status];
            return (
              <tr
                key={deal.id}
                onClick={() => router.push(`/admin/deals/${deal.id}`)}
                className={cn(
                  "group cursor-pointer bg-card hover:bg-muted/40 transition-colors shadow-sm",
                  urgency.level === 'overdue' && "bg-destructive/[0.03]"
                )}
              >
                <td className="px-3 py-2.5 rounded-l-xl border-y border-l border-border">
                  <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{toTitleCase(deal.name || 'Unnamed Deal')}</span>
                </td>
                <td className="px-3 py-2.5 border-y border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground truncate">{entityName(deal.entityId)}</span>
                </td>
                <td className="px-3 py-2.5 border-y border-border">
                  {focal.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {focal.slice(0, 2).map(fc => (
                        <span key={fc.id} className="inline-flex items-center gap-1 bg-muted/60 rounded-full px-1.5 py-0.5 max-w-[110px]" title={fc.role ? `${fc.name} · ${fc.role}` : fc.name}>
                          <UserCircle2 className="h-2.5 w-2.5 shrink-0 text-primary/40" />
                          <span className="truncate text-[9px] font-semibold text-foreground/70">{fc.name}</span>
                        </span>
                      ))}
                      {focal.length > 2 && <span className="text-[9px] font-semibold text-muted-foreground">+{focal.length - 2}</span>}
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 border-y border-border text-right">
                  <span className="text-xs font-bold tabular-nums">${(deal.value || 0).toLocaleString()}</span>
                </td>
                <td className="px-3 py-2.5 border-y border-border">
                  <span className={cn("text-[11px] font-bold", urgency.colorClass)}>{urgency.label}</span>
                </td>
                <td className="px-3 py-2.5 border-y border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide truncate">{deal.stageName || '—'}</span>
                </td>
                <td className="px-3 py-2.5 border-y border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground truncate">{toTitleCase(deal.assignedTo?.name || 'Unassigned')}</span>
                </td>
                <td className="px-3 py-2.5 rounded-r-xl border-y border-r border-border">
                  <Badge
                    variant="outline"
                    className="h-5 text-[8px] font-bold border-none px-2 rounded-md uppercase tracking-wider"
                    style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
                  >
                    {deal.status}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-3 py-2", align === 'right' && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors",
          align === 'right' && "flex-row-reverse",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}
